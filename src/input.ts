// src/input.ts
// Обработка ввода с клавиатуры и мыши. Записывает нажатые клавиши в GameState.
// Экспортирует: setupInput — навешивает обработчики на window и canvas.

import type { GameState } from './utils/types';
import { resetState } from './state';
import { getRestartButtonRect, getBoonButtonRects, BOON_SLOTS_TOTAL } from './render';
import { confirmLevelUp } from './xp';
import { castUlta } from './ulta';

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
 *   - 'playing':          каст ульты в точку курсора (если не на кулдауне)
 *   - 'won' / 'gameOver': клик по кнопке RESTART → resetState
 *   - 'levelup':          клик по одной из 3 кнопок бунов → confirmLevelUp(id)
 *
 * Координаты клика переводим из системы страницы в систему canvas
 * через getBoundingClientRect — иначе при отступах/масштабе попадёт мимо.
 */
function handleCanvasClick(e: MouseEvent, state: GameState, canvas: HTMLCanvasElement): void {
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  if (state.runState === 'playing') {
    handlePlayingClick(state, clickX, clickY);
  } else if (state.runState === 'levelup') {
    handleLevelUpClick(state, canvas, clickX, clickY);
  } else if (state.runState === 'won' || state.runState === 'gameOver') {
    handleRestartClick(state, canvas, clickX, clickY);
  }
}

/**
 * Клик по canvas во время игры — каст ульты в мировую точку под курсором.
 *
 * Перевод screen→world: добавляем смещение камеры к координатам клика.
 * camera хранит верхний левый угол видимой области в мировых координатах,
 * поэтому worldX = clickX + camera.x. Это обратное преобразование к
 * worldToScreen в render.ts.
 *
 * Кулдаун проверяется внутри castUlta — если ульта не готова, клик
 * тихо игнорируется (без визуального индикатора это нормально на дне 1,
 * cooldown HUD приедет в дне 2).
 */
function handlePlayingClick(state: GameState, clickX: number, clickY: number): void {
  const targetWorld = {
    x: clickX + state.camera.x,
    y: clickY + state.camera.y,
  };
  castUlta(state, targetWorld);
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

  // Геометрия всегда на 3 слота (фиксированный layout, см. BOON_SLOTS_TOTAL
  // в render.ts). Реальных бунов может быть меньше — итерируем только по ним,
  // лишние слоты пустые, клик в них игнорируется.
  const rects = getBoonButtonRects(canvas, BOON_SLOTS_TOTAL);
  for (let i = 0; i < choices.length; i++) {
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