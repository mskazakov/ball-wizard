// src/arena.ts
// Логика камеры: следует за игроком, центрируясь на нём.
// Экспортирует: updateCamera — пересчитывает позицию камеры.

import type { GameState } from './utils/types';

// Размер видимой области (canvas)
const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 600;

/**
 * Жёстко центрирует камеру на игроке.
 * Камера хранит верхний левый угол видимой области в мировых координатах.
 * Камера может выходить за границы арены — это сознательно (упростим
 * клампинг позже, когда увидим как это смотрится визуально).
 */
export function updateCamera(state: GameState): void {
  state.camera.x = state.player.position.x - VIEWPORT_WIDTH / 2;
  state.camera.y = state.player.position.y - VIEWPORT_HEIGHT / 2;
}