// main.ts — точка входа.
// Находит <canvas> в DOM, настраивает его размер и запускает game loop.
// Вся остальная логика будет вынесена в отдельные модули по мере роста проекта.

import { startGame } from './game';

// --- Константы canvas ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const BACKGROUND_COLOR = '#000';

/**
 * Инициализация: находим canvas, проверяем что всё на месте, запускаем игру.
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

  startGame(canvas, ctx);
}

init();