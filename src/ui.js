// src/ui.js — zarządzanie ekranami i renderowanie UI

import { emitter } from './eventEmitter.js';
import { CATEGORIES, gameState, toggleLetter, playWord, discardLetters, useOneshotFigure, trySkipBlind, enterCategory, startBlind, sortHand, guessBlindWord } from './game.js';
import { FIGURES, getFigureCost } from './figures.js';
import { PASSIVE_BONUSES } from './passiveBonuses.js';
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

  renderBlindCards();
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

    const activeBlind = gameState._activeBlindWords?.[idx] ?? blind;
    const skipTag = gameState._pendingSkipTags?.[idx];

    const wordDisplay = isDone
      ? `<span class="word-revealed">${activeBlind.word}</span>`
      : `<span class="word-hidden">${activeBlind.word.split('').map(() => '_').join(' ')}</span>`;

    const card = document.createElement('div');
    card.className = `blind-card${isCurrent ? ' active-blind' : ''}${isDone ? ' done-blind' : ''}`;

    card.innerHTML = `
      <div class="blind-card__header">
        <span class="blind-type-badge ${blind.type}">${
          blind.type === 'small' ? 'Szkic' : blind.type === 'big' ? 'Esej' : 'Traktat'
        }</span>
        <span class="blind-card__target">Cel: ${blind.targetScore} pkt</span>
      </div>
      <div class="blind-card__word">${wordDisplay}</div>
      <div class="blind-card__definition">${activeBlind.definition}</div>
      ${isCurrent ? `
        ${blind.type !== 'boss' ? `
          <div class="skip-form">
            <input class="skip-input" type="text" placeholder="Odgadnij i pomiń..." maxlength="20" />
            <button class="btn btn--primary btn--sm">Pomiń</button>
          </div>
          ${skipTag ? `<div class="skip-bonus-info">Bonus za pominięcie: <strong>${skipTag.label}</strong></div>` : ''}
          <div class="skip-feedback"></div>
        ` : `<p class="boss-no-skip">Traktat nie może być pominięty</p>`}
        <button class="btn btn--ghost" style="margin-top:.3rem">Zagraj</button>
      ` : ''}
    `;

    if (isCurrent) {
      const input = card.querySelector('.skip-input');
      const skipBtn = card.querySelector('.btn--primary');
      const playBtn = card.querySelector('.btn--ghost');
      const feedback = card.querySelector('.skip-feedback');

      if (skipBtn) {
        skipBtn.addEventListener('click', () => {
          const attempt = input.value;
          const ok = trySkipBlind(idx, attempt);
          if (!ok) {
            feedback.textContent = 'Niepoprawnie — zaczynamy grę!';
            feedback.className = 'skip-feedback err';
          }
        });
      }

      if (input) input.addEventListener('keydown', e => {
        if (e.key === 'Enter') skipBtn?.click();
      });

      playBtn.addEventListener('click', () => startBlind(idx));
    }

    container.appendChild(card);
  });
}

// ---- Ekran gry -------------------------------------------------------

export function renderGameScreen() {
  updateGameHeader();
  renderTargetWord();
  renderHand();
  renderPlaysIndicator();
  renderActiveFigures();
  renderHandFigures();
  renderPlayedWords();
  updateWordPreview();
  bindGuessForm();
}

function updateGameHeader() {
  const blind = gameState.currentBlind;

  setEl('g-score', gameState.runningScore.toLocaleString('pl'));
  setEl('g-target', blind?.targetScore?.toLocaleString('pl') ?? '0');
  setEl('g-ink', gameState.ink);
  setEl('g-discards', gameState.discardsLeft);

  // Informacja o próbie: "Próba X z N • Kategoria • pozostało: R"
  const total = (gameState.shuffledCategories?.length ?? 0) * 3;
  const done = gameState.completedBlinds?.length ?? 0;
  const current = done + 1;
  const remaining = Math.max(0, total - current);
  const catName = gameState.currentCategory?.name ?? '';
  const blindTypeName = blind?.type === 'small' ? 'Szkic' : blind?.type === 'big' ? 'Esej' : 'Traktat';
  setEl('game-context', `Próba ${current} z ${total} • ${catName} — ${blindTypeName} • pozostało: ${remaining}`);

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
  setEl('g-plays', gameState.playsLeft);
}

// Aktywne figury pasywne + bonusy — widoczne pod przyciskami
export function renderActiveFigures() {
  const container = document.getElementById('active-figures');
  if (!container) return;
  container.innerHTML = '';

  if (gameState.activeFigures.length === 0 && gameState.passiveBonuses.length === 0) return;

  gameState.activeFigures.forEach(figId => {
    const fig = FIGURES[figId];
    if (!fig) return;
    const card = buildFigureCardEl(fig, 0, false);
    card.classList.add('active-figure-card');
    container.appendChild(card);
  });

  gameState.passiveBonuses.forEach(bonusId => {
    const bonus = PASSIVE_BONUSES[bonusId];
    if (!bonus) return;
    const card = document.createElement('div');
    card.className = 'figure-card active-figure-card passive-bonus-card';
    card.innerHTML = `
      <div class="figure-card__icon">${bonus.icon}</div>
      <div class="figure-card__name">${bonus.name}</div>
      <div class="figure-card__desc">${bonus.description}</div>
    `;
    container.appendChild(card);
  });
}

// Jednorazowe figury w ręce — jako pełne karty z przyciskiem Użyj
function renderHandFigures() {
  const container = document.getElementById('hand-figures');
  if (!container) return;
  container.innerHTML = '';

  gameState.handFigures.forEach(figId => {
    const fig = FIGURES[figId];
    if (!fig) return;
    const card = buildFigureCardEl(fig, 0, false);
    card.classList.add('oneshot-hand-card');
    const useBtn = document.createElement('button');
    useBtn.className = 'btn btn--ghost btn--sm';
    useBtn.textContent = 'Użyj';
    useBtn.addEventListener('click', () => useOneshotFigure(figId));
    card.appendChild(useBtn);
    container.appendChild(card);
  });
}

// Zagrane słowa w bieżącej rundzie
function renderPlayedWords() {
  const el = document.getElementById('played-words');
  if (!el) return;
  el.innerHTML = '';
  if (!gameState.wordsPlayedThisBlind?.length) return;

  gameState.wordsPlayedThisBlind.forEach(word => {
    const tag = document.createElement('span');
    tag.className = 'played-word-tag';
    tag.textContent = word.toUpperCase();
    el.appendChild(tag);
  });
}

function updateWordPreview() {
  const preview = document.getElementById('word-preview');
  const tierBadge = document.getElementById('word-tier-badge');
  if (!preview) return;

  preview.innerHTML = '';

  if (gameState.selectedIndices.length === 0) {
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

// ---- Guess form (toggle) binding -----------------------------------

let _guessFormBound = false;
function bindGuessForm() {
  if (_guessFormBound) return;
  _guessFormBound = true;

  const toggleBtn = document.getElementById('btn-guess-toggle');
  const form = document.getElementById('guess-form');
  const input = document.getElementById('guess-input');
  const confirmBtn = document.getElementById('btn-guess');

  function openForm() {
    if (input) input.value = '';
    if (form) form.style.display = 'flex';
    if (toggleBtn) toggleBtn.style.display = 'none';
    if (input) input.focus();
  }

  function closeForm() {
    if (form) form.style.display = 'none';
    if (toggleBtn) toggleBtn.style.display = '';
    if (input) input.value = '';
  }

  function submitGuess() {
    if (!input) return;
    const result = guessBlindWord(input.value);
    if (!result) {
      input.classList.add('shake');
      setTimeout(() => {
        input.classList.remove('shake');
        closeForm();
      }, 400);
    }
    // On correct guess, game.js will transition phase away from 'game',
    // closeForm will be called on next render via resetGuessForm
  }

  if (toggleBtn) toggleBtn.addEventListener('click', openForm);
  if (confirmBtn) confirmBtn.addEventListener('click', submitGuess);
  if (input) input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitGuess();
    if (e.key === 'Escape') closeForm();
  });
}

export function resetGuessForm() {
  const form = document.getElementById('guess-form');
  const toggleBtn = document.getElementById('btn-guess-toggle');
  const input = document.getElementById('guess-input');
  if (form) form.style.display = 'none';
  if (toggleBtn) toggleBtn.style.display = '';
  if (input) input.value = '';
}

// ---- Score popup ---------------------------------------------------

let popupTimer = null;

export function showScorePopup({ word, result }) {
  const popup = document.getElementById('score-popup');
  if (!popup) return;

  const detail = result.lettersOnly
    ? `${result.chips} znaków (bez mnożnika)`
    : `${result.chips} liter × ${result.mult} mnożnik${result.categoryBonus > 0 ? ' <span style="color:var(--accent)">+kat.</span>' : ''}`;

  const extraLine = result.extraChips > 0
    ? `<div class="score-popup__extra">+${result.extraChips} znaków z liter</div>`
    : '';

  popup.innerHTML = `
    <div class="score-popup__word">${word.toUpperCase()}</div>
    <div class="score-popup__value">+${result.score}</div>
    <div class="score-popup__tier" style="color:${result.tier.color}">${result.tier.name}</div>
    <div class="score-popup__detail">${detail}</div>
    ${extraLine}
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
  setEl('summary-title', won ? 'Próba zaliczona!' : 'Próba nieudana');
  setEl('sum-score', score.toLocaleString('pl'));
  setEl('sum-target', blind?.targetScore?.toLocaleString('pl') ?? '0');
  setEl('sum-ink', won ? `+${inkReward}` : '0');

  const title = document.getElementById('summary-title');
  if (title) title.style.color = won ? 'var(--green)' : 'var(--red)';

  const btn = document.getElementById('btn-summary-continue');
  if (btn) {
    if (!won) {
      btn.textContent = 'Koniec gry';
    } else if (gameState._wonByGuess) {
      btn.textContent = 'Dalej →';
    } else {
      btn.textContent = 'Skryptorium →';
    }
  }
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
  renderActiveFigures();
  renderHandFigures();
  renderPlayedWords();
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

  const canAfford = cost === 0 || gameState.ink >= cost;

  card.innerHTML = `
    <div class="figure-card__icon">${fig.icon}</div>
    <div class="figure-card__name">${fig.name}</div>
    <div class="figure-card__desc">${fig.description}</div>
    <div class="figure-card__cost" style="${!canAfford && !showSell ? 'color:var(--red)' : ''}">
      ${cost > 0 ? `✦ ${cost}` : ''}
    </div>
    <div class="figure-card__rarity ${fig.rarity}">${
      fig.rarity === 'common' ? 'Pospolita' :
      fig.rarity === 'rare'   ? 'Rzadka'    : 'Legendarna'
    }</div>
    ${showSell ? `<button class="sell-btn">Sprzedaj (✦${fig.sellValue ?? 1})</button>` : ''}
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
}
