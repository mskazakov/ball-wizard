// src/enemyProjectiles.ts
// Логика снарядов врагов: движение, попадание в игрока, удаление за границами арены.
// Экспортирует: updateEnemyProjectiles — главная функция, вызывается каждый кадр.
//
// Снаряды создаются в enemies.ts (стрелки), удаляются здесь:
//   - при попадании в игрока (если игрок не в i-frames)
//   - при выходе за границы арены

import type { GameState, EnemyProjectile, Vec2 } from './utils/types';
import { distanceSquared } from './utils/math';

const PLAYER_I_FRAMES_MS = 500;
const PLAYER_RED_FLASH_MS = 250;

/**
 * Главная функция системы снарядов врагов. Вызывается раз за кадр.
 * Порядок:
 *   1) подвинуть все снаряды
 *   2) убрать вышедшие за арену
 *   3) проверить попадания в игрока
 */
export function updateEnemyProjectiles(state: GameState): void {
  moveProjectiles(state);
  cullOutOfArena(state);
  resolveHitsOnPlayer(state);
}

function moveProjectiles(state: GameState): void {
  const dtSec = state.time.deltaTime / 1000;

  for (const p of state.enemyProjectiles) {
    p.position.x += p.velocity.x * dtSec;
    p.position.y += p.velocity.y * dtSec;
  }
}

/**
 * Удаляет снаряды вышедшие за границы арены. Без запаса —
 * как только центр пересёк границу, снаряд удаляется.
 */
function cullOutOfArena(state: GameState): void {
  const w = state.arena.width;
  const h = state.arena.height;

  state.enemyProjectiles = state.enemyProjectiles.filter(
    (p) => p.position.x >= 0 && p.position.x <= w && p.position.y >= 0 && p.position.y <= h,
  );
}

/**
 * Проверяет попадания снарядов врагов в игрока.
 * При попадании — урон, i-frames, красная вспышка экрана, снаряд удаляется.
 * В i-frames снаряды НЕ удаляются — пролетают сквозь игрока (игрок прозрачный
 * 0.5с после удара, физика снаряда продолжается). Это важно: иначе залп из 5
 * снарядов поглощается одним i-frames-окном "бесплатно".
 *
 * При срабатывании урона дальнейшие попадания в этом же кадре игнорируются —
 * один удар за кадр, как и контактный урон от грунтов.
 */
function resolveHitsOnPlayer(state: GameState): void {
  const player = state.player;
  const playerHalf = player.size / 2;
  const inIFrames = state.time.now < player.iFramesUntil;

  // Один удар за кадр. После удара — собираем оставшиеся снаряды,
  // прошедшие в новый массив без поглотителя.
  let damageTaken = false;
  const survivors: EnemyProjectile[] = [];

  for (const p of state.enemyProjectiles) {
    if (damageTaken) {
      survivors.push(p);
      continue;
    }
    if (inIFrames) {
      // Игрок прозрачный — снаряд пролетает сквозь, не удаляется
      survivors.push(p);
      continue;
    }
    if (isHittingPlayer(p, player.position, playerHalf)) {
      // Попадание: наносим урон, снаряд исчезает (НЕ кладём в survivors)
      player.hp -= p.damage;
      player.iFramesUntil = state.time.now + PLAYER_I_FRAMES_MS;
      player.redFlashUntil = state.time.now + PLAYER_RED_FLASH_MS;
      damageTaken = true;
      continue;
    }
    survivors.push(p);
  }

  state.enemyProjectiles = survivors;

  // Game Over
  if (player.hp <= 0) {
    player.hp = 0;
    state.runState = 'gameOver';
  }
}

/**
 * Попадание круглого снаряда в квадратного игрока (AABB vs круг).
 * Та же логика что и для контактного урона грунтов.
 */
function isHittingPlayer(p: EnemyProjectile, playerPos: Vec2, playerHalf: number): boolean {
  const closestX = clamp(p.position.x, playerPos.x - playerHalf, playerPos.x + playerHalf);
  const closestY = clamp(p.position.y, playerPos.y - playerHalf, playerPos.y + playerHalf);
  const dSq = distanceSquared({ x: closestX, y: closestY }, p.position);
  return dSq <= p.radius * p.radius;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}