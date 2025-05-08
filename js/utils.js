// --- UTILITY FUNCTIONS ---

/**
 * Генерирует случайное целое число в заданном диапазоне (включительно).
 * @param {number} min - Минимальное значение.
 * @param {number} max - Максимальное значение.
 * @returns {number} Случайное целое число.
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Рассчитывает расстояние между двумя объектами с координатами x и y.
 * @param {object} obj1 - Первый объект (должен иметь свойства x, y).
 * @param {object} obj2 - Второй объект (должен иметь свойства x, y).
 * @returns {number} Расстояние между объектами.
 */
function getDistance(obj1, obj2) {
    if (typeof obj1.x !== 'number' || typeof obj1.y !== 'number' ||
        typeof obj2.x !== 'number' || typeof obj2.y !== 'number') {
        // console.warn("getDistance: invalid object coordinates", obj1, obj2);
        return Infinity; // Возвращаем бесконечность, если координаты некорректны
    }
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Рассчитывает суммарный интеллект бойца.
 * @param {object} fighter - Объект бойца.
 * @returns {number} Суммарный интеллект или 0, если данные некорректны.
 */
function getTotalIntellect(fighter) {
    if (!fighter || !fighter.combatStats || !fighter.combatStats.intellect) return 0;
    const { tactical, defense, resource, spatial } = fighter.combatStats.intellect;
    return (tactical || 0) + (defense || 0) + (resource || 0) + (spatial || 0);
}

/**
 * Рассчитывает необходимое количество опыта для следующего уровня интеллекта.
 * @param {number} currentLevel - Текущий уровень интеллекта.
 * @returns {number} Количество опыта для следующего уровня.
 */
function getExpToLevelUp(currentLevel) {
    return Math.floor(EXP_TO_LEVEL_UP_BASE * Math.pow(EXP_TO_LEVEL_UP_FACTOR, currentLevel -1));
}

/**
 * Создает глубокую копию объекта или массива.
 * @param {object|Array} obj - Объект или массив для копирования.
 * @returns {object|Array} Глубокая копия.
 */
function deepCopy(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        const copy = [];
        for (let i = 0; i < obj.length; i++) {
            copy[i] = deepCopy(obj[i]);
        }
        return copy;
    }

    const copy = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            copy[key] = deepCopy(obj[key]);
        }
    }
    return copy;
}