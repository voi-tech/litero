// src/ui.js — renderowanie DOM i reakcje na emitter

import { emitter } from './eventEmitter.js';
import { gameState, handleLetterGuess, handleOneshot, startRound, addFigure, nextRound, openScriptorium } from './game.js';
import { showScreen } from './main.js';
import { FIGURES, getRandomFigures } from './figures.js';

// ---- Cache referencji DOM ----------------------------------

const els = {};

function $(id) {
  if (!els[id]) els[id] = document.getElementById(id);
  return els[id];
}

// ---- Inicjalizacja UI --------------------------------------

export function initUI() {
  setupKeyboard();
  setupEmitterHandlers();
}

// ---- Klawiatura ekranowa -----------------------------------

function setupKeyboard() {
  document.querySelectorAll('.keyboard-key').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const letter = e.currentTarget.dataset.letter;
      if (letter) handleLetterGuess(letter);
    });
  });

  // Klawiatura fizyczna
  document.addEventListener('keydown', (e) => {
    if (gameState.phase !== 'guessing') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key;
    if (key.length === 1) {
      const letter = key.toUpperCase();
      if (/^[A-ZĄĆĘŁŃÓŚŹŻ]$/.test(letter)) {
        e.preventDefault();
        handleLetterGuess(letter);
      }
    }
  });
}

// ---- Obsługa eventów gry -----------------------------------

function setupEmitterHandlers() {
  emitter.on('roundStarted', ({ state }) => {
    renderGameScreen(state);
  });

  emitter.on('definitionLoaded', ({ definition }) => {
    const defEl = $('definition-text');
    if (defEl) {
      defEl.textContent = definition;
    }
  });

  emitter.on('letterHit', ({ letter, positions, multiplier, combo, ink }) => {
    positions.forEach(i => animateCellHit(i));
    markKeyUsed(letter, 'hit');
    updateMultiplierDisplay(multiplier);
    updateComboDisplay(combo);
    updateInkDisplay(ink);
    updateScoreDisplay();
  });

  emitter.on('letterMiss', ({ letter, errors, combo }) => {
    markKeyUsed(letter, 'miss');
    updateErrorMarkers(errors);
    updateComboDisplay(combo);
    shakeWordGrid();
  });

  emitter.on('letterMissCancelled', ({ letter }) => {
    // Bezbłędnik pochłonął błąd - subtelna informacja
    markKeyUsed(letter, 'miss');
    shakeWordGrid();
    showToast('Bezbłędnik ochronił cię!');
  });

  emitter.on('timerTick', ({ timeLeft }) => {
    renderTimer(timeLeft, gameState.timeLeft);
    $('timer-value').textContent = timeLeft;

    const wrapper = $('timer-wrapper');
    if (timeLeft <= 10) {
      wrapper.classList.add('timer-wrapper--urgent');
    } else {
      wrapper.classList.remove('timer-wrapper--urgent');
    }
  });

  emitter.on('roundEnded', ({ state, reason, roundScore, inkReward, timeBonus }) => {
    showRoundSummary(state, reason, roundScore, inkReward, timeBonus);
  });

  emitter.on('oneshotActivated', ({ figureId, state }) => {
    renderHandFigures(state.handFigures);
    // Odśwież odsłonięte litery (Synekdocha / Akrostych mogły odsłonić kratki)
    renderWordGrid(state.word, state.revealed);
    updateMultiplierDisplay(state.multiplier);
  });

  emitter.on('figurePick', ({ state }) => {
    renderFigurePickScreen(state);
    showScreen('screen-figure-pick');
  });

  emitter.on('anteChanged', ({ ante, state }) => {
    renderAnteScreen(ante);
    showScreen('screen-ante');
  });

  emitter.on('scriptoriumOpen', ({ state }) => {
    showScreen('screen-scriptorium');
  });

  emitter.on('gameOver', ({ state }) => {
    renderGameOver(state);
    showScreen('screen-game-over');
  });
}

// ---- Renderowanie ekranu gry --------------------------------

function renderGameScreen(state) {
  // Nagłówek
  $('game-round').textContent = `${state.round}/${state.maxRounds}`;
  $('game-score').textContent = state.score.toLocaleString('pl-PL');
  $('game-ink').innerHTML = `${state.ink} <span class="ink-icon">✦</span>`;

  // Mnożnik i combo
  updateMultiplierDisplay(state.multiplier);
  updateComboDisplay(state.combo);

  // Definicja
  const defEl = $('definition-text');
  const catEl = $('def-category');
  const hintEl = $('def-hint');

  if (defEl) defEl.textContent = state.definition || '';
  if (catEl) catEl.textContent = state.category || '';
  if (hintEl) hintEl.textContent = state.hint || '';

  // Siatka słowa
  renderWordGrid(state.word, state.revealed);

  // Błędy
  updateErrorMarkers(state.errors);
  $('errors-label').textContent = `${state.errors}/6 błędów`;

  // Klawiatura — reset
  resetKeyboard();

  // Figury pasywne
  renderActiveFigures(state.activeFigures);

  // Figury w ręce
  renderHandFigures(state.handFigures);

  // Timer
  const circumference = 2 * Math.PI * 18; // r=18
  const ring = $('timer-ring-fg');
  if (ring) {
    ring.setAttribute('stroke-dasharray', circumference.toFixed(1));
    ring.setAttribute('stroke-dashoffset', '0');
  }
  $('timer-value').textContent = state.timeLeft;
  $('timer-wrapper').classList.remove('timer-wrapper--urgent');

  showScreen('screen-game');
}

// ---- Siatka słowa ------------------------------------------

function renderWordGrid(word, revealed) {
  const grid = $('word-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (let i = 0; i < word.length; i++) {
    const cell = document.createElement('div');

    if (word[i] === ' ') {
      cell.className = 'letter-cell letter-cell--space';
    } else {
      cell.className = revealed[i] ? 'letter-cell letter-cell--hit' : 'letter-cell';
      cell.textContent = revealed[i] ? word[i] : '';
      cell.dataset.index = i;
    }

    grid.appendChild(cell);
  }
}

// ---- Animacja trafienia ------------------------------------

function animateCellHit(index) {
  const grid = $('word-grid');
  if (!grid) return;

  const cell = grid.querySelector(`[data-index="${index}"]`);
  if (!cell) return;

  cell.textContent = gameState.word[index];
  cell.classList.add('letter-cell--hit');

  // Uruchom animację bounce
  cell.style.animation = 'none';
  cell.offsetHeight; // reflow
  cell.style.animation = '';
}

// ---- Trzęsenie siatki (pudło) ------------------------------

function shakeWordGrid() {
  const grid = $('word-grid');
  if (!grid) return;
  grid.classList.remove('word-grid--shake');
  grid.offsetHeight; // reflow
  grid.classList.add('word-grid--shake');
  grid.addEventListener('animationend', () => {
    grid.classList.remove('word-grid--shake');
  }, { once: true });
}

// ---- Klawiatura --------------------------------------------

function resetKeyboard() {
  document.querySelectorAll('.keyboard-key').forEach(btn => {
    btn.classList.remove('keyboard-key--hit', 'keyboard-key--miss');
  });
}

function markKeyUsed(letter, result) {
  const btn = document.querySelector(`.keyboard-key[data-letter="${letter}"]`);
  if (!btn) return;
  btn.classList.remove('keyboard-key--hit', 'keyboard-key--miss');
  btn.classList.add(result === 'hit' ? 'keyboard-key--hit' : 'keyboard-key--miss');
}

// ---- Timer -------------------------------------------------

function renderTimer(timeLeft, maxTime) {
  const circumference = 2 * Math.PI * 18;
  const ring = $('timer-ring-fg');
  if (!ring) return;

  const fraction = maxTime > 0 ? timeLeft / maxTime : 0;
  const offset = circumference * (1 - fraction);
  ring.style.strokeDashoffset = offset.toFixed(2);

  // Kolor: zielony > żółty > czerwony
  if (fraction > 0.5) {
    ring.style.stroke = 'var(--accent-light)';
  } else if (fraction > 0.25) {
    ring.style.stroke = 'var(--combo)';
  } else {
    ring.style.stroke = 'var(--miss)';
  }
}

// ---- Aktualizacje na żywo ----------------------------------

function updateMultiplierDisplay(multiplier) {
  const el = $('multiplier-value');
  if (el) el.textContent = multiplier.toFixed(1);
}

function updateComboDisplay(combo) {
  const wrapper = $('combo-display');
  const val = $('combo-value');
  if (!wrapper || !val) return;

  val.textContent = combo;
  if (combo >= 3) {
    wrapper.classList.add('combo-display--active');
  } else {
    wrapper.classList.remove('combo-display--active');
  }
}

function updateInkDisplay(ink) {
  const el = $('game-ink');
  if (el) el.innerHTML = `${ink} <span class="ink-icon">✦</span>`;
}

function updateScoreDisplay() {
  const el = $('game-score');
  if (el) {
    const liveScore = Math.floor(gameState.basePoints * gameState.multiplier);
    el.textContent = (gameState.score - gameState.roundScore + liveScore).toLocaleString('pl-PL');
  }
}

function updateErrorMarkers(errors) {
  const markers = document.querySelectorAll('.error-marker');
  markers.forEach((m, i) => {
    m.classList.toggle('error-marker--active', i < errors);
  });
  const label = $('errors-label');
  if (label) label.textContent = `${errors}/6 błędów`;
}

// ---- Figury pasywne ----------------------------------------

function renderActiveFigures(figureIds) {
  const bar = $('active-figures-bar');
  if (!bar) return;
  bar.innerHTML = '';

  figureIds.forEach(id => {
    const fig = FIGURES[id];
    if (!fig) return;
    const pill = document.createElement('div');
    pill.className = 'figure-pill';
    pill.title = fig.description;
    pill.textContent = `${fig.icon} ${fig.name}`;
    bar.appendChild(pill);
  });
}

// ---- Figury w ręce (jednorazowe) ---------------------------

function renderHandFigures(figureIds) {
  const bar = $('hand-figures-bar');
  if (!bar) return;
  bar.innerHTML = '';

  figureIds.forEach(id => {
    const fig = FIGURES[id];
    if (!fig) return;
    const btn = document.createElement('button');
    btn.className = 'hand-figure-btn';
    btn.title = fig.description;
    btn.textContent = `${fig.icon} ${fig.name}`;
    btn.dataset.figureId = id;
    btn.addEventListener('click', () => handleOneshot(id));
    bar.appendChild(btn);
  });
}

// ---- Podsumowanie rundy ------------------------------------

function showRoundSummary(state, reason, roundScore, inkReward, timeBonus) {
  const card = $('summary-card');
  const icon = $('summary-icon');
  const wordEl = $('summary-word');
  const defEl = $('summary-definition');

  const guessed = reason === 'guessed';

  card.classList.remove('summary-card--win', 'summary-card--loss');
  card.classList.add(guessed ? 'summary-card--win' : 'summary-card--loss');

  if (icon) icon.textContent = guessed ? '✓' : '✗';
  if (wordEl) wordEl.textContent = state.word;
  if (defEl) defEl.textContent = state.definition;

  // Wyniki
  const setVal = (id, val) => { const el = $(id); if (el) el.textContent = val; };

  setVal('summary-base-points', state.basePoints.toLocaleString('pl-PL'));
  setVal('summary-multiplier', `×${state.multiplier.toFixed(1)}`);
  setVal('summary-time-bonus', `+${timeBonus}`);
  setVal('summary-round-score', roundScore.toLocaleString('pl-PL'));
  const inkEl = $('summary-ink');
  if (inkEl) inkEl.innerHTML = `+${inkReward} <span class="ink-icon">✦</span>`;

  // Przycisk dalej
  const btn = $('btn-next-round');
  if (btn) {
    btn.onclick = () => nextRound();
  }

  showScreen('screen-round-summary');
}

// ---- Ekran wyboru figury -----------------------------------

export function renderFigurePickScreen(state) {
  $('figure-round-num').textContent = state.round;
  $('figure-round-max').textContent = state.maxRounds;

  const offer = $('figures-offer');
  if (!offer) return;

  // Pobieramy ofertę z gameState._figureOffer (ustawionej przez main.js / scriptorium.js)
  if (!state._figureOffer || state._figureOffer.length === 0) {
    offer.innerHTML = '<p style="color:var(--text-muted);text-align:center">Ładowanie figur…</p>';
    // Wylosuj synchronicznie (getRandomFigures jest już zaimportowany)
    state._figureOffer = getRandomFigures(3, [], state.ante);
    renderFigurePickScreen(state);
    return;
  }

  offer.innerHTML = '';
  state._figureOffer.forEach(figId => {
    const fig = FIGURES[figId];
    if (!fig) return;
    const card = createFigureCard(fig, () => onPickFigure(figId, state));
    offer.appendChild(card);
  });

  // Podgląd aktywnych figur
  const preview = $('active-figures-preview');
  if (preview) {
    preview.innerHTML = '';
    state.activeFigures.forEach(id => {
      const fig = FIGURES[id];
      if (!fig) return;
      const badge = document.createElement('span');
      badge.className = 'mini-figure-badge';
      badge.textContent = `${fig.icon} ${fig.name}`;
      preview.appendChild(badge);
    });
    if (state.activeFigures.length === 0) {
      preview.innerHTML = '<span style="color:var(--text-dim);font-size:0.78rem">brak</span>';
    }
  }

  // Przycisk pomiń
  const skipBtn = $('btn-skip-figure');
  if (skipBtn) {
    skipBtn.onclick = () => onSkipFigure(state);
  }
}

function createFigureCard(fig, onClick) {
  const card = document.createElement('div');
  card.className = `figure-card${fig.type === 'oneshot' ? ' figure-card--oneshot' : ''}`;
  card.innerHTML = `
    <div class="figure-icon">${fig.icon}</div>
    <div class="figure-info">
      <div class="figure-name">${fig.name}</div>
      <span class="figure-type-badge figure-type-badge--${fig.type}">
        ${fig.type === 'passive' ? 'Pasywna' : 'Jednorazowa'}
      </span>
      <div class="figure-desc">${fig.description}</div>
      <div class="figure-rarity">${rarityLabel(fig.rarity)}</div>
    </div>
  `;
  card.addEventListener('click', onClick);
  return card;
}

function rarityLabel(rarity) {
  const map = { common: 'Pospolita', rare: 'Rzadka', legendary: 'Legendarna ✦' };
  return map[rarity] || rarity;
}

function onPickFigure(figId, state) {
  const fig = FIGURES[figId];
  if (fig?.type === 'passive' && state.activeFigures.includes(figId)) {
    showToast('Ta figura jest już aktywna!');
    return;
  }
  const success = addFigure(figId);
  if (!success && fig?.type === 'passive') {
    showToast('Możesz mieć maksymalnie 5 aktywnych figur!');
    return;
  }
  state._figureOffer = [];
  startRound();
}

function onSkipFigure(state) {
  state.ink += 5;
  state._figureOffer = [];
  startRound();
}

// ---- Ekran Ante --------------------------------------------

export function renderAnteScreen(ante) {
  const romanMap = ['', 'I', 'II', 'III', 'IV', 'V'];
  const badge = $('ante-badge');
  const title = $('ante-title');
  const changes = $('ante-changes');

  if (badge) badge.textContent = `ANTE ${romanMap[ante] || ante}`;
  if (title) title.textContent = `Poziom trudności wzrósł`;

  const items = [
    'Timer skrócony o 5 sekund',
    'Trudniejsze słowa w puli',
  ];
  if (ante >= 3) items.push('Odblokowano legendarne figury w Scriptorium');

  if (changes) {
    changes.innerHTML = items.map(t => `<li>${t}</li>`).join('');
  }

  const btn = $('btn-ante-continue');
  if (btn) {
    btn.onclick = () => openScriptorium();
  }
}

// ---- Game over ---------------------------------------------

function renderGameOver(state) {
  $('gameover-score').textContent = state.totalScore.toLocaleString('pl-PL');

  const hsEl = $('gameover-highscore');
  if (hsEl) {
    if (state.totalScore >= state.highScore) {
      hsEl.textContent = '🏆 Nowy rekord!';
    } else {
      hsEl.textContent = `Rekord: ${state.highScore.toLocaleString('pl-PL')}`;
    }
  }

  const setVal = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  setVal('stat-words-guessed', state.wordsGuessed);
  setVal('stat-words-failed', state.wordsFailed);
  setVal('stat-max-combo', state.maxComboThisRun);
  const inkEl = $('stat-total-ink');
  if (inkEl) inkEl.innerHTML = `${state.ink} <span class="ink-icon">✦</span>`;

  const title = $('gameover-title');
  if (title) {
    title.textContent = state.wordsGuessed > state.wordsFailed
      ? 'Świetna gra!'
      : 'Koniec gry';
  }
}

// ---- Toast --------------------------------------------------

export function showToast(message, duration = 2500) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
