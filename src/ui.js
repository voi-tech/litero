// src/ui.js — zarządzanie ekranami i renderowanie UI

import {
  gameState, toggleLetter, useOneshotFigure, trySkipBlind, enterCategory,
  startBlind, guessBlindWord, findWordSequence, buildScoringContext,
  isCategoryCompleted, allCategoriesCompleted, returnToMap,
  clearSelection, DIFFICULTIES,
} from './game.js';
import { FIGURES } from './figures.js';
import { PASSIVE_BONUSES } from './passiveBonuses.js';
import { LETTER_VALUES, getTier, scorePlaySegments } from './scoring.js';
import { icon, initIcons } from './icons.js';

// ---- Helpers -------------------------------------------------------

export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Wspólny toast — jedyne miejsce tworzenia powiadomień
export function showToast(message, color = 'var(--text)', duration = 1800) {
  const toast = document.createElement('div');
  toast.className = 'tag-toast';
  toast.style.color = color;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

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

  const categories = gameState.shuffledCategories;

  categories.forEach((cat, idx) => {
    const isCompleted = isCategoryCompleted(cat);
    const hasProgress = gameState.completedBlinds.some(b => b.categoryId === cat.id);

    const status = isCompleted ? 'completed' : 'available';
    const statusLabel = isCompleted
      ? 'Ukończona'
      : hasProgress ? 'W trakcie' : 'Dostępna';

    const card = document.createElement('div');
    card.className = `category-card ${status}`;
    card.innerHTML = `
      <div class="category-card__icon">${icon(cat.icon, 24)}</div>
      <div class="category-card__name">${escapeHTML(cat.name)}</div>
      <div class="category-card__status">${statusLabel}</div>
    `;

    if (!isCompleted) {
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Kategoria ${cat.name} — ${statusLabel}`);
      const activate = () => enterCategory(idx);
      card.addEventListener('click', activate);
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
    }

    container.appendChild(card);
  });
  initIcons();
}

// ---- Ekran wyboru blinda -------------------------------------------

export function renderBlindSelectScreen() {
  const cat = gameState.currentCategory;
  const inkEl = document.getElementById('bs-ink-value');
  if (inkEl) inkEl.textContent = gameState.ink;

  const nameEl = document.getElementById('bs-category-name');
  if (nameEl) { nameEl.innerHTML = `${icon(cat.icon, 18)} ${escapeHTML(cat.name)}`; initIcons(); }

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
      ? `<span class="word-revealed">${escapeHTML(activeBlind.word)}</span>`
      : `<span class="word-hidden">${activeBlind.word.split('').map(() => '_').join(' ')}</span>`;

    const card = document.createElement('div');
    card.className = `blind-card${isCurrent ? ' active-blind' : ''}${isDone ? ' done-blind' : ''}`;

    card.innerHTML = `
      <div class="blind-card__header">
        <span class="blind-type-badge ${escapeHTML(blind.type)}">${
          blind.type === 'small' ? 'Szkic' : blind.type === 'big' ? 'Esej' : 'Traktat'
        }</span>
        <span class="blind-card__target">Cel: ${Number(activeBlind.targetScore)} pkt</span>
      </div>
      <div class="blind-card__word">${wordDisplay}</div>
      <div class="blind-card__definition">${escapeHTML(activeBlind.definition)}</div>
      ${isCurrent ? `
        ${blind.type !== 'boss' ? `
          <div class="skip-form">
            <input class="skip-input" type="text" placeholder="Odgadnij i pomiń..." maxlength="20" aria-label="Odgadnij hasło, by pominąć blind" />
            <button class="btn btn--primary btn--sm">Pomiń</button>
          </div>
          ${skipTag ? `<div class="skip-bonus-info">Bonus za pominięcie: <strong>${escapeHTML(skipTag.label)}</strong></div>` : ''}
        ` : `<p class="boss-no-skip">Traktat nie może być pominięty</p>`}
        <button class="btn btn--ghost" style="margin-top:.3rem">Zagraj</button>
      ` : ''}
    `;

    if (isCurrent) {
      const input = card.querySelector('.skip-input');
      const skipBtn = card.querySelector('.btn--primary');
      const playBtn = card.querySelector('.btn--ghost');

      if (skipBtn) {
        skipBtn.addEventListener('click', () => {
          const ok = trySkipBlind(idx, input.value);
          // przy błędnym haśle gra startuje natychmiast — feedback toastem,
          // bo ekran wyboru blinda znika
          if (!ok) showToast('Niepoprawne hasło — zaczynamy próbę!', 'var(--red)');
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
  renderGuessAvailability();
  bindGuessForm();
}

function updateGameHeader() {
  const blind = gameState.currentBlind;

  setEl('g-score', gameState.runningScore.toLocaleString('pl'));
  setEl('g-target', blind?.targetScore?.toLocaleString('pl') ?? '0');
  setEl('g-ink', gameState.ink);
  setEl('g-discards', gameState.discardsLeft);

  // Informacja o próbie
  const total = (gameState.shuffledCategories?.length ?? 0) * 3;
  const done = gameState.completedBlinds?.length ?? 0;
  const current = Math.min(done + 1, total);
  const remaining = Math.max(0, total - current);
  const catName = gameState.currentCategory?.name ?? '';
  const blindTypeName = blind?.type === 'small' ? 'Szkic' : blind?.type === 'big' ? 'Esej' : 'Traktat';
  setEl('game-context', `Próba ${current} z ${total} • ${catName} — ${blindTypeName} • pozostało: ${remaining}`);

  setEl('g-definition', blind?.definition ?? '');

  // Aktywne bonusy z tagów (mnożnik ×1.5 na ten blind)
  const bonusEl = document.getElementById('next-round-bonus');
  if (bonusEl) {
    if (gameState._figureState?.mult15) {
      bonusEl.textContent = 'Bonus: mnożnik startuje od ×1.5';
      bonusEl.style.display = '';
    } else {
      bonusEl.style.display = 'none';
    }
  }
}

function renderTargetWord() {
  const container = document.getElementById('target-word');
  if (!container || !gameState.currentBlind) return;

  const word = gameState.currentBlind.word.toUpperCase();
  container.innerHTML = '';

  // Skaluj kafelki zależnie od długości słowa
  const len = word.length;
  const tileW = len <= 6 ? '2.1rem' : len <= 8 ? '1.8rem' : len <= 10 ? '1.5rem' : len <= 12 ? '1.3rem' : '1.1rem';
  const tileH = len <= 6 ? '2.4rem' : len <= 8 ? '2.0rem' : len <= 10 ? '1.7rem' : len <= 12 ? '1.45rem' : '1.2rem';
  const tileF = len <= 6 ? '1rem'   : len <= 8 ? '.85rem'  : len <= 10 ? '.75rem'  : len <= 12 ? '.65rem'  : '.55rem';

  for (let i = 0; i < word.length; i++) {
    const tile = document.createElement('div');
    tile.className = 'target-tile' + (gameState.revealedLetters.has(i) ? ' revealed' : '');
    tile.textContent = gameState.revealedLetters.has(i) ? word[i] : '_';
    tile.style.cssText = `width:${tileW};height:${tileH};font-size:${tileF};`;
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

    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.setAttribute('aria-pressed', String(isSelected));
    tile.setAttribute('aria-label', `Litera ${letter}, ${val} pkt${isSelected ? ', zaznaczona' : ''}`);

    tile.addEventListener('click', () => toggleLetter(idx));
    tile.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLetter(idx); }
    });
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
      <div class="figure-card__icon">${icon(bonus.icon, 20)}</div>
      <div class="figure-card__name">${bonus.name}</div>
      <div class="figure-card__desc">${bonus.description}</div>
    `;
    container.appendChild(card);
  });
  initIcons();
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
    const definition = getDefinitionForWord(word);
    if (definition) {
      tag.setAttribute('role', 'button');
      tag.setAttribute('tabindex', '0');
      tag.title = 'Pokaż definicję';
      const show = () => showToast(`${word.toUpperCase()}: ${definition}`, 'var(--text)', 4200);
      tag.addEventListener('click', show);
      tag.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); }
      });
    }
    el.appendChild(tag);
  });
}

function getDefinitionForWord(word) {
  const normalized = String(word ?? '').toUpperCase();
  const category = gameState.currentCategory;
  if (!category?.words?.some(w => w.toUpperCase() === normalized)) return null;
  for (const blind of category.blinds ?? []) {
    const found = blind.pool?.find(item => item.word.toUpperCase() === normalized);
    if (found?.definition) return found.definition;
  }
  return null;
}

function updateWordPreview() {
  const preview = document.getElementById('word-preview');
  const tierBadge = document.getElementById('word-tier-badge');
  const scoreEl = document.getElementById('word-score-preview');
  const clearBtn = document.getElementById('btn-clear-selection');
  if (!preview) return;

  preview.innerHTML = '';

  if (gameState.selectedIndices.length === 0) {
    if (tierBadge) tierBadge.textContent = '';
    if (scoreEl) { scoreEl.textContent = ''; scoreEl.style.display = 'none'; }
    if (clearBtn) clearBtn.style.display = 'none';
    return;
  }

  if (clearBtn) {
    clearBtn.style.display = 'inline-flex';
    clearBtn.onclick = () => clearSelection();
  }

  const letters = gameState.selectedIndices.map(i => gameState.hand[i]);
  letters.forEach(letter => {
    const tile = document.createElement('div');
    tile.className = 'preview-tile';
    tile.textContent = letter;
    preview.appendChild(tile);
  });

  // Wykryj sekwencje słów (greedy) — ta sama logika co przy zagraniu
  const segments = findWordSequence(letters);
  const wordSegs = segments.filter(s => s.word);
  const extraSegs = segments.filter(s => !s.word);

  if (tierBadge) {
    if (wordSegs.length === 0) {
      tierBadge.textContent = letters.length.toString();
      tierBadge.style.color = 'var(--text-muted)';
    } else {
      const label = wordSegs.map(s => s.word.length).join('+');
      const totalLen = wordSegs.reduce((a, s) => a + s.word.length, 0);
      tierBadge.textContent = label;
      tierBadge.style.color = getTier(totalLen).color;
    }
  }

  // Podgląd wyniku — dokładnie ten sam scoring co faktyczne zagranie
  if (scoreEl) {
    const result = scorePlaySegments(wordSegs, extraSegs, buildScoringContext());
    if (result.score > 0) {
      scoreEl.textContent = `+${result.score}`;
      scoreEl.style.display = '';
    } else {
      scoreEl.textContent = '';
      scoreEl.style.display = 'none';
    }
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
    if (gameState.guessAttemptedThisBlind) return;
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
        renderGuessAvailability();
      }, 400);
    }
    // Przy trafnym haśle game.js zmienia fazę, a resetGuessForm
    // zamknie formularz przy następnym renderze
  }

  if (toggleBtn) toggleBtn.addEventListener('click', openForm);
  if (confirmBtn) confirmBtn.addEventListener('click', submitGuess);
  if (input) input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitGuess();
    if (e.key === 'Escape') closeForm();
  });
}

function renderGuessAvailability() {
  const toggleBtn = document.getElementById('btn-guess-toggle');
  const form = document.getElementById('guess-form');
  if (!toggleBtn) return;

  if (gameState.guessAttemptedThisBlind) {
    toggleBtn.style.display = 'none';
    if (form) form.style.display = 'none';
    let msg = document.getElementById('guess-locked-message');
    if (!msg) {
      msg = document.createElement('p');
      msg.id = 'guess-locked-message';
      msg.className = 'guess-locked-message';
      toggleBtn.insertAdjacentElement('afterend', msg);
    }
    msg.textContent = 'Próba zgadywania wykorzystana w tym blindzie.';
  } else {
    const msg = document.getElementById('guess-locked-message');
    if (msg) msg.remove();
    if (form?.style.display !== 'flex') toggleBtn.style.display = '';
  }
}

export function resetGuessForm() {
  const form = document.getElementById('guess-form');
  const toggleBtn = document.getElementById('btn-guess-toggle');
  const input = document.getElementById('guess-input');
  if (form) form.style.display = 'none';
  if (toggleBtn) toggleBtn.style.display = gameState.guessAttemptedThisBlind ? 'none' : '';
  if (input) input.value = '';
  const msg = document.getElementById('guess-locked-message');
  if (msg) msg.remove();
}

// ---- Feedback po zagraniu ------------------------------------------

export function showScorePopup({ word, result }) {
  const existing = document.querySelector('.score-combo');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.className = `score-combo ${result.score >= 250 ? 'score-combo--huge' : result.score >= 100 ? 'score-combo--big' : ''}`;
  popup.setAttribute('role', 'status');

  const multLabel = Number.isInteger(result.mult) ? result.mult : result.mult.toFixed(1);
  const extra = result.extraChips > 0 ? ` (+${result.extraChips})` : '';
  const label = result.lettersOnly ? 'Litery' : word.toUpperCase();
  popup.innerHTML = `
    <div class="score-combo__word">${escapeHTML(label)}</div>
    <div class="score-combo__row">
      <span class="score-combo__part" data-step="chips">${result.lettersOnly ? result.extraChips : result.chips} żetonów</span>
      <span class="score-combo__part" data-step="mult">× ${multLabel}${extra}</span>
      <span class="score-combo__part score-combo__total" data-step="total">+${result.score}</span>
    </div>
  `;
  document.body.appendChild(popup);

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const parts = [...popup.querySelectorAll('.score-combo__part')];
  if (reduced) {
    parts.forEach(part => part.classList.add('visible'));
  } else {
    parts.forEach((part, idx) => setTimeout(() => part.classList.add('visible'), idx * 120));
  }
  setTimeout(() => popup.remove(), reduced ? 1300 : 2200);
}

export function showWordRejected(data) {
  const hand = document.getElementById('hand');
  if (hand) {
    hand.classList.add('invalid');
    setTimeout(() => hand.classList.remove('invalid'), 350);
  }
  const msg = data.bezblednik ? '(Bezbłędnik) Nieznane słowo' : 'Nieznane słowo';
  showToast(msg, 'var(--red)', 1200);
}

// ---- Ekran podsumowania --------------------------------------------

export function renderSummaryScreen({ won, inkReward, score }) {
  const blind = gameState.currentBlind;

  const iconEl = document.getElementById('summary-result-icon');
  if (iconEl) { iconEl.innerHTML = won ? icon('trophy', 48) : icon('skull', 48); initIcons(); }
  setEl('summary-title', won ? 'Próba zaliczona!' : 'Próba nieudana');
  setEl('sum-score', score.toLocaleString('pl'));
  setEl('sum-target', blind?.targetScore?.toLocaleString('pl') ?? '0');
  setEl('sum-ink', won ? `+${inkReward}` : '0');

  const title = document.getElementById('summary-title');
  if (title) title.style.color = won ? 'var(--green)' : 'var(--red)';

  const btn = document.getElementById('btn-summary-continue');
  if (btn) {
    if (!won) btn.textContent = 'Koniec gry';
    else if (allCategoriesCompleted()) btn.textContent = 'Zakończ grę →';
    else if (gameState._wonByGuess) btn.textContent = 'Dalej →';
    else btn.textContent = 'Skryptorium →';
  }
}

// ---- Ekran końcowy -------------------------------------------------

export function renderEndScreen({ victory }) {
  const endIconEl = document.getElementById('end-icon');
  if (endIconEl) { endIconEl.innerHTML = victory ? icon('trophy', 56) : icon('skull', 56); initIcons(); }
  setEl('end-title', victory ? 'Zwycięstwo!' : 'Porażka');
  setEl('end-subtitle', victory
    ? 'Ukończyłeś wszystkie kategorie!'
    : 'Nie udało się osiągnąć progu punktowego.');
  setEl('end-difficulty', `Poziom: ${DIFFICULTIES[gameState.difficulty]?.label ?? 'Akademicki'}`);
  const shareBtn = document.getElementById('btn-share-daily');
  if (shareBtn) shareBtn.style.display = gameState.mode === 'daily' ? '' : 'none';

  setEl('end-total-score', gameState.totalScore.toLocaleString('pl'));
  setEl('end-highscore', gameState.highScore.toLocaleString('pl'));
  const stats = buildRunStats();
  setEl('end-words-count', stats.wordsCount);
  setEl('end-best-play', stats.bestPlay.toLocaleString('pl'));
  setEl('end-longest-word', stats.longestWord ? stats.longestWord.toUpperCase() : '—');
  setEl('end-category-words', stats.categoryWords);
  setEl('end-common-letter', stats.commonLetter || '—');

  const wordsEl = document.getElementById('end-words-list');
  if (wordsEl) {
    wordsEl.innerHTML = '';
    const shown = flattenRunWords().slice(-30);
    shown.forEach(w => {
      const tag = document.createElement('span');
      tag.className = 'end-word-tag' + (w.categoryBonus ? ' cat' : '');
      tag.textContent = w.word.toUpperCase();
      wordsEl.appendChild(tag);
    });
  }
}

function flattenRunWords() {
  const out = [];
  for (const play of gameState.wordsPlayedThisRun ?? []) {
    if (Array.isArray(play.words)) {
      for (const word of play.words) {
        out.push({
          word,
          categoryBonus: play.categoryMatches?.some(w => w.toLowerCase() === word.toLowerCase()) ?? false,
        });
      }
    } else if (play.word) {
      out.push({ word: play.word, categoryBonus: !!play.categoryBonus });
    }
  }
  return out;
}

function buildRunStats() {
  const plays = gameState.wordsPlayedThisRun ?? [];
  const words = flattenRunWords();
  const bestPlay = plays.reduce((best, play) => Math.max(best, play.score ?? 0), 0);
  const longestWord = words.reduce((best, item) => (
    item.word.length > best.length ? item.word : best
  ), '');
  const categoryWords = words.filter(item => item.categoryBonus).length;
  const counts = new Map();
  for (const play of plays) {
    const letters = Array.isArray(play.letters)
      ? play.letters
      : String(play.word ?? '').toUpperCase().split('');
    for (const letter of letters) {
      const upper = String(letter).toUpperCase();
      counts.set(upper, (counts.get(upper) ?? 0) + 1);
    }
  }
  let commonLetter = '';
  let commonCount = 0;
  for (const [letter, count] of counts) {
    if (count > commonCount || (count === commonCount && letter.localeCompare(commonLetter, 'pl') < 0)) {
      commonLetter = letter;
      commonCount = count;
    }
  }
  return { wordsCount: words.length, bestPlay, longestWord, categoryWords, commonLetter };
}

// ---- Tag toast -----------------------------------------------------

export function showTagToast(tag) {
  showToast(`Bonus: ${tag.label}`, 'var(--gold)', 2200);
}

// ---- Ekran gry: update po akcji ------------------------------------

export function updateGameAfterPlay() {
  updateGameHeader();
  renderTargetWord();
  renderHand();
  renderPlaysIndicator();
  renderActiveFigures();
  renderHandFigures();
  renderPlayedWords();
  updateWordPreview();
  renderGuessAvailability();
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
  const figIcon = icon(fig.icon, 20);

  card.innerHTML = `
    <div class="figure-card__icon">${figIcon}</div>
    <div class="figure-card__name">${fig.name}</div>
    <div class="figure-card__desc">${fig.description}</div>
    <div class="figure-card__cost" style="${!canAfford && !showSell ? 'color:var(--red)' : ''}">
      ${cost > 0 ? `${icon('droplet', 12)} ${cost}` : ''}
    </div>
    <div class="figure-card__rarity ${fig.rarity}">${
      fig.rarity === 'common' ? 'Pospolita' :
      fig.rarity === 'rare'   ? 'Rzadka'    : 'Legendarna'
    }</div>
    ${showSell ? `<button class="sell-btn">${icon('circle-dollar-sign', 13)} Sprzedaj (${fig.sellValue ?? 1})</button>` : ''}
  `;

  initIcons();
  return card;
}

// ---- Powrót z wyboru blinda na mapę --------------------------------

export function bindBlindSelectEvents() {
  const backBtn = document.getElementById('blind-back-btn');
  if (backBtn) {
    backBtn.onclick = () => returnToMap();
  }
}
