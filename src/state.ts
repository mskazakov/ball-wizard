// src/state.ts
// Создание начального состояния игры.
// Экспортирует: createInitialState — фабрика стартового GameState.

import type { GameState, Target } from './utils/types';

// --- Параметры арены ---
const ARENA_WIDTH = 2000;
const ARENA_HEIGHT = 2000;

// --- Параметры игрока ---
const PLAYER_SIZE = 32;
const PLAYER_SPEED = 400; // пикселей в секунду

// --- Параметры стрельбы (стартовые, тюним позже) ---
const PLAYER_ATTACK_RADIUS = 300; // в каком радиусе ищем цель
const BALL_SACK_SIZE = 5; // ёмкость обоймы
const FIRE_RATE_MS = 150; // интервал между шарами в обойме
const RELOAD_TIME_MS = 1000; // полная перезарядка

// --- Параметры мишеней (заглушка дня 3, заменим на врагов в дне 4) ---
const TARGET_RADIUS = 24;
const TARGET_HP = 30;

/**
 * Создаёт три мишени в разных точках арены.
 * Расставлены на разных расстояниях от центра, чтобы тестировать выбор ближайшей.
 */
function createTargets(): Target[] {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;

  // Координаты подобраны так:
  //  - первая близко (≈200px от центра, попадает в радиус сразу)
  //  - вторая средне (≈350px, вне радиуса пока игрок в центре)
  //  - третья далеко (≈500px, тестируем что игрок может к ней подойти)
  const positions = [
    { x: cx + 200, y: cy - 100 },
    { x: cx - 300, y: cy + 200 },
    { x: cx + 100, y: cy + 450 },
  ];

  return positions.map((pos) => ({
    position: pos,
    radius: TARGET_RADIUS,
    hp: TARGET_HP,
    maxHp: TARGET_HP,
    alive: true,
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
    targets: createTargets(),
  };
}