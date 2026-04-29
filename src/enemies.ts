// src/enemies.ts
// Логика врагов: AI движения, стрельба стрелков, контактный урон игроку.
// Экспортирует: updateEnemies — главная функция, вызывается каждый кадр.

import type { GameState, Enemy, Grunt, Shooter, Vec2, EnemyProjectile } from './utils/types';
import { distanceSquared, normalize, subtract } from './utils/math';

// --- I-frames игрока ---
const PLAYER_I_FRAMES_MS = 500;
const PLAYER_RED_FLASH_MS = 250;

// --- Knockback (день 6) ---
const KNOCKBACK_DECAY = 0.001;
const KNOCKBACK_STOP_THRESHOLD = 5;

// --- Ghost HP (день 6) ---
const GHOST_HP_DELAY_MS = 200;
const GHOST_HP_CATCHUP_SPEED = 90;

// --- Стрельба стрелка ---
/** Базовый интервал между выстрелами стрелка (мс). */
const SHOOTER_FIRE_INTERVAL_MS = 2000;
/** Случайный jitter ±N% от базового интервала, чтобы стрелки не палили синхронно. */
const SHOOTER_FIRE_JITTER = 0.2;
/** Скорость снаряда стрелка (px/сек). */
const SHOOTER_PROJECTILE_SPEED = 350;
/** Урон от снаряда стрелка. */
const SHOOTER_PROJECTILE_DAMAGE = 20;
/** Радиус снаряда стрелка для отрисовки и коллизий. */
const SHOOTER_PROJECTILE_RADIUS = 8;

/**
 * Главная функция системы врагов. Вызывается раз за кадр.
 * Порядок:
 *   1) подвинуть всех врагов согласно их AI
 *   2) стрелки стреляют если готовы
 *   3) обновить ghost HP
 *   4) проверить контактные столкновения с игроком
 */
export function updateEnemies(state: GameState): void {
  moveEnemies(state);
  fireShooters(state);
  updateGhostHp(state);
  resolveContactDamage(state);
}

// ------------------------------------------------------------
// Движение (AI: по типу врага)
// ------------------------------------------------------------

/**
 * Каждый враг двигается согласно своему AI.
 * Knockback применяется поверх любого движения, одинаково для всех типов.
 */
function moveEnemies(state: GameState): void {
  const dtSec = state.time.deltaTime / 1000;

  for (const enemy of state.enemies) {
    // 1) Движение по типу врага
    const aiVelocity = getAiVelocity(enemy, state);
    enemy.position.x += aiVelocity.x * dtSec;
    enemy.position.y += aiVelocity.y * dtSec;

    // 2) Knockback поверх AI-движения
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
 * Возвращает желаемую скорость движения врага в px/сек по каждой оси.
 * AI зависит от типа: грунт идёт к игроку, стрелок держит дистанцию.
 */
function getAiVelocity(enemy: Enemy, state: GameState): Vec2 {
  switch (enemy.kind) {
    case 'grunt':
      return getGruntVelocity(enemy, state);
    case 'shooter':
      return getShooterVelocity(enemy, state);
  }
}

/** Грунт: тупо идёт к игроку. */
function getGruntVelocity(enemy: Grunt, state: GameState): Vec2 {
  const dir = directionTo(enemy.position, state.player.position);
  return { x: dir.x * enemy.speed, y: dir.y * enemy.speed };
}

/**
 * Стрелок:
 *   - дальше idealDistance: приближается
 *   - между keepDistance и idealDistance: стоит (мёртвая зона)
 *   - ближе keepDistance: отступает (кайтит)
 */
function getShooterVelocity(enemy: Shooter, state: GameState): Vec2 {
  const dir = directionTo(enemy.position, state.player.position);
  const distSq = distanceSquared(enemy.position, state.player.position);
  const idealSq = enemy.idealDistance * enemy.idealDistance;
  const keepSq = enemy.keepDistance * enemy.keepDistance;

  if (distSq > idealSq) {
    // Слишком далеко — приближаемся
    return { x: dir.x * enemy.speed, y: dir.y * enemy.speed };
  }
  if (distSq < keepSq) {
    // Слишком близко — отступаем (направление от игрока)
    return { x: -dir.x * enemy.speed, y: -dir.y * enemy.speed };
  }
  // Мёртвая зона — стоим
  return { x: 0, y: 0 };
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
// Стрельба стрелков
// ------------------------------------------------------------

/**
 * Все стрелки которые готовы (state.time.now >= nextShotAt) выпускают снаряд
 * в текущую позицию игрока. Без упреждения — игрок может уворачиваться движением.
 * После выстрела ставится новый кулдаун с jitter.
 *
 * Стреляют независимо от расстояния — даже на максимальной дистанции снаряд летит,
 * просто долго и игрок успевает уйти. Это ок: стрелок издалека = меньше угроза.
 */
function fireShooters(state: GameState): void {
  const now = state.time.now;

  for (const enemy of state.enemies) {
    if (enemy.kind !== 'shooter') continue;
    if (now < enemy.nextShotAt) continue;

    spawnShooterProjectile(state, enemy);
    enemy.nextShotAt = now + nextShotInterval();
  }
}

/** Создаёт снаряд стрелка, летящий в текущую позицию игрока. */
function spawnShooterProjectile(state: GameState, shooter: Shooter): void {
  const dir = directionTo(shooter.position, state.player.position);

  const projectile: EnemyProjectile = {
    position: { x: shooter.position.x, y: shooter.position.y },
    velocity: {
      x: dir.x * SHOOTER_PROJECTILE_SPEED,
      y: dir.y * SHOOTER_PROJECTILE_SPEED,
    },
    radius: SHOOTER_PROJECTILE_RADIUS,
    damage: SHOOTER_PROJECTILE_DAMAGE,
  };

  state.enemyProjectiles.push(projectile);
}

/** Возвращает интервал до следующего выстрела с случайным jitter ±SHOOTER_FIRE_JITTER. */
function nextShotInterval(): number {
  const jitter = (Math.random() * 2 - 1) * SHOOTER_FIRE_JITTER; // [-J, +J]
  return SHOOTER_FIRE_INTERVAL_MS * (1 + jitter);
}

// ------------------------------------------------------------
// Контактный урон игроку
// ------------------------------------------------------------

/**
 * Если враг касается игрока и игрок не в i-frames — наносим урон, запускаем i-frames.
 * Только грунты наносят контактный урон. Стрелки урон при касании не дают —
 * только снарядами (касаться стрелка безопасно, можно подойти и расстрелять).
 */
function resolveContactDamage(state: GameState): void {
  const player = state.player;

  if (state.time.now < player.iFramesUntil) return;

  const playerHalf = player.size / 2;

  for (const enemy of state.enemies) {
    if (enemy.kind !== 'grunt') continue;
    if (!isContacting(enemy, player.position, playerHalf)) continue;

    player.hp -= enemy.contactDamage;
    player.iFramesUntil = state.time.now + PLAYER_I_FRAMES_MS;
    player.redFlashUntil = state.time.now + PLAYER_RED_FLASH_MS;
    break; // один удар за кадр
  }

  // Game Over: HP до нуля или ниже.
  if (player.hp <= 0) {
    player.hp = 0;
    state.runState = 'gameOver';
  }
}

/**
 * Проверка пересечения круглого врага с квадратным игроком.
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

// ------------------------------------------------------------
// Ghost HP
// ------------------------------------------------------------

/**
 * Призрачное HP плавно догоняет реальное.
 * После последнего удара (используем flashUntil как маркер) выжидаем
 * 90 + GHOST_HP_DELAY_MS, потом догоняем со скоростью GHOST_HP_CATCHUP_SPEED.
 *
 * Хардкод 90 — длительность вспышки врага из projectiles.ts. Техдолг
 * (см. CURRENT_STATE.md, день 6 недели 1).
 */
function updateGhostHp(state: GameState): void {
  const dtSec = state.time.deltaTime / 1000;

  for (const enemy of state.enemies) {
    if (enemy.ghostHp <= enemy.hp) {
      enemy.ghostHp = enemy.hp;
      continue;
    }

    const timeSinceFlashStart = state.time.now - (enemy.flashUntil - 90);
    if (timeSinceFlashStart < 90 + GHOST_HP_DELAY_MS) continue;

    enemy.ghostHp -= GHOST_HP_CATCHUP_SPEED * dtSec;
    if (enemy.ghostHp < enemy.hp) enemy.ghostHp = enemy.hp;
  }
}