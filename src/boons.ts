// src/boons.ts
// Определения бунов и логика их применения к state.
// Экспортирует:
//   BOON_DEFINITIONS — словарь BoonId → BoonDefinition (имя, описание для UI)
//   applyBoon(state, id) — применяет эффект буна к state и записывает в state.boons
//   getRandomBoonChoices(count) — возвращает N бунов для экрана левелапа
//
// Принцип (день 4 недели 2): эффекты буна мутируют поля игрока сразу при взятии
// (например player.damageMultiplier += 0.25). state.boons ведём как журнал
// взятых — для HUD дня 6 и понимания "что игрок собрал". См. DECISIONS.

import type { BoonDefinition, BoonId, GameState } from './utils/types';

// --- Параметры бунов ---
/** Прибавка к множителю урона от одного стека "More damage". Аддитивно. */
const MORE_DAMAGE_BONUS = 0.25;

/**
 * Все определения бунов. Ключ — BoonId, значение — статичные данные для UI.
 * Эффект каждого буна реализован в applyBoon ниже (switch по id).
 *
 * День 4 недели 2: только 'more_damage'. День 5 добавит 'fast_hands' и 'triple_shot'.
 */
export const BOON_DEFINITIONS: Record<BoonId, BoonDefinition> = {
  more_damage: {
    id: 'more_damage',
    name: 'More damage',
    description: '+25% урона',
  },
};

/**
 * Применяет эффект буна к state и записывает факт взятия в state.boons.
 *
 * Принцип: эффект мутирует поля игрока сразу (дешёвое чтение в шарах),
 * массив boons — журнал для UI. См. DECISIONS, день 4 недели 2.
 *
 * Стакание: аддитивное. Брать "More damage" дважды → +50% (не ×1.5625).
 */
export function applyBoon(state: GameState, id: BoonId): void {
  switch (id) {
    case 'more_damage':
      state.player.damageMultiplier += MORE_DAMAGE_BONUS;
      break;
    // exhaustiveness: при добавлении нового BoonId TS заставит обработать здесь
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unknown boon id: ${_exhaustive}`);
    }
  }

  state.boons.push({ id });
}

/**
 * Возвращает count случайных бунов для экрана левелапа.
 *
 * День 4 недели 2: пул из одного буна, поэтому функция возвращает 3 одинаковых
 * 'more_damage'. Это by design — выбор без выбора, реальные 3 разных буна
 * появятся в дне 5. Метод реализован сразу с правильной сигнатурой,
 * чтобы день 5 был просто расширением пула, без рефакторинга вызовов.
 */
export function getRandomBoonChoices(count: number): BoonId[] {
  const pool: BoonId[] = ['more_damage'];

  const result: BoonId[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool[idx]);
  }
  return result;
}