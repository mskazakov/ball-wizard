// src/state.ts
// Создание начального состояния игры.
// Экспортирует: createInitialState — фабрика стартового GameState.

import type { GameState, Enemy } from './utils/types';

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

// --- Параметры врага "грунт" (стартовые, тюним после дня 4) ---
const ENEMY_RADIUS = 18;
const ENEMY_HP = 40; // 4 шара по 10 урона
const ENEMY_SPEED = 90; // пикселей в секунду; в ~4.5 раза медленнее игрока
const ENEMY_CONTACT_DAMAGE = 10; // урон игроку при касании

/**
 * Создаёт несколько врагов-грунтов вокруг игрока для теста дня 4.
 * Расставлены на разных расстояниях, чтобы видеть как сходятся к центру.
 */
function createEnemies(): Enemy[] {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;

  // Враги вокруг игрока на разных дистанциях:
  //  - двое близко (≈250px) — атакуют первыми
  //  - двое средне (≈400px) — догоняют
  //  - один далеко (≈600px) — успеешь увидеть
  const positions = [
    { x: cx + 250, y: cy - 100 },
    { x: cx - 250, y: cy + 100 },
    { x: cx + 400, y: cy + 300 },
    { x: cx - 400, y: cy - 300 },
    { x: cx, y: cy - 600 },
  ];

  return positions.map((pos) => ({
    position: pos,
    radius: ENEMY_RADIUS,
    hp: ENEMY_HP,
    maxHp: ENEMY_HP,
    speed: ENEMY_SPEED,
    contactDamage: ENEMY_CONTACT_DAMAGE,
  }));
}

/**
 * Создаёт начальное состояние игры.
 * Игрок ставится в центр арены, камера обнуляется (на первом кадре сцентрируется).
 */
export function createInitialState(): GameState {
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

      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      iFramesUntil: 0,
    },
    arena: {
      width: ARENA_WIDTH,
      height: ARENA_HEIGHT,
    },
    camera: {
      x: 0,
      y: 0,
    },
    input: {
      keys: new Set<string>(),
    },
    time: {
      now: 0,
      deltaTime: 0,
    },
    projectiles: [],
    enemies: createEnemies(),
  };
}