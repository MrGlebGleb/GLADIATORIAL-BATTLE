// --- GAME STATE VARIABLES ---
let playerGold = INITIAL_GOLD;
let roundCounter = 0;
let gameLoopInterval = null;
let preRoundTimeoutId = null;
let currentFighters = []; // Массив активных бойцов в текущем раунде
let arenaBonuses = []; // Массив активных бонусов на арене
let duelContenders = null; // Пара бойцов в дуэли
let activeRoundModifier = null; // Текущий модификатор раунда
let intelliActionLog = {}; // Лог интеллектуальных действий для отображения
let currentBet = { fighterId: null, amount: 0, placed: false };
let isBettingPaused = false; // Флаг, приостановлена ли игра для ставок
let defeatedFightersOrder = []; // Порядок выбывших бойцов
let isGameOver = false;
let firstRoundStarted = false;
let roundInProgress = false;
let lastDamageTimestamp = Date.now(); // Время последнего нанесенного урона (для детекции застоя)
let userScrolledLog = false; // Флаг, что пользователь вручную прокрутил лог

// --- ORBITAL EFFECTS STATE ---
let activeOrbitalEffects = []; // Массив активных объектов орбитальных эффектов на арене
let orbitalEffectAngle = 0;    // Текущий угол для вращения эффектов