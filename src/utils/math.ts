// src/utils/math.ts
// Векторная математика. Чистые функции, без сайд-эффектов.
// Экспортирует: distance, distanceSquared, subtract, normalize, scale.

import type { Vec2 } from './types';

/**
 * Евклидово расстояние между двумя точками.
 * Использовать когда нужно реальное расстояние (например для UI или сравнения с радиусом).
 */
export function distance(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Квадрат расстояния. Быстрее чем distance (без sqrt).
 * Использовать для сравнений: "что ближе" — сравнивать квадраты тоже корректно.
 */
export function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

/**
 * Разность векторов: from → to. Возвращает направление и величину "из a в b".
 */
export function subtract(to: Vec2, from: Vec2): Vec2 {
  return { x: to.x - from.x, y: to.y - from.y };
}

/**
 * Нормализация — приводит вектор к длине 1.
 * Если входной вектор нулевой — возвращает {0, 0}.
 */
export function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/** Умножение вектора на скаляр. */
export function scale(v: Vec2, factor: number): Vec2 {
  return { x: v.x * factor, y: v.y * factor };
}