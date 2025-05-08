// --- DOM ELEMENTS ---
const startButtonEl = document.getElementById('start-button');
const restartRoundButtonEl = document.getElementById('restart-round-button');
const playerGoldDisplayEl = document.getElementById('player-gold-display');
const roundInfoOverlayEl = document.getElementById('round-info-overlay');
const weaponInfoListEl = document.getElementById('weapon-info-list');
const placeBetButtonEl = document.getElementById('place-bet-button');
const bettingModalEl = document.getElementById('betting-modal');
const bettingModalGoldEl = document.getElementById('betting-modal-gold');
const betFighterSelectEl = document.getElementById('bet-fighter-select');
const betAmountInputEl = document.getElementById('bet-amount-input');
const confirmBetButtonEl = document.getElementById('confirm-bet-button');
const skipBetButtonEl = document.getElementById('skip-bet-button');
const betErrorMessageEl = document.getElementById('bet-error-message');
const gameOverOverlayEl = document.getElementById('game-over-overlay');
const scoreboardListEl = document.getElementById('scoreboard-list');
const buyLandButtonEl = document.getElementById('buy-land-button');
const arenaEl = document.getElementById('arena');
const battleLogEl = document.getElementById('battle-log');
const h1TitleEl = document.querySelector('h1');

// --- ORBITAL EFFECTS DOM ---
const orbitalEffectsContainerEl = document.getElementById('orbital-effects-container');
const scrollLogDownButtonEl = document.getElementById('scroll-log-down-button');