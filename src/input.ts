// src/input.ts
// Обработка ввода с клавиатуры и мыши. Записывает нажатые клавиши в GameState.
// Экспортирует: setupInput — навешивает обработчики на window и canvas.

import type { GameState } from './utils/types';
import { resetState } from './state';
import { getRestartButtonRect } from './render';
import { confirmLevelUp } from './xp';

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
 * Обрабатывает клик по canvas.
 *
 * Сейчас обрабатывается:
 *   - 'won' / 'gameOver': клик по кнопке RESTART → resetState
 *   - 'levelup':           клик по кнопке CONTINUE → confirmLevelUp (повышает уровень)
 *
 * Геометрия кнопки одна (getRestartButtonRect) и в render все три экрана
 * её переиспользуют через drawCenterButton с разными лейблами.
 *
 * Координаты клика переводим из системы страницы в систему canvas
 * через getBoundingClientRect — иначе при отступах/масштабе попадёт мимо.
 *
 * День 4 недели 2: на 'levelup' будет 3 кнопки бунов, тут появится
 * отдельная getBoonButtonRects и логика выбора.
 */
function handleCanvasClick(e: MouseEvent, state: GameState, canvas: HTMLCanvasElement): void {
  // Кнопка по центру показывается только в этих состояниях
  if (
    state.runState !== 'won' &&
    state.runState !== 'gameOver' &&
    state.runState !== 'levelup'
  ) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  const btn = getRestartButtonRect(canvas);
  const isInside =
    clickX >= btn.x &&
    clickX <= btn.x + btn.w &&
    clickY >= btn.y &&
    clickY <= btn.y + btn.h;

  if (!isInside) return;

  // Развилка по состоянию: одна и та же кнопка делает разные действия.
  if (state.runState === 'levelup') {
    confirmLevelUp(state);
  } else {
    resetState(state);
  }
}