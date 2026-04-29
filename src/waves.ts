// src/waves.ts
// Система волн: спавн врагов, переходы между волнами, состояние победы.
// Машина состояний: spawning → fighting → between → spawning → ... → won
// Экспортирует: updateWaves — главная функция, вызывается раз за кадр.

import type { GameState, Enemy, Vec2 } from './utils/types';

// --- Параметры волн ---

/** Количество врагов на каждой волне. Длина массива = MAX_WAVES. */
const ENEMIES_PER_WAVE = [5, 8, 12, 16, 22];

/** Максимальный номер волны. После победы на ней — игра выиграна. */
const MAX_WAVES = ENEMIES_PER_WAVE.length;

/** Пауза между волнами в мс. */
const BETWEEN_WAVE_DELAY_MS = 2000;

/**
 * Запас спавна за пределами видимой области камеры.
 * Враг создаётся в случайной точке арены, расстояние от которой до края камеры
 * не меньше этой величины. Гарантирует "не появился прямо в лицо".
 */
const SPAWN_OFFSCREEN_MARGIN = 100;

/** Параметры врага "грунт". Дублируют значения из старого state.ts. */
const ENEMY_RADIUS = 18;
const ENEMY_HP = 40;
const ENEMY_SPEED = 90;
const ENEMY_CONTACT_DAMAGE = 10;

/**
 * Главная функция системы волн. Вызывается раз за кадр из game.ts.
 * Машина состояний:
 *   spawning  — спавним всех врагов волны разом, переходим в fighting
 *   fighting  — ждём пока state.enemies опустеет
 *   between   — пауза BETWEEN_WAVE_DELAY_MS, потом следующая волна или won
 *   won       — финальное состояние, ничего не делаем
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
        // Все враги убиты
        if (w.current >= MAX_WAVES) {
          w.state = 'won';
        } else {
          w.state = 'between';
          w.betweenTimer = BETWEEN_WAVE_DELAY_MS;
        }
      }
      break;

    case 'between':
      w.betweenTimer -= state.time.deltaTime;
      if (w.betweenTimer <= 0) {
        w.current += 1;
        w.state = 'spawning';
      }
      break;

    case 'won':
      // Ничего не делаем. Игрок видит экран победы (рендерится в render.ts).
      break;
  }
}

/**
 * Спавнит всех врагов текущей волны разом.
 * ТЕХДОЛГ: постепенный спавн в течение волны (как в Brotato).
 * Сейчас — все сразу для простоты.
 */
function spawnWave(state: GameState): void {
  const count = ENEMIES_PER_WAVE[state.waves.current - 1];

  for (let i = 0; i < count; i++) {
    state.enemies.push(createEnemy(pickSpawnPosition(state)));
  }
}

/**
 * Выбирает точку спавна за пределами видимой камеры, но внутри арены.
 * Алгоритм: выбираем случайную сторону камеры (top/right/bottom/left),
 * затем случайную точку вдоль этой стороны со смещением SPAWN_OFFSCREEN_MARGIN
 * наружу. Если точка вылезает за арену — клампим в границы арены.
 *
 * Камера в этой версии = весь canvas (800x600), верхний левый угол в (cam.x, cam.y).
 */
function pickSpawnPosition(state: GameState): Vec2 {
  const camX = state.camera.x;
  const camY = state.camera.y;
  const camW = 800; // ширина видимой области (= canvas)
  const camH = 600;

  const arenaW = state.arena.width;
  const arenaH = state.arena.height;

  const side = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
  let x = 0;
  let y = 0;

  switch (side) {
    case 0: // сверху
      x = camX + Math.random() * camW;
      y = camY - SPAWN_OFFSCREEN_MARGIN;
      break;
    case 1: // справа
      x = camX + camW + SPAWN_OFFSCREEN_MARGIN;
      y = camY + Math.random() * camH;
      break;
    case 2: // снизу
      x = camX + Math.random() * camW;
      y = camY + camH + SPAWN_OFFSCREEN_MARGIN;
      break;
    case 3: // слева
      x = camX - SPAWN_OFFSCREEN_MARGIN;
      y = camY + Math.random() * camH;
      break;
  }

  // Клампим в границы арены (на случай если игрок у края)
  x = Math.max(ENEMY_RADIUS, Math.min(arenaW - ENEMY_RADIUS, x));
  y = Math.max(ENEMY_RADIUS, Math.min(arenaH - ENEMY_RADIUS, y));

  return { x, y };
}

/** Создаёт одного врага-грунта в указанной точке. */
function createEnemy(position: Vec2): Enemy {
  return {
    position,
    radius: ENEMY_RADIUS,
    hp: ENEMY_HP,
    maxHp: ENEMY_HP,
    speed: ENEMY_SPEED,
    contactDamage: ENEMY_CONTACT_DAMAGE,
    flashUntil: 0,
    ghostHp: ENEMY_HP,
    knockbackVelocity: { x: 0, y: 0 },
  };
}