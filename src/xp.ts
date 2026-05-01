// src/xp.ts
// Прогрессия игрока: начисление опыта и переход на следующий уровень.
// Brotato-style кривая: на каждом уровне порог растёт на 1 относительно предыдущего шага.
// Уровни 1→2: 2, 2→3: 4 (2+2), 3→4: 7 (4+3), 4→5: 11 (7+4), 5→6: 16 (11+5), ...
//
// Экспортирует:
//   - grantXp: начисляет xp игроку, при превышении порога переводит ран в 'levelup'
//   - computeNextXpThreshold: формула порога для следующего уровня

import type { BoonId, GameState } from './utils/types';
import { applyBoon, getRandomBoonChoices } from './boons';

/**
 * Должна совпадать с MAX_WAVES в waves.ts. Дублируем здесь намеренно:
 * waves.ts не должен импортировать из xp.ts (циркулярная зависимость),
 * а xp.ts нужно знать был ли это финальный бой.
 *
 * ТЕХДОЛГ: вынести в src/utils/constants.ts когда константа понадобится
 * в третьем месте (третий случай по принципу из ARCHITECTURE.md).
 */
const MAX_WAVES_FOR_WIN = 5;

/**
 * Считает порог xp для перехода с указанного уровня на следующий.
 * Brotato-style: шаг = currentLevel + 1.
 *   - level 1: следующий порог = 2
 *   - level 2: следующий порог = previousThreshold(1) + 3 = 2 + 3? Нет.
 *
 * Формула: threshold(L) = threshold(L-1) + (L+1), threshold(1) = 2.
 * Развёрнуто: 2, 4, 7, 11, 16, 22, 29, 37, 46, 56, ...
 *
 * Используем итеративную формулу — никаких рекурсий, кэшей не нужно
 * (вызывается один раз на левелап, не в hot path).
 */
export function computeNextXpThreshold(level: number): number {
  let threshold = 2; // уровень 1 → 2
  for (let l = 2; l <= level; l++) {
    threshold += l + 1;
  }
  return threshold;
}

/**
 * Начисляет xp игроку. Если порог пересечён — повышает уровень СРАЗУ
 * и инкрементит pendingLevelUps (счётчик невыбранных бунов).
 *
 * Важное разделение, введённое в дне 3 недели 2:
 *   - player.level — визуальный достигнутый уровень. Растёт мгновенно.
 *   - pendingLevelUps — сколько бунов игрок ещё должен выбрать.
 *
 * Игрок видит "Lv 3" в HUD сразу после набора xp, но между волнами должен
 * подтвердить N экранов выбора буна (по числу pendingLevelUps).
 *
 * Пересечений может быть несколько за один вызов (буны "+xp", убийство
 * толпы за раз) — цикл обрабатывает все.
 */
export function grantXp(state: GameState, amount: number): void {
  const player = state.player;
  player.xp += amount;

  while (player.xp >= player.xpToNextLevel) {
    player.xp -= player.xpToNextLevel;
    player.level += 1;
    player.pendingLevelUps += 1;
    player.xpToNextLevel = computeNextXpThreshold(player.level);
  }
}

/**
 * Подтверждение одного отложенного левелапа. Вызывается когда игрок выбрал
 * один из 3 бунов на экране между волнами.
 *
 * НЕ повышает player.level — он уже повышен в grantXp в момент набора xp.
 * Здесь:
 *   1) применяет выбранный буну (мутирует поля игрока, пишет в state.boons)
 *   2) очищает state.currentBoonChoices — для следующего экрана waves.ts
 *      сгенерирует новые 3 буна
 *   3) декрементит pendingLevelUps
 *   4) если ещё остались — runState='levelup', сразу следующий экран
 *   5) если все разгребены — определяем куда возвращаться:
 *      - финальная волна закрыта без врагов → 'won' (отложенная победа)
 *      - иначе → 'playing'
 */
export function confirmLevelUp(state: GameState, chosenBoon: BoonId): void {
  const player = state.player;

  applyBoon(state, chosenBoon);

  player.pendingLevelUps -= 1;

  if (player.pendingLevelUps > 0) {
    // Остаёмся в 'levelup' для следующего экрана. Сразу генерим новые
    // буны — в waves.ts генерация только при ВХОДЕ в 'levelup', а мы из
    // него не выходим. Без этой строки следующий экран был бы пустой.
    // Длина пула — та же что в waves.ts (3), захардкожена дважды.
    // Техдолг: при появлении третьего использования вынести в utils/constants.
    state.currentBoonChoices = getRandomBoonChoices(3);
    return;
  }

  // Все pending разгребены — экран левелапа закрывается, чистим choices,
  // чтобы следующий заход в 'levelup' (новая волна) сгенерил с нуля.
  state.currentBoonChoices = null;

  // Последний левелап подтверждён. Куда возвращаемся?
  // Если волны кончились и врагов нет — это была отложенная победа.
  const allWavesDone = state.waves.current >= MAX_WAVES_FOR_WIN;
  const noEnemiesLeft = state.enemies.length === 0;

  if (allWavesDone && noEnemiesLeft && state.waves.state === 'fighting') {
    state.runState = 'won';
  } else {
    state.runState = 'playing';
  }
}