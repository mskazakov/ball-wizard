// game.ts — главный игровой цикл.
// Запускается один раз через startGame, дальше вызывает себя через requestAnimationFrame
// 60 раз в секунду. На этом этапе только очищает canvas — логика и отрисовка появятся в следующие дни.

// --- Константы цикла ---
const CLEAR_COLOR = '#000';

/**
 * Точка входа в игру. Вызывается из main.ts после настройки canvas.
 * Запускает бесконечный цикл обновления и отрисовки.
 *
 * @param canvas — настроенный HTMLCanvasElement
 * @param ctx — 2D-контекст этого canvas
 */
export function startGame(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): void {
  /**
   * Один кадр игры. Будет вызываться браузером 60 раз в секунду.
   */
  function frame(): void {
    // Очистка экрана
    ctx.fillStyle = CLEAR_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Запросить следующий кадр
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}