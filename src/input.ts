// src/input.ts
// Обработка ввода с клавиатуры и мыши. Записывает нажатые клавиши в GameState.
// Экспортирует: setupInput — навешивает обработчики на window и canvas.

import type { GameState } from './utils/types';
import { resetState } from './state';
import { getRestartButtonRect, getBoonButtonRects } from './render';
import { confirmLevelUp } from './xp';

/**
 * Навешивает обработчики ввода:
 *   - keydown/keyup на window — записывают коды клавиш в state.input.keys
 *   - blur на window — сбрасывает клавиши при потере фокуса
 *   - click на canvas — кнопки на экранах won/gameOver/levelup
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

  window.addEventListener('blur', () => {
    state.input.keys.clear();
  });

  canvas.addEventListener('click', (e) => {
    handleCanvasClick(e, state, canvas);
  });
}

/**
 * Обрабатывает клик по canvas. Развилка по runState:
 *   - 'won' / 'gameOver': клик по кнопке RESTART → resetState
 *   - 'levelup':          клик по одной из 3 кнопок бунов → confirmLevelUp(id)
 *   - иначе:              игнор (в неделе 3 здесь будет каст ульты)
 *
 * Координаты клика переводим из системы страницы в систему canvas
 * через getBoundingClientRect — иначе при отступах/масштабе попадёт мимо.
 */
function handleCanvasClick(e: MouseEvent, state: GameState, canvas: HTMLCanvasElement): void {
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

  if (state.runState === 'levelup') {
    handleLevelUpClick(state, canvas, clickX, clickY);
  } else {
    handleRestartClick(state, canvas, clickX, clickY);
  }
}

/**
 * Клик на экране won/gameOver: попал в кнопку RESTART → сброс состояния.
 */
function handleRestartClick(
  state: GameState,
  canvas: HTMLCanvasElement,
  clickX: number,
  clickY: number,
): void {
  const btn = getRestartButtonRect(canvas);
  if (isInsideRect(clickX, clickY, btn)) {
    resetState(state);
  }
}

/**
 * Клик на экране levelup: проверяем 3 кнопки бунов, выбираем по индексу.
 *
 * state.currentBoonChoices сгенерирован в waves.ts при входе в 'levelup'
 * и не должен быть null здесь, но защищаемся на случай гонки состояний:
 * если массива нет — ничего не делаем (следующий кадр render всё равно
 * нарисует экран без кнопок, игрок не залипнет — его выручит ответный
 * проход waves.ts → enterLevelUp → сгенерится).
 */
function handleLevelUpClick(
  state: GameState,
  canvas: HTMLCanvasElement,
  clickX: number,
  clickY: number,
): void {
  const choices = state.currentBoonChoices;
  if (!choices || choices.length === 0) return;

  const rects = getBoonButtonRects(canvas, choices.length);
  for (let i = 0; i < rects.length; i++) {
    if (isInsideRect(clickX, clickY, rects[i])) {
      confirmLevelUp(state, choices[i]);
      return;
    }
  }
}

/** Проверка попадания точки в прямоугольник (включая границы). */
function isInsideRect(
  x: number,
  y: number,
  rect: { x: number; y: number; w: number; h: number },
): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}