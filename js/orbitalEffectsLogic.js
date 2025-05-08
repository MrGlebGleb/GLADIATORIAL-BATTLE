// --- ORBITAL EFFECTS LOGIC ---

function clearOrbitalEffects() {
    activeOrbitalEffects.forEach(effect => {
        if (effect.element?.parentElement) {
            effect.element.remove();
        }
        if (effect.projectileAnimationId) {
            cancelAnimationFrame(effect.projectileAnimationId);
        }
    });
    activeOrbitalEffects = [];
    console.log("Orbital effects cleared.");
}

function spawnInitialOrbitalEffects() {
    clearOrbitalEffects();
    if (!orbitalEffectsContainerEl) return;

    const numberOfEffects = Math.min(MAX_ORBITAL_EFFECTS_PER_ROUND, ORBITAL_EFFECTS_POOL.length);
    const availableEffects = [...ORBITAL_EFFECTS_POOL];
    const perimeter = 2 * ARENA_WIDTH + 2 * ARENA_HEIGHT; // Периметр арены
    const spacing = numberOfEffects > 0 ? perimeter / numberOfEffects : 0; // Расстояние между эффектами

    for (let i = 0; i < numberOfEffects; i++) {
        let chosenDefinition = null;
        let attempts = 0;

        while (!chosenDefinition && attempts < availableEffects.length * 3 && availableEffects.length > 0) {
             const randomIndex = getRandomInt(0, availableEffects.length - 1);
             const potentialEffect = availableEffects[randomIndex];
             const spawnChance = potentialEffect.spawnChanceMultiplier !== undefined ? potentialEffect.spawnChanceMultiplier : 1.0;

             if (Math.random() < spawnChance) {
                 chosenDefinition = potentialEffect;
                 availableEffects.splice(randomIndex, 1);
             }
             attempts++;
        }

        if (!chosenDefinition && availableEffects.length > 0) {
             const randomIndex = getRandomInt(0, availableEffects.length - 1);
             chosenDefinition = availableEffects[randomIndex];
             availableEffects.splice(randomIndex, 1);
        }

        if (!chosenDefinition) continue;

        const effectInstance = {
            id: `orb-effect-${Date.now()}-${i}`,
            definition: chosenDefinition,
            element: null,
            distanceAlongPerimeter: spacing * i, // Начальная позиция по периметру
            onCooldownUntil: 0,
            projectileAnimationId: null,
        };

        effectInstance.element = createOrbitalEffectElement(effectInstance);
        if(effectInstance.element) {
            activeOrbitalEffects.push(effectInstance);
        }
    }
    updateOrbitalEffectsPosition(); // Первичное размещение
    console.log(`Spawned ${activeOrbitalEffects.length} orbital effects.`);
}


function updateOrbitalEffectsPosition() {
    // Контейнер эффектов - это orbitalEffectsContainerEl, он же arena-wrapper по размерам
    // Арена находится внутри него и отцентрована
    if (!orbitalEffectsContainerEl || !arenaEl || activeOrbitalEffects.length === 0) return;

    const perimeter = 2 * ARENA_WIDTH + 2 * ARENA_HEIGHT;
    // Скорость движения по периметру. ORBITAL_EFFECT_SPEED уже утроена в constants.js
    // Подберем множитель для комфортной скорости. Чем больше, тем быстрее.
    const speedMultiplier = ORBITAL_EFFECT_SPEED * 900; // Попробуй это значение

    // Рассчитываем смещение самой арены внутри её обертки (и контейнера эффектов)
    const arenaOffsetX = (orbitalEffectsContainerEl.offsetWidth - ARENA_WIDTH) / 2;
    const arenaOffsetY = (orbitalEffectsContainerEl.offsetHeight - ARENA_HEIGHT) / 2;

    activeOrbitalEffects.forEach(effect => {
        if (!effect.element) return;

        // Обновляем позицию вдоль периметра
        effect.distanceAlongPerimeter = (effect.distanceAlongPerimeter + speedMultiplier) % perimeter;
        let currentDistance = effect.distanceAlongPerimeter;

        let xOnArenaEdge, yOnArenaEdge; // Координаты на краю самой АРЕНЫ (0,0 -> W,H)

        // Рассчитываем позицию на периметре арены (движение по часовой стрелке)
        // 1. Верхняя сторона (слева направо)
        if (currentDistance < ARENA_WIDTH) {
            xOnArenaEdge = currentDistance;
            yOnArenaEdge = 0;
        }
        // 2. Правая сторона (сверху вниз)
        else if (currentDistance < ARENA_WIDTH + ARENA_HEIGHT) {
            xOnArenaEdge = ARENA_WIDTH;
            yOnArenaEdge = currentDistance - ARENA_WIDTH;
        }
        // 3. Нижняя сторона (справа налево)
        else if (currentDistance < ARENA_WIDTH * 2 + ARENA_HEIGHT) {
            xOnArenaEdge = ARENA_WIDTH - (currentDistance - (ARENA_WIDTH + ARENA_HEIGHT));
            yOnArenaEdge = ARENA_HEIGHT;
        }
        // 4. Левая сторона (снизу вверх)
        else {
            xOnArenaEdge = 0;
            yOnArenaEdge = ARENA_HEIGHT - (currentDistance - (ARENA_WIDTH * 2 + ARENA_HEIGHT));
             // Или так: yOnArenaEdge = perimeter - currentDistance;
        }

        // Переводим координаты с края арены в координаты относительно orbitalEffectsContainerEl
        // И центрируем сам элемент эффекта
        const effectSize = effect.element.offsetWidth || ORBITAL_EFFECT_SIZE;
        const finalX = arenaOffsetX + xOnArenaEdge - (effectSize / 2);
        const finalY = arenaOffsetY + yOnArenaEdge - (effectSize / 2);

        // Применяем позицию
        effect.element.style.left = `${finalX}px`;
        effect.element.style.top = `${finalY}px`;

        // Обновление класса кулдауна
        if (effect.onCooldownUntil && effect.onCooldownUntil > Date.now()) {
            if (!effect.element.classList.contains('on-cooldown')) {
                effect.element.classList.add('on-cooldown');
            }
        } else if (effect.element.classList.contains('on-cooldown')) {
            effect.element.classList.remove('on-cooldown');
            effect.onCooldownUntil = 0;
        }
    });
}


function handleOrbitalEffectClick(event) {
    if (!roundInProgress || isGameOver) return;
    const effectElement = event.currentTarget;
    const effectId = effectElement.dataset.id;
    const effectInstance = activeOrbitalEffects.find(oe => oe.id === effectId);

    if (!effectInstance || (effectInstance.onCooldownUntil && effectInstance.onCooldownUntil > Date.now())) {
         if (effectInstance && effectInstance.element) {
             effectInstance.element.style.transition = 'transform 0.1s ease-in-out';
             effectInstance.element.style.transform = 'scale(0.95)';
             setTimeout(() => { if(effectInstance.element) effectInstance.element.style.transform = 'scale(1)'; }, 100);
         }
        return;
    }

    const definition = effectInstance.definition;

    if (definition.isPlayerEffect) {
        if(typeof definition.action === 'function'){
            definition.action();
            startOrbitalEffectCooldown(effectInstance);
        } else {
            console.error("Player effect action is not a function:", definition);
        }
        return;
    }

    let nearestFighter = null; let minDistance = Infinity;
    const effectRect = effectElement.getBoundingClientRect();
    const effectCenterX_viewport = effectRect.left + effectRect.width / 2;
    const effectCenterY_viewport = effectRect.top + effectRect.height / 2;

    currentFighters.filter(f => f.alive && f.element).forEach(fighter => {
        const fighterRect = fighter.element.getBoundingClientRect();
        const fighterCenterX_viewport = fighterRect.left + fighterRect.width / 2;
        const fighterCenterY_viewport = fighterRect.top + fighterRect.height / 2;
        const distance = getDistance(
            {x: effectCenterX_viewport, y: effectCenterY_viewport},
            {x: fighterCenterX_viewport, y: fighterCenterY_viewport}
        );
        if (distance < minDistance) {
            minDistance = distance;
            nearestFighter = fighter;
        }
    });

    if (nearestFighter) {
        console.log(`Orbital effect ${definition.name} triggered on ${nearestFighter.name}`);
        animateEffectProjectile(effectInstance, nearestFighter);
        startOrbitalEffectCooldown(effectInstance);
    } else {
        console.log("No alive fighters found for orbital effect target.");
        if(effectInstance.element) {
            effectInstance.element.style.transition = 'transform 0.1s ease-in-out, opacity 0.1s ease-in-out';
            effectInstance.element.style.transform = 'scale(0.8)';
            effectInstance.element.style.opacity = '0.5';
            setTimeout(() => {
                if(effectInstance.element) {
                    effectInstance.element.style.transform = 'scale(1)';
                    effectInstance.element.style.opacity = '1';
                }
            }, 150);
        }
        startOrbitalEffectCooldown(effectInstance);
    }
}

function startOrbitalEffectCooldown(effectInstance) {
    if (!effectInstance?.definition) return;
    const cooldownMs = effectInstance.definition.cooldown;
    if (cooldownMs && cooldownMs > 0) {
        effectInstance.onCooldownUntil = Date.now() + cooldownMs;
        if (effectInstance.element) { effectInstance.element.classList.add('on-cooldown'); }
        console.log(`Effect ${effectInstance.definition.name} put on cooldown for ${cooldownMs}ms`);
    }
}

function animateEffectProjectile(effectInstance, targetFighter) {
    if (!orbitalEffectsContainerEl || !effectInstance?.element || !targetFighter?.element || !arenaEl) return;

    if (effectInstance.projectileAnimationId) {
        cancelAnimationFrame(effectInstance.projectileAnimationId);
        const oldProjectile = orbitalEffectsContainerEl.querySelector(`.effect-projectile[data-source-id="${effectInstance.id}"]`);
        if (oldProjectile) oldProjectile.remove();
    }

    const projectile = document.createElement('div');
    projectile.classList.add('effect-projectile');
    projectile.dataset.sourceId = effectInstance.id;
    const effectColor = effectInstance.definition.color || 'yellow';
    projectile.style.background = `radial-gradient(circle, white 20%, ${effectColor} 80%)`;
    projectile.style.boxShadow = `0 0 10px 4px ${effectColor}`;
    projectile.style.width = '18px';
    projectile.style.height = '18px';

    const projectileSize = 18;
    const startX = parseFloat(effectInstance.element.style.left || '0') + (effectInstance.element.offsetWidth / 2 || ORBITAL_EFFECT_SIZE / 2);
    const startY = parseFloat(effectInstance.element.style.top || '0') + (effectInstance.element.offsetHeight / 2 || ORBITAL_EFFECT_SIZE / 2);
    projectile.style.left = `${startX - projectileSize / 2}px`;
    projectile.style.top = `${startY - projectileSize / 2}px`;

    orbitalEffectsContainerEl.appendChild(projectile);

    let animationStartTime = null;
    function tickAnimation(timestamp) {
        if (animationStartTime === null) animationStartTime = timestamp;

        if (!roundInProgress || !targetFighter.alive || !targetFighter.element || !projectile.parentElement) {
            if (projectile.parentElement) projectile.remove();
            effectInstance.projectileAnimationId = null;
            return;
        }

        const currentX = parseFloat(projectile.style.left || '0') + projectileSize / 2;
        const currentY = parseFloat(projectile.style.top || '0') + projectileSize / 2;

        const containerRect = orbitalEffectsContainerEl.getBoundingClientRect();
        const arenaRect = arenaEl.getBoundingClientRect();
        const targetX_arena = targetFighter.x;
        const targetY_arena = targetFighter.y - FIGHTER_HEIGHT / 4; // Целимся выше центра
        const targetX_viewport = arenaRect.left + targetX_arena;
        const targetY_viewport = arenaRect.top + targetY_arena;
        const targetX_container = targetX_viewport - containerRect.left;
        const targetY_container = targetY_viewport - containerRect.top;

        const dx = targetX_container - currentX;
        const dy = targetY_container - currentY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ORBITAL_EFFECT_PROJECTILE_SPEED) {
            projectile.remove();
            effectInstance.projectileAnimationId = null;
            if (typeof effectInstance.definition.action === 'function') {
                effectInstance.definition.action(targetFighter);
            } else {
                console.error("Effect action is not a function:", effectInstance.definition);
            }
            const effectDurationMs = effectInstance.definition.duration || 0;
            addOrbitalEffectHighlight(targetFighter, effectInstance.definition.type, effectDurationMs);
        } else {
            const moveX = (dx / dist) * ORBITAL_EFFECT_PROJECTILE_SPEED;
            const moveY = (dy / dist) * ORBITAL_EFFECT_PROJECTILE_SPEED;
            const nextX = currentX + moveX;
            const nextY = currentY + moveY;
            projectile.style.left = `${nextX - projectileSize / 2}px`;
            projectile.style.top = `${nextY - projectileSize / 2}px`;
            effectInstance.projectileAnimationId = requestAnimationFrame(tickAnimation);
        }
    }
    effectInstance.projectileAnimationId = requestAnimationFrame(tickAnimation);
}