// src/enemies.ts
// Логика врагов: AI движения и контактный урон игроку.
// Экспортирует: updateEnemies — главная функция, вызывается каждый кадр.
//
// Спавн врагов появится в дне 5 (волны). Удаление мёртвых врагов
// происходит в projectiles.resolveHits — там, где их убивают.

import type { GameState, Enemy, Vec2 } from './utils/types';
import { distanceSquared, normalize, subtract } from './utils/math';

// --- I-frames игрока ---
const PLAYER_I_FRAMES_MS = 500; // длительность неуязвимости после удара
/** Сколько мс длится красная вспышка экрана при уроне. */
const PLAYER_RED_FLASH_MS = 250;

// --- Knockback (день 6) ---
/**
 * Множитель затухания knockback за секунду. 0.001 значит за 1с скорость падает в 1000 раз.
 * Применяется как pow(KNOCKBACK_DECAY, dtSec).
 */
const KNOCKBACK_DECAY = 0.001;
/** Если скорость knockback меньше этого порога — обнуляем (px/сек). */
const KNOCKBACK_STOP_THRESHOLD = 5;

// --- Ghost HP (день 6) ---
/** Задержка перед началом догоняния hp (мс) — чтобы белая полоса успела "висеть". */
const GHOST_HP_DELAY_MS = 200;
/** Скорость догоняния ghostHp в HP/сек после задержки. */
const GHOST_HP_CATCHUP_SPEED = 90;

/**
 * Главная функция системы врагов. Вызывается раз за кадр.
 * Порядок:
 *   1) подвинуть всех врагов к игроку
 *   2) проверить контактные столкновения с игроком
 */
export function updateEnemies(state: GameState): void {
  moveEnemies(state);
  updateGhostHp(state);
  resolveContactDamage(state);
}

// ------------------------------------------------------------
// Движение (AI: тупо идём к игроку)
// ------------------------------------------------------------

/**
 * Каждый враг двигается к позиции игрока со своей скоростью.
 * Если враг уже на позиции игрока (расстояние ~0) — не двигается,
 * чтобы не делить на ноль в normalize.
 */
function moveEnemies(state: GameState): void {
  const dtSec = state.time.deltaTime / 1000;
  const playerPos = state.player.position;

  for (const enemy of state.enemies) {
    // 1) Обычное движение к игроку
    const direction = directionTo(enemy.position, playerPos);
    enemy.position.x += direction.x * enemy.speed * dtSec;
    enemy.position.y += direction.y * enemy.speed * dtSec;

    // 2) Knockback (применяется поверх обычного движения)
    enemy.position.x += enemy.knockbackVelocity.x * dtSec;
    enemy.position.y += enemy.knockbackVelocity.y * dtSec;

    // 3) Затухание knockback. pow(decay, dtSec) — фрейм-рейт независимо.
    const decay = Math.pow(KNOCKBACK_DECAY, dtSec);
    enemy.knockbackVelocity.x *= decay;
    enemy.knockbackVelocity.y *= decay;

    // 4) Обнуляем если почти ноль
    if (
      Math.abs(enemy.knockbackVelocity.x) < KNOCKBACK_STOP_THRESHOLD &&
      Math.abs(enemy.knockbackVelocity.y) < KNOCKBACK_STOP_THRESHOLD
    ) {
      enemy.knockbackVelocity.x = 0;
      enemy.knockbackVelocity.y = 0;
    }
  }
}

/**
 * Нормализованный вектор из `from` в `to`. Если точки совпадают — возвращает {0,0}.
 */
function directionTo(from: Vec2, to: Vec2): Vec2 {
  const diff = subtract(to, from);
  if (diff.x === 0 && diff.y === 0) return { x: 0, y: 0 };
  return normalize(diff);
}

// ------------------------------------------------------------
// Контактный урон игроку
// ------------------------------------------------------------

/**
 * Если враг касается игрока и игрок не в i-frames — наносим урон, запускаем i-frames.
 * Один враг = один удар за касание (пока он касается, урон идёт раз в i-frames-цикл).
 * Останавливающего эффекта нет: враги продолжают двигаться сквозь игрока.
 *
 * Решение "не отталкивать врагов от игрока" — сознательное упрощение дня 4.
 * Если в дне 6 hit feedback покажет что это ощущается странно — добавим knockback.
 */
function resolveContactDamage(state: GameState): void {
  const player = state.player;

  // В i-frames — никто не наносит урон
  if (state.time.now < player.iFramesUntil) return;

  const playerHalf = player.size / 2;

  for (const enemy of state.enemies) {
    if (isContacting(enemy, player.position, playerHalf)) {
      player.hp -= enemy.contactDamage;
      player.iFramesUntil = state.time.now + PLAYER_I_FRAMES_MS;
      player.redFlashUntil = state.time.now + PLAYER_RED_FLASH_MS;
      // Только один удар за кадр: не получаем урон от 5 врагов сразу
      break;
    }
  }

  // Логика "Game Over" будет в дне 7. Сейчас HP может уйти в минус —
  // визуально клампится в drawHud, дальше пока не идём.
}

/**
 * Проверка пересечения круглого врага с квадратным игроком.
 * Используется AABB-приближение игрока (квадрат, центр в position, сторона = size).
 * Для врага-круга считаем что хитбокс — круг радиуса enemy.radius.
 *
 * Грубо но достаточно: ближайшая к врагу точка квадрата находится
 * клампом координат врага в границы квадрата, потом расстояние от неё до центра врага.
 */
function isContacting(enemy: Enemy, playerPos: Vec2, playerHalf: number): boolean {
  const closestX = clamp(enemy.position.x, playerPos.x - playerHalf, playerPos.x + playerHalf);
  const closestY = clamp(enemy.position.y, playerPos.y - playerHalf, playerPos.y + playerHalf);
  const dSq = distanceSquared({ x: closestX, y: closestY }, enemy.position);
  return dSq <= enemy.radius * enemy.radius;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Призрачное HP плавно догоняет реальное.
 * Логика: после получения урона ghostHp > hp. Через GHOST_HP_DELAY_MS
 * после последней вспышки (используем flashUntil как маркер последнего попадания)
 * ghostHp начинает уменьшаться к hp со скоростью GHOST_HP_CATCHUP_SPEED HP/сек.
 *
 * Использование flashUntil как timestamp удара: flashUntil = удар + 90мс,
 * значит "удар был в момент now < flashUntil" мы трактуем как "только что попали".
 * Задержка догоняния = пока (flashUntil - now) > 0, мы внутри окна вспышки + delay.
 */
function updateGhostHp(state: GameState): void {
  const dtSec = state.time.deltaTime / 1000;

  for (const enemy of state.enemies) {
    if (enemy.ghostHp <= enemy.hp) {
      // Реальное HP уже догнало или равно — синхронизируем (на случай отрицательного hp)
      enemy.ghostHp = enemy.hp;
      continue;
    }

    // Ждём пока пройдёт окно вспышки + задержка
    const timeSinceFlashStart = state.time.now - (enemy.flashUntil - 90);
    if (timeSinceFlashStart < 90 + GHOST_HP_DELAY_MS) continue;

    // Догоняем
    enemy.ghostHp -= GHOST_HP_CATCHUP_SPEED * dtSec;
    if (enemy.ghostHp < enemy.hp) enemy.ghostHp = enemy.hp;
  }
}