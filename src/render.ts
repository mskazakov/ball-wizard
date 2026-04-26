// src/render.ts
// Отрисовка игры на canvas. Знает про экранные координаты.
// Экспортирует: render — рисует один кадр.

import type { GameState } from './utils/types';

// Цвета
const BG_COLOR = '#000000';
const ARENA_BORDER_COLOR = '#222222';
const PLAYER_COLOR = '#ffffff';

/**
 * Рисует один кадр.
 * Преобразует мировые координаты в экранные через camera.
 */
export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const canvas = ctx.canvas;

  // Очистка экрана
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Границы арены — прямоугольник в мировых координатах
  ctx.strokeStyle = ARENA_BORDER_COLOR;
  ctx.lineWidth = 4;
  ctx.strokeRect(
    0 - state.camera.x,
    0 - state.camera.y,
    state.arena.width,
    state.arena.height
  );

  // Игрок — белый квадрат, центр в player.position
  const half = state.player.size / 2;
  const screenX = state.player.position.x - state.camera.x - half;
  const screenY = state.player.position.y - state.camera.y - half;
  ctx.fillStyle = PLAYER_COLOR;
  ctx.fillRect(screenX, screenY, state.player.size, state.player.size);
}