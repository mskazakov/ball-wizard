// src/state.ts
// Создание начального состояния игры.
// Экспортирует: createInitialState — фабрика стартового GameState.

import type { GameState } from './utils/types';

// --- Параметры арены ---
const ARENA_WIDTH = 2000;
const ARENA_HEIGHT = 2000;

// --- Параметры игрока ---
const PLAYER_SIZE = 32;
const PLAYER_SPEED = 400; // пикселей в секунду
const PLAYER_MAX_HP = 100;

// --- Параметры стрельбы (стартовые, тюним позже) ---
const PLAYER_ATTACK_RADIUS = 300; // в каком радиусе ищем цель
const BALL_SACK_SIZE = 5; // ёмкость обоймы
const FIRE_RATE_MS = 150; // интервал между шарами в обойме
const RELOAD_TIME_MS = 1000; // полная перезарядка

// --- Боевые модификаторы ---
/** Стартовый множитель урона. Буну "More damage" прибавляет 0.25 (аддитивно). */
const PLAYER_START_DAMAGE_MULTIPLIER = 1;

/** Стартовое количество шаров за выстрел. Бун "More projectiles" прибавляет +1. */
const PLAYER_START_PROJECTILES_PER_SHOT = 1;

// --- Прогрессия (день 3 недели 2) ---
/** Стартовый уровень игрока. */
const PLAYER_START_LEVEL = 1;
/**
 * Сколько xp нужно для перехода с уровня 1 на уровень 2.
 * Brotato-style кривая: на каждом уровне порог растёт на 1 относительно предыдущего шага.
 * Уровни 1→2: 2, 2→3: 4 (2+2), 3→4: 7 (4+3), 4→5: 11 (7+4), 5→6: 16 (11+5), ...
 * Формула шага: xpToNextLevel(L) = xpToNextLevel(L-1) + (L+1)
 * См. computeNextXpThreshold в src/xp.ts (появится далее).
 */
const PLAYER_XP_TO_LEVEL_2 = 2;

/**
 * Создаёт начальное состояние игры.
 * Игрок ставится в центр арены, камера обнуляется (на первом кадре сцентрируется).
 * Враги НЕ создаются здесь — этим занимается система волн (см. src/waves.ts).
 * При старте: волна 1 в состоянии 'spawning', враги появятся в первом же кадре.
 */
export function createInitialState(viewportWidth: number, viewportHeight: number): GameState {
  const playerStartX = ARENA_WIDTH / 2;
  const playerStartY = ARENA_HEIGHT / 2;

  return {
    player: {
      position: { x: playerStartX, y: playerStartY },
      size: PLAYER_SIZE,
      speed: PLAYER_SPEED,

      attackRadius: PLAYER_ATTACK_RADIUS,
      ballSackSize: BALL_SACK_SIZE,
      ballSackCurrent: BALL_SACK_SIZE,
      fireRate: FIRE_RATE_MS,
      lastShotAt: 0,
      reloadTime: RELOAD_TIME_MS,
      reloadProgress: -1, // -1 = сейчас не перезаряжаемся
      damageMultiplier: PLAYER_START_DAMAGE_MULTIPLIER,
      projectilesPerShot: PLAYER_START_PROJECTILES_PER_SHOT,

      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      iFramesUntil: 0,
      redFlashUntil: 0,

      ultaReadyAt: 0, // готова сразу с начала рана

      // --- Прогрессия ---
      level: PLAYER_START_LEVEL,
      xp: 0,
      xpToNextLevel: PLAYER_XP_TO_LEVEL_2,
      pendingLevelUps: 0,
    },
    arena: {
      width: ARENA_WIDTH,
      height: ARENA_HEIGHT,
    },
    camera: {
      x: 0,
      y: 0,
    },
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
    },
    input: {
      keys: new Set<string>(),
    },
    time: {
      now: 0,
      deltaTime: 0,
    },
    projectiles: [],
    ultaProjectiles: [],
    enemyProjectiles: [],
    enemies: [],
    waves: {
      current: 1,
      state: 'spawning',
      betweenTimer: 0,
    },
    runState: 'playing',
    boons: [],
    currentBoonChoices: null,
  };
}

/**
 * Сбрасывает существующий GameState в стартовое состояние.
 * Используется для рестарта игры — мутирует переданный объект,
 * НЕ создаёт новый. Это критично: ссылку на state держат замыкания
 * в game loop и обработчики ввода, заменить её снаружи нельзя.
 *
 * Реализация: создаём свежий state через createInitialState и копируем
 * все поля в существующий объект. Так структура определяется в одном месте,
 * и при добавлении нового поля в GameState его не нужно дублировать здесь.
 */
export function resetState(state: GameState): void {
  // viewport не пересоздаём — он не меняется в течение жизни игры,
  // передаём текущие значения чтобы createInitialState не упал.
  const fresh = createInitialState(state.viewport.width, state.viewport.height);

  state.player = fresh.player;
  state.arena = fresh.arena;
  state.camera = fresh.camera;
  state.time = fresh.time;
  state.projectiles = fresh.projectiles;
  state.ultaProjectiles = fresh.ultaProjectiles;
  state.enemyProjectiles = fresh.enemyProjectiles;
  state.enemies = fresh.enemies;
  state.waves = fresh.waves;
  state.runState = fresh.runState;
  state.boons = fresh.boons;
  state.currentBoonChoices = fresh.currentBoonChoices;

  // input.keys НЕ пересоздаём — Set держится тем же,
  // обработчики keydown/keyup в input.ts ссылаются на него по ссылке.
  // Если игрок зажал WASD — после рестарта продолжит ехать, это ок.
  state.input.keys.clear();
}