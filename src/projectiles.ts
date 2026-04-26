// src/projectiles.ts
// Логика автошаров: поиск цели, выстрел, движение, столкновения, перезарядка.
// Экспортирует: updateProjectiles — главная функция, вызывается каждый кадр.

import type { GameState, Projectile, Target, Vec2 } from './utils/types';
import { distanceSquared, normalize, scale, subtract } from './utils/math';

// --- Параметры шара ---
const PROJECTILE_RADIUS = 6; // визуальный радиус и хитбокс
const PROJECTILE_SPEED = 900; // пикселей в секунду
const PROJECTILE_DAMAGE = 10;

/**
 * Главная функция системы шаров. Вызывается раз за кадр.
 * Порядок операций важен:
 *   1) обработать перезарядку (она может закончиться и разрешить выстрел в этом же кадре)
 *   2) попытаться выстрелить (если можно)
 *   3) подвинуть существующие шары
 *   4) проверить столкновения с мишенями
 *   5) удалить шары, вылетевшие за арену или попавшие в цель
 */
export function updateProjectiles(state: GameState): void {
  updateReload(state);
  tryShoot(state);
  moveProjectiles(state);
  resolveHits(state);
  cleanupProjectiles(state);
}

// ------------------------------------------------------------
// Перезарядка
// ------------------------------------------------------------

/**
 * Если игрок сейчас перезаряжается — продвигаем прогресс.
 * Когда прогресс достигает reloadTime — обойма заполнена, перезарядка снимается.
 */
function updateReload(state: GameState): void {
  const p = state.player;
  if (p.reloadProgress < 0) return; // не перезаряжаемся

  p.reloadProgress += state.time.deltaTime;

  if (p.reloadProgress >= p.reloadTime) {
    p.ballSackCurrent = p.ballSackSize;
    p.reloadProgress = -1;
  }
}

// ------------------------------------------------------------
// Выстрел
// ------------------------------------------------------------

/**
 * Пытается выстрелить в этом кадре.
 * Условия выстрела:
 *   - не на перезарядке
 *   - в обойме есть шары
 *   - прошло >= fireRate мс с прошлого выстрела
 *   - есть цель в радиусе атаки
 */
function tryShoot(state: GameState): void {
  const p = state.player;

  if (p.reloadProgress >= 0) return; // на перезарядке
  if (p.ballSackCurrent <= 0) return; // обойма пуста (страховка)
  if (state.time.now - p.lastShotAt < p.fireRate) return; // слишком рано

  const target = findNearestTarget(state);
  if (!target) return; // нет цели — не стреляем

  spawnProjectile(state, p.position, target.position);

  p.ballSackCurrent -= 1;
  p.lastShotAt = state.time.now;

  // Если это был последний шар — запускаем перезарядку
  if (p.ballSackCurrent <= 0) {
    p.reloadProgress = 0;
  }
}

/**
 * Ищет ближайшую живую мишень в пределах attackRadius игрока.
 * Возвращает null если таких нет.
 */
function findNearestTarget(state: GameState): Target | null {
  const p = state.player;
  const radiusSq = p.attackRadius * p.attackRadius;

  let nearest: Target | null = null;
  let nearestDistSq = Infinity;

  for (const t of state.targets) {
    if (!t.alive) continue;
    const dSq = distanceSquared(p.position, t.position);
    if (dSq > radiusSq) continue; // вне радиуса
    if (dSq < nearestDistSq) {
      nearestDistSq = dSq;
      nearest = t;
    }
  }

  return nearest;
}

/**
 * Создаёт новый шар, летящий из позиции `from` в направлении `to`.
 * Скорость и урон — константы из этого файла.
 */
function spawnProjectile(state: GameState, from: Vec2, to: Vec2): void {
  const direction = normalize(subtract(to, from));
  const velocity = scale(direction, PROJECTILE_SPEED);

  const projectile: Projectile = {
    position: { x: from.x, y: from.y },
    velocity,
    radius: PROJECTILE_RADIUS,
    damage: PROJECTILE_DAMAGE,
  };

  state.projectiles.push(projectile);
}

// ------------------------------------------------------------
// Движение
// ------------------------------------------------------------

/**
 * Каждый шар двигается по своей velocity * deltaTime.
 * deltaTime в мс, скорость в пикс/сек, поэтому делим на 1000.
 */
function moveProjectiles(state: GameState): void {
  const dtSec = state.time.deltaTime / 1000;
  for (const proj of state.projectiles) {
    proj.position.x += proj.velocity.x * dtSec;
    proj.position.y += proj.velocity.y * dtSec;
  }
}

// ------------------------------------------------------------
// Столкновения с мишенями
// ------------------------------------------------------------

/**
 * Проверяет каждый шар на пересечение с каждой живой мишенью.
 * Шары, попавшие в цель, помечаются velocity={0,0} и удаляются в cleanup —
 * это упрощает логику (нет "удаления во время итерации").
 */
function resolveHits(state: GameState): void {
  for (const proj of state.projectiles) {
    if (proj.velocity.x === 0 && proj.velocity.y === 0) continue; // уже отработал

    for (const t of state.targets) {
      if (!t.alive) continue;

      const collisionRadius = proj.radius + t.radius;
      const dSq = distanceSquared(proj.position, t.position);
      if (dSq > collisionRadius * collisionRadius) continue;

      // Попали
      t.hp -= proj.damage;
      if (t.hp <= 0) {
        t.alive = false;
      }
      // Помечаем шар на удаление
      proj.velocity.x = 0;
      proj.velocity.y = 0;
      break;
    }
  }
}

// ------------------------------------------------------------
// Удаление шаров
// ------------------------------------------------------------

/**
 * Удаляем шары, которые:
 *   - помечены как отработавшие (velocity = 0)
 *   - вылетели за пределы арены
 */
function cleanupProjectiles(state: GameState): void {
  const { width, height } = state.arena;
  state.projectiles = state.projectiles.filter((proj) => {
    if (proj.velocity.x === 0 && proj.velocity.y === 0) return false;
    if (proj.position.x < 0 || proj.position.x > width) return false;
    if (proj.position.y < 0 || proj.position.y > height) return false;
    return true;
  });
}