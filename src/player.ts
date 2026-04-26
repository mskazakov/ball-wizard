// src/player.ts
// Логика игрока: движение по WASD/стрелкам с нормализацией диагонали.
// Экспортирует: updatePlayer — обновляет позицию игрока за один кадр.

import type { GameState } from './utils/types';

/**
 * Обновляет позицию игрока на основе нажатых клавиш.
 * Диагональное движение нормализовано (не быстрее прямого).
 * Игрок ограничен границами арены с учётом своего размера.
 */
export function updatePlayer(state: GameState): void {
  const { player, arena, input, time } = state;
  const keys = input.keys;

  // Считаем направление: -1, 0 или +1 по каждой оси
  let dx = 0;
  let dy = 0;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;

  // Нормализация: если по обеим осям 1, длина вектора = √2, делим на √2
  const length = Math.hypot(dx, dy);
  if (length > 0) {
    dx /= length;
    dy /= length;
  }

  // deltaTime в мс, скорость в px/сек → делим на 1000
  const distance = (player.speed * time.deltaTime) / 1000;
  player.position.x += dx * distance;
  player.position.y += dy * distance;

  // Ограничение по границам арены
  const half = player.size / 2;
  if (player.position.x < half) player.position.x = half;
  if (player.position.y < half) player.position.y = half;
  if (player.position.x > arena.width - half) player.position.x = arena.width - half;
  if (player.position.y > arena.height - half) player.position.y = arena.height - half;
}