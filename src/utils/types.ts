// src/utils/types.ts
// Централизованные TS-типы проекта. Все интерфейсы игры — здесь.
// Экспортирует: Vec2, Player, Arena, Camera, InputState, TimeState, GameState.

/** 2D-вектор. Используется для позиций и скоростей. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Состояние игрока. Координаты — мировые. */
export interface Player {
  position: Vec2;
  size: number; // сторона квадрата в пикселях
  speed: number; // пикселей в секунду
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

/** Главный объект состояния игры. Передаётся во все системы. */
export interface GameState {
  player: Player;
  arena: Arena;
  camera: Camera;
  input: InputState;
  time: TimeState;
}