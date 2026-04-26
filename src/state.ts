// src/state.ts
// Создание начального состояния игры.
// Экспортирует: createInitialState — фабрика стартового GameState.

import type { GameState } from './utils/types';

// Параметры арены
const ARENA_WIDTH = 2000;
const ARENA_HEIGHT = 2000;

// Параметры игрока
const PLAYER_SIZE = 32;
const PLAYER_SPEED = 400; // пикселей в секунду

/**
 * Создаёт начальное состояние игры.
 * Игрок ставится в центр арены, камера — тоже на игроке.
 */
export function createInitialState(): GameState {
  const playerStartX = ARENA_WIDTH / 2;
  const playerStartY = ARENA_HEIGHT / 2;

  return {
    player: {
      position: { x: playerStartX, y: playerStartY },
      size: PLAYER_SIZE,
      speed: PLAYER_SPEED,
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
  };
}