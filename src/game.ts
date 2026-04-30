// src/game.ts
// Главный игровой цикл. Каждый кадр: обновить время → обновить логику → отрисовать.

import type { GameState } from './utils/types';
import { updatePlayer } from './player';
import { updateCamera } from './arena';
import { updateProjectiles } from './projectiles';
import { updateEnemies } from './enemies';
import { updateEnemyProjectiles } from './enemyProjectiles';
import { updateWaves } from './waves';
import { grantXp } from './xp';
import { render } from './render';

/**
 * Точка входа в игру. Вызывается из main.ts.
 * Запускает бесконечный цикл через requestAnimationFrame.
 *
 * @param canvas — настроенный HTMLCanvasElement
 * @param ctx — 2D-контекст этого canvas
 * @param state — начальное состояние игры
 */
export function startGame(
  _canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  let lastTime = performance.now();

  /**
   * Один кадр игры. Браузер вызывает ~60 раз в секунду.
   */
  function frame(now: number): void {
    
    // Обновляем время. deltaTime — мс с прошлого кадра.
    state.time.deltaTime = now - lastTime;
    state.time.now = now;
    lastTime = now;

    // Защита от больших скачков (например при возврате из неактивной вкладки).
    // Если deltaTime > 100 мс, ограничиваем — иначе игрок улетит сквозь стену.
    if (state.time.deltaTime > 100) {
      state.time.deltaTime = 100;
    }

    // Обновление логики — только пока ран идёт.
    // На 'won', 'gameOver' и 'levelup' всё замораживается: игрок не двигается,
    // шары не летят, враги стоят. Рендер продолжает работать — рисует финальный
    // кадр + оверлей.
    if (state.runState === 'playing') {
      updatePlayer(state);
      updateEnemies(state);
      updateEnemyProjectiles(state);
      updateProjectiles(state);
      cleanupDead(state);
      updateWaves(state);
      updateCamera(state);
    }

    // Отрисовка
    render(ctx, state);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

/**
 * Единое место удаления мёртвых сущностей. Вызывается раз за кадр
 * после всех систем, которые могут наносить урон.
 *
 * Принцип: системы урона (шары, в будущем — ульта, контактный урон врагов)
 * только проставляют hp -= damage. Удаление — здесь.
 * Это позволяет добавлять новые источники урона, не дублируя фильтрацию.
 *
 * Здесь же — единая точка начисления xp за убийство. Все мёртвые враги
 * проходят через эту функцию, поэтому нет риска "забыли начислить xp
 * при новом источнике урона". Принцип симметричный с урон → cleanup:
 * убил враг → xp начислится, кто бы ни нанёс финальный удар.
 *
 * Важно: сначала суммируем весь xp с мёртвых, потом один раз вызываем grantXp.
 * Так если за один кадр убили несколько врагов — runState='levelup' выставится
 * корректно по итоговому xp, а не по первому пересечению порога.
 */
function cleanupDead(state: GameState): void {
  let xpFromKills = 0;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) {
      xpFromKills += enemy.xpReward;
    }
  }

  state.enemies = state.enemies.filter((e) => e.hp > 0);

  if (xpFromKills > 0) {
    grantXp(state, xpFromKills);
  }
}