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
/** Высота полосы в пикселях. Тонкая, чтобы не отъедать игровое поле. */
const XP_BAR_HEIGHT = 6;
/** Цвет фона xp-бара — приглушённый, не отвлекает периферию. */
const XP_BAR_BG = '#1a1a2e';
/** Цвет заполнения — голубой, контрастно к зелёным HP-барам и красным/оранжевым врагам. */
const XP_BAR_FG = '#4ec9ff';
/**
 * Отступ "Lv N" от xp-бара. Уровень рисуется по центру под полосой,
 * мелким шрифтом — нужен только когда захочешь свериться, не лезет в глаз.
 */
const LEVEL_TEXT_COLOR = '#ffffff';
const LEVEL_TEXT_FONT = '14px monospace';
const LEVEL_TEXT_OFFSET_Y = 4; // сколько px ниже xp-бара

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
/** Подзаголовок под "LEVEL UP" — показывает на какой уровень переходим. */
const LEVELUP_SUBTITLE_COLOR = '#ffffff';
const LEVELUP_SUBTITLE_FONT = '20px monospace';
const LEVELUP_SUBTITLE_OFFSET_Y = 30; // ниже заголовка

// --- Кнопка Continue (на экране левелапа) ---
const CONTINUE_BTN_LABEL = 'CONTINUE';

// --- Экран Game Over ---
const GAMEOVER_OVERLAY_COLOR = 'rgba(40, 0, 0, 0.7)';
const GAMEOVER_TEXT_COLOR = '#ff6666';
const GAMEOVER_TEXT_FONT = 'bold 64px monospace';

// --- Кнопка рестарта (общая для обоих экранов) ---
/**
 * Прямоугольник кнопки в экранных координатах.
 * Координаты считаются в drawRestartButton от центра canvas, ниже текста заголовка.
 * Эти же значения читает обработчик клика в input.ts через getRestartButtonRect().
 */
const RESTART_BTN_WIDTH = 240;
const RESTART_BTN_HEIGHT = 60;
const RESTART_BTN_OFFSET_Y = 60; // на сколько px ниже центра экрана
const RESTART_BTN_BG = '#ffffff';
const RESTART_BTN_TEXT_COLOR = '#000000';
const RESTART_BTN_FONT = 'bold 24px monospace';
const RESTART_BTN_LABEL = 'RESTART';

// --- Подсветка игрока в i-frames (после получения урона) ---
const PLAYER_IFRAMES_COLOR = '#ff5555'; // красноватый, пока неуязвим

// --- Красная вспышка экрана при уроне ---
/** Длительность вспышки в мс — должна совпадать с PLAYER_RED_FLASH_MS в enemies.ts. */
const RED_FLASH_DURATION_MS = 250;
/** Максимальная прозрачность вспышки в момент удара (0..1). */
const RED_FLASH_MAX_ALPHA = 0.2;

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

  // 5) Шары игрока
  drawProjectiles(ctx, state);

  // 5.5) Снаряды врагов
  drawEnemyProjectiles(ctx, state);

  // 6) Игрок
  drawPlayer(ctx, state);

  // 7) HUD (поверх всего, в экранных координатах)
  drawHud(ctx, state);

  // 8) Красная вспышка при уроне игроку — поверх HUD, чтобы накрыть весь экран
  drawDamageFlash(ctx, state);
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

    const isFlashing = state.time.now < e.flashUntil;
    const baseColor = getEnemyColor(e.kind);
    ctx.fillStyle = isFlashing ? ENEMY_FLASH_COLOR : baseColor;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, e.radius, 0, Math.PI * 2);
    ctx.fill();

    // HP-бар
    const barX = screen.x - HP_BAR_WIDTH / 2;
    const barY = screen.y - e.radius - HP_BAR_OFFSET_Y - HP_BAR_HEIGHT;

    ctx.fillStyle = ENEMY_HP_BG;
    ctx.fillRect(barX, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    // Призрачный HP — белая полоса от реального HP до ghostHp
    const ghostRatio = Math.max(0, e.ghostHp / e.maxHp);
    ctx.fillStyle = ENEMY_HP_GHOST;
    ctx.fillRect(barX, barY, HP_BAR_WIDTH * ghostRatio, HP_BAR_HEIGHT);

    // Реальный HP — зелёная полоса поверх белой (рисуется сверху, поэтому видна)
    const hpRatio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = ENEMY_HP_FG;
    ctx.fillRect(barX, barY, HP_BAR_WIDTH * hpRatio, HP_BAR_HEIGHT);
  }
}

/**
 * Рисует все активные шары игрока как жёлтые круги.
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
 * Рисует снаряды врагов как оранжевые круги.
 * Отдельная функция от drawProjectiles, чтобы не путать визуально:
 * жёлтые шары — твои, оранжевые — летят в тебя.
 */
function drawEnemyProjectiles(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = ENEMY_PROJECTILE_COLOR;
  for (const proj of state.enemyProjectiles) {
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

  // XP-бар сверху на всю ширину (день 3 недели 2).
  // Рисуется первым в HUD, потому что его место — самый верх экрана.
  drawXpBar(ctx, state);

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

  // Финальные оверлеи: победа или поражение.
  // Оба останавливают игру (см. game.ts) и показывают кнопку рестарта.
  if (state.runState === 'won') {
    drawWinScreen(ctx);
  } else if (state.runState === 'gameOver') {
    drawGameOverScreen(ctx);
  } else if (state.runState === 'levelup') {
    drawLevelUpScreen(ctx, state);
  }

  // Сбрасываем textAlign на дефолт, чтобы не повлиять на другой код
  ctx.textAlign = 'left';
}

/**
 * XP-бар на всю ширину canvas, у самого верха экрана.
 * Под ним — мелким текстом по центру "Lv N" (для редкой проверки уровня,
 * не отвлекает периферию во время боя).
 *
 * Полоса заполняется от 0 до xpToNextLevel. В состоянии 'levelup'
 * полоса визуально полная (xp >= xpToNextLevel) — клампим до 1, чтобы
 * не вылезала за пределы при xp > порога (например после убийства стрелка
 * с порога 2/2 → 5/2).
 */
function drawXpBar(ctx: CanvasRenderingContext2D, state: GameState): void {
  const canvas = ctx.canvas;
  const player = state.player;

  // Фон полосы
  ctx.fillStyle = XP_BAR_BG;
  ctx.fillRect(0, 0, canvas.width, XP_BAR_HEIGHT);

  // Заполнение
  const ratio = Math.min(1, player.xp / player.xpToNextLevel);
  ctx.fillStyle = XP_BAR_FG;
  ctx.fillRect(0, 0, canvas.width * ratio, XP_BAR_HEIGHT);

  // Уровень текстом по центру под полосой
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
 * Экран левелапа: оверлей + "LEVEL UP" + подзаголовок "Lv N → N+1" + кнопка Continue.
 * День 3 недели 2: только заглушка-кнопка, выбора бунов нет.
 * День 4 недели 2: вместо одной кнопки — 3 кнопки с бунами.
 *
 * Хитбокс кнопки — тот же getRestartButtonRect, label другой. Это сознательное
 * переиспользование: одна кнопка по центру = одна геометрия. Когда в дне 4
 * появятся 3 кнопки, тут будет своя getBoonButtonRects.
 */
function drawLevelUpScreen(ctx: CanvasRenderingContext2D, state: GameState): void {
  const canvas = ctx.canvas;

  ctx.fillStyle = LEVELUP_OVERLAY_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = LEVELUP_TEXT_COLOR;
  ctx.font = LEVELUP_TEXT_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LEVEL UP', canvas.width / 2, canvas.height / 2 - 40);

  // Подзаголовок: текущий уровень и сколько ещё выборов осталось.
  // Уровень уже повышен в момент набора xp (см. grantXp), здесь только
  // подтверждение буна. День 4: будет 3 кнопки бунов вместо одной.
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
    canvas.height / 2 - 40 + LEVELUP_SUBTITLE_OFFSET_Y,
  );

  // Кнопка Continue — переиспользуем геометрию кнопки рестарта.
  // День 4: заменим на 3 кнопки бунов.
  drawCenterButton(ctx, CONTINUE_BTN_LABEL);

  ctx.textBaseline = 'alphabetic';
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
  ctx.fillText('YOU WIN', canvas.width / 2, canvas.height / 2 - 40);

  drawCenterButton(ctx, RESTART_BTN_LABEL);

  ctx.textBaseline = 'alphabetic'; // вернуть дефолт
}

/**
 * Полупрозрачная заливка + крупный текст "GAME OVER" по центру + кнопка рестарта.
 */
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

  ctx.textBaseline = 'alphabetic'; // вернуть дефолт
}

/**
 * Рисует белую кнопку с произвольным лейблом по центру (ниже заголовка экрана).
 * Используется для RESTART (на 'won'/'gameOver') и CONTINUE (на 'levelup').
 * Геометрия одна — getRestartButtonRect — поэтому хитбокс клика общий.
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

/**
 * Возвращает прямоугольник кнопки рестарта в экранных координатах.
 * Используется и в render (для отрисовки), и в input (для проверки клика).
 *
 * @returns {x, y, w, h} — верхний левый угол, ширина, высота
 */
export function getRestartButtonRect(canvas: HTMLCanvasElement): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  return {
    x: canvas.width / 2 - RESTART_BTN_WIDTH / 2,
    y: canvas.height / 2 + RESTART_BTN_OFFSET_Y,
    w: RESTART_BTN_WIDTH,
    h: RESTART_BTN_HEIGHT,
  };
}

/**
 * Красная полупрозрачная заливка поверх всего экрана при получении урона.
 * Прозрачность линейно затухает от RED_FLASH_MAX_ALPHA до 0 за RED_FLASH_DURATION_MS.
 */
function drawDamageFlash(ctx: CanvasRenderingContext2D, state: GameState): void {
  const remaining = state.player.redFlashUntil - state.time.now;
  if (remaining <= 0) return;

  const ratio = remaining / RED_FLASH_DURATION_MS; // 1 в момент удара, 0 в конце
  const alpha = RED_FLASH_MAX_ALPHA * ratio;

  const canvas = ctx.canvas;
  ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Цвет круга врага по типу. Хелпер чтобы drawEnemies не превращался в гнездо тернарников.
 * При добавлении нового типа врага — добавляем один case, TypeScript заставит обработать.
 */
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