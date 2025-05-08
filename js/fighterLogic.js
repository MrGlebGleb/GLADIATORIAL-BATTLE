// --- FIGHTER LOGIC ---

var createFighterInstanceNamespace = {
    commonWeaponThisRound: null
};

function createFighterInstance(baseFighterData) {
    const dataCopy = deepCopy(baseFighterData);
    let weapon;

    // Логика общего оружия для спец-раундов
    if (roundCounter > 0 && roundCounter % 5 === 0) {
        if (!createFighterInstanceNamespace.commonWeaponThisRound) {
            createFighterInstanceNamespace.commonWeaponThisRound = deepCopy(WEAPONS[getRandomInt(0, WEAPONS.length - 1)]);
        }
        weapon = deepCopy(createFighterInstanceNamespace.commonWeaponThisRound);
    } else {
         weapon = deepCopy(WEAPONS[getRandomInt(0, WEAPONS.length - 1)]);
    }
    weapon.currentRange = weapon.range; // Устанавливаем начальную текущую дальность

    // Инициализация недостающих структур в combatStats
    if (!dataCopy.combatStats.intellect) {
        dataCopy.combatStats.intellect = { tactical: 1, defense: 1, resource: 1, spatial: 1 };
    }
    if (!dataCopy.combatStats.experience) {
        dataCopy.combatStats.experience = { tactical: 0, defense: 0, resource: 0, spatial: 0 };
    }
    if (!dataCopy.combatStats.learning) {
        dataCopy.combatStats.learning = { weaponEffectiveness: {}, targetPriorities: {}, dangerousEnemies: {}, optimalDistances: {}, successfulPatterns: [] };
    }

    // Создание объекта бойца
    const fighter = {
        ...dataCopy,
        health: BASE_HEALTH,
        maxHealth: BASE_HEALTH,
        baseSpeed: getRandomInt(15, 25), // Базовая скорость
        speed: 0, // Текущая скорость, будет установлена ниже
        weapon: weapon,
        x: getRandomInt(FIGHTER_WIDTH / 2, ARENA_WIDTH - FIGHTER_WIDTH / 2),
        y: getRandomInt(FIGHTER_HEIGHT / 2, ARENA_HEIGHT - FIGHTER_HEIGHT / 2),
        alive: true,
        element: null, // DOM элемент
        target: null, // Текущая цель (боец или бонус)
        actionCooldown: 0, // Кулдаун следующего действия
        statusEffects: {}, // Активные статусные эффекты
        damageOutputMultiplier: 1, // Множитель исходящего урона
        damageTakenMultiplier: 1, // Множитель получаемого урона
        critDamageTakenMultiplier: 1, // Множитель получаемого критического урона
        evasionChance: 0.05 + (dataCopy.combatStats.intellect.defense * 0.005), // Шанс уклонения
        currentAction: null, // Текущее запланированное действие
        actionProgress: 0, // Прогресс выполнения действия (не используется сейчас)
        lastDamagedBy: null, // ID последнего атаковавшего
        damageDealtThisRound: 0,
        killsThisRound: 0,
        bonusesCollectedThisRound: 0,
        ticksSurvivedThisRound: 0,
        armorHits: 0, // Текущие заряды брони
        maxArmorHits: 0, // Максимальные заряды брони (для UI)
        hasArmor: false, // Флаг наличия брони
        initialExpThisRound: deepCopy(dataCopy.combatStats.experience), // Опыт на начало раунда

        // --- Флаги и множители для новых эффектов ---
        isInvulnerable: false, // Флаг неуязвимости (oe_invulnerability_short)
        canNullifyCrit: false, // Флаг для анти-крит щита (oe_crit_nullification)
        actionCooldownMultiplier: 1, // Множитель для кулдаунов (oe_temporal_acceleration / oe_increased_cooldowns_short)
        pickupRadiusFactor: 1, // Множитель радиуса подбора бонусов (oe_bonus_attraction_field)
        projectileSpeedFactor: 1, // Множитель скорости снарядов (oe_projectile_friction / возможно, будущие баффы)
        kineticBarrierActive: null, // Ссылка на активный эффект барьера (oe_kinetic_barrier)
        reactiveArmorCharge: null, // Ссылка на активный эффект реактивной брони (oe_reactive_armor_charge)
        vulnerabilityBonusNextHit: 1, // Множитель урона для следующей атаки по этой цели (oe_reveal_enemy_weakness)
    };
    fighter.speed = fighter.baseSpeed; // Устанавливаем текущую скорость равной базовой
    return fighter;
}


function addExperience(fighter, eventTypeKey, baseAmountMultiplier = 1) {
    if (!fighter || !fighter.alive || !fighter.combatStats || !fighter.combatStats.experience || !fighter.combatStats.intellect) return;

    const rewardsForEvent = EXPERIENCE_REWARDS[eventTypeKey];

    // Прямое добавление опыта (например, от орбитального эффекта)
    if (eventTypeKey.startsWith('orbital_xp_')) {
         const intellectType = eventTypeKey.replace('orbital_xp_', '');
         if (fighter.combatStats.intellect[intellectType] >= MAX_INTELLECT_LEVEL) return;

         fighter.combatStats.experience[intellectType] = (fighter.combatStats.experience[intellectType] || 0) + baseAmountMultiplier;
         const expNeeded = getExpToLevelUp(fighter.combatStats.intellect[intellectType]);

         // Проверка и повышение уровня
         while (fighter.combatStats.experience[intellectType] >= expNeeded && fighter.combatStats.intellect[intellectType] < MAX_INTELLECT_LEVEL) {
            fighter.combatStats.intellect[intellectType]++;
            fighter.combatStats.experience[intellectType] -= expNeeded; // Вычитаем опыт за этот уровень
            logMessage(`🧠 <span class="log-int-levelup">${fighter.name} повысил ${intellectType} интеллект до ${fighter.combatStats.intellect[intellectType]}!</span> (Орбита)`, "log-int-levelup");
            updateFighterIntellectVisuals(fighter);
            showIntellectLevelUpSparkle(fighter);
            // Пересчитываем необходимое количество опыта для *следующего* уровня, если вдруг набралось на несколько
             if (fighter.combatStats.intellect[intellectType] < MAX_INTELLECT_LEVEL) {
                 // expNeeded = getExpToLevelUp(fighter.combatStats.intellect[intellectType]);
                 // Ошибка в пред. комментарии, не нужно пересчитывать expNeeded внутри цикла, он используется для текущего level up
             } else {
                 fighter.combatStats.experience[intellectType] = 0; // Обнуляем опыт на макс уровне
             }
         }
         updateScoreboard(); // Обновляем таблицу после всех повышений
         return; // Выходим, так как это было прямое добавление
    }

    if (!rewardsForEvent) return; // Если ключ не найден в стандартных наградах

    let gainedAnyExp = false;
    for (const intellectType in rewardsForEvent) {
        if (fighter.combatStats.intellect[intellectType] >= MAX_INTELLECT_LEVEL) continue; // Пропускаем прокачанный интеллект

        const amount = (rewardsForEvent[intellectType] || 0) * baseAmountMultiplier;
        if (amount === 0) continue;

        fighter.combatStats.experience[intellectType] = (fighter.combatStats.experience[intellectType] || 0) + amount;
        gainedAnyExp = true;

        // Проверка и повышение уровня (может быть несколько уровней за раз)
        let expNeeded = getExpToLevelUp(fighter.combatStats.intellect[intellectType]);
        while (fighter.combatStats.experience[intellectType] >= expNeeded && fighter.combatStats.intellect[intellectType] < MAX_INTELLECT_LEVEL) {
            fighter.combatStats.intellect[intellectType]++;
            fighter.combatStats.experience[intellectType] -= expNeeded;
            logMessage(`🧠 <span class="log-int-levelup">${fighter.name} повысил ${intellectType} интеллект до ${fighter.combatStats.intellect[intellectType]}!</span> (<span class="log-int-${intellectType}">${INTELLECT_SYMBOLS[intellectType]}</span>)`, "log-int-levelup");
            updateFighterIntellectVisuals(fighter);
            showIntellectLevelUpSparkle(fighter);
            // Обновляем expNeeded для следующего возможного уровня
            if (fighter.combatStats.intellect[intellectType] < MAX_INTELLECT_LEVEL) {
                 expNeeded = getExpToLevelUp(fighter.combatStats.intellect[intellectType]);
            } else {
                fighter.combatStats.experience[intellectType] = 0; // Обнуляем опыт на макс уровне
            }
        }
    }
    if (gainedAnyExp) {
        updateScoreboard(); // Обновляем таблицу, если был получен опыт
    }
}

function processRoundExperience() {
    const winner = currentFighters.find(f => f.alive);

    currentFighters.forEach(fighter => {
        // Если initialExpThisRound не был установлен (маловероятно, но на всякий случай)
        if (fighter.initialExpThisRound === undefined && fighter.combatStats && fighter.combatStats.experience) {
             fighter.initialExpThisRound = deepCopy(fighter.combatStats.experience);
        }

        // Базовый опыт за участие и выживание
        addExperience(fighter, 'participation');
        addExperience(fighter, 'survive_round_tick', fighter.ticksSurvivedThisRound);

        // Опыт за урон
        if (fighter.damageDealtThisRound > 0) {
            addExperience(fighter, 'damage_dealt_ratio', (fighter.damageDealtThisRound / BASE_HEALTH));
        }

        // Опыт за место в раунде
        if (winner) { // Есть явный победитель
            if (fighter.id === winner.id) addExperience(fighter, 'win_round');
            else if (defeatedFightersOrder.length > 0 && defeatedFightersOrder[defeatedFightersOrder.length - 1] === fighter.id) addExperience(fighter, 'place_2nd');
            else if (defeatedFightersOrder.length > 1 && defeatedFightersOrder[defeatedFightersOrder.length - 2] === fighter.id) addExperience(fighter, 'place_3rd');
        } else { // Ничья или неопределенный исход
            // Если все пали, определяем места по порядку выбывания
            if (defeatedFightersOrder.length === currentFighters.length) {
                 if (defeatedFightersOrder.length >=1 && defeatedFightersOrder[defeatedFightersOrder.length - 1] === fighter.id) addExperience(fighter, 'win_round'); // Последний выживший считается победителем
                 else if (defeatedFightersOrder.length >=2 && defeatedFightersOrder[defeatedFightersOrder.length - 2] === fighter.id) addExperience(fighter, 'place_2nd');
                 else if (defeatedFightersOrder.length >=3 && defeatedFightersOrder[defeatedFightersOrder.length - 3] === fighter.id) addExperience(fighter, 'place_3rd');
            } else { // Если не все пали, но победителя нет (например, таймаут) - даем опыт за выживание до конца
                 if (fighter.alive) {
                     // Можно добавить немного опыта за выживание до конца без победы
                     addExperience(fighter, 'place_3rd'); // Например, как за 3е место
                 } else { // Если пал, но не в топ-3
                     if (defeatedFightersOrder.length > 0 && defeatedFightersOrder[defeatedFightersOrder.length - 1] === fighter.id) addExperience(fighter, 'place_2nd');
                     else if (defeatedFightersOrder.length > 1 && defeatedFightersOrder[defeatedFightersOrder.length - 2] === fighter.id) addExperience(fighter, 'place_3rd');
                 }
            }
        }
    });
}


function chooseAction(fighter, aliveFighters, bonuses) {
    // Не выбираем действие, если боец неактивен или под эффектами контроля
    if (fighter.actionCooldown > 0 || fighter.statusEffects?.stun || fighter.statusEffects?.oe_weapon_jam_effect) return;
    intelliActionLog[fighter.id] = null; // Сбрасываем лог действия для этого тика

    const { intellect, caution, aggression, preferredTargetType, learnedGrudges, learning } = fighter.combatStats;
    let bestAction = { type: 'idle', priority: -1, message: "бездействует" };

    // --- Обработка переопределяющих статусов ---
    // 1. Дезориентация
    if (fighter.statusEffects?.oe_disorient_movement_effect) {
        const destX = fighter.x + getRandomInt(-2, 2) * fighter.speed;
        const destY = fighter.y + getRandomInt(-2, 2) * fighter.speed;
        fighter.currentAction = { type: 'reposition', destX, destY, priority: 1000, message: `движется хаотично (дезориентация)` };
        logIntellectAction(fighter, 'spatial', `дезориентирован!`);
        return; // Выход, дезориентация важнее всего
    }
    // 2. Замешательство
    if (fighter.statusEffects?.oe_confusion_effect) {
        const possibleTargetsIncludingSelf = currentFighters.filter(f => f.alive);
        if (possibleTargetsIncludingSelf.length > 0) {
            const randomTarget = possibleTargetsIncludingSelf[getRandomInt(0, possibleTargetsIncludingSelf.length - 1)];
            fighter.target = randomTarget;
            const distToTarget = getDistance(fighter, randomTarget);
            const attackRange = fighter.weapon.currentRange || fighter.weapon.range;
            if (distToTarget <= attackRange) {
                fighter.currentAction = { type: 'attack', target: randomTarget, priority: 100, message: `атакует ${randomTarget.name} (замешательство)` };
            } else {
                 fighter.currentAction = { type: 'move_to_attack', target: randomTarget, priority: 99, message: `движется к ${randomTarget.name} (замешательство)` };
            }
            logIntellectAction(fighter, 'tactical', `в замешательстве!`);
            // Уменьшаем счетчик атак для эффекта и удаляем, если нужно
            if (fighter.statusEffects.oe_confusion_effect.attacksAffected > 0) {
                fighter.statusEffects.oe_confusion_effect.attacksAffected--;
                if (fighter.statusEffects.oe_confusion_effect.attacksAffected <= 0) {
                    const effectConf = fighter.statusEffects.oe_confusion_effect;
                    if (effectConf && typeof effectConf.onRemove === 'function') effectConf.onRemove(fighter, effectConf);
                    delete fighter.statusEffects.oe_confusion_effect;
                }
            }
            return; // Выход, замешательство переопределяет остальное
        }
    }
    // --- Конец обработки переопределяющих статусов ---


    // --- Выбор стандартного действия ---
    // 1. Проверка бонусов
    if (bonuses && bonuses.length > 0) {
        let closestBonus = null;
        let minDistToBonus = Infinity;
        const currentPickupRadius = BONUS_PICKUP_RADIUS * (fighter.pickupRadiusFactor || 1); // Учитываем магнит

        bonuses.forEach(b => {
            const d = getDistance(fighter, b);
            if (d < minDistToBonus) {
                minDistToBonus = d;
                closestBonus = b;
            }
        });
        if (closestBonus) {
            let bonusPriority = 10;
            if (closestBonus.type === 'health_pack' && fighter.health < fighter.maxHealth * 0.7) bonusPriority = 60 + (1 - fighter.health / fighter.maxHealth) * 60 + intellect.resource * 6;
            else if (closestBonus.type === 'elite_weapon' && (!fighter.weapon.name.includes("Элитное") && !ELITE_WEAPONS.some(ew => ew.name === fighter.weapon.name) )) bonusPriority = 50 + intellect.resource * 7;
            else if (closestBonus.type.includes('armor') && (!fighter.hasArmor || fighter.armorHits < (closestBonus.type === 'armor_heavy' ? MAX_ARMOR_HITS_HEAVY : MAX_ARMOR_HITS_LIGHT))) bonusPriority = (closestBonus.type === 'armor_heavy' ? 55 : 45) + intellect.resource * 5;

            if (minDistToBonus < currentPickupRadius * 2.5) bonusPriority += 30;

            if (bonusPriority > bestAction.priority) {
                bestAction = { type: 'pickup', targetBonus: closestBonus, priority: bonusPriority, message: `идет за ${closestBonus.element.title.split(':')[0]}` };
            }
        }
    }

    // 2. Выбор цели для атаки/преследования
    const potentialTargets = aliveFighters.filter(f => f.id !== fighter.id && f.alive);
    if (potentialTargets.length > 0) {
        let currentTarget = null;
        let highestThreatScore = -Infinity;
        potentialTargets.forEach(pTarget => {
            let score = 0;
            const distToTarget = getDistance(fighter, pTarget);
            if (preferredTargetType === 'closest') score += (ARENA_WIDTH - distToTarget) / 10;
            if (preferredTargetType === 'weakest') score += (pTarget.maxHealth - pTarget.health) + (intellect.tactical * 6) - (pTarget.hasArmor ? 25 : 0);
            if (preferredTargetType === 'highest_threat') {
                score += (getTotalIntellect(pTarget) * 2.5) + (pTarget.wins * 6) + (pTarget.hasArmor ? 12 : 0);
                if (pTarget.target && pTarget.target.id === fighter.id) score += 25;
            }
            score += intellect.tactical * 2.5;
            if (learnedGrudges && learnedGrudges[pTarget.id]) score += learnedGrudges[pTarget.id] * (6 + intellect.tactical);
            if (learning && learning.dangerousEnemies && learning.dangerousEnemies[pTarget.id] && learning.dangerousEnemies[pTarget.id] > fighter.health * 0.15) score += 15 + intellect.tactical * 2.5;
            if (learning && learning.weaponEffectiveness && learning.weaponEffectiveness[pTarget.id] && learning.weaponEffectiveness[pTarget.id] > 0) score += 7 + intellect.tactical;
            score *= (1 + aggression - caution);
            if (pTarget.statusEffects?.oe_marked_for_death_effect || pTarget.statusEffects?.oe_vulnerability_effect) score *= 1.3; // Учитываем метки уязвимости

            if (score > highestThreatScore) {
                highestThreatScore = score;
                currentTarget = pTarget;
            }
        });
        if (preferredTargetType === 'random' && potentialTargets.length > 0 && !currentTarget && bestAction.priority < 12) {
            currentTarget = potentialTargets[getRandomInt(0, potentialTargets.length-1)];
        }

        if (currentTarget) {
            fighter.target = currentTarget;
            const distToTarget = getDistance(fighter, currentTarget);
            const attackRange = fighter.weapon.currentRange || fighter.weapon.range;
            if (distToTarget <= attackRange) {
                let attackPriority = 40 + intellect.tactical * 6 + aggression * 30;
                if (currentTarget.health < currentTarget.maxHealth * 0.20 && fighter.health > fighter.maxHealth * 0.10) attackPriority += 45 + aggression * 12;
                if (fighter.health < fighter.maxHealth * 0.25 && caution > aggression * 1.2) attackPriority *= (0.4 - caution * 1.8);
                if (attackPriority > bestAction.priority) {
                   bestAction = { type: 'attack', target: currentTarget, priority: attackPriority, message: `атакует ${currentTarget.name}` };
                }
            } else {
                let moveAttackPriority = 30 + intellect.spatial * 4 + aggression * 25;
                if (currentTarget.health < currentTarget.maxHealth * 0.20 && fighter.health > fighter.maxHealth * 0.10) moveAttackPriority += 35 + aggression * 7;
                 if (moveAttackPriority > bestAction.priority) {
                    bestAction = { type: 'move_to_attack', target: currentTarget, priority: moveAttackPriority, message: `сближается с ${currentTarget.name}` };
                }
            }
        }
    }

    // 3. Отступление
    let wantsToRetreat = false;
    let retreatPriority = -1;
    if (fighter.health < fighter.maxHealth * (0.25 + caution * 0.7 - aggression * 0.25 + intellect.defense * 0.04)) wantsToRetreat = true;
    if (fighter.hasArmor && fighter.armorHits > 0 && fighter.health > fighter.maxHealth * 0.12) wantsToRetreat = false;
    if (fighter.target && fighter.target.health < fighter.target.maxHealth * 0.08 && fighter.health > fighter.maxHealth * 0.08) wantsToRetreat = false;
    if (duelContenders && duelContenders.some(dc => dc.id === fighter.id) && fighter.health > fighter.maxHealth * 0.04) wantsToRetreat = false;
    else if (aggression > 0.96 && fighter.health > fighter.maxHealth * 0.02) { if (Math.random() < aggression * 0.95) wantsToRetreat = false; }
    if (wantsToRetreat && potentialTargets.length > 0) {
        let escapeVector = { x: 0, y: 0 };
        let closestThreatDist = Infinity;
        let closestThreat = null;
        let numThreatsConsidered = 0;
        potentialTargets.forEach(pTarget => {
            const dist = getDistance(fighter, pTarget);
            if (dist < (fighter.weapon.range || 100) * 2.2 || (pTarget.target && pTarget.target.id === fighter.id)) {
                numThreatsConsidered++;
                if (dist < closestThreatDist) { closestThreatDist = dist; closestThreat = pTarget; }
                escapeVector.x -= (pTarget.x - fighter.x) / (dist * dist + 1);
                escapeVector.y -= (pTarget.y - fighter.y) / (dist * dist + 1);
            }
        });
        if (numThreatsConsidered > 0) {
            let retreatDestX = fighter.x, retreatDestY = fighter.y;
            const norm = Math.sqrt(escapeVector.x * escapeVector.x + escapeVector.y * escapeVector.y);
            if (norm > 0) { retreatDestX = fighter.x + (escapeVector.x / norm) * fighter.speed * 3; retreatDestY = fighter.y + (escapeVector.y / norm) * fighter.speed * 3; }
            else if (closestThreat) { retreatDestX = fighter.x + (fighter.x - closestThreat.x) / closestThreatDist * fighter.speed * 3; retreatDestY = fighter.y + (fighter.y - closestThreat.y) / closestThreatDist * fighter.speed * 3; }
            retreatPriority = 35 + intellect.defense * 7 + caution * 25 - aggression * 20;
            if (aggression > 0.92) retreatPriority -= (aggression - 0.92) * 130;
            if (duelContenders && duelContenders.some(dc => dc.id === fighter.id) && fighter.health > fighter.maxHealth * 0.04) retreatPriority -= 70;
            if (fighter.target && fighter.target.health < fighter.target.maxHealth * 0.08) retreatPriority -= 35;
            if (retreatPriority > bestAction.priority) {
                bestAction = { type: 'retreat', destX: retreatDestX, destY: retreatDestY, priority: retreatPriority, message: `отступает` };
            }
        }
    }

    // 4. Репозиционирование (если ничего лучше нет)
    if (bestAction.type === 'idle' || bestAction.priority < (10 + intellect.spatial * 2.5)) {
        let destX = fighter.x + getRandomInt(-1, 1) * fighter.speed * (1.2 + intellect.spatial * 0.12);
        let destY = fighter.y + getRandomInt(-1, 1) * fighter.speed * (1.2 + intellect.spatial * 0.12);
        // Активнее уходит от краев
        if (fighter.x < 60) destX = fighter.x + fighter.speed * 1.8;
        if (fighter.x > ARENA_WIDTH - 60) destX = fighter.x - fighter.speed * 1.8;
        if (fighter.y < 60) destY = fighter.y + fighter.speed * 1.8;
        if (fighter.y > ARENA_HEIGHT - 60) destY = fighter.y - fighter.speed * 1.8;
        bestAction = { type: 'reposition', destX, destY, priority: 7 + intellect.spatial * 2.5, message: `маневрирует` };
    }

    // Назначаем выбранное действие
    fighter.currentAction = bestAction;

    // Логируем интеллектуальное действие
    if (bestAction.type !== 'idle' && bestAction.message) {
        const intellectContextKey = bestAction.type === 'attack' || bestAction.type === 'move_to_attack' ? 'tactical' :
                                   bestAction.type === 'pickup' ? 'resource' :
                                   bestAction.type === 'retreat' ? 'defense' : 'spatial';
        // Логируем, если интеллект выше базового или это важное действие (атака, отступление, бонус)
        if (intellect[intellectContextKey] > 1 || ['attack', 'retreat', 'pickup'].includes(bestAction.type)) {
            logIntellectAction(fighter, intellectContextKey, bestAction.message);
        }
    }
}

function executeAction(fighter) {
    if (!fighter.alive || fighter.actionCooldown > 0 || fighter.statusEffects?.stun || !fighter.currentAction) return;

    // Проверка на Weapon Jam перед выполнением атаки
    if (fighter.statusEffects?.oe_weapon_jam_effect && fighter.currentAction.type === 'attack') {
        logIntellectAction(fighter, 'tactical', `пытается атаковать, но оружие заклинило!`);
        fighter.actionCooldown = Math.max(1, Math.round( (10 / (fighter.weapon?.speed || 1)) / 2 * (fighter.actionCooldownMultiplier || 1))); // Учитываем множитель КД
        return; // Прерываем выполнение действия
    }

    const action = fighter.currentAction;
    let targetFighter = null;
    if (action.target && action.target.id) {
        targetFighter = currentFighters.find(f => f.id === action.target.id && f.alive);
    }
    let targetBonus = null;
    if(action.targetBonus && action.targetBonus.id) {
        targetBonus = arenaBonuses.find(b => b.id === action.targetBonus.id);
    }
    let moveSpeed = fighter.speed;
    if (fighter.statusEffects && fighter.statusEffects.root) moveSpeed = 0;

    let baseCooldown = 1; // Базовый кулдаун (в тиках)

    switch (action.type) {
        case 'attack':
            if (targetFighter) {
                if (fighter.element) fighter.element.classList.add('attacking');
                setTimeout(() => { if(fighter.element) fighter.element.classList.remove('attacking'); }, 100);

                // --- Проверка на Fumble (Проклятие Неуклюжести) ---
                if (fighter.statusEffects?.oe_fumble_effect) {
                    const fumbleEffect = fighter.statusEffects.oe_fumble_effect;
                    if (Math.random() < fumbleEffect.chance) {
                        logMessage(`${fighter.name} <span class="log-effect">промахивается</span> из-за неуклюжести!`, "log-effect");
                        // Удаляем эффект, если одноразовый
                        if (fumbleEffect.oneTimeUse) {
                            if (typeof fumbleEffect.onRemove === 'function') fumbleEffect.onRemove(fighter, fumbleEffect);
                            delete fighter.statusEffects.oe_fumble_effect;
                        }
                        baseCooldown = Math.max(1, Math.round( (10 / fighter.weapon.speed) / 2 )); // Стандартный КД атаки
                        break; // Выход из switch, атака не происходит
                    }
                    // Если не промахнулся, но эффект одноразовый, удаляем
                    if (fumbleEffect.oneTimeUse) {
                         if (typeof fumbleEffect.onRemove === 'function') fumbleEffect.onRemove(fighter, fumbleEffect);
                         delete target.statusEffects.oe_fumble_effect; // Удаляем у цели? Ошибка, должно быть у атакующего fighter
                         // Правильно: delete fighter.statusEffects.oe_fumble_effect;
                    }
                }
                // --- Конец проверки Fumble ---


                const aoeMeleeEffect = fighter.weapon.effects ? fighter.weapon.effects.find(e => e.type === 'aoe_melee') : null;
                if (aoeMeleeEffect && fighter.weapon.type === 'melee') {
                    createAoeIndicator(fighter.x, fighter.y, aoeMeleeEffect.radius);
                    let targetsHit = 0;
                    currentFighters.filter(f => f.alive && f.id !== fighter.id).forEach(potentialVictim => {
                        if (getDistance(fighter, potentialVictim) <= aoeMeleeEffect.radius) {
                            let damageMult = (potentialVictim.id === targetFighter.id) ? 1.0 : (aoeMeleeEffect.subDamageFactor || 0.7);
                            if (aoeMeleeEffect.selfImmune && potentialVictim.id === fighter.id) return;
                            performAttackDamage(fighter, potentialVictim, fighter.weapon, damageMult);
                            targetsHit++;
                        }
                    });
                    if (targetsHit > 1) addExperience(fighter, 'aoe_hit_multiple', (targetsHit -1));
                } else if (fighter.weapon.type === 'melee') {
                    performAttackDamage(fighter, targetFighter, fighter.weapon);
                } else if (fighter.weapon.type === 'ranged') {
                    createAndAnimateProjectile(fighter, targetFighter, fighter.weapon);
                }
                baseCooldown = Math.max(1, Math.round( (10 / fighter.weapon.speed) / 2) ); // КД зависит от скорости оружия
            } else {
                fighter.currentAction = null; // Цель не найдена/мертва
            }
            break;
        case 'move_to_attack':
        case 'retreat':
        case 'reposition':
            if (moveSpeed > 0) {
                let destX = action.destX;
                let destY = action.destY;
                if (action.type === 'move_to_attack') {
                    if (targetFighter) { destX = targetFighter.x; destY = targetFighter.y; }
                    else { fighter.currentAction = null; baseCooldown = 1; break; } // Цель потеряна
                }
                // Ограничиваем точку назначения границами арены
                 destX = Math.max(FIGHTER_WIDTH / 2, Math.min(ARENA_WIDTH - FIGHTER_WIDTH / 2, destX));
                 destY = Math.max(FIGHTER_HEIGHT / 2, Math.min(ARENA_HEIGHT - FIGHTER_HEIGHT / 2, destY));

                const dx = destX - fighter.x;
                const dy = destY - fighter.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > moveSpeed) { // Если до точки назначения дальше, чем можем пройти за тик
                    fighter.x += (dx / dist) * moveSpeed;
                    fighter.y += (dy / dist) * moveSpeed;
                } else { // Если можем дойти или уже на месте
                    fighter.x = destX;
                    fighter.y = destY;
                    // Завершаем действие, если это было отступление или репозиционирование
                    if (action.type === 'retreat' || action.type === 'reposition') fighter.currentAction = null;
                }
                // Дополнительная проверка границ после перемещения (на всякий случай)
                fighter.x = Math.max(FIGHTER_WIDTH / 2, Math.min(ARENA_WIDTH - FIGHTER_WIDTH / 2, fighter.x));
                fighter.y = Math.max(FIGHTER_HEIGHT / 2, Math.min(ARENA_HEIGHT - FIGHTER_HEIGHT / 2, fighter.y));
            }
            baseCooldown = 1; // Движение имеет минимальный кулдаун
            break;
        case 'pickup':
            if (targetBonus && moveSpeed > 0) {
                const currentPickupRadius = BONUS_PICKUP_RADIUS * (fighter.pickupRadiusFactor || 1);
                const distToBonus = getDistance(fighter, targetBonus);

                if (distToBonus <= currentPickupRadius) { // Если уже в радиусе
                    collectBonus(fighter, targetBonus);
                    fighter.currentAction = null; // Завершаем действие
                } else { // Двигаемся к бонусу
                    const dx = targetBonus.x - fighter.x;
                    const dy = targetBonus.y - fighter.y;
                    if (distToBonus > moveSpeed) { // Если далеко
                        fighter.x += (dx / distToBonus) * moveSpeed;
                        fighter.y += (dy / distToBonus) * moveSpeed;
                    } else { // Если можем дойти
                        fighter.x = targetBonus.x;
                        fighter.y = targetBonus.y;
                        // Проверяем еще раз после перемещения, могли войти в радиус
                        if(getDistance(fighter, targetBonus) <= currentPickupRadius) {
                            collectBonus(fighter, targetBonus);
                            fighter.currentAction = null;
                        }
                    }
                    // Ограничение ареной
                    fighter.x = Math.max(FIGHTER_WIDTH / 2, Math.min(ARENA_WIDTH - FIGHTER_WIDTH / 2, fighter.x));
                    fighter.y = Math.max(FIGHTER_HEIGHT / 2, Math.min(ARENA_HEIGHT - FIGHTER_HEIGHT / 2, fighter.y));
                }
            } else { // Бонус исчез или скорость 0
                fighter.currentAction = null;
            }
            baseCooldown = 1; // Движение к бонусу
            break;
        case 'idle': default: baseCooldown = 1; break;
    }

    // Применяем модификаторы кулдауна
    baseCooldown *= (fighter.actionCooldownMultiplier || 1);

    fighter.actionCooldown = Math.max(1, Math.round(baseCooldown)); // Устанавливаем финальный кулдаун (минимум 1 тик)

    // Запоминаем обиду при атаке
    if(fighter.actionCooldown > 0 && fighter.currentAction?.type === 'attack') {
        if (targetFighter && fighter.combatStats && fighter.combatStats.learnedGrudges) {
            fighter.combatStats.learnedGrudges[targetFighter.id] = (fighter.combatStats.learnedGrudges[targetFighter.id] || 0) + 1;
        }
    }
}

function createAndAnimateProjectile(attacker, target, weapon) {
    const projectileEl = createProjectileElement(attacker, weapon);
    if (!projectileEl) return;

    // Учитываем модификаторы скорости снарядов
    const currentProjectileSpeed = PROJECTILE_SPEED * (attacker.projectileSpeedFactor || 1);

    const startX = attacker.x;
    const startY = attacker.y - (FIGHTER_HEIGHT / 4) ; // Начальная точка чуть выше центра

    // Простое предсказание цели (можно усложнить, учитывая повороты и т.д.)
    const estimatedTravelTimeTicks = getDistance({x: startX, y: startY}, target) / currentProjectileSpeed;
    let targetPredictedX = target.x;
    let targetPredictedY = target.y;
    // Если цель движется, пытаемся предсказать ее позицию
    if (target.currentAction && (target.currentAction.type === 'move_to_attack' || target.currentAction.type === 'retreat' || target.currentAction.type === 'reposition')) {
        const targetDx = target.currentAction.destX - target.x;
        const targetDy = target.currentAction.destY - target.y;
        const targetDist = Math.sqrt(targetDx*targetDx + targetDy*targetDy);
        if (targetDist > 0) {
            const targetMoveXPerTick = (targetDx / targetDist) * target.speed;
            const targetMoveYPerTick = (targetDy / targetDist) * target.speed;
            targetPredictedX += targetMoveXPerTick * estimatedTravelTimeTicks * 0.5; // Упреждение на половину времени полета
            targetPredictedY += targetMoveYPerTick * estimatedTravelTimeTicks * 0.5;
        }
    }

    const dx = targetPredictedX - startX;
    const dy = targetPredictedY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) { if (projectileEl.parentElement) projectileEl.remove(); handleProjectileHit(attacker, target, weapon, {x: startX, y: startY}); return; } // Если стреляем в упор

    const moveX = (dx / dist) * currentProjectileSpeed;
    const moveY = (dy / dist) * currentProjectileSpeed;
    let currentX = startX;
    let currentY = startY;
    const travelTicks = Math.max(1, Math.round(dist / currentProjectileSpeed)); // Используем Math.round
    let ticksPassed = 0;

    function animateProjectileTick() {
        if (!roundInProgress || !attacker.alive || !projectileEl.parentElement) { // Проверяем и родителя
            if (projectileEl.parentElement) projectileEl.remove();
            return;
        }
        ticksPassed++;
        currentX += moveX;
        currentY += moveY;
        projectileEl.style.left = `${currentX - (projectileEl.offsetWidth / 2 || 12)}px`;
        projectileEl.style.top = `${currentY - (projectileEl.offsetHeight / 2 || 12)}px`;

        const finalTargetCheck = currentFighters.find(f => f.id === target.id && f.alive);

        // Проверка на эффект отражения у цели
        if (finalTargetCheck?.statusEffects?.oe_deflection_aura_effect) {
            if (Math.random() < finalTargetCheck.statusEffects.oe_deflection_aura_effect.chance) {
                logMessage(`${finalTargetCheck.name} <span class="log-evasion">отражает</span> снаряд ${attacker.name}!`, "log-evasion");
                if (projectileEl.parentElement) projectileEl.remove();
                // Опционально: создать новый снаряд, летящий обратно
                return; // Прерываем полет
            }
        }

        // Проверка попадания
        if (finalTargetCheck && getDistance({x: currentX, y: currentY}, finalTargetCheck) < (FIGHTER_WIDTH / 2) ) {
            if (projectileEl.parentElement) projectileEl.remove();
            handleProjectileHit(attacker, finalTargetCheck, weapon, {x: currentX, y: currentY}); return;
        }

        // Проверка выхода за пределы или завершения полета
        if (ticksPassed >= travelTicks || currentX < -projectileEl.offsetWidth || currentX > ARENA_WIDTH || currentY < -projectileEl.offsetHeight || currentY > ARENA_HEIGHT) {
            if (projectileEl.parentElement) projectileEl.remove();
            // Проверяем, не попали ли мы рядом с целью в момент исчезновения
            const finalTarget = currentFighters.find(f => f.id === target.id && f.alive);
            if (finalTarget && getDistance({x: currentX, y: currentY}, finalTarget) < (FIGHTER_WIDTH * 0.75) ) {
                 handleProjectileHit(attacker, finalTarget, weapon, {x: currentX, y: currentY});
            }
        } else {
             // Используем requestAnimationFrame для более плавной анимации, если возможно
             requestAnimationFrame(animateProjectileTick);
             // Старый вариант с setTimeout:
             // setTimeout(animateProjectileTick, Math.max(16, GAME_SPEED / (currentProjectileSpeed / 1.2)) );
        }
    }
    // Запускаем первый кадр анимации
    requestAnimationFrame(animateProjectileTick);
}

function handleProjectileHit(attacker, finalTarget, weapon, hitCoords) {
    const aoeRangedEffect = weapon.effects ? weapon.effects.find(e => e.type === 'aoe_ranged') : null;
    if (aoeRangedEffect && aoeRangedEffect.radius) {
        createAoeIndicator(hitCoords.x, hitCoords.y, aoeRangedEffect.radius);
        let mainTargetWasHitInAoe = false;
        let targetsHitCount = 0;
        currentFighters.filter(f => f.alive).forEach(potentialVictim => {
            if (getDistance(hitCoords, potentialVictim) <= aoeRangedEffect.radius) {
                if (potentialVictim.id === attacker.id && aoeRangedEffect.selfImmune) return; // Самоиммунность
                let aoeDamageMultiplier = 1.0;
                // Снижаем урон для вторичных целей
                if (finalTarget && potentialVictim.id !== finalTarget.id && aoeRangedEffect.subDamageFactor !== undefined) aoeDamageMultiplier = aoeRangedEffect.subDamageFactor;
                else if (!finalTarget && aoeRangedEffect.subDamageFactor !== undefined) aoeDamageMultiplier = aoeRangedEffect.subDamageFactor; // Если основной цели нет (умерла?), все получают сниженный урон

                performAttackDamage(attacker, potentialVictim, weapon, aoeDamageMultiplier);
                targetsHitCount++;
                if (finalTarget && potentialVictim.id === finalTarget.id) mainTargetWasHitInAoe = true;
            }
        });
        // Если основная цель не попала под AOE (например, из-за самоиммунности или если она была единственной целью)
        // но должна была быть поражена прямым попаданием (этот случай маловероятен при AOE, но все же)
        if (finalTarget && !mainTargetWasHitInAoe && getDistance(hitCoords, finalTarget) <= aoeRangedEffect.radius) {
             if (!(finalTarget.id === attacker.id && aoeRangedEffect.selfImmune)) {
                 performAttackDamage(attacker, finalTarget, weapon, 1.0); // Основная цель получает полный урон
                 targetsHitCount++;
             }
        }
        // Опыт за мульти-попадание
        if (targetsHitCount > 1) {
            addExperience(attacker, 'aoe_hit_multiple', (targetsHitCount - 1));
        }
    } else if (finalTarget) { // Обычное попадание без AOE
        performAttackDamage(attacker, finalTarget, weapon);
    }
}


function performAttackDamage(attacker, target, weaponToUse, damageMultiplier = 1.0) {
    if (!target.alive || !attacker.alive || !weaponToUse) return;
    lastDamageTimestamp = Date.now(); // Обновляем время последнего урона

    const isSilenced = attacker.statusEffects && attacker.statusEffects.oe_silence_effect;
    if (isSilenced) {
        // Можно добавить лог, если нужно часто видеть срабатывание молчания
        // logMessage(`${attacker.name} не может использовать спец. эффекты оружия (молчание)!`, "log-effect");
    }

    // Проверка шанса промаха из-за ослепления (oe_accuracy_debuff_effect)
    if (attacker.statusEffects?.oe_accuracy_debuff_effect) {
        if (Math.random() < (attacker.statusEffects.oe_accuracy_debuff_effect.missChance || 0.15)) {
            logMessage(`${attacker.name} <span class="log-effect">промахивается</span> из-за ослепления!`, "log-effect");
            return; // Атака не состоялась
        }
    }

    const isCrit = Math.random() < (weaponToUse.critChance || 0);
    let damage = getRandomInt(weaponToUse.minDamage || 0, weaponToUse.maxDamage || 0);

    // Модификация крит. урона
    if (isCrit) {
        // Проверка на Анти-Крит Щит цели
        if (target.canNullifyCrit) {
            logMessage(`${target.name} <span class="log-armor-block">поглощает критический удар</span> ${attacker.name} анти-крит щитом!`, "log-armor-block");
            target.canNullifyCrit = false;
            // Удаляем эффект, если он был одноразовым или временным
            const critDefEffect = target.statusEffects?.oe_crit_defense_effect;
            if (critDefEffect) {
                 if (typeof critDefEffect.onRemove === 'function') critDefEffect.onRemove(target, critDefEffect);
                 delete target.statusEffects.oe_crit_defense_effect;
                 updateFighterElement(target); // Обновляем, чтобы убрать возможные визуальные эффекты щита
            }
            return; // Урон полностью поглощен
        }
        damage = Math.round(damage * 1.5 * (target.critDamageTakenMultiplier || 1)); // Базовый крит x1.5 + множитель цели
    }

    // Множитель исходящего урона атакующего
    damage = Math.round(damage * (attacker.damageOutputMultiplier || 1));
    // Множитель от конкретной атаки (например, для AOE)
    damage = Math.round(damage * damageMultiplier);


    // --- Проверка уклонения ---
    const isAOE = weaponToUse.effects && weaponToUse.effects.some(e => e.type === 'aoe_melee' || e.type === 'aoe_ranged');
    const evasionRoll = Math.random();
    const targetEvasionChance = (target.evasionChance || 0) + (target.combatStats.intellect.defense * 0.01); // Добавим бонус от интеллекта
    if (!isAOE && evasionRoll < targetEvasionChance ) { // AOE атаки не могут быть уклонены (или можно добавить шанс?)
        logMessage(`${target.name} <span class="log-evasion">уклоняется</span> от атаки ${attacker.name}!`, "log-evasion");
        addExperience(target, 'evade_attack');
        if (target.combatStats.intellect.defense > 2) logIntellectAction(target, 'defense', 'Уклонился!');
        return; // Урон не нанесен
    }
    // --- Конец проверки уклонения ---


    // Проверка пробития брони
    const armorPierceEffect = weaponToUse.effects ? weaponToUse.effects.find(e => e.type === 'armor_pierce') : null;
    const piercesArmor = armorPierceEffect && (Math.random() < (armorPierceEffect.chance || 0.0)); // Используем шанс из эффекта

    // Применяем урон с учетом брони и других модификаторов
    const damageResult = applyDamage(target, damage, attacker, isCrit, weaponToUse.name, piercesArmor, weaponToUse.type === 'melee');


    // Применяем статусные эффекты оружия (если не под молчанием и урон прошел или пробил броню)
    if (!isSilenced && (damageResult.damageApplied > 0 || (damageResult.blockedByArmor && piercesArmor))) {
         if (weaponToUse.effects && weaponToUse.effects.length > 0) {
            weaponToUse.effects.forEach(effect => {
                // Применяем только статусные эффекты (не AOE, не пирсинг, не лайфстил и т.д.)
                if (['stun', 'poison', 'slow', 'root', 'burn'].includes(effect.type)) {
                    if (Math.random() < (effect.chance || 1.0)) { // Учитываем шанс эффекта
                        // Передаем детали эффекта (длительность, dps и т.д.)
                        applyStatusEffect(target, effect.type, { ...effect, sourceId: attacker.id });
                    }
                }
            });
        }
        // Применяем специальные эффекты оружия (лайфстил, пуш/пулл)
        applyWeaponSpecialEffects(attacker, target, weaponToUse, damageResult.damageApplied);
    }
}

function applyDamage(target, damage, attackerInfo, isCrit, sourceName = "атака", piercesArmor = false, isMeleeAttack = false) {
    if (!target.alive) return { damageApplied: 0, blockedByArmor: false };
    lastDamageTimestamp = Date.now();

    // --- Проверка Неуязвимости ---
    if (target.isInvulnerable) {
        logMessage(`${target.name} <span class="log-evasion">неуязвим</span> и не получает урона от ${attackerInfo.name || "источника"}!`, "log-evasion");
        return { damageApplied: 0, blockedByArmor: false };
    }
    // --- Конец проверки Неуязвимости ---

    let actualDamage = damage;
    let blockedByArmorThisHit = false;
    const attackerName = attackerInfo.name || "Неизвестный источник";
    const attackerId = attackerInfo.id || null;

    // --- Проверка уязвимости цели (от эффекта Слабое Место Врага) ---
    if (target.vulnerabilityBonusNextHit && target.vulnerabilityBonusNextHit > 1) {
        actualDamage = Math.round(actualDamage * target.vulnerabilityBonusNextHit);
        logMessage(`${target.name} получает <span class="log-crit-damage">усиленный урон</span> по слабому месту! (x${target.vulnerabilityBonusNextHit.toFixed(1)})`, "log-crit-damage");
        // Сбрасываем флаг/множитель после использования
         // Важно: damageTakenMultiplier восстанавливается в onRemove эффекта oe_vulnerability_effect
         delete target.vulnerabilityBonusNextHit;
         // Удаляем сам статус эффект, т.к. он одноразовый
         const vulnEffect = target.statusEffects?.oe_vulnerability_effect;
         if (vulnEffect && vulnEffect.oneTimeUse) {
             if (typeof vulnEffect.onRemove === 'function') vulnEffect.onRemove(target, vulnEffect);
             delete target.statusEffects.oe_vulnerability_effect;
         }
    }
    // --- Конец проверки уязвимости ---


    // --- Проверка и применение Брони ---
    if (target.hasArmor && target.armorHits > 0 && !piercesArmor && !sourceName.includes("Споры") && !sourceName.includes("Яд")) { // Споры и яд игнорируют броню
        target.armorHits--;
        blockedByArmorThisHit = true;
        actualDamage = 0; // Урон полностью поглощен
        logMessage(`🛡️ <span class="log-armor-block">Броня ${target.name} поглощает удар от ${attackerName}! (Осталось: ${target.armorHits})</span>`, "log-armor-block");
        showDamageFlash(target, false, true); // Вспышка блока
        showHitSpark(target, false, true);   // Искра блока
        addExperience(target, 'block_attack'); // Опыт за блок
        // Проверка, сломана ли броня
        if (target.armorHits <= 0) {
            target.hasArmor = false;
            target.maxArmorHits = 0;
            logMessage(`💔 <span class="log-armor">Броня ${target.name} сломана!</span>`, "log-armor");
        }
        updateFighterElement(target);
        // Выход, так как урон не прошел
        return { damageApplied: 0, blockedByArmor: true };
    }
    // Лог пробития брони
    if (piercesArmor && target.hasArmor) {
        logMessage(`⚡ <span class="log-effect">${attackerName} пробивает броню ${target.name}!</span>`, "log-effect");
    }
    // --- Конец проверки Брони ---


    // --- Применение модификаторов получаемого урона ---
    // Проверка Кинетического Барьера
    if (target.kineticBarrierActive && target.kineticBarrierActive.hitsLeft > 0) {
        actualDamage = Math.round(actualDamage * target.kineticBarrierActive.damageReduction);
        target.kineticBarrierActive.hitsLeft--;
        logMessage(`${target.name} <span class="log-armor-block">снижает урон</span> кинетическим барьером! (Осталось зарядов: ${target.kineticBarrierActive.hitsLeft})`, "log-armor-block");
        // Удаляем эффект, если заряды кончились
        if (target.kineticBarrierActive.hitsLeft <= 0) {
            const barrierEffect = target.kineticBarrierActive; // Сохраняем ссылку перед удалением
            delete target.kineticBarrierActive; // Удаляем флаг/ссылку
            // Ищем и удаляем сам статус-эффект
            const effectKey = Object.keys(target.statusEffects).find(k => target.statusEffects[k] === barrierEffect);
            if(effectKey){
                if (typeof target.statusEffects[effectKey].onRemove === 'function') target.statusEffects[effectKey].onRemove(target, target.statusEffects[effectKey]);
                delete target.statusEffects[effectKey];
            }
        }
    }
    // Общий множитель получаемого урона
    actualDamage = Math.round(actualDamage * (target.damageTakenMultiplier || 1));
    if (actualDamage < 0) actualDamage = 0; // Урон не может быть отрицательным
    // --- Конец модификаторов урона ---

    // --- Применение Реактивной Брони (после расчета урона, но до его применения к здоровью) ---
    if (target.reactiveArmorCharge && target.reactiveArmorCharge.charges > 0 && actualDamage >= target.reactiveArmorCharge.threshold) {
        logMessage(`${target.name} <span class="log-effect">активирует реактивную броню</span>, отбрасывая врагов!`, "log-effect");
        target.reactiveArmorCharge.charges--;
        // Отбрасываем всех вокруг (кроме себя)
        currentFighters.filter(f => f.alive && f.id !== target.id && getDistance(target, f) < 100).forEach(otherFighter => {
            const dx = otherFighter.x - target.x;
            const dy = otherFighter.y - target.y;
            const distPush = Math.sqrt(dx*dx + dy*dy);
            if (distPush > 0) {
                otherFighter.x += (dx / distPush) * target.reactiveArmorCharge.pushDistance;
                otherFighter.y += (dy / distPush) * target.reactiveArmorCharge.pushDistance;
                // Ограничение ареной
                otherFighter.x = Math.max(FIGHTER_WIDTH / 2, Math.min(ARENA_WIDTH - FIGHTER_WIDTH / 2, otherFighter.x));
                otherFighter.y = Math.max(FIGHTER_HEIGHT / 2, Math.min(ARENA_HEIGHT - FIGHTER_HEIGHT / 2, otherFighter.y));
                updateFighterElement(otherFighter);
            }
        });
        // Удаляем эффект, если заряды кончились
        if (target.reactiveArmorCharge.charges <= 0) {
             const reactiveEffect = target.reactiveArmorCharge;
             delete target.reactiveArmorCharge;
             const effectKey = Object.keys(target.statusEffects).find(k => target.statusEffects[k] === reactiveEffect);
             if(effectKey){
                if (typeof target.statusEffects[effectKey].onRemove === 'function') target.statusEffects[effectKey].onRemove(target, target.statusEffects[effectKey]);
                 delete target.statusEffects[effectKey];
             }
        }
    }
    // --- Конец Реактивной Брони ---


    // --- Непосредственное нанесение урона здоровью ---
    target.health -= actualDamage;
    // --- Конец нанесения урона здоровью ---


    // --- Эффекты ПОСЛЕ получения урона ---
    // Запись последнего атаковавшего и нанесенного урона
    if (attackerId && !String(attackerId).startsWith('status-') && !String(attackerId).startsWith('orbital_effect')) {
        target.lastDamagedBy = attackerId;
        const attackingFighter = currentFighters.find(f => f.id === attackerId);
        if (attackingFighter) attackingFighter.damageDealtThisRound = (attackingFighter.damageDealtThisRound || 0) + actualDamage;
    }

    // Визуальные эффекты урона
    showDamageFlash(target, isCrit, false);
    showHitSpark(target, isCrit, false);
    if (target.element) target.element.classList.add('hit');
    setTimeout(() => { if (target.element) target.element.classList.remove('hit'); }, 150);

    // Логирование урона
    const damageClass = isCrit ? "log-crit-damage" : "log-damage";
    logMessage(`${attackerName} (${sourceName}) наносит <span class="${damageClass}">${actualDamage}</span> урона ${target.name}. (ОЗ: ${Math.max(0, target.health)})`, damageClass);


    // --- Шипы (Thorns) ---
    if (target.statusEffects?.oe_thorns_effect && isMeleeAttack && actualDamage > 0) {
         const thornDamage = target.statusEffects.oe_thorns_effect.reflectDamage || 0;
         if (thornDamage > 0 && attackerId && !String(attackerId).startsWith('status-') && !String(attackerId).startsWith('orbital_effect')) {
             const originalAttacker = currentFighters.find(f => f.id === attackerId);
             if (originalAttacker && originalAttacker.alive) { // Проверяем, что атакующий еще жив
                logMessage(`🌵 <span style="color:#795548;">Шипы ${target.name} наносят ${thornDamage} урона ${originalAttacker.name}!</span>`, "log-effect");
                // Урон от шипов не считается критом, не пробивает броню и не является рукопашной атакой (чтобы избежать бесконечного отражения)
                applyDamage(originalAttacker, thornDamage, {name: "Шипы", id: `thorns-${target.id}`}, false, "отражение шипов", false, false);
             }
         }
    }
    // --- Конец Шипов ---

    // --- Паразитическая связь ---
    if (target.statusEffects?.oe_shared_pain_effect && actualDamage > 0) {
        const linkEffect = target.statusEffects.oe_shared_pain_effect;
        const sharedDamage = Math.round(actualDamage * linkEffect.percent);
        if (sharedDamage > 0) {
            // Ищем *другого* живого бойца (не цель и не атакующего, если он есть)
            const otherFighters = currentFighters.filter(f => f.alive && f.id !== target.id && f.id !== attackerId);
            if (otherFighters.length > 0) {
                const unfortunateVictim = otherFighters[getRandomInt(0, otherFighters.length - 1)];
                logMessage(`🔗 <span style="color:darkgreen;">Паразитическая связь передает ${sharedDamage} урона от ${target.name} к ${unfortunateVictim.name}!</span>`, "log-effect");
                applyDamage(unfortunateVictim, sharedDamage, {name: "Паразитическая связь", id: `link-${target.id}`}, false, "связь", true, false); // Урон от связи может пробивать броню? Решаем: да (true)
            }
        }
    }
    // --- Конец Паразитической связи ---


    // --- Проверка смерти цели ---
    if (target.health <= 0) {
        target.health = 0;
        target.alive = false;
        if (target.element) {
            target.element.classList.remove('breathing');
            target.element.classList.add('defeated'); // Применяем стиль поражения
        }
        defeatedFightersOrder.push(target.id); // Добавляем в порядок выбывших
        logMessage(`${target.name} <span class="log-kill">повержен</span> от руки ${attackerName}!`, "log-kill");

        // Начисление опыта за убийство
        if (attackerId && !String(attackerId).startsWith('status-') && !String(attackerId).startsWith('orbital_effect')) {
            const attackingFighter = currentFighters.find(f => f.id === attackerId);
            if (attackingFighter) {
                attackingFighter.killsThisRound = (attackingFighter.killsThisRound || 0) + 1;
                addExperience(attackingFighter, 'kill');
                // Дополнительный опыт за убийство опасного врага или врага с высоким интеллектом
                if(getTotalIntellect(target) > getTotalIntellect(attackingFighter) + 2 || target.wins > attackingFighter.wins) {
                   addExperience(attackingFighter, 'defeat_dangerous_enemy');
                } else {
                   addExperience(attackingFighter, 'kill_major_boost'); // Обычный бонус за килл
                }
                // Обновление обучающих данных
                if (attackingFighter.combatStats.learning && attackingFighter.combatStats.learning.weaponEffectiveness) {
                     attackingFighter.combatStats.learning.weaponEffectiveness[target.id] = (attackingFighter.combatStats.learning.weaponEffectiveness[target.id] || 0) + 1; // Повышаем эффективность против этого типа
                }
            }
        }
        // Возможно, стоит обновить элемент сразу после поражения
        // updateFighterElement(target); // Но updateFighterElement проверяет target.alive, так что это не сработает как надо
    } else { // Если цель выжила
        // Запоминаем, кто нанес урон (для AI)
        if (attackerId && !String(attackerId).startsWith('status-') && !String(attackerId).startsWith('orbital_effect') && target.combatStats && target.combatStats.learning && target.combatStats.learning.dangerousEnemies) {
            target.combatStats.learning.dangerousEnemies[attackerId] = (target.combatStats.learning.dangerousEnemies[attackerId] || 0) + actualDamage;
        }
    }
    // --- Конец проверки смерти ---

    updateFighterElement(target); // Обновляем вид цели (здоровье и т.д.)
    return { damageApplied: actualDamage, blockedByArmor: false }; // Возвращаем фактически нанесенный урон
}