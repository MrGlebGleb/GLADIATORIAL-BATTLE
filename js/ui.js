// --- UI FUNCTIONS ---

function logMessage(message, className = "") {
    if (!battleLogEl) return; const p = document.createElement('p'); p.innerHTML = message; if (className) p.classList.add(className); battleLogEl.appendChild(p);
    if (!userScrolledLog) { battleLogEl.scrollTop = battleLogEl.scrollHeight; } else if (scrollLogDownButtonEl) { scrollLogDownButtonEl.style.opacity = (battleLogEl.scrollTop + battleLogEl.clientHeight < battleLogEl.scrollHeight - 20) ? '0.8' : '0'; }
}
function updatePlayerGoldDisplay() { if (playerGoldDisplayEl) playerGoldDisplayEl.innerHTML = `Золото: ${playerGold.toLocaleString()} 💰`; if (bettingModalGoldEl) bettingModalGoldEl.textContent = playerGold.toLocaleString(); if (buyLandButtonEl) { const canAfford = playerGold !== undefined && playerGold !== null && playerGold >= WIN_AMOUNT_FOR_LAND; buyLandButtonEl.disabled = !canAfford || isGameOver; buyLandButtonEl.classList.toggle('disabled', !canAfford || isGameOver); } }
function updateScoreboard() { if (!scoreboardListEl) { console.error("updateScoreboard: scoreboardListEl is missing!"); return; } if (!fightersInitialData || !Array.isArray(fightersInitialData)) { console.error("updateScoreboard: fightersInitialData is invalid!"); return; } scoreboardListEl.innerHTML = ''; try { const sortedFighters = [...fightersInitialData].sort((a, b) => (b.wins || 0) - (a.wins || 0)); sortedFighters.forEach((fighterData, index) => { if (!fighterData || typeof fighterData !== 'object') { console.warn(`updateScoreboard: Invalid fighter data at index ${index}`, fighterData); return; } const li = document.createElement('li'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.classList.add('fighter-checkbox'); checkbox.checked = !!fighterData.participating; checkbox.dataset.fighterId = fighterData.id; checkbox.disabled = isGameOver || roundInProgress; checkbox.addEventListener('change', (event) => { const fId = event.target.dataset.fighterId; const fData = fightersInitialData.find(f => f.id === fId); if (fData) { fData.participating = event.target.checked; updateScoreboard(); } else { console.warn("Checkbox change: Fighter data not found for ID:", fId); } }); const nameSpan = document.createElement('span'); nameSpan.textContent = fighterData.name || "Безымянный"; nameSpan.style.marginRight = 'auto'; const intellectSpan = document.createElement('span'); intellectSpan.classList.add('fighter-intellect'); if (fighterData.combatStats?.intellect) { const { tactical = 1, defense = 1, resource = 1, spatial = 1 } = fighterData.combatStats.intellect; if (tactical > 1) intellectSpan.innerHTML += `<span class="int-tactical">${INTELLECT_SYMBOLS.tactical}${tactical}</span>`; if (defense > 1) intellectSpan.innerHTML += `<span class="int-defense">${INTELLECT_SYMBOLS.defense}${defense}</span>`; if (resource > 1) intellectSpan.innerHTML += `<span class="int-resource">${INTELLECT_SYMBOLS.resource}${resource}</span>`; if (spatial > 1) intellectSpan.innerHTML += `<span class="int-spatial">${INTELLECT_SYMBOLS.spatial}${spatial}</span>`; } const winsSpan = document.createElement('span'); winsSpan.classList.add('wins'); winsSpan.textContent = '🏆'.repeat(fighterData.wins || 0); li.appendChild(checkbox); li.appendChild(nameSpan); li.appendChild(intellectSpan); li.appendChild(winsSpan); scoreboardListEl.appendChild(li); }); } catch (error) { console.error("updateScoreboard: Error during processing fighters:", error); } }
function createFighterElement(fighter) { const el = document.createElement('div'); el.classList.add('fighter-on-arena', 'breathing'); el.id = fighter.id; el.style.left = `${fighter.x - FIGHTER_WIDTH / 2}px`; el.style.top = `${fighter.y - FIGHTER_HEIGHT / 2}px`; const healthBarContainer = document.createElement('div'); healthBarContainer.classList.add('health-bar-container'); const healthBar = document.createElement('div'); healthBar.classList.add('health-bar'); healthBarContainer.appendChild(healthBar); const armorBarContainer = document.createElement('div'); armorBarContainer.classList.add('armor-bar-container'); const armorBar = document.createElement('div'); armorBar.classList.add('armor-bar'); armorBarContainer.appendChild(armorBar); const img = document.createElement('img'); img.src = fighter.image; img.alt = fighter.name; img.onerror = () => { img.src = 'images/default.png'; }; const nameDisplay = document.createElement('span'); nameDisplay.classList.add('fighter-name-display'); nameDisplay.textContent = fighter.name; const weaponEmoji = document.createElement('span'); weaponEmoji.classList.add('weapon-emoji'); weaponEmoji.textContent = fighter.weapon?.emoji || '?'; const intActionHint = document.createElement('div'); intActionHint.classList.add('int-action-hint'); intActionHint.textContent = "..."; el.appendChild(healthBarContainer); el.appendChild(armorBarContainer); el.appendChild(img); el.appendChild(nameDisplay); el.appendChild(weaponEmoji); el.appendChild(intActionHint); if (arenaEl) { arenaEl.appendChild(el); } fighter.element = el; updateFighterIntellectVisuals(fighter); updateFighterElement(fighter); /* Изначальное обновление вида */}
function updateFighterIntellectVisuals(fighter) { if (!fighter?.element) return; const imgEl = fighter.element.querySelector('img'); if (!imgEl) return; const totalInt = getTotalIntellect(fighter); const hasSpecialFrame = fighter.element.classList.contains('orbital-buff-active') || fighter.element.classList.contains('orbital-debuff-active'); imgEl.classList.toggle('has-intellect', totalInt > 4 && !fighter.hasArmor && !hasSpecialFrame); imgEl.classList.toggle('int-level-high', totalInt >= 8 && !fighter.hasArmor && !hasSpecialFrame); }
function updateFighterElement(fighter) {
    if (!fighter?.element) return; // Проверка наличия элемента

    // Обновляем позицию, если боец жив
    if (fighter.alive) {
        fighter.element.style.left = `${fighter.x - FIGHTER_WIDTH / 2}px`;
        fighter.element.style.top = `${fighter.y - FIGHTER_HEIGHT / 2}px`;
    }

    // Обновляем полоску здоровья
    const healthBar = fighter.element.querySelector('.health-bar');
    if (healthBar) {
        const healthPercent = Math.max(0, Math.min(100, ((fighter.health || 0) / (fighter.maxHealth || BASE_HEALTH)) * 100));
        healthBar.style.width = `${healthPercent}%`;

        // --- Логика цвета полоски здоровья ---
        let healthGradient = `linear-gradient(to bottom, var(--bonus-health-color), var(--bonus-health-dark-color))`; // Зеленый по умолчанию
        if (healthPercent < 30) {
            healthGradient = `linear-gradient(to bottom, var(--danger-color), var(--danger-dark-color))`; // Красный
        } else if (healthPercent < 60) {
            healthGradient = `linear-gradient(to bottom, var(--warning-color), var(--warning-dark-color))`; // Желтый
        }
        healthBar.style.backgroundImage = healthGradient;
        // --- Конец логики цвета ---

        // Проверка на яд/горение (переопределяет цвет)
        healthBar.classList.toggle('poisoned', !!fighter.statusEffects?.poison || !!fighter.statusEffects?.burn);
    }

    // Обновляем броню
    fighter.element.classList.toggle('has-armor', fighter.hasArmor);
    const armorBar = fighter.element.querySelector('.armor-bar');
    if (armorBar) {
        if (fighter.hasArmor && fighter.maxArmorHits > 0) {
            const armorPercent = Math.max(0, Math.min(100, ((fighter.armorHits || 0) / fighter.maxArmorHits) * 100));
            armorBar.style.width = `${armorPercent}%`;
        } else {
            armorBar.style.width = `0%`; // Сбрасываем ширину, если брони нет
        }
    }

    // Обновляем классы статусов
    fighter.element.classList.toggle('is-stunned', !!fighter.statusEffects?.stun);
    fighter.element.classList.toggle('is-rooted', !!fighter.statusEffects?.root);
    fighter.element.classList.toggle('is-slowed', !!fighter.statusEffects?.slow);
    fighter.element.classList.toggle('enraged', !!fighter.statusEffects?.enrage);

    // Обновляем рамку интеллекта/статусов
    updateFighterIntellectVisuals(fighter);

    // Обновляем подсказку действия
    const hintEl = fighter.element.querySelector('.int-action-hint');
    if (hintEl) {
        if (fighter.alive && intelliActionLog && intelliActionLog[fighter.id]?.message) {
            const logEntry = intelliActionLog[fighter.id];
            hintEl.textContent = `${INTELLECT_SYMBOLS[logEntry.type] || '?'} ${logEntry.message}`;
            // Устанавливаем цвет текста подсказки в соответствии с типом интеллекта
            hintEl.style.color = `var(--${logEntry.type}-int-color, white)`; // Fallback на белый
        } else {
            hintEl.textContent = ""; // Очищаем, если нет действия или боец мертв
            hintEl.style.color = "white";
        }
    }

    // Обновляем иконку оружия, если она изменилась
    const weaponEmojiEl = fighter.element.querySelector('.weapon-emoji');
    if (weaponEmojiEl && fighter.weapon && weaponEmojiEl.textContent !== fighter.weapon.emoji) {
        weaponEmojiEl.textContent = fighter.weapon.emoji;
    }

    // Убираем анимацию дыхания, если боец не жив
     if (!fighter.alive) {
        fighter.element.classList.remove('breathing');
     } else if (!fighter.element.classList.contains('breathing')) {
         fighter.element.classList.add('breathing'); // Добавляем обратно, если ожил (маловероятно, но вдруг)
     }
}
function removeFighterElement(fighter) { if (fighter?.element?.parentElement) { fighter.element.remove(); } }
function showDamageFlash(target, isCrit, isBlocked) { if (target?.element) { const flash = document.createElement('div'); flash.classList.add('damage-flash'); if (isBlocked) flash.classList.add('blocked'); else flash.classList.add(isCrit ? 'critical' : 'normal'); const imgEl = target.element.querySelector('img'); if (imgEl?.parentNode) { imgEl.parentNode.insertBefore(flash, imgEl.nextSibling); setTimeout(() => { if (flash.parentElement) flash.remove() }, 200); } } }
function showHitSpark(target, isCrit, isBlocked) { if (!arenaEl) return; const spark = document.createElement('div'); spark.classList.add('hit-spark'); if (isBlocked) spark.classList.add('blocked'); else if (isCrit) spark.classList.add('critical'); spark.style.left = `${(target?.x || 0) + getRandomInt(-10, 10)}px`; spark.style.top = `${(target?.y || 0) - FIGHTER_HEIGHT / 2 + getRandomInt(-5, 5)}px`; arenaEl.appendChild(spark); setTimeout(() => { if (spark.parentElement) spark.remove(); }, isCrit ? 180 : (isBlocked ? 200 : 150)); }
function createProjectileElement(attacker, weapon) { if (!attacker || !weapon || !arenaEl) return null; const projectileEl = document.createElement('div'); projectileEl.classList.add('projectile'); projectileEl.textContent = weapon.projectile || '?'; projectileEl.style.left = `${attacker.x - 12}px`; projectileEl.style.top = `${attacker.y - 12 - (FIGHTER_HEIGHT/4)}px`; arenaEl.appendChild(projectileEl); return projectileEl; }
function createAoeIndicator(x, y, radius) { if (!arenaEl || typeof x !== 'number' || typeof y !== 'number' || typeof radius !== 'number' || radius <= 0) return; const indicator = document.createElement('div'); indicator.classList.add('aoe-indicator'); indicator.style.width = `${radius * 2}px`; indicator.style.height = `${radius * 2}px`; indicator.style.left = `${x - radius}px`; indicator.style.top = `${y - radius}px`; arenaEl.appendChild(indicator); setTimeout(() => { if (indicator.parentElement) indicator.remove(); }, 250); }
function showPickupAura(fighter, bonusType) { if (!fighter?.element) return; const aura = document.createElement('div'); aura.classList.add('pickup-aura'); if (bonusType === 'health_pack') aura.classList.add('health'); else if (bonusType === 'elite_weapon') aura.classList.add('weapon'); else if (bonusType.includes('armor')) aura.classList.add('armor'); fighter.element.appendChild(aura); setTimeout(() => { if (aura.parentElement) aura.remove() }, 500); }
function showIntellectLevelUpSparkle(fighter) { if (!arenaEl || !fighter?.element) return; for (let i = 0; i < 5; i++) { const sparkle = document.createElement('div'); sparkle.classList.add('intellect-levelup-sparkle'); sparkle.style.left = `${fighter.x + getRandomInt(-15, 15) - 4}px`; sparkle.style.top = `${fighter.y - FIGHTER_HEIGHT / 2 + getRandomInt(-10, 0) - 4}px`; sparkle.style.animationDelay = `${i * 0.05}s`; arenaEl.appendChild(sparkle); setTimeout(() => { if (sparkle.parentElement) sparkle.remove() }, 600); } }
function logIntellectAction(fighter, intellectType, message) { if (!fighter || !intellectType || !message) return; intelliActionLog[fighter.id] = { type: intellectType, message: message }; if(fighter.element) { fighter.element.classList.add('intellect-action'); setTimeout(() => { if(fighter.element) fighter.element.classList.remove('intellect-action'); }, 600); } }

// --- ФУНКЦИИ ДЛЯ ОРБИТАЛЬНЫХ ЭФФЕКТОВ ---

function createOrbitalEffectElement(effectInstance) {
    if (!orbitalEffectsContainerEl || !effectInstance?.definition) return null;
    const el = document.createElement('div');
    el.classList.add('orbital-effect');
    el.dataset.id = effectInstance.id;
    const effectColor = effectInstance.definition.color || 'purple';
    el.style.backgroundImage = `radial-gradient(circle at 65% 35%, white 1px, ${effectColor} 4%, black 100%)`;

    const iconSpan = document.createElement('span');
    iconSpan.classList.add('orbital-effect-icon');
    iconSpan.textContent = effectInstance.definition.icon || '?';
    el.appendChild(iconSpan);

    const tooltip = document.createElement('span');
    tooltip.classList.add('tooltip');
    tooltip.textContent = `${effectInstance.definition.name || 'Эффект'}: ${effectInstance.definition.description || 'Нет описания'}`;
    el.appendChild(tooltip);

    el.addEventListener('click', handleOrbitalEffectClick);
    orbitalEffectsContainerEl.appendChild(el);
    return el;
}

function addOrbitalEffectHighlight(fighter, effectType, durationMs) {
    if (!fighter?.element) return;
    const buffClass = 'orbital-buff-active';
    const debuffClass = 'orbital-debuff-active';
    const targetClass = effectType === 'buff' ? buffClass : debuffClass;
    const otherClass = effectType === 'buff' ? debuffClass : buffClass;

    if (fighter.element.classList.contains(otherClass)) {
        removeOrbitalEffectHighlight(fighter, otherClass);
    }
    if (!fighter.orbitalHighlightTimeouts) {
        fighter.orbitalHighlightTimeouts = {};
    }
    if (fighter.orbitalHighlightTimeouts[targetClass]) {
        clearTimeout(fighter.orbitalHighlightTimeouts[targetClass]);
    }

    if (durationMs > 0) {
        fighter.element.classList.add(targetClass);
        fighter.orbitalHighlightTimeouts[targetClass] = setTimeout(() => {
            removeOrbitalEffectHighlight(fighter, targetClass);
        }, durationMs);
    } else {
         fighter.element.classList.add(targetClass);
         setTimeout(()=> removeOrbitalEffectHighlight(fighter, targetClass), 150);
    }
    updateFighterIntellectVisuals(fighter);
}

function removeOrbitalEffectHighlight(fighter, className) {
     if (!fighter?.element) return;
     fighter.element.classList.remove(className);
     updateFighterIntellectVisuals(fighter); // Обновляем вид после снятия подсветки
     if (fighter.orbitalHighlightTimeouts?.[className]) {
        clearTimeout(fighter.orbitalHighlightTimeouts[className]); // Убедимся, что таймаут очищен
        delete fighter.orbitalHighlightTimeouts[className];
     }
}