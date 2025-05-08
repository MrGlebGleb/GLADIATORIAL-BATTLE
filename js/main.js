// --- MAIN SCRIPT (INITIALIZATION) ---

/**
 * Инициализирует игру, устанавливает слушатели событий.
 */
function initGame() {
    console.log("initGame: Starting initialization...");

    document.title = "Арена Гладиаторов";
    if (h1TitleEl) {
        h1TitleEl.textContent = `Арена Гладиаторов`;
    } else {
        console.error("initGame: h1TitleEl not found!");
    }

    // --- Слушатели событий для кнопок управления игрой ---
    if (startButtonEl) {
        startButtonEl.addEventListener('click', () => {
            console.log("startButtonEl clicked. isGameOver:", isGameOver, "firstRoundStarted:", firstRoundStarted, "roundInProgress:", roundInProgress);
            if (isGameOver) return; // Используется isGameOver
            if ((!firstRoundStarted && !roundInProgress) ||
                startButtonEl.textContent === 'Нужно больше бойцов!' ||
                startButtonEl.textContent === 'Ошибка! Перезапустить?') {
                firstRoundStarted = true;
                startButtonEl.textContent = 'Подготовка...';
                startButtonEl.disabled = true;
                if (restartRoundButtonEl) restartRoundButtonEl.style.display = 'none';
                setupNewRound(false);
            }
        });
    } else {
        console.error("initGame: startButtonEl not found!");
    }

    if (restartRoundButtonEl) {
        restartRoundButtonEl.addEventListener('click', () => {
            console.log("restartRoundButtonEl clicked. firstRoundStarted:", firstRoundStarted, "isGameOver:", isGameOver);
            if (!firstRoundStarted && !isGameOver) { // Используется isGameOver
                 alert("Сначала начните игру!");
                 return;
            }
            if (confirm("Перезапустить текущий раунд? Текущий прогресс раунда (опыт, ставки) будет потерян.")) {
                logMessage("🏁 <span class='log-stall-restart'>Раунд перезапускается вручную...</span>", "log-stall-restart");
                endRound(true);
            }
        });
    } else {
         console.warn("initGame: restartRoundButtonEl not found or initially hidden.");
    }

    // --- Слушатели событий для ставок ---
     if (placeBetButtonEl) {
        placeBetButtonEl.addEventListener('click', () => {
            console.log("placeBetButtonEl clicked.");
            if (isGameOver || roundInProgress) return; // Используется isGameOver
            const participatingCount = fightersInitialData.filter(f => f.participating).length;
            if (fightersInitialData.length !== participatingCount || participatingCount < 2) {
                 alert("Ставки доступны только когда все бойцы участвуют и их минимум двое.");
                 placeBetButtonEl.style.display = 'none';
                 return;
            }
            isBettingPaused = true;
            if (preRoundTimeoutId) clearTimeout(preRoundTimeoutId);
            if (betFighterSelectEl) betFighterSelectEl.innerHTML = '';
            const aliveBetTargets = currentFighters ? currentFighters.filter(f => f.alive) : [];
            aliveBetTargets.forEach(f => {
                const option = document.createElement('option');
                option.value = f.id;
                let intellectInfo = "";
                const totalInt = getTotalIntellect(f);
                 if (totalInt > 4) {
                    intellectInfo = ` (${INTELLECT_SYMBOLS.tactical}${f.combatStats?.intellect?.tactical || 1}, ${INTELLECT_SYMBOLS.defense}${f.combatStats?.intellect?.defense || 1}, ${INTELLECT_SYMBOLS.resource}${f.combatStats?.intellect?.resource || 1}, ${INTELLECT_SYMBOLS.spatial}${f.combatStats?.intellect?.spatial || 1})`;
                }
                option.textContent = f.name + intellectInfo;
                if (betFighterSelectEl) betFighterSelectEl.appendChild(option);
            });
            if (betAmountInputEl) { betAmountInputEl.value = ''; betAmountInputEl.max = playerGold; } // Используется playerGold
            if (betErrorMessageEl) betErrorMessageEl.textContent = '';
            updatePlayerGoldDisplay(); // Косвенно использует playerGold
            if (bettingModalEl) bettingModalEl.style.display = 'flex';
        });
    } else {
        console.error("initGame: placeBetButtonEl not found!");
    }

    if (confirmBetButtonEl) {
         confirmBetButtonEl.addEventListener('click', () => {
            console.log("confirmBetButtonEl clicked.");
             if (isGameOver) return; // Используется isGameOver
             const selectedFighterId = betFighterSelectEl.value;
             const betAmount = parseInt(betAmountInputEl.value);
             if (betErrorMessageEl) betErrorMessageEl.textContent = '';
             if (!selectedFighterId) { if (betErrorMessageEl) betErrorMessageEl.textContent = 'Выберите бойца.'; return; }
             if (isNaN(betAmount) || betAmount <= 0) { if (betErrorMessageEl) betErrorMessageEl.textContent = 'Введите корректную сумму.'; return; }
             if (betAmount > playerGold) { if (betErrorMessageEl) betErrorMessageEl.textContent = 'Недостаточно золота.'; return; } // Используется playerGold
             currentBet.fighterId = selectedFighterId;
             currentBet.amount = betAmount;
             currentBet.placed = true;
             playerGold -= betAmount; // Используется playerGold
             updatePlayerGoldDisplay();
             const fighterBetOn = currentFighters?.find(f => f.id === selectedFighterId);
             logMessage(`💰 Вы поставили ${betAmount.toLocaleString()} золота на <span class="log-winner">${fighterBetOn ? fighterBetOn.name : 'бойца'}</span>!`);
             if (bettingModalEl) bettingModalEl.style.display = 'none';
             isBettingPaused = false;
             proceedToRoundStart();
          });
     } else { console.error("initGame: confirmBetButtonEl not found!"); }

      if (skipBetButtonEl) {
         skipBetButtonEl.addEventListener('click', () => {
             console.log("skipBetButtonEl clicked.");
             if (isGameOver) return; // Используется isGameOver
             if (bettingModalEl) bettingModalEl.style.display = 'none';
             isBettingPaused = false;
             proceedToRoundStart();
          });
     } else { console.error("initGame: skipBetButtonEl not found!"); }

    // --- Слушатель для кнопки покупки земли ---
    if (buyLandButtonEl) {
        buyLandButtonEl.addEventListener('click', () => {
            console.log("buyLandButtonEl clicked.");
            if (playerGold >= WIN_AMOUNT_FOR_LAND && !isGameOver) { // Используется playerGold и isGameOver
                playerGold -= WIN_AMOUNT_FOR_LAND; // Используется playerGold
                updatePlayerGoldDisplay();
                isGameOver = true; // Используется isGameOver
                if (gameLoopInterval) clearInterval(gameLoopInterval);
                if (preRoundTimeoutId) clearTimeout(preRoundTimeoutId);
                roundInProgress = false;
                if (startButtonEl) { startButtonEl.disabled = true; startButtonEl.textContent = "ИГРА ОКОНЧЕНА"; }
                if (restartRoundButtonEl) restartRoundButtonEl.style.display = 'none';
                if (roundInfoOverlayEl) roundInfoOverlayEl.style.display = 'none';
                if (bettingModalEl) bettingModalEl.style.display = 'none';
                if (arenaEl) arenaEl.innerHTML = '<p style="text-align:center; font-size: 3em; color: var(--warning-color); margin-top: 200px;">👑 Вы Бог! 👑</p>';
                if (battleLogEl) battleLogEl.innerHTML = '';
                logMessage(`ПОЗДРАВЛЯЕМ! ВЫ ПОТРАТИЛИ ${WIN_AMOUNT_FOR_LAND.toLocaleString()} 💰, КУПИЛИ ЗЕМЛЮ И СТАЛИ БОГОМ!`, "log-winner");
                if (gameOverOverlayEl) gameOverOverlayEl.style.display = 'flex';
                updateScoreboard();
            } else if (!isGameOver) { // Используется isGameOver
                alert(`Недостаточно золота! Нужно ${WIN_AMOUNT_FOR_LAND.toLocaleString()} 💰.`);
            }
        });
    } else {
        console.error("initGame: buyLandButtonEl not found!");
    }

    // --- Слушатели для управления скроллом лога ---
    if (battleLogEl) {
        battleLogEl.addEventListener('wheel', () => {
            if (!scrollLogDownButtonEl) return;
            setTimeout(() => {
                 if (battleLogEl.scrollTop + battleLogEl.clientHeight < battleLogEl.scrollHeight - 15) {
                    userScrolledLog = true;
                    scrollLogDownButtonEl.style.opacity = '0.8';
                } else {
                     userScrolledLog = false;
                     scrollLogDownButtonEl.style.opacity = '0';
                }
            }, 50);
        });
         battleLogEl.addEventListener('scroll', () => {
             if (!scrollLogDownButtonEl) return;
            if (battleLogEl.scrollTop + battleLogEl.clientHeight < battleLogEl.scrollHeight - 15) {
                 if (!userScrolledLog) {
                     userScrolledLog = true;
                     scrollLogDownButtonEl.style.opacity = '0.8';
                 }
            } else {
                 userScrolledLog = false;
                 scrollLogDownButtonEl.style.opacity = '0';
            }
         });
    } else {
        console.error("initGame: battleLogEl not found!");
    }

    if (scrollLogDownButtonEl) {
        scrollLogDownButtonEl.addEventListener('click', () => {
            if (battleLogEl) {
                battleLogEl.scrollTop = battleLogEl.scrollHeight;
                userScrolledLog = false;
                scrollLogDownButtonEl.style.opacity = '0';
            }
        });
    } else {
        console.error("initGame: scrollLogDownButtonEl not found!");
    }


    // Первоначальная настройка UI
    console.log("initGame: Calling initial UI updates...");
    try {
        updateScoreboard();
        updatePlayerGoldDisplay();
        logMessage("Ожидание начала первой битвы...");
        logMessage("🔮 <span class='log-modifier'>Новинка! Вокруг арены появились орбитальные эффекты! Кликайте на них во время боя!</span>", "log-modifier");
        logMessage("🧠 <span class='log-winner'>Гладиаторы теперь обладают интеллектом и будут становиться умнее с каждым боем!</span>", "log-winner");
        logMessage("🛡️ <span class='log-armor'>На арене теперь может появляться броня!</span>", "log-armor");
    } catch (error) {
        console.error("initGame: Error during initial UI updates:", error);
    }

    console.log("initGame: Initialization finished.");
}

// --- Запуск игры после загрузки DOM ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired.");
    initGame();
});