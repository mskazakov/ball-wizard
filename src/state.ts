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

/**
 * Создаёт начальное состояние игры.
 * Игрок ставится в центр арены, камера обнуляется (на первом кадре сцентрируется).
 * Враги НЕ создаются здесь — этим занимается система волн (см. src/waves.ts).
 * При старте: волна 1 в состоянии 'spawning', враги появятся в первом же кадре.
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
      redFlashUntil: 0,
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
    enemies: [],
    waves: {
      current: 1,
      state: 'spawning',
      betweenTimer: 0,
    },
  };
}