// src/game.ts
// Главный игровой цикл. Каждый кадр: обновить время → обновить логику → отрисовать.

import type { GameState } from './utils/types';
import { updatePlayer } from './player';
import { updateCamera } from './arena';
import { updateProjectiles } from './projectiles';
import { updateEnemies } from './enemies';
import { updateWaves } from './waves';
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

    // Обновление логики
    // Порядок важен: сначала игрок (двигается), потом враги, потом шары
    // (стреляют из обновлённой позиции игрока в обновлённую позицию врагов),
    // потом cleanup (убираем мёртвых единым местом — единственный источник истины
    // про "враг умер"), потом камера (следит за позицией игрока).
    updatePlayer(state);
    updateEnemies(state);
    updateProjectiles(state);
    cleanupDead(state);
    updateWaves(state);
    updateCamera(state);

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
 */
function cleanupDead(state: GameState): void {
  state.enemies = state.enemies.filter((e) => e.hp > 0);
}