// src/render.ts
// Отрисовка игры на canvas. Знает про экранные координаты.
// Экспортирует: render — рисует один кадр.

import type { GameState, Vec2 } from './utils/types';

// --- Цвета ---
const BG_COLOR = '#000000';
const ARENA_BORDER_COLOR = '#222222';
const PLAYER_COLOR = '#ffffff';
const ATTACK_RADIUS_COLOR = 'rgba(120, 200, 255, 0.25)'; // полупрозрачный голубой
const PROJECTILE_COLOR = '#ffe066'; // жёлтый
const TARGET_COLOR = '#e74c3c'; // красный
const TARGET_DEAD_COLOR = '#444444'; // серый, мёртвая мишень
const TARGET_HP_BG = '#222222';
const TARGET_HP_FG = '#2ecc71';

// --- Размеры HP-бара мишени ---
const HP_BAR_WIDTH = 50;
const HP_BAR_HEIGHT = 5;
const HP_BAR_OFFSET_Y = 8; // сколько px над мишенью

/**
 * Переводит мировые координаты в экранные с учётом камеры.
 */
function worldToScreen(world: Vec2, state: GameState): Vec2 {
  return {
    x: world.x - state.camera.x,
    y: world.y - state.camera.y,
  };
}

/**
 * Рисует один кадр.
 * Порядок отрисовки (снизу вверх по слоям):
 *   1) фон
 *   2) граница арены
 *   3) радиус атаки игрока (под всем остальным, чтобы не мешал)
 *   4) мишени и их HP-бары
 *   5) шары
 *   6) игрок
 */
export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const canvas = ctx.canvas;

  // 1) Очистка экрана
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2) Граница арены
  ctx.strokeStyle = ARENA_BORDER_COLOR;
  ctx.lineWidth = 4;
  ctx.strokeRect(
    0 - state.camera.x,
    0 - state.camera.y,
    state.arena.width,
    state.arena.height,
  );

  // 3) Радиус атаки игрока (визуализация для теста)
  drawAttackRadius(ctx, state);

  // 4) Мишени
  drawTargets(ctx, state);

  // 5) Шары
  drawProjectiles(ctx, state);

  // 6) Игрок
  drawPlayer(ctx, state);
}

/**
 * Полупрозрачный круг вокруг игрока — показывает зону, в которой он ищет цель.
 */
function drawAttackRadius(ctx: CanvasRenderingContext2D, state: GameState): void {
  const center = worldToScreen(state.player.position, state);
  ctx.fillStyle = ATTACK_RADIUS_COLOR;
  ctx.beginPath();
  ctx.arc(center.x, center.y, state.player.attackRadius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Рисует мишени: красный круг + HP-бар над ним.
 * Мёртвая мишень рисуется серой и без HP-бара.
 */
function drawTargets(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const t of state.targets) {
    const screen = worldToScreen(t.position, state);

    ctx.fillStyle = t.alive ? TARGET_COLOR : TARGET_DEAD_COLOR;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, t.radius, 0, Math.PI * 2);
    ctx.fill();

    if (!t.alive) continue;

    // HP-бар
    const barX = screen.x - HP_BAR_WIDTH / 2;
    const barY = screen.y - t.radius - HP_BAR_OFFSET_Y - HP_BAR_HEIGHT;

    ctx.fillStyle = TARGET_HP_BG;
    ctx.fillRect(barX, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    const hpRatio = Math.max(0, t.hp / t.maxHp);
    ctx.fillStyle = TARGET_HP_FG;
    ctx.fillRect(barX, barY, HP_BAR_WIDTH * hpRatio, HP_BAR_HEIGHT);
  }
}

/**
 * Рисует все активные шары как жёлтые круги.
 */
function drawProjectiles(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = PROJECTILE_COLOR;
  for (const proj of state.projectiles) {
    const screen = worldToScreen(proj.position, state);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, proj.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Игрок — белый квадрат, центр в player.position.
 */
function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState): void {
  const half = state.player.size / 2;
  const screen = worldToScreen(state.player.position, state);
  ctx.fillStyle = PLAYER_COLOR;
  ctx.fillRect(screen.x - half, screen.y - half, state.player.size, state.player.size);
}