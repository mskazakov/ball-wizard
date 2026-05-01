// src/waves.ts
// Система волн: спавн врагов, переходы между волнами, состояние победы.
// Машина состояний: spawning → fighting → between → spawning → ...
// При победе на финальной волне ставит state.runState = 'won'.
// Экспортирует: updateWaves — главная функция, вызывается раз за кадр.

import type { GameState, Grunt, Shooter, Rusher, Vec2 } from './utils/types';
import { getRandomBoonChoices } from './boons';

// --- Параметры волн ---

/** Количество врагов на каждой волне. Длина массива = MAX_WAVES. */
const ENEMIES_PER_WAVE = [5, 8, 12, 16, 22];

/** Максимальный номер волны. */
const MAX_WAVES = ENEMIES_PER_WAVE.length;

/** Пауза между волнами в мс. */
const BETWEEN_WAVE_DELAY_MS = 2000;

/** Запас спавна за пределами видимой области камеры. */
const SPAWN_OFFSCREEN_MARGIN = 100;

/** Сколько раз пробуем выбрать сторону камеры прежде чем перейти к fallback. */
const SPAWN_SIDE_ATTEMPTS = 4;

/**
 * Доля стрелков в волне. Каждая волна выбирает случайное число из этого диапазона:
 * 10–30% врагов — стрелки, остальное — грунты. Создаёт непредсказуемость.
 * Волна 1 — без стрелков (см. SHOOTERS_START_FROM_WAVE).
 */
const SHOOTER_FRACTION_MIN = 0.1;
const SHOOTER_FRACTION_MAX = 0.3;

/**
 * С какой волны стрелки начинают появляться. Волна 1 — только грунты,
 * чтобы первая волна оставалась чистым обучением базовой механике.
 */
const SHOOTERS_START_FROM_WAVE = 2;

/**
 * Доля рашеров в волне. Рашеры — быстрая контактная угроза, появляются
 * со случайной стороны. Доля выше чем у стрелков (стрелков 10-30%, рашеров
 * 15-25%) потому что они должны давать постоянное давление, не разовые
 * залпы. Меньше — игнорятся, больше — волна превращается в "только бегаешь".
 */
const RUSHER_FRACTION_MIN = 0.15;
const RUSHER_FRACTION_MAX = 0.25;

/**
 * С какой волны рашеры начинают появляться. Волна 1 — обучение грунтам,
 * волна 2 — стрелки, волна 3 — рашеры. Каждая волна добавляет одну новую
 * угрозу, чтобы игрок успевал освоить тип прежде чем встретить следующий.
 */
const RUSHERS_START_FROM_WAVE = 3;

// --- Параметры грунта ---
const GRUNT_RADIUS = 18;
const GRUNT_HP = 40;
const GRUNT_SPEED = 90;
const GRUNT_CONTACT_DAMAGE = 10;
/** Опыт за убийство грунта. Базовая массовка — мало xp. */
const GRUNT_XP_REWARD = 1;

// --- Параметры стрелка ---
const SHOOTER_RADIUS = 14;
const SHOOTER_HP = 30;
const SHOOTER_SPEED = 60;
/** Дистанция на которой стрелок предпочитает стоять и стрелять. */
const SHOOTER_IDEAL_DISTANCE = 350;
/** Если игрок ближе этой дистанции — стрелок отступает (кайтит). */
const SHOOTER_KEEP_DISTANCE = 250;
/** Опыт за убийство стрелка. Самая опасная цель → больше xp, поощряет приоритет. */
const SHOOTER_XP_REWARD = 3;

// --- Параметры рашера ---
const RUSHER_RADIUS = 12;
const RUSHER_HP = 15;
const RUSHER_SPEED = 220;
const RUSHER_CONTACT_DAMAGE = 15;
/**
 * Опыт за убийство рашера. Умирает с 2 шаров (быстрый фарм), но опасен —
 * 2 xp золотая середина: чуть выше грунта (1), но меньше стрелка (3),
 * чтобы рашер не стал лучшим способом фармить xp за счёт низкого HP.
 */
const RUSHER_XP_REWARD = 2;

/**
 * Главная функция системы волн. Вызывается раз за кадр из game.ts.
 */
export function updateWaves(state: GameState): void {
  const w = state.waves;

  switch (w.state) {
    case 'spawning':
      spawnWave(state);
      w.state = 'fighting';
      break;

    case 'fighting':
      if (state.enemies.length === 0) {
        // Если есть невыбранные левелапы — приоритет им, не победа и не таймер.
        // Игрок должен подтвердить все левелапы прежде чем игра двинется дальше.
        if (state.player.pendingLevelUps > 0) {
          enterLevelUp(state);
          // Не меняем w.state: остаёмся в 'fighting', чтобы confirmLevelUp
          // знал "это был финальный бой, ставь 'won' после последнего CONTINUE".
          // Если это не финальная волна — после confirmLevelUp вернёмся сюда,
          // и эта же ветка переведёт в 'between'.
        } else if (w.current >= MAX_WAVES) {
          state.runState = 'won';
        } else {
          w.state = 'between';
          w.betweenTimer = BETWEEN_WAVE_DELAY_MS;
        }
      }
      break;

    case 'between':
      // Между волнами: если есть невыбранные левелапы — пауза левелап-экраном,
      // таймер НЕ тикает. Это решение из дня 3 недели 2: левелап обязателен
      // для перехода к следующей волне (МВП правило "не выбрал апдейт — не идёшь").
      if (state.player.pendingLevelUps > 0) {
        enterLevelUp(state);
        break;
      }

      w.betweenTimer -= state.time.deltaTime;
      if (w.betweenTimer <= 0) {
        w.current += 1;
        w.state = 'spawning';
      }
      break;
  }
}

/**
 * Спавнит всех врагов текущей волны разом.
 * Состав:
 *   - стрелки (с волны SHOOTERS_START_FROM_WAVE): доля случайная в [SHOOTER_FRACTION_MIN, MAX]
 *   - рашеры (с волны RUSHERS_START_FROM_WAVE): доля случайная в [RUSHER_FRACTION_MIN, MAX]
 *   - остальное — грунты
 *
 * Доли считаются от total. Если на ранней волне сумма долей даёт 0 рашеров —
 * это нормально, так и задумано (плавное введение типов по волнам).
 *
 * ТЕХДОЛГ: постепенный спавн в течение волны.
 */
function spawnWave(state: GameState): void {
  const wave = state.waves.current;
  const total = ENEMIES_PER_WAVE[wave - 1];

  const shooterFraction =
    wave < SHOOTERS_START_FROM_WAVE
      ? 0
      : SHOOTER_FRACTION_MIN + Math.random() * (SHOOTER_FRACTION_MAX - SHOOTER_FRACTION_MIN);

  const rusherFraction =
    wave < RUSHERS_START_FROM_WAVE
      ? 0
      : RUSHER_FRACTION_MIN + Math.random() * (RUSHER_FRACTION_MAX - RUSHER_FRACTION_MIN);

  const shooterCount = Math.round(total * shooterFraction);
  const rusherCount = Math.round(total * rusherFraction);
  // Грунты — остаток. Math.max на случай если округление съело больше total.
  const gruntCount = Math.max(0, total - shooterCount - rusherCount);

  for (let i = 0; i < gruntCount; i++) {
    state.enemies.push(createGrunt(pickSpawnPosition(state)));
  }
  for (let i = 0; i < shooterCount; i++) {
    state.enemies.push(createShooter(state, pickSpawnPosition(state)));
  }
  for (let i = 0; i < rusherCount; i++) {
    state.enemies.push(createRusher(pickSpawnPosition(state)));
  }
}

/**
 * Выбирает точку спавна за пределами видимой камеры, но внутри арены.
 * Алгоритм: 4 случайные стороны → если все клампятся в кадр → fallback по расстоянию.
 */
function pickSpawnPosition(state: GameState): Vec2 {
  const sides = shuffledSides();

  for (let i = 0; i < SPAWN_SIDE_ATTEMPTS; i++) {
    const candidate = pickPositionOnSide(state, sides[i]);
    if (isOutsideCamera(state, candidate)) {
      return candidate;
    }
  }

  return pickFallbackPosition(state);
}

/** Случайная перестановка [0,1,2,3] = top/right/bottom/left. */
function shuffledSides(): number[] {
  const sides = [0, 1, 2, 3];
  for (let i = sides.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sides[i], sides[j]] = [sides[j], sides[i]];
  }
  return sides;
}

/**
 * Генерирует точку с указанной стороны камеры, со смещением SPAWN_OFFSCREEN_MARGIN
 * наружу. Клампит в границы арены.
 */
function pickPositionOnSide(state: GameState, side: number): Vec2 {
  const camX = state.camera.x;
  const camY = state.camera.y;
  const camW = state.viewport.width;
  const camH = state.viewport.height;
  const arenaW = state.arena.width;
  const arenaH = state.arena.height;

  // Используем максимальный радиус всех типов врагов для клампа,
  // чтобы враг любого типа не торчал за границу арены.
  const margin = Math.max(GRUNT_RADIUS, SHOOTER_RADIUS);

  let x = 0;
  let y = 0;

  switch (side) {
    case 0:
      x = camX + Math.random() * camW;
      y = camY - SPAWN_OFFSCREEN_MARGIN;
      break;
    case 1:
      x = camX + camW + SPAWN_OFFSCREEN_MARGIN;
      y = camY + Math.random() * camH;
      break;
    case 2:
      x = camX + Math.random() * camW;
      y = camY + camH + SPAWN_OFFSCREEN_MARGIN;
      break;
    case 3:
      x = camX - SPAWN_OFFSCREEN_MARGIN;
      y = camY + Math.random() * camH;
      break;
  }

  x = Math.max(margin, Math.min(arenaW - margin, x));
  y = Math.max(margin, Math.min(arenaH - margin, y));

  return { x, y };
}

/** Точка строго за пределами камеры (с запасом на радиус самого большого врага). */
function isOutsideCamera(state: GameState, p: Vec2): boolean {
  const camX = state.camera.x;
  const camY = state.camera.y;
  const camW = state.viewport.width;
  const camH = state.viewport.height;

  const margin = Math.max(GRUNT_RADIUS, SHOOTER_RADIUS);
  const left = camX - margin;
  const right = camX + camW + margin;
  const top = camY - margin;
  const bottom = camY + camH + margin;

  return p.x < left || p.x > right || p.y < top || p.y > bottom;
}

/** Fallback: случайная точка на арене на расстоянии > диагональ камеры от игрока. */
function pickFallbackPosition(state: GameState): Vec2 {
  const arenaW = state.arena.width;
  const arenaH = state.arena.height;
  const px = state.player.position.x;
  const py = state.player.position.y;

  const margin = Math.max(GRUNT_RADIUS, SHOOTER_RADIUS);
  const camW = state.viewport.width;
  const camH = state.viewport.height;
  const minDist = Math.sqrt(camW * camW + camH * camH);
  const minDistSq = minDist * minDist;

  let last: Vec2 = { x: arenaW / 2, y: arenaH / 2 };

  for (let i = 0; i < 20; i++) {
    const x = margin + Math.random() * (arenaW - 2 * margin);
    const y = margin + Math.random() * (arenaH - 2 * margin);
    const dx = x - px;
    const dy = y - py;
    if (dx * dx + dy * dy >= minDistSq) {
      return { x, y };
    }
    last = { x, y };
  }

  return last;
}

// ------------------------------------------------------------
// Фабрики врагов
// ------------------------------------------------------------

/** Создаёт грунта в указанной точке. */
function createGrunt(position: Vec2): Grunt {
  return {
    kind: 'grunt',
    position,
    radius: GRUNT_RADIUS,
    hp: GRUNT_HP,
    maxHp: GRUNT_HP,
    speed: GRUNT_SPEED,
    contactDamage: GRUNT_CONTACT_DAMAGE,
    flashUntil: 0,
    ghostHp: GRUNT_HP,
    knockbackVelocity: { x: 0, y: 0 },
    xpReward: GRUNT_XP_REWARD,
  };
}

/**
 * Создаёт стрелка в указанной точке.
 * Первый выстрел — через случайный кулдаун от текущего времени, чтобы спавн-волна
 * стрелков не выпустила залп синхронно.
 */
function createShooter(state: GameState, position: Vec2): Shooter {
  // Случайная задержка первого выстрела от 500 до 2000мс
  const firstShotDelay = 500 + Math.random() * 1500;

  return {
    kind: 'shooter',
    position,
    radius: SHOOTER_RADIUS,
    hp: SHOOTER_HP,
    maxHp: SHOOTER_HP,
    speed: SHOOTER_SPEED,
    idealDistance: SHOOTER_IDEAL_DISTANCE,
    keepDistance: SHOOTER_KEEP_DISTANCE,
    nextShotAt: state.time.now + firstShotDelay,
    flashUntil: 0,
    ghostHp: SHOOTER_HP,
    knockbackVelocity: { x: 0, y: 0 },
    xpReward: SHOOTER_XP_REWARD,
  };
}

/** Создаёт рашера в указанной точке. */
function createRusher(position: Vec2): Rusher {
  return {
    kind: 'rusher',
    position,
    radius: RUSHER_RADIUS,
    hp: RUSHER_HP,
    maxHp: RUSHER_HP,
    speed: RUSHER_SPEED,
    contactDamage: RUSHER_CONTACT_DAMAGE,
    flashUntil: 0,
    ghostHp: RUSHER_HP,
    knockbackVelocity: { x: 0, y: 0 },
    xpReward: RUSHER_XP_REWARD,
  };
}

/**
 * Сколько бунов показывается на одном экране левелапа.
 * День 4 недели 2: 3 (по плану ROADMAP). День 5 пул расширится, число останется 3.
 */
const BOON_CHOICES_PER_LEVELUP = 3;

/**
 * Переводит ран в состояние левелапа. Если буны для текущего экрана ещё
 * не сгенерированы — генерирует их. Вызывается из обоих мест перехода
 * в 'levelup' (закрытие волны и тик between-таймера), чтобы логика
 * "сгенерить если null" не дублировалась.
 */
function enterLevelUp(state: GameState): void {
  if (state.currentBoonChoices === null) {
    state.currentBoonChoices = getRandomBoonChoices(BOON_CHOICES_PER_LEVELUP);
  }
  state.runState = 'levelup';
}