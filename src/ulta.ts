// src/ulta.ts
// Ульта Ball-istics — пробивной снайперский выстрел.
// Кастуется кликом мыши, летит из игрока в точку курсора, пробивает
// всех врагов на линии, удаляется при выходе за арену.
// Экспортирует:
//   - castUlta: спавнит снаряд, ставит кулдаун. Вызывается из input.ts.
//   - updateUltaProjectiles: каждый кадр двигает снаряды и наносит урон.

import type { GameState, UltaProjectile, Vec2 } from './utils/types';
import { normalize, subtract, distanceSquared } from './utils/math';

// --- Параметры ульты (день 1 недели 3, тюним по ощущениям) ---
/** Кулдаун в мс между кастами. */
const ULTA_COOLDOWN_MS = 8000;
/** Базовый урон. Ваншотит грунта (40), стрелка (30), рашера (15) — by design на дне 1. */
const ULTA_DAMAGE = 50;
/** Скорость снаряда (px/сек). Заметно быстрее автошара (900) — снайперский фил. */
const ULTA_SPEED = 1400;
/** Радиус хитбокса/визуала. Толще автошара (6) — пока единственный feedback. */
const ULTA_RADIUS = 10;

// --- Hit feedback (унаследовано от шаров) ---
const ENEMY_FLASH_DURATION_MS = 90;

/**
 * Каст ульты. Вызывается обработчиком клика когда runState='playing'.
 * Если ульта на кулдауне — вызывающий должен это проверить ДО вызова.
 * Здесь страховка тоже есть, но без неё работает корректно.
 *
 * targetWorld — мировые координаты точки клика (НЕ экранные).
 * Вызывающий обязан перевести экранные координаты через state.camera.
 *
 * Если игрок кликает в свою же позицию (нулевой вектор направления) —
 * normalize вернёт {0,0} и снаряд останется на месте, бесконечно вися
 * на старте. Защищаемся: при нулевом направлении просто не кастуем
 * (кулдаун не тратится).
 */
export function castUlta(state: GameState, targetWorld: Vec2): void {
  const p = state.player;
  if (state.time.now < p.ultaReadyAt) return;

  const direction = normalize(subtract(targetWorld, p.position));
  if (direction.x === 0 && direction.y === 0) return;

  const projectile: UltaProjectile = {
    position: { x: p.position.x, y: p.position.y },
    velocity: {
      x: direction.x * ULTA_SPEED,
      y: direction.y * ULTA_SPEED,
    },
    radius: ULTA_RADIUS,
    damage: ULTA_DAMAGE,
    hitEnemies: new Set(),
  };

  state.ultaProjectiles.push(projectile);
  p.ultaReadyAt = state.time.now + ULTA_COOLDOWN_MS;
}

/**
 * Каждый кадр: двигаем снаряды → проверяем коллизии → удаляем вылетевшие.
 *
 * Коллизии устроены иначе чем у автошар:
 *   - снаряд НЕ удаляется при попадании (пробивной)
 *   - каждый враг бьётся ровно один раз на снаряд (через Set hitEnemies)
 *   - knockback не ставим (см. план дня 1: feedback — день 2)
 *
 * Удаление мёртвых врагов и начисление xp — общая система cleanupDead
 * в game.ts, здесь не дублируем.
 */
export function updateUltaProjectiles(state: GameState): void {
  moveUltaProjectiles(state);
  resolveUltaHits(state);
  cleanupUltaProjectiles(state);
}

function moveUltaProjectiles(state: GameState): void {
  const dtSec = state.time.deltaTime / 1000;
  for (const proj of state.ultaProjectiles) {
    proj.position.x += proj.velocity.x * dtSec;
    proj.position.y += proj.velocity.y * dtSec;
  }
}

/**
 * Для каждого снаряда — проверка пересечения с каждым врагом.
 * Врагам, которым снаряд уже наносил урон (есть в hitEnemies), пропускаем —
 * это позволяет снаряду продолжить лететь и не бить того же дважды.
 */
function resolveUltaHits(state: GameState): void {
  for (const proj of state.ultaProjectiles) {
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      if (proj.hitEnemies.has(e)) continue;

      const collisionRadius = proj.radius + e.radius;
      const dSq = distanceSquared(proj.position, e.position);
      if (dSq > collisionRadius * collisionRadius) continue;

      e.hp -= proj.damage;
      e.flashUntil = state.time.now + ENEMY_FLASH_DURATION_MS;
      proj.hitEnemies.add(e);
    }
  }
}

function cleanupUltaProjectiles(state: GameState): void {
  const { width, height } = state.arena;
  state.ultaProjectiles = state.ultaProjectiles.filter((proj) => {
    if (proj.position.x < 0 || proj.position.x > width) return false;
    if (proj.position.y < 0 || proj.position.y > height) return false;
    return true;
  });
}
