// src/input.ts
// Обработка ввода с клавиатуры. Записывает нажатые клавиши в GameState.
// Экспортирует: setupInput — навешивает обработчики на window.

import type { GameState } from './utils/types';

/**
 * Навешивает обработчики keydown/keyup на window.
 * Нажатые клавиши хранятся в state.input.keys как нижний регистр (например 'w', 'arrowup').
 * Вызывается один раз при старте игры.
 */
export function setupInput(state: GameState): void {
  window.addEventListener('keydown', (e) => {
    state.input.keys.add(e.key.toLowerCase());
  });

  window.addEventListener('keyup', (e) => {
    state.input.keys.delete(e.key.toLowerCase());
  });

  // Если окно теряет фокус — сбрасываем все клавиши,
  // иначе игрок продолжит "ехать" после Alt+Tab.
  window.addEventListener('blur', () => {
    state.input.keys.clear();
  });
}