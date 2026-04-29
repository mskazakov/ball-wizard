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
const ENEMY_COLOR = '#e74c3c'; // красный
const ENEMY_HP_BG = '#222222';
const ENEMY_HP_FG = '#2ecc71';

// --- HP-бар врага ---
const HP_BAR_WIDTH = 50;
const HP_BAR_HEIGHT = 5;
const HP_BAR_OFFSET_Y = 8; // сколько px над врагом

// --- HP-индикатор игрока (текстом, в углу экрана) ---
const PLAYER_HP_TEXT_COLOR = '#ffffff';
const PLAYER_HP_TEXT_FONT = '20px monospace';
const PLAYER_HP_TEXT_X = 16;
const PLAYER_HP_TEXT_Y = 28;

// --- Текст номера волны (правый верхний угол) ---
const WAVE_TEXT_COLOR = '#ffffff';
const WAVE_TEXT_FONT = '20px monospace';
const WAVE_TEXT_RIGHT_PADDING = 16;
const WAVE_TEXT_Y = 28;

// --- Экран победы ---
const WIN_OVERLAY_COLOR = 'rgba(0, 0, 0, 0.7)';
const WIN_TEXT_COLOR = '#ffe066';
const WIN_TEXT_FONT = 'bold 64px monospace';

// --- Подсветка игрока в i-frames (после получения урона) ---
const PLAYER_IFRAMES_COLOR = '#ff5555'; // красноватый, пока неуязвим

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
 *   4) враги и их HP-бары
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

  // 4) Враги
  drawEnemies(ctx, state);

  // 5) Шары
  drawProjectiles(ctx, state);

  // 6) Игрок
  drawPlayer(ctx, state);

  // 7) HUD (поверх всего, в экранных координатах)
  drawHud(ctx, state);
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
 * Рисует врагов: красный круг + HP-бар над ним.
 * Мёртвых врагов в массиве уже нет (удаляются в projectiles.resolveHits),
 * поэтому проверка alive не нужна.
 */
function drawEnemies(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const e of state.enemies) {
    const screen = worldToScreen(e.position, state);

    ctx.fillStyle = ENEMY_COLOR;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, e.radius, 0, Math.PI * 2);
    ctx.fill();

    // HP-бар
    const barX = screen.x - HP_BAR_WIDTH / 2;
    const barY = screen.y - e.radius - HP_BAR_OFFSET_Y - HP_BAR_HEIGHT;

    ctx.fillStyle = ENEMY_HP_BG;
    ctx.fillRect(barX, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    const hpRatio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = ENEMY_HP_FG;
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
 * Во время i-frames рисуется красноватым (для теста — заменим вспышкой в дне 6).
 */
function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState): void {
  const half = state.player.size / 2;
  const screen = worldToScreen(state.player.position, state);
  const isInvulnerable = state.time.now < state.player.iFramesUntil;
  ctx.fillStyle = isInvulnerable ? PLAYER_IFRAMES_COLOR : PLAYER_COLOR;
  ctx.fillRect(screen.x - half, screen.y - half, state.player.size, state.player.size);
}

/**
 * HUD дня 5 — HP игрока (слева) и номер волны (справа).
 * Поверх всего: экран победы если waves.state === 'won'.
 * Полноценный HUD (полоса, иконки бунов) — день 6 недели 2.
 */
function drawHud(ctx: CanvasRenderingContext2D, state: GameState): void {
  const canvas = ctx.canvas;

  // HP игрока (слева)
  ctx.fillStyle = PLAYER_HP_TEXT_COLOR;
  ctx.font = PLAYER_HP_TEXT_FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(
    `HP: ${Math.max(0, Math.ceil(state.player.hp))} / ${state.player.maxHp}`,
    PLAYER_HP_TEXT_X,
    PLAYER_HP_TEXT_Y,
  );

  // Номер волны (справа)
  ctx.fillStyle = WAVE_TEXT_COLOR;
  ctx.font = WAVE_TEXT_FONT;
  ctx.textAlign = 'right';
  ctx.fillText(
    `Wave ${state.waves.current} / 5`,
    canvas.width - WAVE_TEXT_RIGHT_PADDING,
    WAVE_TEXT_Y,
  );

  // Экран победы
  if (state.waves.state === 'won') {
    drawWinScreen(ctx);
  }

  // Сбрасываем textAlign на дефолт, чтобы не повлиять на другой код
  ctx.textAlign = 'left';
}

/**
 * Полупрозрачная заливка + крупный текст "YOU WIN" по центру.
 * Кнопка рестарта появится в дне 7.
 */
function drawWinScreen(ctx: CanvasRenderingContext2D): void {
  const canvas = ctx.canvas;

  ctx.fillStyle = WIN_OVERLAY_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = WIN_TEXT_COLOR;
  ctx.font = WIN_TEXT_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('YOU WIN', canvas.width / 2, canvas.height / 2);

  ctx.textBaseline = 'alphabetic'; // вернуть дефолт
}