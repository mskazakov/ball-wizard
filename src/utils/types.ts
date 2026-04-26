// src/utils/types.ts
// Централизованные TS-типы проекта. Все интерфейсы игры — здесь.
// Экспортирует: Vec2, Player, Arena, Camera, InputState, TimeState,
// Projectile, Target, GameState.

/** 2D-вектор. Используется для позиций, скоростей, направлений. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Состояние игрока. Координаты — мировые. */
export interface Player {
  position: Vec2;
  size: number; // сторона квадрата в пикселях
  speed: number; // пикселей в секунду

  // --- Стрельба ---
  attackRadius: number; // в пределах какого радиуса игрок ищет цель
  ballSackSize: number; // ёмкость обоймы (макс. шаров до перезарядки)
  ballSackCurrent: number; // сколько шаров осталось до перезарядки
  fireRate: number; // мс между выстрелами в обойме
  lastShotAt: number; // timestamp (state.time.now) последнего выстрела
  reloadTime: number; // мс на полную перезарядку
  reloadProgress: number; // 0..reloadTime; -1 если сейчас не перезаряжаемся

  // --- Здоровье ---
  hp: number; // текущее здоровье
  maxHp: number; // максимальное здоровье
  iFramesUntil: number; // до какого state.time.now игрок неуязвим
}

/** Арена — игровое поле, больше экрана. */
export interface Arena {
  width: number;
  height: number;
}

/** Камера. Хранит верхний левый угол в мировых координатах. */
export interface Camera {
  x: number;
  y: number;
}

/** Состояние ввода. Обновляется обработчиками клавиатуры/мыши. */
export interface InputState {
  keys: Set<string>;
}

/** Время игры. Обновляется в начале каждого кадра. */
export interface TimeState {
  now: number; // ms с начала игры
  deltaTime: number; // ms с прошлого кадра
}

/** Автошар, выпущенный игроком. Координаты — мировые. */
export interface Projectile {
  position: Vec2;
  velocity: Vec2; // пикселей в секунду по каждой оси
  radius: number; // визуальный радиус для отрисовки и коллизий
  damage: number; // урон при попадании
}

/**
 * Враг "грунт" — медленно идёт к игроку, наносит контактный урон.
 * Координаты — мировые.
 */
export interface Enemy {
  position: Vec2;
  radius: number; // для отрисовки и коллизий
  hp: number;
  maxHp: number;
  speed: number; // пикселей в секунду
  contactDamage: number; // урон игроку при касании
}

/** Главный объект состояния игры. Передаётся во все системы. */
export interface GameState {
  player: Player;
  arena: Arena;
  camera: Camera;
  input: InputState;
  time: TimeState;
  projectiles: Projectile[];
  enemies: Enemy[];
}