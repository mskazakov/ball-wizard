// src/render.ts
// Отрисовка игры на canvas. Знает про экранные координаты.
// Экспортирует:
//   - render: рисует один кадр
//   - getRestartButtonRect: геометрия кнопки RESTART (won/gameOver)
//   - getBoonButtonRects: геометрия 3 кнопок бунов (levelup)

import type { BoonId, GameState, Vec2 } from './utils/types';
import { BOON_DEFINITIONS } from './boons';

// --- Цвета ---
const BG_COLOR = '#000000';
const ARENA_BORDER_COLOR = '#222222';
const PLAYER_COLOR = '#ffffff';
const ATTACK_RADIUS_COLOR = 'rgba(120, 200, 255, 0.25)'; // полупрозрачный голубой
const PROJECTILE_COLOR = '#ffe066'; // жёлтый
const ENEMY_GRUNT_COLOR = '#e74c3c'; // красный — грунт
const ENEMY_SHOOTER_COLOR = '#9b59b6'; // фиолетовый — стрелок (визуально отличим от грунта)
const ENEMY_RUSHER_COLOR = '#f39c12'; // жёлто-оранжевый — рашер (заметно отличается от грунта и стрелка)
const ENEMY_FLASH_COLOR = '#ffffff'; // вспышка при попадании
const ENEMY_PROJECTILE_COLOR = '#ff8c00'; // оранжевый — снаряд стрелка
const ENEMY_HP_BG = '#222222';
const ENEMY_HP_FG = '#2ecc71';
const ENEMY_HP_GHOST = '#ffffff'; // белая полоса между реальным HP и ghost HP

// --- HP-бар врага ---
const HP_BAR_WIDTH = 50;
const HP_BAR_HEIGHT = 5;
const HP_BAR_OFFSET_Y = 8; // сколько px над врагом

// --- HP-индикатор игрока (текстом, в углу экрана) ---
const PLAYER_HP_TEXT_COLOR = '#ffffff';
const PLAYER_HP_TEXT_FONT = '20px monospace';
const PLAYER_HP_TEXT_X = 16;
const PLAYER_HP_TEXT_Y = 28;

// --- XP-бар сверху экрана (на всю ширину) ---
const XP_BAR_HEIGHT = 6;
const XP_BAR_BG = '#1a1a2e';
const XP_BAR_FG = '#4ec9ff';
const LEVEL_TEXT_COLOR = '#ffffff';
const LEVEL_TEXT_FONT = '14px monospace';
const LEVEL_TEXT_OFFSET_Y = 4;

// --- Текст номера волны (правый верхний угол) ---
const WAVE_TEXT_COLOR = '#ffffff';
const WAVE_TEXT_FONT = '20px monospace';
const WAVE_TEXT_RIGHT_PADDING = 16;
const WAVE_TEXT_Y = 28;

// --- Экран победы ---
const WIN_OVERLAY_COLOR = 'rgba(0, 0, 0, 0.7)';
const WIN_TEXT_COLOR = '#ffe066';
const WIN_TEXT_FONT = 'bold 64px monospace';

// --- Экран левелапа ---
const LEVELUP_OVERLAY_COLOR = 'rgba(0, 20, 40, 0.7)';
const LEVELUP_TEXT_COLOR = '#4ec9ff';
const LEVELUP_TEXT_FONT = 'bold 64px monospace';
const LEVELUP_SUBTITLE_COLOR = '#ffffff';
const LEVELUP_SUBTITLE_FONT = '20px monospace';

/**
 * Y-координата центра заголовка "LEVEL UP" относительно центра canvas.
 * Заголовок поднят выше центра, чтобы освободить место под подзаголовок
 * и горизонтальный ряд из 3 кнопок бунов под ним.
 */
const LEVELUP_TITLE_OFFSET_Y = -180;
/** Отступ подзаголовка от заголовка (вниз). */
const LEVELUP_SUBTITLE_OFFSET_Y = 50;

// --- Кнопки бунов на экране левелапа ---
const BOON_BTN_WIDTH = 220;
const BOON_BTN_HEIGHT = 140;
/** Зазор между соседними кнопками. */
const BOON_BTN_GAP = 24;
/** Сколько px ниже центра canvas — верхний край кнопок. */
const BOON_BTN_OFFSET_Y = -40;
const BOON_BTN_BG = '#ffffff';
const BOON_BTN_BG_HOVER = '#e8e8e8'; // зарезервировано на будущее
const BOON_BTN_BORDER = '#4ec9ff';
const BOON_BTN_BORDER_WIDTH = 3;
const BOON_BTN_NAME_COLOR = '#000000';
const BOON_BTN_NAME_FONT = 'bold 22px monospace';
const BOON_BTN_DESC_COLOR = '#444444';
const BOON_BTN_DESC_FONT = '16px monospace';
/** Отступ имени буна от верха кнопки. */
const BOON_BTN_NAME_OFFSET_Y = 36;
/** Отступ описания от имени. */
const BOON_BTN_DESC_OFFSET_Y = 70;

// --- Экран Game Over ---
const GAMEOVER_OVERLAY_COLOR = 'rgba(40, 0, 0, 0.7)';
const GAMEOVER_TEXT_COLOR = '#ff6666';
const GAMEOVER_TEXT_FONT = 'bold 64px monospace';

// --- Кнопка рестарта (won/gameOver) ---
const RESTART_BTN_WIDTH = 240;
const RESTART_BTN_HEIGHT = 60;
const RESTART_BTN_OFFSET_Y = 60;
const RESTART_BTN_BG = '#ffffff';
const RESTART_BTN_TEXT_COLOR = '#000000';
const RESTART_BTN_FONT = 'bold 24px monospace';
const RESTART_BTN_LABEL = 'RESTART';

// --- Подсветка игрока в i-frames ---
const PLAYER_IFRAMES_COLOR = '#ff5555';

// --- Красная вспышка экрана при уроне ---
const RED_FLASH_DURATION_MS = 250;
const RED_FLASH_MAX_ALPHA = 0.2;

/** Прямоугольник в экранных координатах. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Переводит мировые координаты в экранные с учётом камеры. */
function worldToScreen(world: Vec2, state: GameState): Vec2 {
  return {
    x: world.x - state.camera.x,
    y: world.y - state.camera.y,
  };
}

/**
 * Рисует один кадр. Порядок отрисовки снизу вверх по слоям:
 *   1) фон → 2) арена → 3) радиус атаки → 4) враги → 5) шары игрока
 *   → 6) снаряды врагов → 7) игрок → 8) HUD → 9) красная вспышка.
 */
export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const canvas = ctx.canvas;

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = ARENA_BORDER_COLOR;
  ctx.lineWidth = 4;
  ctx.strokeRect(
    0 - state.camera.x,
    0 - state.camera.y,
    state.arena.width,
    state.arena.height,
  );

  drawAttackRadius(ctx, state);
  drawEnemies(ctx, state);
  drawProjectiles(ctx, state);
  drawEnemyProjectiles(ctx, state);
  drawPlayer(ctx, state);
  drawHud(ctx, state);
  drawDamageFlash(ctx, state);
}

function drawAttackRadius(ctx: CanvasRenderingContext2D, state: GameState): void {
  const center = worldToScreen(state.player.position, state);
  ctx.fillStyle = ATTACK_RADIUS_COLOR;
  ctx.beginPath();
  ctx.arc(center.x, center.y, state.player.attackRadius, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemies(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const e of state.enemies) {
    const screen = worldToScreen(e.position, state);

    const isFlashing = state.time.now < e.flashUntil;
    const baseColor = getEnemyColor(e.kind);
    ctx.fillStyle = isFlashing ? ENEMY_FLASH_COLOR : baseColor;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, e.radius, 0, Math.PI * 2);
    ctx.fill();

    const barX = screen.x - HP_BAR_WIDTH / 2;
    const barY = screen.y - e.radius - HP_BAR_OFFSET_Y - HP_BAR_HEIGHT;

    ctx.fillStyle = ENEMY_HP_BG;
    ctx.fillRect(barX, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    const ghostRatio = Math.max(0, e.ghostHp / e.maxHp);
    ctx.fillStyle = ENEMY_HP_GHOST;
    ctx.fillRect(barX, barY, HP_BAR_WIDTH * ghostRatio, HP_BAR_HEIGHT);

    const hpRatio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = ENEMY_HP_FG;
    ctx.fillRect(barX, barY, HP_BAR_WIDTH * hpRatio, HP_BAR_HEIGHT);
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = PROJECTILE_COLOR;
  for (const proj of state.projectiles) {
    const screen = worldToScreen(proj.position, state);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, proj.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemyProjectiles(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = ENEMY_PROJECTILE_COLOR;
  for (const proj of state.enemyProjectiles) {
    const screen = worldToScreen(proj.position, state);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, proj.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState): void {
  const half = state.player.size / 2;
  const screen = worldToScreen(state.player.position, state);
  const isInvulnerable = state.time.now < state.player.iFramesUntil;
  ctx.fillStyle = isInvulnerable ? PLAYER_IFRAMES_COLOR : PLAYER_COLOR;
  ctx.fillRect(screen.x - half, screen.y - half, state.player.size, state.player.size);
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState): void {
  const canvas = ctx.canvas;

  drawXpBar(ctx, state);

  ctx.fillStyle = PLAYER_HP_TEXT_COLOR;
  ctx.font = PLAYER_HP_TEXT_FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(
    `HP: ${Math.max(0, Math.ceil(state.player.hp))} / ${state.player.maxHp}`,
    PLAYER_HP_TEXT_X,
    PLAYER_HP_TEXT_Y,
  );

  ctx.fillStyle = WAVE_TEXT_COLOR;
  ctx.font = WAVE_TEXT_FONT;
  ctx.textAlign = 'right';
  ctx.fillText(
    `Wave ${state.waves.current} / 5`,
    canvas.width - WAVE_TEXT_RIGHT_PADDING,
    WAVE_TEXT_Y,
  );

  if (state.runState === 'won') {
    drawWinScreen(ctx);
  } else if (state.runState === 'gameOver') {
    drawGameOverScreen(ctx);
  } else if (state.runState === 'levelup') {
    drawLevelUpScreen(ctx, state);
  }

  ctx.textAlign = 'left';
}

function drawXpBar(ctx: CanvasRenderingContext2D, state: GameState): void {
  const canvas = ctx.canvas;
  const player = state.player;

  ctx.fillStyle = XP_BAR_BG;
  ctx.fillRect(0, 0, canvas.width, XP_BAR_HEIGHT);

  const ratio = Math.min(1, player.xp / player.xpToNextLevel);
  ctx.fillStyle = XP_BAR_FG;
  ctx.fillRect(0, 0, canvas.width * ratio, XP_BAR_HEIGHT);

  ctx.fillStyle = LEVEL_TEXT_COLOR;
  ctx.font = LEVEL_TEXT_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `Lv ${player.level}`,
    canvas.width / 2,
    XP_BAR_HEIGHT + LEVEL_TEXT_OFFSET_Y,
  );
}

/**
 * Экран левелапа: оверлей + "LEVEL UP" + подзаголовок + 3 кнопки бунов.
 *
 * Буны берутся из state.currentBoonChoices (сгенерированы в waves.ts при
 * входе в 'levelup'). Если по какой-то причине массив пуст или null —
 * рисуем заглушку, чтобы не падать. Это защита от бага, нормальный путь
 * через waves.ts всегда заполняет массив до перехода в 'levelup'.
 */
function drawLevelUpScreen(ctx: CanvasRenderingContext2D, state: GameState): void {
  const canvas = ctx.canvas;

  ctx.fillStyle = LEVELUP_OVERLAY_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = LEVELUP_TEXT_COLOR;
  ctx.font = LEVELUP_TEXT_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    'LEVEL UP',
    canvas.width / 2,
    canvas.height / 2 + LEVELUP_TITLE_OFFSET_Y,
  );

  ctx.fillStyle = LEVELUP_SUBTITLE_COLOR;
  ctx.font = LEVELUP_SUBTITLE_FONT;
  const pending = state.player.pendingLevelUps;
  const subtitle =
    pending > 1
      ? `Lv ${state.player.level} — choose boon (${pending} pending)`
      : `Lv ${state.player.level} — choose boon`;
  ctx.fillText(
    subtitle,
    canvas.width / 2,
    canvas.height / 2 + LEVELUP_TITLE_OFFSET_Y + LEVELUP_SUBTITLE_OFFSET_Y,
  );

  const choices = state.currentBoonChoices;
  if (choices && choices.length > 0) {
    drawBoonButtons(ctx, choices);
  }

  ctx.textBaseline = 'alphabetic';
}

/** Рисует ряд кнопок бунов по геометрии из getBoonButtonRects. */
function drawBoonButtons(ctx: CanvasRenderingContext2D, choices: BoonId[]): void {
  const rects = getBoonButtonRects(ctx.canvas, choices.length);

  for (let i = 0; i < choices.length; i++) {
    const rect = rects[i];
    const def = BOON_DEFINITIONS[choices[i]];

    ctx.fillStyle = BOON_BTN_BG;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    ctx.strokeStyle = BOON_BTN_BORDER;
    ctx.lineWidth = BOON_BTN_BORDER_WIDTH;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    ctx.fillStyle = BOON_BTN_NAME_COLOR;
    ctx.font = BOON_BTN_NAME_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(def.name, rect.x + rect.w / 2, rect.y + BOON_BTN_NAME_OFFSET_Y);

    ctx.fillStyle = BOON_BTN_DESC_COLOR;
    ctx.font = BOON_BTN_DESC_FONT;
    ctx.fillText(
      def.description,
      rect.x + rect.w / 2,
      rect.y + BOON_BTN_DESC_OFFSET_Y,
    );
  }

  // Сохраняем заглушку BG_HOVER от tree-shaker, понадобится в дне 5+
  void BOON_BTN_BG_HOVER;
}

/**
 * Геометрия кнопок бунов в экранных координатах.
 * Кнопки в ряд по центру по горизонтали, на BOON_BTN_OFFSET_Y по вертикали.
 *
 * Используется и в render (для отрисовки), и в input (для проверки клика
 * по индексу буна — клик в i-ю кнопку = выбор state.currentBoonChoices[i]).
 */
export function getBoonButtonRects(canvas: HTMLCanvasElement, count: number): Rect[] {
  const totalWidth = count * BOON_BTN_WIDTH + (count - 1) * BOON_BTN_GAP;
  const startX = canvas.width / 2 - totalWidth / 2;
  const y = canvas.height / 2 + BOON_BTN_OFFSET_Y;

  const rects: Rect[] = [];
  for (let i = 0; i < count; i++) {
    rects.push({
      x: startX + i * (BOON_BTN_WIDTH + BOON_BTN_GAP),
      y,
      w: BOON_BTN_WIDTH,
      h: BOON_BTN_HEIGHT,
    });
  }
  return rects;
}

function drawWinScreen(ctx: CanvasRenderingContext2D): void {
  const canvas = ctx.canvas;

  ctx.fillStyle = WIN_OVERLAY_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = WIN_TEXT_COLOR;
  ctx.font = WIN_TEXT_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('YOU WIN', canvas.width / 2, canvas.height / 2 - 40);

  drawCenterButton(ctx, RESTART_BTN_LABEL);

  ctx.textBaseline = 'alphabetic';
}

function drawGameOverScreen(ctx: CanvasRenderingContext2D): void {
  const canvas = ctx.canvas;

  ctx.fillStyle = GAMEOVER_OVERLAY_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = GAMEOVER_TEXT_COLOR;
  ctx.font = GAMEOVER_TEXT_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);

  drawCenterButton(ctx, RESTART_BTN_LABEL);

  ctx.textBaseline = 'alphabetic';
}

/**
 * Рисует белую кнопку с лейблом по центру (ниже заголовка экрана).
 * Используется только для RESTART на won/gameOver. На levelup теперь
 * 3 кнопки бунов (см. drawBoonButtons).
 */
function drawCenterButton(ctx: CanvasRenderingContext2D, label: string): void {
  const rect = getRestartButtonRect(ctx.canvas);

  ctx.fillStyle = RESTART_BTN_BG;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  ctx.fillStyle = RESTART_BTN_TEXT_COLOR;
  ctx.font = RESTART_BTN_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

/** Геометрия кнопки RESTART на won/gameOver. */
export function getRestartButtonRect(canvas: HTMLCanvasElement): Rect {
  return {
    x: canvas.width / 2 - RESTART_BTN_WIDTH / 2,
    y: canvas.height / 2 + RESTART_BTN_OFFSET_Y,
    w: RESTART_BTN_WIDTH,
    h: RESTART_BTN_HEIGHT,
  };
}

function drawDamageFlash(ctx: CanvasRenderingContext2D, state: GameState): void {
  const remaining = state.player.redFlashUntil - state.time.now;
  if (remaining <= 0) return;

  const ratio = remaining / RED_FLASH_DURATION_MS;
  const alpha = RED_FLASH_MAX_ALPHA * ratio;

  const canvas = ctx.canvas;
  ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function getEnemyColor(kind: 'grunt' | 'shooter' | 'rusher'): string {
  switch (kind) {
    case 'grunt':
      return ENEMY_GRUNT_COLOR;
    case 'shooter':
      return ENEMY_SHOOTER_COLOR;
    case 'rusher':
      return ENEMY_RUSHER_COLOR;
  }
}