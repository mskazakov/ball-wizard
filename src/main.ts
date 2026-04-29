// src/main.ts
// Точка входа. Находит canvas, создаёт состояние игры, запускает game loop.

import { startGame } from './game';
import { createInitialState } from './state';
import { setupInput } from './input';

// --- Константы canvas ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const BACKGROUND_COLOR = '#000';

/**
 * Инициализация: находим canvas, создаём состояние, навешиваем ввод, запускаем игру.
 */
function init(): void {
  const canvas = document.getElementById('game');

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Canvas с id="game" не найден в index.html');
  }

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  canvas.style.backgroundColor = BACKGROUND_COLOR;
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось получить 2D-контекст canvas');
  }

  const state = createInitialState(canvas.width, canvas.height);
  setupInput(state, canvas);

  startGame(canvas, ctx, state);
}

init();