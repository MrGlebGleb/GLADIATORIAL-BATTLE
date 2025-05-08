// --- STATUS EFFECTS LOGIC ---

function applyStatusEffect(target, effectType, details) {
    if (!target || !target.statusEffects || !STATUS_EFFECT_DEFINITIONS[effectType]) { console.warn(`Cannot apply effect: Invalid target, statusEffects, or definition for ${effectType}`); return; }

    // Проверка на стакивание (по умолчанию не стакается, если не forceReapply)
    if (target.statusEffects[effectType] && !details.forceReapply) {
        // Обновляем длительность, если новая больше
        if (details.duration && target.statusEffects[effectType].duration < details.duration) {
            target.statusEffects[effectType].duration = details.duration;
            if (!details.isReapply) {
                 logMessage(`Длительность эффекта <span class="log-effect">${effectType.replace('_effect','').replace('oe_','')}</span> на ${target.name} обновлена.`, "log-effect");
            }
        }
        return;
    }

    const effectData = { ...STATUS_EFFECT_DEFINITIONS[effectType], ...details };

    // Перед применением нового, если был старый с onRemove, вызываем его
    if (target.statusEffects[effectType] && typeof target.statusEffects[effectType].onRemove === 'function') {
        try { target.statusEffects[effectType].onRemove(target, target.statusEffects[effectType]); }
        catch (error) { console.error(`Error during onRemove for existing effect ${effectType} on ${target.name}:`, error); }
    }

    target.statusEffects[effectType] = effectData;
    if (typeof effectData.onApply === 'function') {
        try { effectData.onApply(target, effectData); }
        catch (error) { console.error(`Error during onApply for effect ${effectType} on ${target.name}:`, error); }
    }

    if (!details.isReapply) {
        logMessage(`${target.name} получает эффект: <span class="log-effect">${effectType.replace('_effect','').replace('oe_','')}</span> (длит: ${effectData.duration ? (effectData.duration * GAME_SPEED / 1000).toFixed(1)+'с' : 'мгновенно'})`, "log-effect");
    }
    updateFighterElement(target);
}

function processStatusEffects(fighter) {
    if (!fighter?.statusEffects) return;
    const effectsToRemove = [];

    for (const effectType in fighter.statusEffects) {
        const effect = fighter.statusEffects[effectType];
        const isOrbitalEffect = effectType.startsWith('oe_');

        if (['lifesteal', 'pull', 'push', 'armor_pierce'].includes(effectType)) continue;

        // Обработка длительности
        if (effect.duration !== undefined && !isNaN(effect.duration)) {
            effect.duration--;
            if (effect.duration <= 0) {
                effectsToRemove.push(effectType);
            }
        } else if (effect.duration === undefined && !effect.hasOwnProperty('dps') && !effect.hasOwnProperty('dpsPercent')) {
            // Флаги без длительности
        }

        // --- Специальная обработка для некоторых эффектов (только для живых) ---
        if (fighter.alive) {
            if ((effectType === 'poison' || effectType === 'burn') && effect.dps > 0) {
                applyDamage(fighter, effect.dps, {name: effectType, id: `status-${effectType}`}, false, `${effectType} effect`);
            }
            else if (effectType === 'oe_health_burn_percent_effect' && effect.dpsPercent > 0) {
                const damage = Math.max(1, Math.round(fighter.maxHealth * effect.dpsPercent));
                applyDamage(fighter, damage, {name: "Едкие Споры", id: "status-oe_health_burn_percent"}, false, "едкие споры", true);
            }
            else if (effectType === 'oe_swift_retreat_effect' && !effect.isActive && !effect.triggeredThisRound && fighter.health < fighter.maxHealth * effect.healthThreshold) {
                effect.isActive = true;
                effect.triggeredThisRound = true;
                effect.originalSpeed = fighter.speed;
                fighter.speed *= effect.speedBonus;
                effect.duration = effect.bonusDurationTicks;
                logMessage(`<span style="color:orangered;">${fighter.name} АКТИВИРУЕТ Прилив Адреналина! Скорость резко увеличена!</span>`, "log-effect");
                if (effect.duration <= 0 && effectsToRemove.indexOf(effectType) === -1) effectsToRemove.push(effectType);
            }
            else if (effectType === 'oe_gravity_well_effect' && effect.radius > 0) {
                currentFighters.forEach(f => {
                    if (f.alive) {
                        const distToWell = getDistance(f, {x: effect.x, y: effect.y});
                        if (distToWell < effect.radius && distToWell > 5) {
                            const dx = effect.x - f.x;
                            const dy = effect.y - f.y;
                            const pullForce = Math.min(5, (fighter.baseSpeed * effect.strength) / (distToWell * 0.1 + 1));
                            const moveX = (dx / distToWell) * pullForce;
                            const moveY = (dy / distToWell) * pullForce;
                            f.x += moveX;
                            f.y += moveY;
                            f.x = Math.max(FIGHTER_WIDTH / 2, Math.min(ARENA_WIDTH - FIGHTER_WIDTH / 2, f.x));
                            f.y = Math.max(FIGHTER_HEIGHT / 2, Math.min(ARENA_HEIGHT - FIGHTER_HEIGHT / 2, f.y));
                            updateFighterElement(f);
                        }
                    }
                });
            }
        }

        if (effect.duration !== undefined && effect.duration <= 0 && effectsToRemove.indexOf(effectType) === -1) {
             effectsToRemove.push(effectType);
        }
    }

    // Удаление эффектов
    effectsToRemove.forEach(effectType => {
        const effectToRemove = fighter.statusEffects[effectType];

        if (effectToRemove && typeof effectToRemove.onRemove === 'function') {
             try { effectToRemove.onRemove(fighter, effectToRemove); }
             catch (error) { console.error(`Error during onRemove for effect ${effectType} on ${fighter.name}:`, error); }
        }
         else if (effectType === 'slow' && fighter.baseSpeed) fighter.speed = fighter.baseSpeed;
         else if (effectType === 'enrage' && effectToRemove?.damageMultiplier && fighter.damageOutputMultiplier) fighter.damageOutputMultiplier /= effectToRemove.damageMultiplier;
         else if (effectType === 'oe_swift_retreat_effect' && effectToRemove?.isActive) {
            fighter.speed = effectToRemove.originalSpeed;
            effectToRemove.isActive = false;
         }

        delete fighter.statusEffects[effectType];
        if (fighter.alive || effectToRemove?.duration >= 0) {
            logMessage(`Эффект <span class="log-effect">${effectType.replace('_effect','').replace('oe_','')}</span> на ${fighter.name} прошел.`, "log-effect");
        }

        const isOrbitalEffect = effectType.startsWith('oe_');
        if (isOrbitalEffect && ORBITAL_EFFECTS_POOL.find(def => def.id === effectType)?.duration > 0) {
             const highlightClass = ORBITAL_EFFECTS_POOL.find(def => def.id === effectType)?.type === 'buff' ? 'orbital-buff-active' : 'orbital-debuff-active';
             removeOrbitalEffectHighlight(fighter, highlightClass);
        }
    });

    if (Object.keys(fighter.statusEffects).length > 0 || effectsToRemove.length > 0) {
        updateFighterElement(fighter);
    }
}


function applyWeaponSpecialEffects(attacker, target, weapon, actualDamageDealt) {
     if (!attacker || !attacker.alive || !target || !target.alive || !weapon || actualDamageDealt <= 0) return;

    const isSilenced = attacker.statusEffects?.oe_silence_effect;
    if (isSilenced) {
        return;
    }

    if (weapon.effects) {
        weapon.effects.forEach(effect => {
            if (Math.random() < (effect.chance || 1.0)) {
                if (effect.type === 'lifesteal' && effect.percent) {
                    const healed = Math.round(actualDamageDealt * effect.percent);
                    if (healed > 0) {
                        attacker.health = Math.min(attacker.maxHealth, attacker.health + healed);
                        logMessage(`${attacker.name} <span class="log-bonus">восстанавливает ${healed} ОЗ</span> (оружие)!`, "log-bonus");
                        updateFighterElement(attacker);
                    }
                }
                else if ((effect.type === 'pull' || effect.type === 'push') && effect.distance) {
                    const distEffect = effect.distance * (effect.type === 'pull' ? -1 : 1);
                    const dx = target.x - attacker.x;
                    const dy = target.y - attacker.y;
                    const currentDist = Math.sqrt(dx*dx + dy*dy);
                    if (currentDist > 0) {
                        let moveX = (dx / currentDist) * distEffect;
                        let moveY = (dy / currentDist) * distEffect;
                        if (effect.type === 'pull' && Math.abs(distEffect) >= currentDist - (FIGHTER_WIDTH / 2) ) {
                            target.x = attacker.x + (dx / currentDist) * (FIGHTER_WIDTH / 2 + 5);
                            target.y = attacker.y + (dy / currentDist) * (FIGHTER_HEIGHT / 2 + 5);
                        } else {
                            target.x += moveX;
                            target.y += moveY;
                        }
                        target.x = Math.max(FIGHTER_WIDTH / 2, Math.min(ARENA_WIDTH - FIGHTER_WIDTH / 2, target.x));
                        target.y = Math.max(FIGHTER_HEIGHT / 2, Math.min(ARENA_HEIGHT - FIGHTER_HEIGHT / 2, target.y));
                        logMessage(`${attacker.name} ${effect.type === 'pull' ? 'притягивает' : 'отталкивает'} ${target.name} (оружие)!`, "log-effect");
                        updateFighterElement(target);
                    }
                }
            }
        });
    }

    // Проверка Ауры Вампиризма (Орбитальный Эффект)
    if (attacker.statusEffects?.oe_lifesteal_aura_effect) {
        const auraEffect = attacker.statusEffects.oe_lifesteal_aura_effect;
        if (auraEffect.lifestealPercent) {
            const healed = Math.round(actualDamageDealt * auraEffect.lifestealPercent);
            if (healed > 0) {
                attacker.health = Math.min(attacker.maxHealth, attacker.health + healed);
                logMessage(`${attacker.name} <span class="log-bonus">восстанавливает ${healed} ОЗ</span> (аура вампиризма)!`, "log-bonus");
                updateFighterElement(attacker);
            }
        }
    }
}