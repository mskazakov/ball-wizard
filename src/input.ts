// src/input.ts
// Обработка ввода с клавиатуры и мыши. Записывает нажатые клавиши в GameState.
// Экспортирует: setupInput — навешивает обработчики на window и canvas.

import type { GameState } from './utils/types';
import { resetState } from './state';
import { getRestartButtonRect } from './render';

/**
 * Навешивает обработчики ввода:
 *   - keydown/keyup на window — записывают коды клавиш в state.input.keys
 *   - blur на window — сбрасывает клавиши при потере фокуса (иначе игрок "уезжает" после Alt+Tab)
 *   - click на canvas — обработка клика по кнопке RESTART на экранах won/gameOver
 *
 * Вызывается один раз при старте игры.
 */
export function setupInput(state: GameState, canvas: HTMLCanvasElement): void {
  window.addEventListener('keydown', (e) => {
    state.input.keys.add(e.code);
  });

  window.addEventListener('keyup', (e) => {
    state.input.keys.delete(e.code);
  });

  // Если окно теряет фокус — сбрасываем все клавиши,
  // иначе игрок продолжит "ехать" после Alt+Tab.
  window.addEventListener('blur', () => {
    state.input.keys.clear();
  });

  // Клик по canvas — пока единственное использование — кнопка RESTART
  // на экранах победы и Game Over. В неделе 3 здесь же будет каст ульты.
  canvas.addEventListener('click', (e) => {
    handleCanvasClick(e, state, canvas);
  });
}

/**
 * Обрабатывает клик по canvas. Сейчас — только кнопка рестарта.
 * Кнопка активна только когда игра остановлена (won или gameOver).
 *
 * Координаты клика переводим из системы страницы в систему canvas
 * через getBoundingClientRect — иначе при отступах/масштабе попадёт мимо.
 */
function handleCanvasClick(e: MouseEvent, state: GameState, canvas: HTMLCanvasElement): void {
  // Кнопка показывается только в этих состояниях
  if (state.runState !== 'won' && state.runState !== 'gameOver') return;

  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  const btn = getRestartButtonRect(canvas);
  const isInside =
    clickX >= btn.x &&
    clickX <= btn.x + btn.w &&
    clickY >= btn.y &&
    clickY <= btn.y + btn.h;

  if (isInside) {
    resetState(state);
  }
}