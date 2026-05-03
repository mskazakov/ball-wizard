// src/boons.ts
// Определения бунов и логика их применения к state.
// Экспортирует:
//   BOON_DEFINITIONS — словарь BoonId → BoonDefinition (имя, описание для UI)
//   applyBoon(state, id) — применяет эффект буна к state и записывает в state.boons
//   getRandomBoonChoices(state, count) — возвращает N бунов для экрана левелапа
//                                         с учётом капов (на основе state.boons)
//
// Принцип (день 4 недели 2): эффекты буна мутируют поля игрока сразу при взятии
// (например player.damageMultiplier += 0.25). state.boons ведём как журнал
// взятых — для HUD дня 6 и понимания "что игрок собрал". См. DECISIONS.
//
// День 5 недели 2: добавлены 'fast_hands', 'more_projectiles', заглушка
// 'too_powerful'. Каждый бун имеет cap — максимальное число стеков за ран.
// Все числовые параметры эффектов вынесены в константы, описание читает их же
// (один источник истины, балансим в одном месте).

import type { BoonDefinition, BoonId, GameState } from './utils/types';

// --- Параметры бунов ---

/** Прибавка к множителю урона от одного стека "More damage". Аддитивно. */
const MORE_DAMAGE_BONUS = 0.25;
/** Максимум стеков "More damage" за ран. */
const MORE_DAMAGE_CAP = 5;

/**
 * Множитель reloadTime от одного стека "Fast hands". Мультипликативно.
 * 0.7 = перезарядка занимает 70% от текущего времени (т.е. -30%).
 */
const FAST_HANDS_RELOAD_FACTOR = 0.7;
/** Максимум стеков "Fast hands" за ран. После 3 стеков reloadTime ≈ 34% от исходного. */
const FAST_HANDS_CAP = 3;

/** Прибавка к projectilesPerShot от одного стека "More projectiles". */
const MORE_PROJECTILES_BONUS = 1;
/** Максимум стеков. 1 (старт) + 2 = 3 шара веером. */
const MORE_PROJECTILES_CAP = 2;

// --- Хелперы для description (читают те же константы, что и эффекты) ---

/** Процент уменьшения reloadTime за один стек, для description. 0.7 → "30%". */
const FAST_HANDS_RELOAD_REDUCTION_PCT = Math.round((1 - FAST_HANDS_RELOAD_FACTOR) * 100);
/** Процент прибавки урона за один стек, для description. 0.25 → "25%". */
const MORE_DAMAGE_BONUS_PCT = Math.round(MORE_DAMAGE_BONUS * 100);

/**
 * Все определения бунов. Ключ — BoonId, значение — статичные данные для UI.
 * Эффект каждого буна реализован в applyBoon ниже (switch по id).
 *
 * 'too_powerful' — заглушка для случая когда у игрока все буны выкачаны до
 * капа и пул пуст. Имеет cap = Infinity, никаких эффектов не применяет,
 * клик просто декрементит pendingLevelUps.
 */
export const BOON_DEFINITIONS: Record<BoonId, BoonDefinition> = {
  more_damage: {
    id: 'more_damage',
    name: 'More damage',
    description: `+${MORE_DAMAGE_BONUS_PCT}% damage`,
    cap: MORE_DAMAGE_CAP,
  },
  fast_hands: {
    id: 'fast_hands',
    name: 'Fast hands',
    description: `-${FAST_HANDS_RELOAD_REDUCTION_PCT}% reload time`,
    cap: FAST_HANDS_CAP,
  },
  more_projectiles: {
    id: 'more_projectiles',
    name: 'More projectiles',
    description: `+${MORE_PROJECTILES_BONUS} projectile`,
    cap: MORE_PROJECTILES_CAP,
  },
  too_powerful: {
    id: 'too_powerful',
    name: 'You are too powerful',
    description: 'No more upgrades available',
    cap: Infinity,
  },
};

/**
 * Применяет эффект буна к state и записывает факт взятия в state.boons.
 *
 * Принцип: эффект мутирует поля игрока сразу (дешёвое чтение в шарах),
 * массив boons — журнал для UI. См. DECISIONS, день 4 недели 2.
 *
 * Стакание: смотри комментарии у каждого case'а.
 */
export function applyBoon(state: GameState, id: BoonId): void {
  switch (id) {
    case 'more_damage':
      // Аддитивно: каждый стак прибавляет +0.25 к множителю.
      state.player.damageMultiplier += MORE_DAMAGE_BONUS;
      break;
    case 'fast_hands':
      // Мультипликативно: каждый стак умножает reloadTime на 0.7.
      // 1000 → 700 → 490 → 343мс при 3 стеках.
      state.player.reloadTime *= FAST_HANDS_RELOAD_FACTOR;
      break;
    case 'more_projectiles':
      // Аддитивно: каждый стак добавляет +1 шар. 1 → 2 → 3 при 2 стеках.
      state.player.projectilesPerShot += MORE_PROJECTILES_BONUS;
      break;
    case 'too_powerful':
      // Заглушка: никаких эффектов. Журнал тоже не пишем — это не реальный бун.
      return;
    // exhaustiveness: при добавлении нового BoonId TS заставит обработать здесь
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unknown boon id: ${_exhaustive}`);
    }
  }

  state.boons.push({ id });
}

/**
 * Считает сколько раз бун уже взят в текущем ране.
 * Используется для проверки достижения капа.
 */
function countBoonStacks(state: GameState, id: BoonId): number {
  let count = 0;
  for (const applied of state.boons) {
    if (applied.id === id) count++;
  }
  return count;
}

/**
 * Возвращает count случайных бунов для экрана левелапа.
 *
 * Учитывает капы: бун с уже достигнутым капом не попадает в пул.
 * Без повторов на одном экране — каждый из count бунов уникален.
 *
 * Если доступных бунов меньше count — возвращается массив длины
 * "сколько есть" (1-2 буна, остальные слоты на экране будут пустыми).
 *
 * Если доступных бунов 0 — возвращается ['too_powerful'] (один слот
 * с заглушкой, остальные пустые). См. DECISIONS, день 5 недели 2.
 */
export function getRandomBoonChoices(state: GameState, count: number): BoonId[] {
  // Все реальные буны (без заглушки).
  const allRealBoons: BoonId[] = ['more_damage', 'fast_hands', 'more_projectiles'];

  // Фильтруем по капу — оставляем те, где stacks < cap.
  const available = allRealBoons.filter((id) => {
    const stacks = countBoonStacks(state, id);
    const cap = BOON_DEFINITIONS[id].cap;
    return stacks < cap;
  });

  // Все реальные буны выкачаны → один слот с заглушкой.
  if (available.length === 0) {
    return ['too_powerful'];
  }

  // Выбираем без повторов: shuffle + take первые count.
  // Fisher-Yates на копии массива.
  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Если доступных меньше count — вернём сколько есть.
  return shuffled.slice(0, Math.min(count, shuffled.length));
}