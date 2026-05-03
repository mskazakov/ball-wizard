// src/utils/types.ts
// Централизованные TS-типы проекта. Все интерфейсы игры — здесь.
// Экспортирует: Vec2, Player, Arena, Camera, InputState, TimeState,
// Projectile, Enemy, WaveState, Waves, GameState.

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

/**
   * Множитель урона от бунов. Стартовое значение — 1. Буну "More damage"
   * прибавляет 0.25 (аддитивно, по решению дня 4 недели 2).
   * Шары при создании читают BASE_DAMAGE * player.damageMultiplier.
   */
  damageMultiplier: number;

  /**
   * Сколько шаров выпускается за один выстрел. Стартовое значение — 1.
   * Бун "More projectiles" прибавляет +1 (cap 2 → максимум 3 шара).
   * При >1 шары летят веером с углом 15° между соседними.
   */
  projectilesPerShot: number;

  // --- Здоровье ---
  hp: number; // текущее здоровье
  maxHp: number; // максимальное здоровье
  iFramesUntil: number; // до какого state.time.now игрок неуязвим

  // --- Hit feedback (день 6) ---
  /** До какого state.time.now экран залит красным после получения урона. */
  redFlashUntil: number;

  // --- Прогрессия (день 3 недели 2) ---
  /** Текущий уровень игрока. Стартовое значение — 1. */
  level: number;
  /** Накопленный опыт на текущем уровне. Сбрасывается в 0 при левелапе. */
  xp: number;
  /**
   * Сколько xp нужно набрать на текущем уровне для перехода на следующий.
   * Brotato-style кривая: на уровне 1 — 2, на 2 — 4, на 3 — 7, шаг растёт на 1.
   */
  xpToNextLevel: number;
  /**
   * Сколько ещё левелапов игрок не подтвердил. Накапливается в grantXp при
   * каждом пересечении порога. Декрементится в confirmLevelUp.
   * Левелап-экран показывается пока > 0.
   *
   * Зачем счётчик, а не просто флаг runState='levelup': если за один кадр
   * пересечено несколько порогов (теоретически возможно с буном "+xp" или
   * убийством толпы за раз), нужно показать N экранов подряд, не один.
   */
  pendingLevelUps: number;
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

/**
 * Размер видимой области (canvas) в пикселях.
 * Заполняется один раз при инициализации игры из реального canvas.
 * Используется системами которым нужно знать "что видит игрок"
 * (например спавн врагов за пределами кадра).
 */
export interface Viewport {
  width: number;
  height: number;
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
 * Общие поля любого врага. Поведение и параметры конкретного типа
 * определяются конкретным интерфейсом-наследником через дискриминатор kind.
 */
interface EnemyBase {
  position: Vec2;
  radius: number; // для отрисовки и коллизий
  hp: number;
  maxHp: number;
  speed: number; // пикселей в секунду

  // --- Hit feedback (день 6) ---
  /** До какого state.time.now враг подсвечен белым после попадания. */
  flashUntil: number;
  /**
   * Призрачное HP — копия hp, которая плавно догоняет реальное при уроне.
   * Рисуется белой полосой над основной HP-полосой как в Доте.
   */
  ghostHp: number;
  /**
   * Скорость отталкивания от удара (px/сек). Затухает каждый кадр,
   * прибавляется к обычному движению. {0,0} = нет knockback.
   */
  knockbackVelocity: Vec2;
  /**
   * Сколько xp получает игрок при убийстве этого врага.
   * День 3 недели 2: грунт=1, стрелок=3, рашер=2.
   */
  xpReward: number;
}

/**
 * Враг "грунт" — медленно идёт к игроку, наносит контактный урон.
 */
export interface Grunt extends EnemyBase {
  kind: 'grunt';
  /** Урон игроку при касании. */
  contactDamage: number;
}

/**
 * Враг "стрелок" — держит дистанцию, стреляет снарядами.
 *
 * Поведение зависит от расстояния до игрока:
 *   - дальше idealDistance: приближается со speed
 *   - между keepDistance и idealDistance: стоит, стреляет
 *   - ближе keepDistance: отступает со speed (кайтит), стреляет
 *
 * Контактного урона не наносит — только снаряды.
 */
export interface Shooter extends EnemyBase {
  kind: 'shooter';
  /** Дистанция на которой стрелок предпочитает стоять и стрелять. */
  idealDistance: number;
  /** Если игрок ближе этой дистанции — стрелок отступает (кайтит). */
  keepDistance: number;
  /** До какого state.time.now следующий выстрел невозможен (кулдаун). */
  nextShotAt: number;
}

/**
 * Враг "рашер" — быстрый, малое HP, бежит на игрока. Спавнится со случайной
 * стороны, при 3-4 рашерах в волне с высокой вероятностью атакует с разных
 * направлений — игрок не может стабильно убегать по прямой.
 *
 * AI идентичен грунту (тупо normalize(player - self)), отличие — параметры.
 * Контактный урон выше грунта, скорость заметно выше.
 */
export interface Rusher extends EnemyBase {
  kind: 'rusher';
  /** Урон игроку при касании. */
  contactDamage: number;
}

/** Любой враг. Дискриминатор kind определяет конкретный тип. */
export type Enemy = Grunt | Shooter | Rusher;

/**
 * Снаряд врага — летит по прямой с фиксированной скоростью, наносит урон
 * игроку при попадании. Отдельный тип от Projectile (снарядов игрока),
 * чтобы коллизии не путались — игрок vs шар игрока невозможно.
 */
export interface EnemyProjectile {
  position: Vec2;
  velocity: Vec2; // пикселей в секунду по каждой оси
  radius: number;
  damage: number;
}

/**
 * Состояние волны:
 *   - 'spawning': враги создаются (сейчас одномоментно, в техдолге — постепенно)
 *   - 'fighting': враги уже на арене, ждём пока всех убьют
 *   - 'between': все убиты, идёт пауза перед следующей волной
 *   - 'won': последняя волна пройдена, игра окончена победой
 */
export type WaveState = 'spawning' | 'fighting' | 'between';

/** Состояние системы волн. */
export interface Waves {
  current: number; // номер текущей волны (1..MAX_WAVES)
  state: WaveState;
  betweenTimer: number; // мс до начала следующей волны (используется в state='between')
}

/**
 * Глобальное состояние рана:
 *   - 'playing':  идёт игра (волны спавнятся, бьются, между волнами)
 *   - 'levelup':  игрок достиг порога xp, игра остановлена, ждём подтверждения
 *   - 'won':      все волны пройдены, экран победы, игра остановлена
 *   - 'gameOver': игрок умер, экран Game Over, игра остановлена
 *
 * Хранится отдельно от waves.state чтобы смерть игрока и левелапы не путались
 * с состояниями системы волн. См. DECISIONS.md, день 7 недели 1.
 */
export type RunState = 'playing' | 'levelup' | 'won' | 'gameOver';

/**
 * Идентификатор буна. Расширяется по мере добавления новых бунов.
 * День 4 недели 2: только 'more_damage'.
 */
export type BoonId = 'more_damage' | 'fast_hands' | 'more_projectiles' | 'too_powerful';

/**
 * Описание буна — статичные данные (имя, эффект). Список всех BoonDefinition
 * лежит в src/boons.ts, индексируется по BoonId.
 */
export interface BoonDefinition {
  id: BoonId;
  /** Короткое имя для кнопки на экране левелапа. */
  name: string;
  /** Описание эффекта одной строкой, под именем на кнопке. */
  description: string;
  /**
   * Максимальное число раз, которое игрок может взять этот бун за ран.
   * При достижении капа бун исключается из пула getRandomBoonChoices.
   * Заглушка 'too_powerful' имеет cap = Infinity (всегда доступна).
   */
  cap: number;
}

/**
 * Запись о взятом буне. Сейчас только id, но структура объектная — чтобы
 * позже добавить поля типа stackCount или takenAtLevel без миграций.
 */
export interface AppliedBoon {
  id: BoonId;
}

/** Главный объект состояния игры. Передаётся во все системы. */
export interface GameState {
  player: Player;
  arena: Arena;
  camera: Camera;
  viewport: Viewport;
  input: InputState;
  time: TimeState;
  projectiles: Projectile[];
  /** Снаряды врагов (стрелки и т.д.). Отдельно от снарядов игрока. */
  enemyProjectiles: EnemyProjectile[];
  enemies: Enemy[];
  waves: Waves;
  /** Глобальное состояние рана. См. RunState. */
  runState: RunState;
  /**
   * Журнал взятых бунов в текущем ране. Эффекты применены сразу к state
   * (например player.damageMultiplier), массив используется для HUD
   * (иконки бунов) и для понимания "что игрок собрал".
   * Очищается при resetState через пересоздание GameState.
   */
  boons: AppliedBoon[];
  /**
   * Текущие 3 буна на экране левелапа (сгенерированы один раз при входе
   * в runState='levelup'). null когда экран не показывается.
   * Хранится в state, а не в render-модуле, чтобы а) рендер был чистой
   * функцией от state, б) при resetState всё сбрасывалось автоматически.
   */
  currentBoonChoices: BoonId[] | null;
}