// --- GAME FLOW ---

/**
 * Завершает текущий раунд.
 * @param {boolean} [isStallRestart=false] - Был ли раунд завершен из-за застоя (для перезапуска).
 */
function endRound(isStallRestart = false) {
    console.log(`endRound called. isStallRestart: ${isStallRestart}, roundInProgress: ${roundInProgress}`);

    // Предотвращение многократного вызова, КРОМЕ случая рестарта по таймауту или ручного
    if (!roundInProgress && !isStallRestart) {
         console.log("endRound: Exiting because round not in progress and not a stall/manual restart.");
         return;
    }

    // Важно: Сначала останавливаем игровой цикл и сбрасываем флаги
    if (gameLoopInterval) {
        clearInterval(gameLoopInterval);
        gameLoopInterval = null;
        console.log("endRound: Cleared gameLoopInterval.");
    }
    if (preRoundTimeoutId) {
        clearTimeout(preRoundTimeoutId);
        preRoundTimeoutId = null;
        console.log("endRound: Cleared preRoundTimeoutId.");
    }
    roundInProgress = false; // Устанавливаем, что раунд больше не идет

    // Блокируем кнопки на время обработки конца раунда
    if(startButtonEl) startButtonEl.disabled = true;
    if(restartRoundButtonEl) restartRoundButtonEl.disabled = true;


    // --- Логика для перезапуска из-за застоя или вручную ---
    if (isStallRestart) {
        logMessage(`🏁 <span class='log-stall-restart'>Перезапуск раунда ${roundCounter}...</span>`, "log-stall-restart");
        // Очистка только необходимых элементов
         if (arenaEl) arenaEl.innerHTML = '';
         clearOrbitalEffects();
         arenaBonuses.forEach(b => { if (b.element?.parentElement) b.element.remove(); });
         arenaBonuses = [];
         currentFighters = []; // Очищаем массив бойцов для перезапуска

        // Запускаем подготовку нового раунда через небольшую задержку
        preRoundTimeoutId = setTimeout(() => {
            if (isGameOver) {
                 console.log("endRound (stall/manual restart): Game is over, not restarting round.");
                 return;
            }
             console.log("endRound (stall/manual restart): Calling setupNewRound(true, true)...");
            // true для isContinuation (не сбрасывать счетчик раундов), true для isManualRestart (не давать золото)
            setupNewRound(true, true);
        }, NEW_ROUND_DELAY / 2); // Короткая задержка перед настройкой
        return; // Выход, остальная логика конца раунда не нужна
    }

    // --- Обычная логика конца раунда (не перезапуск) ---
    console.log("endRound: Proceeding with normal end round logic.");
    const aliveFightersCurrent = currentFighters.filter(f => f.alive);
    let winner = null;

    if (aliveFightersCurrent.length === 1) {
        winner = aliveFightersCurrent[0];
        logMessage(`🎉 <span class="log-winner">${winner.name}</span> ПОБЕЖДАЕТ В РАУНДЕ ${roundCounter}!`, "log-winner");
        const winnerData = fightersInitialData.find(f => f.id === winner.id);
        if (winnerData) winnerData.wins++;

        const totalInt = getTotalIntellect(winner);
        if (totalInt >= 12) {
             let intellectSummary = `(${INTELLECT_SYMBOLS.tactical}${winner.combatStats.intellect.tactical} ${INTELLECT_SYMBOLS.defense}${winner.combatStats.intellect.defense} ${INTELLECT_SYMBOLS.resource}${winner.combatStats.intellect.resource} ${INTELLECT_SYMBOLS.spatial}${winner.combatStats.intellect.spatial})`;
             logMessage(`🧠 Интеллект победителя: <span class="log-winner">${intellectSummary}</span>`, "log-winner");
        }

    } else if (aliveFightersCurrent.length === 0) {
        logMessage(`💔 Все бойцы пали в раунде ${roundCounter}! Ничья...`, "log-winner");
    } else {
        // Этот случай не должен происходить при нормальном завершении, но оставим лог на всякий случай
        logMessage(`🤔 Раунд ${roundCounter} завершен (${aliveFightersCurrent.length} выживших). Неопределенный исход.`, "log-winner");
    }

    // Обработка ставок
    if (currentBet.placed && currentBet.fighterId && currentBet.amount > 0) {
        let payoutMultiplier = 0;
        let placeTaken = 0;
        const betOnFighterData = fightersInitialData.find(f => f.id === currentBet.fighterId);
        const betOnFighterName = betOnFighterData ? betOnFighterData.name : "Боец";
        const totalFightersInRound = currentFighters.length; // Общее число участников в раунде

        if (winner && winner.id === currentBet.fighterId) { // Ставка на победителя
            payoutMultiplier = 10; placeTaken = 1;
        } else { // Проверяем 2-е и 3-е места по порядку выбывших
            const actualDefeatedCount = defeatedFightersOrder.length;
            // Если боец занял 2е место (предпоследний выбывший ИЛИ второй выживший, если победитель определен)
            if (actualDefeatedCount >= totalFightersInRound - 1 && defeatedFightersOrder[actualDefeatedCount - 1] === currentBet.fighterId) {
                 payoutMultiplier = 5; placeTaken = 2;
            }
            // Если боец занял 3е место (третий с конца выбывший)
            else if (actualDefeatedCount >= totalFightersInRound - 2 && defeatedFightersOrder[actualDefeatedCount - 2] === currentBet.fighterId) {
                 payoutMultiplier = 3; placeTaken = 3;
            }
        }


        if (payoutMultiplier > 0) {
            const winnings = currentBet.amount * payoutMultiplier;
            playerGold += winnings;
            logMessage(`💰 ПОЗДРАВЛЯЕМ! Ваша ставка на <span class="log-winner">${betOnFighterName}</span> (${placeTaken}-е место) выиграла! Вы получаете ${winnings.toLocaleString()} золота!`, "log-winner");
        } else {
            logMessage(`💔 Ваша ставка на <span class="log-damage">${betOnFighterName}</span> не сыграла.`, "log-damage");
        }
        currentBet = { fighterId: null, amount: 0, placed: false }; // Сброс ставки
    }
    updatePlayerGoldDisplay();

    // Начисление опыта за раунд
    processRoundExperience();

    // Сохраняем обновленные данные бойцов (обиды, обучение, интеллект, опыт)
    currentFighters.forEach(cf => {
        const fData = fightersInitialData.find(f => f.id === cf.id);
        if (fData && fData.combatStats) {
            fData.combatStats.learnedGrudges = deepCopy(cf.combatStats.learnedGrudges || {});
            fData.combatStats.learning = deepCopy(cf.combatStats.learning || {});
            fData.combatStats.intellect = deepCopy(cf.combatStats.intellect || {});
            fData.combatStats.experience = deepCopy(cf.combatStats.experience || {});
        }
    });

    // Снимаем модификатор раунда, если он был
    if (activeRoundModifier && activeRoundModifier.remove) {
         // Применяем remove ко всем *исходным* данным бойцов, участвовавших в раунде
         // чтобы корректно сбросить модификаторы перед следующим раундом
         const participatingIds = currentFighters.map(f => f.id);
         fightersInitialData.forEach(fInitialData => {
             if (participatingIds.includes(fInitialData.id)) {
                 // Важно: передаем исходные данные, а не инстанс из currentFighters
                 activeRoundModifier.remove(fInitialData);
             }
         });
    }
    activeRoundModifier = null; // Сбрасываем активный модификатор

    updateScoreboard(); // Обновляем таблицу с новыми победами и интеллектом

    // Добавляем класс defeated для проигравших, если его еще нет
    currentFighters.forEach(f => {
        if (!f.alive && f.element && !f.element.classList.contains('defeated')) {
            f.element.classList.add('defeated');
            f.element.classList.remove('breathing');
        }
    });

    // Проверка на конец игры
    if (isGameOver) {
         console.log("endRound: Game is over, not scheduling next round.");
         if(startButtonEl) startButtonEl.textContent = "ИГРА ОКОНЧЕНА"; // Устанавливаем финальный текст кнопки
         // Кнопки уже должны быть disabled
         return;
    }

    // Подготовка к следующему раунду
    logMessage(`Подготовка к раунду ${roundCounter + 1}...`, "log-round-start");
    preRoundTimeoutId = setTimeout(() => {
        if (isGameOver) return; // Еще раз проверка на всякий случай
        console.log("endRound: Scheduling setupNewRound(true) via setTimeout.");
        setupNewRound(true); // true для isContinuation (продолжение игры)
    }, NEW_ROUND_DELAY);
     console.log(`endRound: Scheduled next round setup with timeout ID: ${preRoundTimeoutId}`);
}


/**
 * Настраивает и подготавливает новый раунд игры.
 * @param {boolean} [isContinuation=false] - Является ли этот раунд продолжением предыдущего (не сброс счетчика).
 * @param {boolean} [isManualRestart=false] - Был ли раунд перезапущен вручную (не начислять золото за раунд, сбросить флаг game over).
 */
function setupNewRound(isContinuation = false, isManualRestart = false) {
    // Если игра окончена и это не ручной рестарт, выходим
    if (isGameOver && !isManualRestart) {
        console.log("setupNewRound: Game is over and not a manual restart. Exiting.");
        return;
    }
    // Если это ручной рестарт, сбрасываем флаг конца игры
    if (isManualRestart) {
        isGameOver = false;
        console.log("setupNewRound: Manual restart, isGameOver reset to false.");
    }

    console.log("--- Starting setupNewRound --- isContinuation:", isContinuation, "isManualRestart:", isManualRestart);

    // Сброс состояния раунда
    roundInProgress = false;
    if (gameLoopInterval) { clearInterval(gameLoopInterval); gameLoopInterval = null; }
    if (preRoundTimeoutId) { clearTimeout(preRoundTimeoutId); preRoundTimeoutId = null; }

    // Очистка арены и данных раунда
    if (arenaEl) arenaEl.innerHTML = '';
    clearOrbitalEffects();
    arenaBonuses.forEach(b => { if (b.element?.parentElement) b.element.remove(); });
    arenaBonuses = [];
    currentFighters = [];
    duelContenders = null;
    activeRoundModifier = null; // Сбрасываем модификатор здесь
    intelliActionLog = {};
    defeatedFightersOrder = [];
    createFighterInstanceNamespace.commonWeaponThisRound = null; // Сброс общего оружия
    lastDamageTimestamp = Date.now(); // Сброс таймера бездействия
    userScrolledLog = false; // Сброс флага скролла лога
    if (scrollLogDownButtonEl) scrollLogDownButtonEl.style.opacity = '0'; // Скрываем кнопку скролла

    // Обновление золота игрока (кроме ручного рестарта)
    if (!isManualRestart) {
        playerGold += GOLD_PER_ROUND_BONUS;
    }
    currentBet = { fighterId: null, amount: 0, placed: false }; // Сброс ставки
    isBettingPaused = false; // Сброс паузы для ставок
    updatePlayerGoldDisplay(); // Обновляем отображение золота

    // Скрытие модальных окон
    if (bettingModalEl) bettingModalEl.style.display = 'none';
    if (gameOverOverlayEl) gameOverOverlayEl.style.display = 'none'; // Скрываем Game Over на всякий случай
    if (guideModal) guideModal.style.display = 'none'; // Скрываем руководство
    isGuideOpen = false; // Сбрасываем флаг открытого руководства
    gameWasPausedByGuide = false; // Сбрасываем флаг паузы от руководства

    // Обновление счетчика раундов (только если это не ручной рестарт)
    if (!isManualRestart) {
        if (!isContinuation) { // Если это самый первый запуск
            roundCounter = 1;
        } else { // Если это продолжение
            roundCounter++;
        }
    } // При ручном рестарте roundCounter не меняется

    // Обновление заголовков
    document.title = `Арена Гладиаторов: Раунд ${roundCounter}`;
    if (h1TitleEl) h1TitleEl.textContent = `Арена Гладиаторов: Раунд ${roundCounter}`;

    // Очистка лога (только при первом запуске или если не продолжение/рестарт)
    if ((!isContinuation || battleLogEl.children.length === 0) && !isManualRestart && battleLogEl) {
        battleLogEl.innerHTML = '';
    }
    logMessage(`⚔️ Раунд ${roundCounter} начинается! Бойцы готовятся...`, "log-round-start");

    // Выбор модификатора раунда (если не первый раунд)
    activeRoundModifier = null; // Сначала сбрасываем
    if (roundCounter > 1 && Math.random() < MODIFIER_CHANCE_PER_ROUND) {
        activeRoundModifier = roundModifiers[getRandomInt(0, roundModifiers.length - 1)];
        logMessage(`🔮 МОДИФИКАТОР РАУНДА: <span class="log-modifier">${activeRoundModifier.name}</span>`, "log-modifier");
        logMessage(`<i>${activeRoundModifier.description}</i>`, "log-modifier");
    }

    // Лог для спец-раунда
    if (roundCounter > 0 && roundCounter % 5 === 0) {
        logMessage("💥 <span class='log-winner'>Спец-раунд! Все бойцы получают одинаковое оружие!</span>", "log-winner");
    }

    // Фильтрация и проверка участников
    const participatingFightersData = fightersInitialData.filter(fData => fData.participating);
    if (participatingFightersData.length < 2) {
        logMessage("Недостаточно бойцов для начала раунда (нужно минимум 2). Отметьте участников в таблице.", "log-kill");
        if(startButtonEl) {
            startButtonEl.textContent = 'Нужно больше бойцов!';
            startButtonEl.disabled = false;
        }
        if(restartRoundButtonEl) restartRoundButtonEl.style.display = 'none';
        firstRoundStarted = false; // Сбрасываем флаг, если бойцов не хватило
        // Откатываем счетчик раунда, если он увеличился зря
        if (!isManualRestart && isContinuation) roundCounter--;
        document.title = `Арена Гладиаторов`;
        if (h1TitleEl) h1TitleEl.textContent = `Арена Гладиаторов`;
        return; // Выход из функции, раунд не начнется
    }

    // Создание инстансов бойцов для раунда
    currentFighters = participatingFightersData.map(data => createFighterInstance(data));

    // Применение модификатора к инстансам бойцов
    if (activeRoundModifier && activeRoundModifier.apply) {
        currentFighters.forEach(f => {
            if (f) activeRoundModifier.apply(f); // Применяем к каждому созданному бойцу
        });
    }

    // Управление кнопкой ставок
    const allFightersAreActuallyParticipating = fightersInitialData.length === participatingFightersData.length && fightersInitialData.every(f => f.participating);
    if (placeBetButtonEl) {
        if (allFightersAreActuallyParticipating && currentFighters.length >= 2) {
            placeBetButtonEl.style.display = 'block';
            logMessage("💰 Доступны ставки на этот раунд! (Все бойцы участвуют)", "log-bonus");
        } else {
            placeBetButtonEl.style.display = 'none';
            if (!allFightersAreActuallyParticipating && currentFighters.length >= 2) logMessage("Ставки недоступны: не все бойцы участвуют.", "log-effect");
            else if (currentFighters.length < 2) logMessage("Ставки недоступны: недостаточно бойцов.", "log-effect");
        }
    }

    // Лог о бойце с высоким интеллектом
    if (currentFighters.length > 0) {
        const highestIntellectFighter = currentFighters.reduce((prev, current) => getTotalIntellect(prev) > getTotalIntellect(current) ? prev : current, currentFighters[0]);
        if (highestIntellectFighter && getTotalIntellect(highestIntellectFighter) >= 10) {
            let intellectSummary = `(${INTELLECT_SYMBOLS.tactical}${highestIntellectFighter.combatStats.intellect.tactical} ${INTELLECT_SYMBOLS.defense}${highestIntellectFighter.combatStats.intellect.defense} ${INTELLECT_SYMBOLS.resource}${highestIntellectFighter.combatStats.intellect.resource} ${INTELLECT_SYMBOLS.spatial}${highestIntellectFighter.combatStats.intellect.spatial})`;
            logMessage(`🧠 <span class="log-winner">${highestIntellectFighter.name}</span> выделяется высоким интеллектом ${intellectSummary}!`, "log-winner");
        }
    }

    // Отображение информации об оружии в оверлее
    if (weaponInfoListEl) weaponInfoListEl.innerHTML = '';
    currentFighters.forEach(fighter => {
        createFighterElement(fighter); // Создаем DOM элемент бойца
        if (weaponInfoListEl) {
            const li = document.createElement('li');
            let intellectInfo = "";
            const totalInt = getTotalIntellect(fighter);
             if (totalInt > 4) {
                intellectInfo = `<span class="fighter-intellect-info">(`;
                if (fighter.combatStats.intellect.tactical > 1) intellectInfo += `<span class="int-tactical">${INTELLECT_SYMBOLS.tactical}${fighter.combatStats.intellect.tactical}</span>`;
                if (fighter.combatStats.intellect.defense > 1) intellectInfo += `<span class="int-defense">${INTELLECT_SYMBOLS.defense}${fighter.combatStats.intellect.defense}</span>`;
                if (fighter.combatStats.intellect.resource > 1) intellectInfo += `<span class="int-resource">${INTELLECT_SYMBOLS.resource}${fighter.combatStats.intellect.resource}</span>`;
                if (fighter.combatStats.intellect.spatial > 1) intellectInfo += `<span class="int-spatial">${INTELLECT_SYMBOLS.spatial}${fighter.combatStats.intellect.spatial}</span>`;
                intellectInfo += `)</span>`;
            }
            li.innerHTML = `<span class="fighter-name-info">${fighter.name}</span>${intellectInfo} вооружен: <span class="weapon-name-info">${fighter.weapon.name}</span> <span class="weapon-emoji-info">${fighter.weapon.emoji}</span>`;
            weaponInfoListEl.appendChild(li);
        }
    });

    spawnInitialOrbitalEffects(); // Создаем орбитальные эффекты

    // Показываем оверлей с информацией об оружии
    if (roundInfoOverlayEl) roundInfoOverlayEl.style.display = 'flex';

    // Обновляем состояние кнопок
    if(startButtonEl) {
        startButtonEl.textContent = 'Раунд Идет...';
        startButtonEl.disabled = true;
    }
    if(restartRoundButtonEl) {
        restartRoundButtonEl.style.display = 'block'; // Показываем кнопку рестарта
        restartRoundButtonEl.disabled = false; // Делаем ее активной
    }
    updateScoreboard(); // Обновляем таблицу лидеров

    // Запускаем таймер до начала боя (или до открытия окна ставок)
    preRoundTimeoutId = setTimeout(() => {
        // Если игра на паузе из-за ставок, ничего не делаем
        if (isBettingPaused) {
            console.log("setupNewRound: Betting is paused, not starting round yet.");
            return;
        }
        // Если ставки не выбраны или не доступны, начинаем бой
        proceedToRoundStart();
    }, PRE_ROUND_WEAPON_DISPLAY_DURATION);
     console.log(`setupNewRound: Scheduled round start or betting check with timeout ID: ${preRoundTimeoutId}`);
}

/**
 * Начинает активную фазу раунда после предбоевой подготовки/ставок.
 */
function proceedToRoundStart() {
    if(isGameOver || roundInProgress) {
        console.log("proceedToRoundStart: Cannot start, game over or round already in progress.");
        return;
    }
    if (roundInfoOverlayEl) roundInfoOverlayEl.style.display = 'none'; // Скрываем оверлей с оружием
    if (bettingModalEl) bettingModalEl.style.display = 'none'; // Скрываем окно ставок на всякий случай
    logMessage("БОЙ НАЧИНАЕТСЯ!", "log-round-start");
    roundInProgress = true;
    lastDamageTimestamp = Date.now(); // Сбрасываем таймер бездействия
    userScrolledLog = false;
    updateScoreboard(); // Обновляем таблицу на случай, если интеллект изменился

    console.log("proceedToRoundStart: Checking functions before setInterval...");
    console.log(" - typeof gameTick:", typeof gameTick);

    if (typeof gameTick !== 'function') {
        console.error("CRITICAL: gameTick is not defined before setInterval!");
        // Попытка безопасно остановить игру
        if(startButtonEl) { startButtonEl.textContent = "Ошибка! Перезапустить?"; startButtonEl.disabled = false; }
        if(restartRoundButtonEl) restartRoundButtonEl.style.display = 'none';
        return;
    }

    // Запускаем основной игровой цикл
    gameLoopInterval = setInterval(gameTick, GAME_SPEED);
    console.log(`proceedToRoundStart: Started game loop with interval ID: ${gameLoopInterval}`);
}

/**
 * Один игровой тик (основной цикл игры).
 */
function gameTick() {
    // Останавливаем тик, если раунд не идет, игра окончена или открыто руководство
    if (!roundInProgress || isGameOver || isGuideOpen) {
        if (gameLoopInterval && !isGuideOpen) { // Не чистим интервал, если пауза из-за гайда (он сам его остановил)
             console.warn("gameTick: Called while round not in progress or game over. Clearing interval.");
             clearInterval(gameLoopInterval);
             gameLoopInterval = null;
        }
        return;
    }

    intelliActionLog = {}; // Сброс лога действий ИИ на этот тик
    const aliveFighters = currentFighters.filter(f => f.alive);

    // --- Проверка на бездействие (только если гайд не открыт!) ---
    if (!isGuideOpen && Date.now() - lastDamageTimestamp > STALL_TIMEOUT && aliveFighters.length > 1 && !duelContenders) {
        logMessage("⏳ <span class='log-stall-restart'>Бездействие на арене более " + (STALL_TIMEOUT / 1000) + " секунд! Раунд перезапускается...</span>", "log-stall-restart");
        endRound(true); // Перезапуск из-за застоя
        return; // Выход из тика после вызова endRound
    }
    // --- Конец проверки на бездействие ---


    // --- Проверка конца раунда ---
    if (aliveFighters.length <= 1) {
        console.log(`gameTick: Ending round because alive fighters count is ${aliveFighters.length}. Calling endRound(false)...`);
        endRound(false); // Обычное завершение раунда
        return; // Выход из тика после вызова endRound
    }
    // --- Конец проверки конца раунда ---


    // --- Основной цикл действий бойцов ---
    aliveFighters.forEach(fighter => {
        if (!fighter.alive) return; // Пропускаем мертвых

        fighter.ticksSurvivedThisRound++; // Увеличиваем счетчик выживания

        // Уменьшаем кулдаун действия
        if (fighter.actionCooldown > 0) {
            fighter.actionCooldown--;
        }

        // Обработка статусных эффектов (яд, горение, реген и т.д.)
        if (typeof processStatusEffects === 'function') {
            processStatusEffects(fighter);
        } else {
             console.error("gameTick: processStatusEffects is not defined!");
             // Возможно, стоит остановить игру здесь, чтобы избежать лавины ошибок
             clearInterval(gameLoopInterval); gameLoopInterval = null; return;
        }


        // Применение тиковых модификаторов раунда
        if (activeRoundModifier?.applyTick) {
            activeRoundModifier.applyTick(fighter);
        }

        // Выбор и выполнение действия, если боец готов и не в стане
        if (fighter.alive && fighter.actionCooldown <= 0 && !fighter.statusEffects?.stun) {
             if (typeof chooseAction === 'function' && typeof executeAction === 'function') {
                 chooseAction(fighter, aliveFighters, arenaBonuses);
                 executeAction(fighter);
             } else {
                  console.error("gameTick: chooseAction or executeAction is not defined!");
                  clearInterval(gameLoopInterval); gameLoopInterval = null; return;
             }
        }

        // Обновление DOM-элемента бойца (позиция, хп, броня, статусы)
        updateFighterElement(fighter);
    });
    // --- Конец цикла действий бойцов ---


    // --- Управление бонусами и орбитальными эффектами ---
    manageArenaBonuses(); // Спавн бонусов
    updateOrbitalEffectsPosition(); // Движение орбитальных эффектов
    // --- Конец управления бонусами и орбитальными эффектами ---


    // --- Проверка и начало дуэли ---
    if (!duelContenders && aliveFighters.length === 2) {
        duelContenders = [...aliveFighters];
        logMessage(`⚔️ <span class="log-duel">ДУЭЛЬ!</span> ${duelContenders[0].name} против ${duelContenders[1].name}!`, "log-duel");
        duelContenders.forEach(f => {
            addExperience(f, 'target_priority_success'); // Опыт за выход в финал
            if(getTotalIntellect(f) >= 8) logIntellectAction(f, 'tactical', `вступает в дуэль!`);
        });
    }
    // Проверка конца дуэли (если один из дуэлянтов выбыл)
     else if (duelContenders) {
         const [fighter1, fighter2] = duelContenders;
         if (!fighter1.alive || !fighter2.alive) {
             const duelWinner = fighter1.alive ? fighter1 : (fighter2.alive ? fighter2 : null);
             const duelLoser = fighter1.alive ? fighter2 : fighter1;
             if (duelWinner) {
                 logMessage(`👑 <span class="log-winner">${duelWinner.name}</span> побеждает в дуэли против ${duelLoser.name}!`, "log-winner");
                 addExperience(duelWinner, 'defeat_dangerous_enemy'); // Доп. опыт за победу в дуэли
                 if (getTotalIntellect(duelWinner) >= 10) logIntellectAction(duelWinner, 'tactical', `выиграл дуэль!`);
             } else {
                 // Этот случай маловероятен, если конец раунда обрабатывается корректно
                 logMessage(`💔 Дуэль между ${fighter1.name} и ${fighter2.name} завершилась без явного победителя.`, "log-winner");
             }
             duelContenders = null; // Сбрасываем дуэль
         }
     }
    // --- Конец проверки дуэли ---
}