// src/ui.js — zarządzanie ekranami i renderowanie UI

import { emitter } from './eventEmitter.js';
import { CATEGORIES, gameState, toggleLetter, playWord, discardLetters, useOneshotFigure, trySkipBlind, enterCategory, startBlind, pickFigure, skipFigurePick } from './game.js';
import { FIGURES, getFigureCost } from './figures.js';
import { LETTER_VALUES, getTier } from './scoring.js';

// ---- Przełączanie ekranów -------------------------------------------

const screens = {};
let currentScreen = null;

export function initScreens() {
  document.querySelectorAll('.screen').forEach(el => {
    screens[el.id] = el;
  });
}

export function showScreen(id) {
  if (currentScreen) currentScreen.classList.remove('active');
  currentScreen = screens[id];
  if (currentScreen) currentScreen.classList.add('active');
  window.scrollTo(0, 0);
}

// ---- Ekran start ----------------------------------------------------

export function renderStartScreen() {
  const hs = document.getElementById('hs-value');
  if (hs) hs.textContent = gameState.highScore.toLocaleString('pl');
}

// ---- Ekran mapa -----------------------------------------------------

export function renderMapScreen() {
  const container = document.getElementById('category-map');
  const inkEl = document.getElementById('map-ink-value');
  if (inkEl) inkEl.textContent = gameState.ink;

  if (!container) return;
  container.innerHTML = '';

  const completedIds = new Set(
    gameState.completedBlinds
      .filter(b => {
        // kategoria ukończona jeśli wszystkie 3 blindy ukończone lub pominięte
        const catBlinds = gameState.completedBlinds.filter(x => x.categoryId === b.categoryId);
        const cat = CATEGORIES.find(c => c.id === b.categoryId);
        return cat && catBlinds.length >= cat.blinds.length;
      })
      .map(b => b.categoryId)
  );

  const categories = gameState.shuffledCategories?.length ? gameState.shuffledCategories : CATEGORIES;

  categories.forEach((cat, idx) => {
    const isCompleted = completedIds.has(cat.id);
    const isActive = idx === gameState.categoryIndex && !isCompleted;
    const isLocked = idx > gameState.categoryIndex;

    let status = 'locked';
    if (isCompleted) status = 'completed';
    else if (isActive || idx < gameState.categoryIndex) status = 'available';

    const card = document.createElement('div');
    card.className = `category-card ${status}`;
    card.innerHTML = `
      <div class="category-card__icon">${cat.icon}</div>
      <div class="category-card__name">${cat.name}</div>
      <div class="category-card__status">${
        isCompleted ? 'Ukończona' :
        isActive    ? 'Aktywna'  :
        isLocked    ? 'Zablokowana' : 'Dostępna'
      }</div>
    `;

    if (status === 'available') {
      card.addEventListener('click', () => {
        enterCategory(idx);
      });
    }

    container.appendChild(card);
  });
}

// ---- Ekran wyboru blinda -------------------------------------------

export function renderBlindSelectScreen() {
  const cat = gameState.currentCategory;
  const inkEl = document.getElementById('bs-ink-value');
  if (inkEl) inkEl.textContent = gameState.ink;

  const nameEl = document.getElementById('bs-category-name');
  if (nameEl) nameEl.textContent = `${cat.icon} ${cat.name}`;

  const discardsEl = document.getElementById('bs-discards-info');
  if (discardsEl) discardsEl.textContent = `Odrzucenia w kategorii: ${gameState.discardsLeft}/3`;

  renderBlindCards();
  renderFigureOffer();
}

function renderBlindCards() {
  const container = document.getElementById('blind-cards');
  if (!container) return;
  container.innerHTML = '';

  const cat = gameState.currentCategory;
  const completedInCat = new Set(
    gameState.completedBlinds
      .filter(b => b.categoryId === cat.id)
      .map(b => b.blindId)
  );

  cat.blinds.forEach((blind, idx) => {
    const isDone = completedInCat.has(blind.id);
    const isCurrent = idx === gameState.blindIndex && !isDone;

    // Użyj losowo wybranego słowa z puli (jeśli dostępne)
    const activeBlind = gameState._activeBlindWords?.[idx] ?? blind;
    const skipTag = gameState._pendingSkipTags?.[idx];

    // Słowo ukryte dla nieukończonych blindów
    const wordDisplay = isDone
      ? `<span class="word-revealed">${activeBlind.word}</span>`
      : `<span class="word-hidden">${activeBlind.word.split('').map(() => '_').join(' ')}</span>`;

    const card = document.createElement('div');
    card.className = `blind-card${isCurrent ? ' active-blind' : ''}${isDone ? ' done-blind' : ''}`;

    card.innerHTML = `
      <div class="blind-card__header">
        <span class="blind-type-badge ${blind.type}">${
          blind.type === 'small' ? 'Mały' : blind.type === 'big' ? 'Duży' : 'Boss'
        }</span>
        <span class="blind-card__target">Cel: ${blind.targetScore} pkt</span>
      </div>
      <div class="blind-card__word">${wordDisplay}</div>
      <div class="blind-card__definition">${activeBlind.definition}</div>
      ${isCurrent ? `
        <div class="skip-form">
          <input class="skip-input" type="text" placeholder="Odgadnij i pomiń..." maxlength="20" />
          <button class="btn btn--primary btn--sm">Pomiń</button>
        </div>
        ${skipTag ? `<div class="skip-bonus-info">Bonus za pominięcie: <strong>${skipTag.label}</strong></div>` : ''}
        <div class="skip-feedback"></div>
        <button class="btn btn--ghost" style="margin-top:.3rem">Zagraj blind</button>
      ` : ''}
    `;

    if (isCurrent) {
      const input = card.querySelector('.skip-input');
      const skipBtn = card.querySelector('.btn--primary');
      const playBtn = card.querySelector('.btn--ghost');
      const feedback = card.querySelector('.skip-feedback');

      skipBtn.addEventListener('click', () => {
        const attempt = input.value;
        const ok = trySkipBlind(idx, attempt);
        if (!ok) {
          feedback.textContent = 'Niepoprawnie — zaczynamy grę!';
          feedback.className = 'skip-feedback err';
        }
      });

      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') skipBtn.click();
      });

      playBtn.addEventListener('click', () => startBlind(idx));
    }

    container.appendChild(card);
  });
}

function renderFigureOffer() {
  const offer = gameState._figureOffer || [];
  const cardsEl = document.getElementById('figure-offer-cards');
  if (!cardsEl) return;
  cardsEl.innerHTML = '';

  offer.forEach(fig => {
    const cost = getFigureCostDisplay(fig.id);
    const card = buildFigureCardEl(fig, cost, false);
    card.addEventListener('click', () => {
      if (gameState.ink >= cost) {
        gameState.ink -= cost;
        pickFigure(fig.id);
        renderBlindSelectScreen();
      }
    });
    cardsEl.appendChild(card);
  });
}

function getFigureCostDisplay(figureId) {
  return getFigureCost(figureId, gameState.activeFigures);
}

// ---- Ekran gry -------------------------------------------------------

export function renderGameScreen() {
  updateGameHeader();
  renderTargetWord();
  renderHand();
  renderPlaysIndicator();
  renderHandFigures();
  updateWordPreview();
}

function updateGameHeader() {
  const blind = gameState.currentBlind;
  // Pokaż słowo tylko w stopniu odkrytym (reszta jako podkreślenia)
  if (blind) {
    const word = blind.word.toUpperCase();
    const display = word.split('').map((l, i) => gameState.revealedLetters.has(i) ? l : '_').join(' ');
    setEl('g-blind-name', display);
  } else {
    setEl('g-blind-name', '');
  }
  setEl('g-score', gameState.runningScore.toLocaleString('pl'));
  setEl('g-target', blind?.targetScore?.toLocaleString('pl') ?? '0');
  setEl('g-ink', gameState.ink);
  setEl('g-discards', gameState.discardsLeft);

  const fill = document.getElementById('g-progress-fill');
  if (fill && blind) {
    const pct = Math.min(100, (gameState.runningScore / blind.targetScore) * 100);
    fill.style.width = pct + '%';
  }

  setEl('g-definition', blind?.definition ?? '');
}

function renderTargetWord() {
  const container = document.getElementById('target-word');
  if (!container || !gameState.currentBlind) return;

  const word = gameState.currentBlind.word.toUpperCase();
  container.innerHTML = '';

  for (let i = 0; i < word.length; i++) {
    const tile = document.createElement('div');
    tile.className = 'target-tile' + (gameState.revealedLetters.has(i) ? ' revealed' : '');
    tile.textContent = gameState.revealedLetters.has(i) ? word[i] : '_';
    container.appendChild(tile);
  }
}

export function renderHand() {
  const container = document.getElementById('hand');
  if (!container) return;
  container.innerHTML = '';

  gameState.hand.forEach((letter, idx) => {
    const isSelected = gameState.selectedIndices.includes(idx);
    const tile = document.createElement('div');
    tile.className = 'letter-tile' + (isSelected ? ' selected' : '');
    tile.dataset.idx = idx;

    const val = LETTER_VALUES[letter.toUpperCase()] ?? 1;
    tile.innerHTML = `${letter}<span class="letter-tile__val">${val}</span>`;

    tile.addEventListener('click', () => toggleLetter(idx));
    container.appendChild(tile);
  });
}

function renderPlaysIndicator() {
  const container = document.getElementById('plays-indicator');
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    const dot = document.createElement('div');
    dot.className = 'play-dot' + (i >= gameState.playsLeft ? ' used' : '');
    container.appendChild(dot);
  }
}

function renderHandFigures() {
  const container = document.getElementById('hand-figures');
  if (!container) return;
  container.innerHTML = '';

  gameState.handFigures.forEach(figId => {
    const fig = FIGURES[figId];
    if (!fig) return;
    const chip = document.createElement('div');
    chip.className = 'oneshot-chip';
    chip.innerHTML = `<span>${fig.icon}</span><span>${fig.name}</span>`;
    chip.title = fig.description;
    chip.addEventListener('click', () => {
      useOneshotFigure(figId);
    });
    container.appendChild(chip);
  });
}

function updateWordPreview() {
  const preview = document.getElementById('word-preview');
  const tierBadge = document.getElementById('word-tier-badge');
  if (!preview) return;

  preview.innerHTML = '';

  if (gameState.selectedIndices.length === 0) {
    const ph = document.createElement('span');
    ph.className = 'word-preview__placeholder';
    ph.textContent = 'Kliknij litery...';
    preview.appendChild(ph);
    if (tierBadge) tierBadge.textContent = '';
    return;
  }

  gameState.selectedIndices.forEach(idx => {
    const letter = gameState.hand[idx];
    const tile = document.createElement('div');
    tile.className = 'preview-tile';
    tile.textContent = letter;
    preview.appendChild(tile);
  });

  const len = gameState.selectedIndices.length;
  const tier = getTier(len);
  if (tierBadge) {
    tierBadge.textContent = tier.name;
    tierBadge.style.color = tier.color;
  }
}

// ---- Score popup ---------------------------------------------------

let popupTimer = null;

export function showScorePopup({ word, result }) {
  const popup = document.getElementById('score-popup');
  if (!popup) return;

  const detail = result.lettersOnly
    ? `${result.chips} chipów (bez mnożnika)`
    : `${result.chips} liter × ${result.mult} mnożnik${result.categoryBonus > 0 ? ' <span style="color:var(--accent)">+kat.</span>' : ''}`;

  popup.innerHTML = `
    <div class="score-popup__word">${word.toUpperCase()}</div>
    <div class="score-popup__value">+${result.score}</div>
    <div class="score-popup__tier" style="color:${result.tier.color}">${result.tier.name}</div>
    <div class="score-popup__detail">${detail}</div>
  `;

  popup.classList.add('show');
  if (popupTimer) clearTimeout(popupTimer);
  popupTimer = setTimeout(() => popup.classList.remove('show'), 1600);
}

export function showWordRejected(data) {
  const hand = document.getElementById('hand');
  if (!hand) return;

  hand.classList.add('invalid');
  setTimeout(() => hand.classList.remove('invalid'), 350);

  const popup = document.getElementById('score-popup');
  if (popup) {
    popup.innerHTML = `<div style="color:var(--red);font-weight:700">${
      data.bezblednik ? '(Bezbłędnik) Nieznane słowo' : 'Nieznane słowo'
    }</div>`;
    popup.classList.add('show');
    if (popupTimer) clearTimeout(popupTimer);
    popupTimer = setTimeout(() => popup.classList.remove('show'), 1200);
  }
}

// ---- Ekran podsumowania --------------------------------------------

export function renderSummaryScreen({ won, inkReward, score }) {
  const blind = gameState.currentBlind;

  setEl('summary-result-icon', won ? '🏆' : '💀');
  setEl('summary-title', won ? 'Blind wygrany!' : 'Blind przegrany');
  setEl('sum-score', score.toLocaleString('pl'));
  setEl('sum-target', blind?.targetScore?.toLocaleString('pl') ?? '0');
  setEl('sum-ink', won ? `+${inkReward}` : '0');

  const title = document.getElementById('summary-title');
  if (title) title.style.color = won ? 'var(--green)' : 'var(--red)';

  const btn = document.getElementById('btn-summary-continue');
  if (btn) btn.textContent = won ? 'Scriptorium →' : 'Koniec gry';
}

// ---- Ekran końcowy -------------------------------------------------

export function renderEndScreen({ victory }) {
  setEl('end-icon', victory ? '🎉' : '💀');
  setEl('end-title', victory ? 'Zwycięstwo!' : 'Porażka');
  setEl('end-subtitle', victory
    ? 'Ukończyłeś wszystkie kategorie!'
    : 'Nie udało się osiągnąć progu punktowego.');

  setEl('end-total-score', gameState.totalScore.toLocaleString('pl'));
  setEl('end-highscore', gameState.highScore.toLocaleString('pl'));
  setEl('end-words-count', gameState.wordsPlayedThisRun.length);

  const wordsEl = document.getElementById('end-words-list');
  if (wordsEl) {
    wordsEl.innerHTML = '';
    const shown = gameState.wordsPlayedThisRun.slice(-30);
    shown.forEach(w => {
      const tag = document.createElement('span');
      tag.className = 'end-word-tag' + (w.categoryBonus ? ' cat' : '');
      tag.textContent = w.word.toUpperCase();
      wordsEl.appendChild(tag);
    });
  }
}

// ---- Tag toast -----------------------------------------------------

export function showTagToast(tag) {
  const toast = document.createElement('div');
  toast.className = 'tag-toast';
  toast.textContent = `Bonus: ${tag.label}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

// ---- Ekran gry: update inkrujementalny -----------------------------

export function updateGameAfterPlay() {
  updateGameHeader();
  renderTargetWord();
  renderHand();
  renderPlaysIndicator();
  renderHandFigures();
  updateWordPreview();
}

// ---- Helpers -------------------------------------------------------

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text ?? '';
}

export function buildFigureCardEl(fig, cost, showSell = false) {
  const card = document.createElement('div');
  card.className = `figure-card ${fig.rarity === 'legendary' ? 'legendary' : ''}`;
  card.title = fig.linguisticMeaning || '';

  const canAfford = gameState.ink >= cost;

  card.innerHTML = `
    <div class="figure-card__icon">${fig.icon}</div>
    <div class="figure-card__name">${fig.name}</div>
    <div class="figure-card__desc">${fig.description}</div>
    <div class="figure-card__cost" style="${!canAfford && !showSell ? 'color:var(--red)' : ''}">
      ✦ ${cost}
    </div>
    <div class="figure-card__rarity ${fig.rarity}">${
      fig.rarity === 'common' ? 'Pospolita' :
      fig.rarity === 'rare'   ? 'Rzadka'    : 'Legendarna'
    }</div>
    ${showSell ? `<button class="sell-btn">Sprzedaj (✦${fig.sellValue})</button>` : ''}
  `;

  return card;
}

// ---- Event listeners na ekranie blind-select back ------------------
export function bindBlindSelectEvents() {
  const backBtn = document.getElementById('blind-back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      if (gameState.phase === 'blind-select') {
        showScreen('screen-map');
      }
    };
  }

  const skipFigBtn = document.getElementById('btn-skip-figure');
  if (skipFigBtn) {
    skipFigBtn.onclick = () => skipFigurePick();
  }
}
