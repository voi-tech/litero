// src/game.js — rdzeń gry Litero (Balatro-inspired)

import { emitter } from './eventEmitter.js';
import categoriesData from '../data/categories.json';
import { buildHand, replenishHand } from './letters.js';
import { loadDictionary, isValidWord } from './dictionary.js';
import { scoreWord, calcInkReward } from './scoring.js';
import { applyFigureHooks, FIGURES, getRandomFigures, getFigureSellValue, setReplenishHand } from './figures.js';

// Podpięcie replenishHand pod figures.js (unikamy circular import)
setReplenishHand(replenishHand);

export const CATEGORIES = categoriesData.categories;

// ---- Stan gry -----------------------------------------------

export const gameState = {
  phase: 'start', // start | map | blind-select | game | summary | scriptorium | victory | defeat

  // Progres
  categoryIndex: 0,
  blindIndex: 0,          // 0=small 1=big 2=boss
  completedBlinds: [],    // [{ categoryId, blindId, skipped, score }]

  // Ekonomia
  ink: 3,

  // Aktualny blind
  currentBlind: null,
  currentCategory: null,
  runningScore: 0,
  playsLeft: 5,
  discardsLeft: 3,        // 3 per KATEGORIA (współdzielone przez 3 blindy)
  playsUsedThisBlind: 0,

  // Ręka
  hand: [],
  letterPool: [],
  selectedIndices: [],    // indeksy zaznaczonych liter w ręce

  // Odkryte litery docelowego słowa (Set indeksów)
  revealedLetters: new Set(),

  // Figury
  activeFigures: [],      // max 5 pasywnych (IDs)
  handFigures: [],        // jednorazowe (IDs)

  // Stan figur (reset per blind)
  _figureState: {},

  // Kombo: ile kolejnych słów z kategorii
  categoryStreak: 0,

  // Statystyki run
  totalScore: 0,
  wordsPlayedThisRun: [],
  highScore: 0,

  // Tagi (bonusy ze skipowania)
  pendingTags: [],

  // Oferta figur (ekran blind-select)
  _figureOffer: [],
};

// ---- Init ---------------------------------------------------

export function initGame() {
  loadDictionary();
  const hs = localStorage.getItem('litero_highscore');
  gameState.highScore = hs ? parseInt(hs, 10) : 0;
}

// ---- Start nowej gry ----------------------------------------

export function startGame() {
  const { hand, pool } = buildHand();

  gameState.phase = 'map';
  gameState.categoryIndex = 0;
  gameState.blindIndex = 0;
  gameState.completedBlinds = [];
  gameState.ink = 3;
  gameState.activeFigures = [];
  gameState.handFigures = [];
  gameState.totalScore = 0;
  gameState.wordsPlayedThisRun = [];
  gameState.pendingTags = [];
  gameState.hand = hand;
  gameState.letterPool = pool;

  emitter.emit('gameStarted', { state: gameState });
}

// ---- Wejście w kategorię ------------------------------------

export function enterCategory(categoryIndex) {
  gameState.categoryIndex = categoryIndex;
  gameState.blindIndex = 0;
  gameState.discardsLeft = 3;
  gameState.currentCategory = CATEGORIES[categoryIndex];
  gameState.phase = 'blind-select';
  gameState._figureOffer = getRandomFigures(3, gameState.activeFigures, anteTier());

  emitter.emit('categoryEntered', { state: gameState });
}

// ---- Próba pominięcia blinda --------------------------------

export function trySkipBlind(blindIndex, attempt) {
  const blind = CATEGORIES[gameState.categoryIndex].blinds[blindIndex];
  const correct = attempt.trim().toUpperCase() === blind.word.toUpperCase();

  if (correct) {
    // Pominięto — przyznaj tag
    const tag = randomTag();
    gameState.pendingTags.push(tag);
    applyTag(tag);
    gameState.completedBlinds.push({
      categoryId: gameState.currentCategory.id,
      blindId: blind.id,
      skipped: true,
      score: 0,
    });
    emitter.emit('blindSkipped', { blind, tag, state: gameState });
    // Przejdź do następnego blinda lub zakończ kategorię
    advanceAfterBlind(true);
  } else {
    // Niepoprawna próba — uruchom grę tego blinda
    startBlind(blindIndex);
  }
  return correct;
}

// ---- Start blinda -------------------------------------------

export function startBlind(blindIndex) {
  gameState.blindIndex = blindIndex;
  const blind = CATEGORIES[gameState.categoryIndex].blinds[blindIndex];
  gameState.currentBlind = blind;
  gameState.runningScore = 0;
  gameState.playsLeft = 5;
  gameState.playsUsedThisBlind = 0;
  gameState.selectedIndices = [];
  gameState.revealedLetters = new Set();
  gameState.categoryStreak = 0;
  gameState._figureState = {};

  // Hooki onBlindStart (hiperbola, litotes, inicjal, bezblednik)
  applyFigureHooks(gameState.activeFigures, 'onBlindStart', gameState);

  gameState.phase = 'game';
  emitter.emit('blindStarted', { blind, state: gameState });
}

// ---- Zaznaczanie/odznaczanie liter --------------------------

export function toggleLetter(index) {
  if (gameState.phase !== 'game') return;
  const sel = gameState.selectedIndices;
  const pos = sel.indexOf(index);
  if (pos === -1) {
    sel.push(index);
  } else {
    sel.splice(pos, 1);
  }
  emitter.emit('selectionChanged', { selectedIndices: [...gameState.selectedIndices] });
}

// ---- Zagranie słowa -----------------------------------------

export function playWord() {
  if (gameState.phase !== 'game') return;
  const { selectedIndices, hand, currentBlind, currentCategory, activeFigures } = gameState;

  if (selectedIndices.length < 2) {
    emitter.emit('wordRejected', { reason: 'too_short' });
    return;
  }

  const wordLetters = selectedIndices.map(i => hand[i]);
  const word = wordLetters.join('');

  // Walidacja słownikowa
  if (!isValidWord(word)) {
    // Bezbłędnik: pierwsze niepoprawne słowo nie kosztuje zagrania
    if (
      activeFigures.includes('bezblednik') &&
      !gameState._figureState.bezblednikUsed
    ) {
      gameState._figureState.bezblednikUsed = true;
      emitter.emit('wordRejected', { reason: 'invalid', bezblednik: true });
      gameState.selectedIndices = [];
      emitter.emit('selectionChanged', { selectedIndices: [] });
      return;
    }
    // Normalne odrzucenie (nie kosztuje zagrania)
    emitter.emit('wordRejected', { reason: 'invalid' });
    gameState.selectedIndices = [];
    emitter.emit('selectionChanged', { selectedIndices: [] });
    return;
  }

  // Oblicz wynik
  const komboBonus =
    activeFigures.includes('kombo') && gameState.categoryStreak >= 2;
  const result = scoreWord(
    word,
    currentCategory.id,
    currentCategory.words,
    activeFigures,
    {
      emfazaActive: gameState._figureState.emfazaActive,
      komboBonus,
    }
  );

  // Reset emfazy
  gameState._figureState.emfazaActive = false;

  // Aktualizuj kombo kategorialne
  if (result.categoryBonus > 0) {
    gameState.categoryStreak += 1;
  } else {
    gameState.categoryStreak = 0;
  }

  gameState.runningScore += result.score;
  gameState.playsLeft -= 1;
  gameState.playsUsedThisBlind += 1;

  // Skryba: +2 atramenty za słowo
  if (activeFigures.includes('skryba')) {
    gameState.ink += 2;
  }

  // Uzupełnij rękę
  const { hand: newHand, pool: newPool } = replenishHand(
    hand, selectedIndices, gameState.letterPool
  );
  gameState.hand = newHand;
  gameState.letterPool = newPool;
  gameState.selectedIndices = [];

  // Zapisz słowo do historii
  gameState.wordsPlayedThisRun.push({ word, score: result.score, categoryBonus: result.categoryBonus > 0 });

  // Odkryj litery proporcjonalnie
  updateRevealedLetters();

  emitter.emit('wordPlayed', { word, result, state: gameState });

  // Sprawdź koniec blinda
  if (gameState.runningScore >= currentBlind.targetScore) {
    endBlind(true);
  } else if (gameState.playsLeft <= 0) {
    endBlind(false);
  }
}

// Proporcjonalne odkrywanie liter docelowego słowa
function updateRevealedLetters() {
  const word = gameState.currentBlind?.word ?? '';
  const progress = Math.min(1, gameState.runningScore / gameState.currentBlind.targetScore);
  const toReveal = Math.floor(progress * word.length);
  for (let i = 0; i < toReveal; i++) {
    gameState.revealedLetters.add(i);
  }
}

// ---- Odrzucenie liter ---------------------------------------

export function discardLetters() {
  if (gameState.phase !== 'game') return;
  if (gameState.discardsLeft <= 0) {
    emitter.emit('discardFailed', { reason: 'no_discards' });
    return;
  }
  if (gameState.selectedIndices.length === 0) {
    emitter.emit('discardFailed', { reason: 'nothing_selected' });
    return;
  }

  const { hand: newHand, pool: newPool } = replenishHand(
    gameState.hand,
    gameState.selectedIndices,
    gameState.letterPool
  );
  gameState.hand = newHand;
  gameState.letterPool = newPool;
  gameState.selectedIndices = [];
  gameState.discardsLeft -= 1;

  emitter.emit('lettersDiscarded', { state: gameState });
  emitter.emit('selectionChanged', { selectedIndices: [] });
}

// ---- Użycie figury jednorazowej -----------------------------

export function useOneshotFigure(figureId) {
  if (gameState.phase !== 'game') return;
  const idx = gameState.handFigures.indexOf(figureId);
  if (idx === -1) return;

  const fig = FIGURES[figureId];
  if (!fig?.hooks?.onUse) return;

  const result = fig.hooks.onUse(gameState);
  gameState.handFigures.splice(idx, 1);

  emitter.emit('oneshotUsed', { figureId, result, state: gameState });
}

// ---- Koniec blinda ------------------------------------------

function endBlind(won) {
  gameState.phase = 'summary';

  // Atrament za wygranie
  let inkReward = 0;
  if (won) {
    inkReward = calcInkReward(gameState.playsUsedThisBlind, 5, true);
    // Hook perfekcjonista
    inkReward = applyFigureHooks(
      gameState.activeFigures,
      'onBlindEnd',
      { ...gameState, won },
      inkReward
    );
    gameState.ink += inkReward;
    gameState.totalScore += gameState.runningScore;

    gameState.completedBlinds.push({
      categoryId: gameState.currentCategory.id,
      blindId: gameState.currentBlind.id,
      skipped: false,
      score: gameState.runningScore,
    });
  }

  gameState._summaryWon = won;
  emitter.emit('blindEnded', { won, inkReward, score: gameState.runningScore, state: gameState });

  // Dalszy flow obsługuje btn-summary-continue w main.js
}

// Po zamknięciu Scriptorium
export function closeScriptorium() {
  advanceAfterBlind(false);
}

function advanceAfterBlind(skipped) {
  const category = CATEGORIES[gameState.categoryIndex];
  const nextBlindIndex = gameState.blindIndex + 1;

  if (nextBlindIndex < category.blinds.length) {
    // Następny blind w tej kategorii
    gameState.blindIndex = nextBlindIndex;
    gameState.phase = 'blind-select';
    gameState._figureOffer = getRandomFigures(3, gameState.activeFigures, anteTier());
    emitter.emit('nextBlind', { state: gameState });
  } else {
    // Kategoria ukończona
    const nextCategoryIndex = gameState.categoryIndex + 1;
    if (nextCategoryIndex < CATEGORIES.length) {
      gameState.categoryIndex = nextCategoryIndex;
      gameState.blindIndex = 0;
      gameState.discardsLeft = 3;
      gameState.phase = 'map';
      emitter.emit('categoryCompleted', { state: gameState });
    } else {
      endGame(true);
    }
  }
}

// ---- Koniec gry ---------------------------------------------

export function endGame(victory) {
  gameState.phase = victory ? 'victory' : 'defeat';

  if (gameState.totalScore > gameState.highScore) {
    gameState.highScore = gameState.totalScore;
    localStorage.setItem('litero_highscore', String(gameState.totalScore));
  }

  emitter.emit('gameOver', { victory, state: gameState });
}

// ---- Figury: dodawanie/usuwanie (używane przez Scriptorium) --

export function addFigure(figureId) {
  const fig = FIGURES[figureId];
  if (!fig) return false;

  if (fig.type === 'passive') {
    if (gameState.activeFigures.length >= 5) return false;
    if (gameState.activeFigures.includes(figureId)) return false;
    gameState.activeFigures.push(figureId);
  } else {
    gameState.handFigures.push(figureId);
  }
  return true;
}

export function removeFigure(figureId) {
  const idx = gameState.activeFigures.indexOf(figureId);
  if (idx !== -1) {
    gameState.activeFigures.splice(idx, 1);
    gameState.ink += getFigureSellValue(figureId);
    return true;
  }
  return false;
}

// ---- Wybór figury przed blindem -----------------------------

export function pickFigure(figureId) {
  const success = addFigure(figureId);
  if (success) {
    emitter.emit('figurePicked', { figureId, state: gameState });
  }
  return success;
}

export function skipFigurePick() {
  gameState.ink += 2;
  emitter.emit('figurePickSkipped', { state: gameState });
}

// ---- Helpers ------------------------------------------------

function anteTier() {
  return Math.floor(gameState.categoryIndex / 2) + 1;
}

function randomTag() {
  const tags = [
    { id: 'ink3',     label: '+3 atrament',          apply: s => { s.ink += 3; } },
    { id: 'play1',    label: '+1 zagranie (next)',    apply: s => { s._pendingExtraPlay = (s._pendingExtraPlay||0)+1; } },
    { id: 'discard1', label: '+1 odrzucenie',         apply: s => { s.discardsLeft += 1; } },
    { id: 'mult15',   label: 'Mnożnik startuje od ×1.5 (next)', apply: s => { s._pendingMult15 = true; } },
  ];
  return tags[Math.floor(Math.random() * tags.length)];
}

function applyTag(tag) {
  tag.apply(gameState);
}
