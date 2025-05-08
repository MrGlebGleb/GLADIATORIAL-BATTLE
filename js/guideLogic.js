// --- GUIDE MODAL LOGIC ---

const guideButton = document.getElementById('guide-button');
const guideModal = document.getElementById('guide-modal');
const closeGuideButton = document.getElementById('close-guide-button');
const guideNavigation = document.getElementById('guide-navigation');
const guideWeaponsSubNav = document.getElementById('guide-weapons-subnav');
const guideContent = document.getElementById('guide-content');
const guideBackButton = document.getElementById('guide-back-button');
const guideTitle = document.getElementById('guide-title');

let isGuideOpen = false;
let gameWasPausedByGuide = false; // Флаг, чтобы знать, мы ли поставили игру на паузу

// --- Функции открытия/закрытия ---

function openGuide() {
    if (!guideModal) return;
    guideModal.style.display = 'flex';
    isGuideOpen = true;
    resetGuideView();

    // Пауза игры, если она идет
    if (roundInProgress) {
        if (gameLoopInterval) {
            clearInterval(gameLoopInterval);
            gameLoopInterval = null;
            gameWasPausedByGuide = true; // Ставим флаг, что пауза из-за нас
            console.log("Game paused by guide.");
        }
    }
    // Блокируем кнопки игры на всякий случай
    if (startButtonEl) startButtonEl.disabled = true;
    if (restartRoundButtonEl) restartRoundButtonEl.disabled = true;
}

function closeGuide() {
    if (!guideModal) return;
    guideModal.style.display = 'none';
    isGuideOpen = false;

    // Возобновляем игру, ТОЛЬКО если она была на паузе ИЗ-ЗА руководства
    if (gameWasPausedByGuide) {
        // **Сбрасываем таймер бездействия ПЕРЕД возобновлением цикла!**
        lastDamageTimestamp = Date.now();
        console.log("Stall timer reset after closing guide.");

        if (!isGameOver && roundInProgress && !gameLoopInterval) {
             if (typeof gameTick === 'function') {
                 gameLoopInterval = setInterval(gameTick, GAME_SPEED);
                 console.log("Game resumed by guide.");
             } else {
                 console.error("closeGuide: gameTick is not defined, cannot resume game loop.");
             }
        }
    }
    gameWasPausedByGuide = false; // Сбрасываем флаг

    // Обновляем состояние кнопок в зависимости от текущего статуса игры
    if (!isGameOver) {
        if (roundInProgress) { // Если раунд идет (или только что возобновился)
            if (startButtonEl) startButtonEl.disabled = true;
            if (restartRoundButtonEl) restartRoundButtonEl.disabled = false; // Рестарт доступен во время раунда
        } else { // Если раунд не идет (между раундами или до старта)
             if (startButtonEl && !firstRoundStarted) startButtonEl.disabled = false; // Кнопка старта активна только до первого запуска
             else if (startButtonEl) startButtonEl.disabled = true; // После первого запуска старт блокируется

             if (restartRoundButtonEl && firstRoundStarted) restartRoundButtonEl.disabled = false; // Рестарт доступен после первого запуска
             else if (restartRoundButtonEl) restartRoundButtonEl.disabled = true;
        }
    } else { // Если игра окончена
        if (startButtonEl) startButtonEl.disabled = true;
        if (restartRoundButtonEl) restartRoundButtonEl.disabled = true;
    }
}

// --- Функции навигации ---

function showSection(targetId) {
    const sections = guideContent.querySelectorAll('.guide-section');
    sections.forEach(section => section.classList.remove('active'));
    const targetSection = document.getElementById(targetId);
    if (targetSection) {
        targetSection.classList.add('active');
        guideContent.scrollTop = 0;
    }

    const isWeaponSubSection = targetId.startsWith('guide-weapons-');
    const isWeaponMainSection = targetId === 'guide-weapons';

    guideNavigation.style.display = (isWeaponSubSection || isWeaponMainSection) ? 'none' : 'flex';
    guideWeaponsSubNav.style.display = (isWeaponSubSection || isWeaponMainSection) ? 'flex' : 'none';
    guideBackButton.style.display = (isWeaponSubSection || isWeaponMainSection) ? 'inline-block' : 'none';
    guideTitle.textContent = (isWeaponSubSection || isWeaponMainSection) ? "⚔️ ОРУЖИЕ" : "📖 РУКОВОДСТВО ПО АРЕНЕ ГЛАДИАТОРОВ";

    // Если кликнули на "Оружие", но не на подраздел, скрываем текст "выберите подкатегорию"
     if (isWeaponMainSection) {
          const weaponMainSectionContent = document.getElementById('guide-weapons');
         if (weaponMainSectionContent) weaponMainSectionContent.classList.remove('active');
     }
     // Активируем кнопку в главном меню, если выбран основной раздел
     if (!isWeaponSubSection) {
         const mainButton = guideNavigation.querySelector(`.guide-tab-button[data-target="${targetId}"]`);
         setActiveButton(mainButton, guideNavigation);
         setActiveButton(null, guideWeaponsSubNav); // Сбрасываем подменю
     } else {
         setActiveButton(null, guideNavigation); // Сбрасываем основное меню
     }
}

function showMainMenu() {
    resetGuideView();
    showSection('guide-default-content');
    setActiveButton(null, guideNavigation);
    setActiveButton(null, guideWeaponsSubNav);
}

function resetGuideView() {
    guideNavigation.style.display = 'flex';
    guideWeaponsSubNav.style.display = 'none';
    guideBackButton.style.display = 'none';
    guideTitle.textContent = "📖 РУКОВОДСТВО ПО АРЕНЕ ГЛАДИАТОРОВ";
}

function setActiveButton(buttonToActivate, parentNav) {
     if (!parentNav) return;
    const buttons = parentNav.querySelectorAll('.guide-tab-button');
    buttons.forEach(btn => btn.classList.remove('active'));
    if (buttonToActivate) {
        buttonToActivate.classList.add('active');
    }
}

// --- Слушатели событий ---

if (guideButton) {
    guideButton.addEventListener('click', openGuide);
}
if (closeGuideButton) {
    closeGuideButton.addEventListener('click', closeGuide);
}
if (guideModal) {
    guideModal.addEventListener('click', (event) => {
        if (event.target === guideModal) {
            closeGuide();
        }
    });
}
if (guideNavigation) {
    guideNavigation.addEventListener('click', (event) => {
        if (event.target.classList.contains('guide-tab-button')) {
            const targetId = event.target.dataset.target;
            if (targetId) {
                 // Не нужно вызывать setActiveButton здесь, showSection это сделает
                 showSection(targetId);
            }
        }
    });
}
if (guideWeaponsSubNav) {
     guideWeaponsSubNav.addEventListener('click', (event) => {
        if (event.target.classList.contains('guide-tab-button')) {
            const targetId = event.target.dataset.target;
            if (targetId) {
                 setActiveButton(event.target, guideWeaponsSubNav); // Активируем кнопку подменю
                 showSection(targetId);
            }
        }
    });
}
if (guideBackButton) {
    guideBackButton.addEventListener('click', () => {
        showMainMenu();
    });
}
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isGuideOpen) {
        closeGuide();
    }
});