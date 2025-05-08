// --- ARENA BONUSES LOGIC ---

/**
 * Управляет появлением бонусов на арене.
 * Вызывается в каждом игровом тике.
 */
function manageArenaBonuses() {
    if (arenaBonuses.length < MAX_ARENA_BONUSES) {
        const randomChance = Math.random();
        // Шансы нормализуются относительно частоты тиков, чтобы быть примерно одинаковыми независимо от GAME_SPEED
        const tickRateFactor = 1000 / GAME_SPEED; // Сколько раз в секунду примерно вызывается тик

        if (randomChance < (ELITE_WEAPON_BONUS_CHANCE / tickRateFactor) ) {
            spawnArenaBonus('elite_weapon');
        } else if (randomChance < ((ELITE_WEAPON_BONUS_CHANCE + HEALTH_PACK_BONUS_CHANCE) / tickRateFactor) ) {
            spawnArenaBonus('health_pack');
        } else if (randomChance < ((ELITE_WEAPON_BONUS_CHANCE + HEALTH_PACK_BONUS_CHANCE + ARMOR_PACK_LIGHT_CHANCE) / tickRateFactor) ) {
            spawnArenaBonus('armor_light');
        } else if (randomChance < ((ELITE_WEAPON_BONUS_CHANCE + HEALTH_PACK_BONUS_CHANCE + ARMOR_PACK_LIGHT_CHANCE + ARMOR_PACK_HEAVY_CHANCE) / tickRateFactor) ) {
            spawnArenaBonus('armor_heavy');
        }
    }
}

/**
 * Создает и размещает бонус на арене.
 * @param {string} type - Тип бонуса ('elite_weapon', 'health_pack', 'armor_light', 'armor_heavy').
 */
function spawnArenaBonus(type) {
    if (arenaBonuses.length >= MAX_ARENA_BONUSES || !arenaEl) return;

    const bonus = {
        id: `bonus-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: type,
        x: getRandomInt(30, ARENA_WIDTH - 30),
        y: getRandomInt(30, ARENA_HEIGHT - 30),
        element: document.createElement('div')
    };
    bonus.element.classList.add('arena-bonus');

    if (type === 'health_pack') {
        bonus.element.classList.add('health-pack');
        bonus.element.textContent = '➕';
        bonus.element.title = "Аптечка (+50 ОЗ)";
        bonus.value = 50; // Количество здоровья
    } else if (type === 'elite_weapon') {
        bonus.element.classList.add('elite-weapon-pickup');
        const eliteWeaponSample = ELITE_WEAPONS[getRandomInt(0, ELITE_WEAPONS.length - 1)];
        // Отображаем только первую часть эмодзи, если он составной
        bonus.element.textContent = eliteWeaponSample.emoji.length > 1 && eliteWeaponSample.emoji.includes("️") ? eliteWeaponSample.emoji.substring(0, eliteWeaponSample.emoji.indexOf("️")) : eliteWeaponSample.emoji.substring(0,1);
        bonus.element.title = `Элитное оружие: ${eliteWeaponSample.name}`;
        bonus.weapon = deepCopy(eliteWeaponSample); // Глубокая копия, чтобы не менять исходный объект
    } else if (type === 'armor_light') {
        bonus.element.classList.add('armor-pack');
        bonus.element.textContent = '🛡️';
        bonus.element.title = `Легкая Броня (${MAX_ARMOR_HITS_LIGHT} блока)`;
        bonus.hits = MAX_ARMOR_HITS_LIGHT;
    } else if (type === 'armor_heavy') {
        bonus.element.classList.add('armor-pack');
        bonus.element.textContent = '💠'; // Другой значок для тяжелой брони
        bonus.element.title = `Тяжелая Броня (${MAX_ARMOR_HITS_HEAVY} блока)`;
        bonus.hits = MAX_ARMOR_HITS_HEAVY;
    }

    bonus.element.style.left = `${bonus.x - 20}px`; // 20 - половина ширины/высоты бонуса
    bonus.element.style.top = `${bonus.y - 20}px`;
    arenaEl.appendChild(bonus.element);
    arenaBonuses.push(bonus);
}

/**
 * Обрабатывает подбор бонуса бойцом.
 * @param {object} fighter - Боец, подобравший бонус.
 * @param {object} bonus - Объект бонуса.
 */
function collectBonus(fighter, bonus) {
    if (!fighter || !bonus || !bonus.element) return;

    logIntellectAction(fighter, 'resource', `подбирает ${bonus.element.title.split(':')[0]}`);
    addExperience(fighter, 'pickup_bonus');
    fighter.bonusesCollectedThisRound = (fighter.bonusesCollectedThisRound || 0) + 1;

    showPickupAura(fighter, bonus.type); // UI эффект

    if (bonus.type === 'health_pack' && bonus.value) {
        fighter.health = Math.min(fighter.maxHealth, fighter.health + bonus.value);
        logMessage(`${fighter.name} <span class="log-bonus">исцеляется на ${bonus.value} ОЗ</span> от аптечки!`, "log-bonus");
    } else if (bonus.type === 'elite_weapon' && bonus.weapon) {
        fighter.weapon = deepCopy(bonus.weapon); // Глубокая копия
        fighter.weapon.currentRange = fighter.weapon.range; // Устанавливаем текущую дальность
        logMessage(`${fighter.name} <span class="log-elite-weapon">подбирает Элитное Оружие: ${fighter.weapon.name} ${fighter.weapon.emoji}</span>!`, "log-elite-weapon");
        if (fighter.element) {
            const weaponEmojiEl = fighter.element.querySelector('.weapon-emoji');
            if (weaponEmojiEl) weaponEmojiEl.textContent = fighter.weapon.emoji;
        }
    } else if ((bonus.type === 'armor_light' || bonus.type === 'armor_heavy') && bonus.hits) {
        fighter.armorHits = bonus.hits;
        if (activeRoundModifier && activeRoundModifier.name === "Хрупкая Броня") {
            fighter.armorHits = Math.max(0, fighter.armorHits - 1);
            if (fighter.armorHits < bonus.hits) {
                 logMessage(`Модификатор "Хрупкая Броня" уменьшает прочность брони ${fighter.name}!`, "log-modifier");
            }
        }
        fighter.maxArmorHits = bonus.hits; // Запоминаем максимальное количество для отображения полоски
        fighter.hasArmor = fighter.armorHits > 0;
        logMessage(`${fighter.name} <span class="log-armor">надевает ${bonus.element.title}</span>! (${fighter.armorHits} блоков)`, "log-armor");
    }

    if (bonus.element.parentElement) {
        bonus.element.remove();
    }
    arenaBonuses = arenaBonuses.filter(b => b.id !== bonus.id);
    updateFighterElement(fighter);
}