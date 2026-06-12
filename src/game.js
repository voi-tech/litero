// src/game.js — rdzeń gry Litero (Balatro-inspired)

import { emitter } from './eventEmitter.js';
import categoriesData from '../data/categories.json';
import { buildHand, shufflePool, buildPool } from './letters.js';
import { loadDictionary, isValidWord } from './dictionary.js';
import { scorePlaySegments, calcInkReward, LETTER_VALUES } from './scoring.js';
import { applyFigureHooks, FIGURES, getFigureSellValue } from './figures.js';
import { applySaveToState } from './persistence.js';
import { hashSeed, localDateString, nextRandom } from './rng.js';

export const CATEGORIES = categoriesData.categories;

// ---- Stałe rozgrywki ----------------------------------------

export const HAND_SIZE = 8;
export const BASE_PLAYS = 5;
export const BASE_DISCARDS = 3;
export const MAX_PASSIVE_FIGURES = 5;
export const MAX_ONESHOT_FIGURES = 3;

// Cele blindów rosną wraz z liczbą ukończonych kategorii
export const BLIND_TARGETS = {
  small: { base: 120, step: 80, lateStep: 50 },
  big:   { base: 240, step: 160, lateStep: 100 },
  boss:  { base: 420, step: 270, lateStep: 170 },
};

export const DIFFICULTIES = {
  szkolny: {
    id: 'szkolny',
    label: 'Szkolny',
    targetMultiplier: 0.7,
    basePlays: 6,
  },
  akademicki: {
    id: 'akademicki',
    label: 'Akademicki',
    targetMultiplier: 1,
    basePlays: BASE_PLAYS,
  },
};

const HIGHSCORE_KEY = 'litero_highscore';
const DAILY_RESULT_PREFIX = 'litero_daily_result_v1:';

// ---- Stan gry -----------------------------------------------

export const gameState = {
  phase: 'start', // start | map | blind-select | game | summary | scriptorium | victory | defeat

  // Progres
  difficulty: 'akademicki',
  mode: 'normal',
  dailyDate: null,
  runSeed: null,
  _rngState: 1,
  categoryIndex: 0,
  blindIndex: 0,          // 0=small 1=big 2=boss
  completedBlinds: [],    // [{ categoryId, blindId, skipped, score }]

  // Ekonomia
  ink: 0,

  // Aktualny blind
  currentBlind: null,
  currentCategory: null,
  runningScore: 0,
  playsLeft: BASE_PLAYS,
  discardsLeft: BASE_DISCARDS,
  playsUsedThisBlind: 0,
  maxPlaysThisBlind: BASE_PLAYS,
  guessAttemptedThisBlind: false,

  // Ręka
  hand: [],
  letterPool: [],
  discardPile: [],
  selectedIndices: [],

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
  wordsPlayedThisBlind: [],  // reset per blind
  _playOrder: 0,
  highScore: 0,

  // Tagi (bonusy ze skipowania) — konsumowane na starcie kolejnego blinda
  pendingTags: [],

  // Potasowana kolejność kategorii (nowa per rozgrywka)
  shuffledCategories: [],

  // Cache wylosowanych haseł i tagów per kategoria
  // (powrót na mapę nie reroluje haseł)
  _categoryBlindCache: {},

  // Aktywne słowa blindów bieżącej kategorii
  _activeBlindWords: [],

  // Pre-generowane tagi skip (jedna per blind)
  _pendingSkipTags: [],

  // Bonusy pasywne — jeden za każdego pokonanego bossa
  passiveBonuses: [],
  bossesDefeated: 0,

  // Skryptorium
  scriptoriumOffer: [],
  _scriptoriumBlindKey: null,
  lastInterestReward: 0,
};

// ---- Init ---------------------------------------------------

export function initGame() {
  const hs = localStorage.getItem(HIGHSCORE_KEY);
  gameState.highScore = hs ? parseInt(hs, 10) : 0;
  return loadDictionary();
}

// ---- Wznowienie zapisanego runa ------------------------------

export function restoreRun(saved) {
  applySaveToState(saved, gameState);
  emitter.emit('runRestored', { state: gameState });
}

// ---- Start nowej gry ----------------------------------------

export function startGame(options = {}) {
  const difficulty = DIFFICULTIES[options.difficulty]?.id ?? 'akademicki';
  const mode = options.mode === 'daily' ? 'daily' : 'normal';
  const dailyDate = mode === 'daily' ? (options.dailyDate ?? localDateString()) : null;
  const runSeed = mode === 'daily'
    ? `daily:${dailyDate}:${difficulty}`
    : `normal:${Date.now()}:${Math.random()}`;
  gameState._rngState = hashSeed(runSeed);
  gameState.mode = mode;
  gameState.dailyDate = dailyDate;
  gameState.runSeed = runSeed;

  const { hand, pool } = buildHand(randomFloat);

  gameState.phase = 'map';
  gameState.difficulty = difficulty;
  gameState.categoryIndex = 0;
  gameState.blindIndex = 0;
  gameState.completedBlinds = [];
  gameState.ink = 0;
  gameState.activeFigures = [];
  gameState.handFigures = [];
  gameState.totalScore = 0;
  gameState.wordsPlayedThisRun = [];
  gameState._playOrder = 0;
  gameState.pendingTags = [];
  gameState.hand = hand;
  gameState.letterPool = pool;
  gameState.discardPile = [];
  gameState.shuffledCategories = shuffleArray(CATEGORIES);
  gameState._categoryBlindCache = {};
  gameState._activeBlindWords = [];
  gameState._pendingSkipTags = [];
  gameState.passiveBonuses = [];
  gameState.bossesDefeated = 0;
  gameState.scriptoriumOffer = [];
  gameState._scriptoriumBlindKey = null;
  gameState.lastInterestReward = 0;

  emitter.emit('gameStarted', { state: gameState });
}

// ---- Postęp kategorii ---------------------------------------

export function isCategoryCompleted(category) {
  const doneIds = completedBlindIds(category.id);
  return category.blinds.every(b => doneIds.has(b.id));
}

export function allCategoriesCompleted() {
  return gameState.shuffledCategories.every(isCategoryCompleted);
}

function completedBlindIds(categoryId) {
  return new Set(
    gameState.completedBlinds
      .filter(b => b.categoryId === categoryId)
      .map(b => b.blindId)
  );
}

function completedCategoriesCount() {
  return gameState.shuffledCategories.filter(isCategoryCompleted).length;
}

// ---- Wejście w kategorię ------------------------------------

export function enterCategory(categoryIndex) {
  const category = gameState.shuffledCategories[categoryIndex];
  if (!category || isCategoryCompleted(category)) return;

  gameState.categoryIndex = categoryIndex;
  gameState.currentCategory = category;

  // Hasła i cele losowane tylko przy pierwszym wejściu —
  // powrót na mapę i ponowne wejście nie reroluje blindów
  let cached = gameState._categoryBlindCache[category.id];
  if (!cached) {
    const progress = completedCategoriesCount();
    cached = {
      blindWords: category.blinds.map(blind => {
        const pick = blind.pool[Math.floor(randomFloat() * blind.pool.length)];
        const t = BLIND_TARGETS[blind.type] ?? BLIND_TARGETS.small;
        return {
          ...blind,
          word: pick.word,
          definition: pick.definition,
          targetScore: getTargetScore(t, progress),
        };
      }),
      skipTags: category.blinds.map(() => randomTag()),
    };
    gameState._categoryBlindCache[category.id] = cached;
  }
  gameState._activeBlindWords = cached.blindWords;
  gameState._pendingSkipTags = cached.skipTags;

  // Wznów od pierwszego nieukończonego blinda
  const doneIds = completedBlindIds(category.id);
  const firstOpen = category.blinds.findIndex(b => !doneIds.has(b.id));
  gameState.blindIndex = firstOpen === -1 ? 0 : firstOpen;

  gameState.phase = 'blind-select';
  emitter.emit('categoryEntered', { state: gameState });
}

// ---- Powrót na mapę -----------------------------------------

export function returnToMap() {
  if (gameState.phase !== 'blind-select') return;
  gameState.phase = 'map';
  emitter.emit('returnedToMap', { state: gameState });
}

// ---- Próba pominięcia blinda --------------------------------

export function trySkipBlind(blindIndex, attempt) {
  const blind = gameState._activeBlindWords[blindIndex];
  if (!blind || blind.type === 'boss') return false; // Traktat nie może być pominięty

  const correct = attempt.trim().toUpperCase() === blind.word.toUpperCase();

  if (correct) {
    const tag = gameState._pendingSkipTags[blindIndex];
    applyTag(tag);
    gameState.completedBlinds.push({
      categoryId: gameState.currentCategory.id,
      blindId: blind.id,
      skipped: true,
      score: 0,
    });
    emitter.emit('blindSkipped', { blind, tag, state: gameState });
    advanceAfterBlind();
  } else {
    startBlind(blindIndex);
  }
  return correct;
}

// ---- Start blinda -------------------------------------------

export function startBlind(blindIndex) {
  gameState.blindIndex = blindIndex;
  const blind = gameState._activeBlindWords[blindIndex];
  gameState.currentBlind = blind;
  gameState.runningScore = 0;
  gameState.playsLeft = DIFFICULTIES[gameState.difficulty]?.basePlays ?? BASE_PLAYS;
  gameState.discardsLeft = BASE_DISCARDS;
  gameState.playsUsedThisBlind = 0;
  gameState.selectedIndices = [];
  gameState.guessAttemptedThisBlind = false;
  gameState.revealedLetters = new Set();
  gameState.categoryStreak = 0;
  gameState._figureState = {};
  gameState.wordsPlayedThisBlind = [];

  // Hooki onBlindStart (litotes, bezblednik)
  applyFigureHooks(gameState.activeFigures, 'onBlindStart', gameState);

  // Bonusy pasywne: pergamin (+1 odrzucenie), manuskrypt (+1 zagranie)
  if (gameState.passiveBonuses.includes('pergamin')) gameState.discardsLeft += 1;
  if (gameState.passiveBonuses.includes('manuskrypt')) gameState.playsLeft += 1;

  // Konsumuj tagi za pominięte blindy
  for (const tag of gameState.pendingTags) {
    if (tag.id === 'play1') gameState.playsLeft += 1;
    if (tag.id === 'discard1') gameState.discardsLeft += 1;
    if (tag.id === 'mult15') gameState._figureState.mult15 = true;
  }
  gameState.pendingTags = [];

  gameState.maxPlaysThisBlind = gameState.playsLeft;

  sortHandInPlace();
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

export function clearSelection() {
  if (gameState.phase !== 'game') return;
  if (gameState.selectedIndices.length === 0) return;
  gameState.selectedIndices = [];
  emitter.emit('selectionChanged', { selectedIndices: [] });
}

export function removeLastSelectedLetter() {
  if (gameState.phase !== 'game') return;
  if (gameState.selectedIndices.length === 0) return;
  gameState.selectedIndices.pop();
  emitter.emit('selectionChanged', { selectedIndices: [...gameState.selectedIndices] });
}

export function selectFirstMatchingLetter(letter) {
  if (gameState.phase !== 'game') return false;
  const normalized = String(letter ?? '').trim().toUpperCase();
  if (!normalized) return false;
  const idx = gameState.hand.findIndex((item, index) =>
    item.toUpperCase() === normalized && !gameState.selectedIndices.includes(index)
  );
  if (idx === -1) return false;
  gameState.selectedIndices.push(idx);
  emitter.emit('selectionChanged', { selectedIndices: [...gameState.selectedIndices] });
  return true;
}

// ---- Sortowanie ręki ----------------------------------------

function sortHandInPlace() {
  gameState.hand = [...gameState.hand].sort((a, b) => a.localeCompare(b, 'pl'));
}

// ---- Dobieranie ze stosem odrzuconym ------------------------

export function drawFromPool(count) {
  const drawn = [];
  while (drawn.length < count) {
    if (gameState.letterPool.length === 0) {
      if (gameState.discardPile.length > 0) {
        gameState.letterPool = shufflePool(gameState.discardPile, randomFloat);
        gameState.discardPile = [];
      } else {
        gameState.letterPool = shufflePool(buildPool(), randomFloat);
      }
    }
    drawn.push(gameState.letterPool.shift());
  }
  return drawn;
}

// Usuń zagrane/odrzucone litery z ręki i dobierz do pełnej ręki
function removeFromHandAndRefill(indices, letters) {
  const newHand = gameState.hand.filter((_, i) => !indices.includes(i));
  gameState.discardPile.push(...letters);
  const refillCount = Math.max(0, HAND_SIZE - newHand.length);
  const drawn = drawFromPool(refillCount);
  gameState.hand = [...newHand, ...drawn];
  gameState.selectedIndices = [];
  sortHandInPlace();
}

// ---- Greedy word sequence detection -------------------------

export function findWordSequence(letters) {
  const segments = [];
  let i = 0;
  while (i < letters.length) {
    let found = false;
    for (let len = letters.length - i; len >= 2; len--) {
      const candidate = letters.slice(i, i + len).join('');
      if (isValidWord(candidate)) {
        segments.push({ word: candidate, start: i, end: i + len });
        i += len;
        found = true;
        break;
      }
    }
    if (!found) {
      segments.push({ word: null, letter: letters[i], idx: i });
      i++;
    }
  }
  return segments;
}

// Kontekst punktacji — wspólny dla zagrania i podglądu w UI
export function buildScoringContext() {
  return {
    categoryWords: gameState.currentCategory?.words ?? [],
    activeFigures: gameState.activeFigures,
    passiveBonuses: gameState.passiveBonuses,
    figureState: gameState._figureState,
    categoryStreak: gameState.categoryStreak,
  };
}

export function getTargetScore(targetConfig, completedCategories) {
  const earlyProgress = Math.min(5, completedCategories);
  const lateProgress = Math.max(0, completedCategories - 5);
  const raw = targetConfig.base + earlyProgress * targetConfig.step + lateProgress * targetConfig.lateStep;
  const multiplier = DIFFICULTIES[gameState.difficulty]?.targetMultiplier ?? 1;
  return Math.max(1, Math.round(raw * multiplier));
}

// ---- Zagranie słowa -----------------------------------------

export function playWord() {
  if (gameState.phase !== 'game') return;
  const { selectedIndices, hand, currentBlind, currentCategory, activeFigures } = gameState;

  if (selectedIndices.length < 1) {
    emitter.emit('playFailed', { reason: 'nothing_selected' });
    return;
  }

  const playedLetters = selectedIndices.map(i => hand[i]);
  const segments = findWordSequence(playedLetters);
  const validSegments = segments.filter(s => s.word);
  const extraSegments = segments.filter(s => !s.word);

  // Bezbłędnik: pierwsze zagranie bez żadnego słowa nie kosztuje zagrania
  if (
    validSegments.length === 0 &&
    activeFigures.includes('bezblednik') &&
    !gameState._figureState.bezblednikUsed
  ) {
    gameState._figureState.bezblednikUsed = true;
    gameState.selectedIndices = [];
    emitter.emit('wordRejected', { reason: 'invalid', bezblednik: true });
    emitter.emit('selectionChanged', { selectedIndices: [] });
    return;
  }

  const result = scorePlaySegments(validSegments, extraSegments, buildScoringContext());

  // Efekty jednorazowe zużywają się przy zagraniu
  gameState._figureState.emfazaActive = false;
  gameState._figureState.synekdochaActive = false;

  gameState.categoryStreak = result.categoryBonus > 0 ? gameState.categoryStreak + 1 : 0;

  gameState.runningScore += result.score;
  gameState.playsLeft -= 1;
  gameState.playsUsedThisBlind += 1;
  if (activeFigures.includes('skryba')) gameState.ink += 2;

  removeFromHandAndRefill(selectedIndices, playedLetters);

  const categoryMatches = [];
  if (validSegments.length > 0) {
    for (const seg of validSegments) {
      const isCatWord = currentCategory.words.some(w => w.toLowerCase() === seg.word.toLowerCase());
      if (isCatWord) categoryMatches.push(seg.word);
      gameState.wordsPlayedThisBlind.push(seg.word);
    }
  }
  gameState.wordsPlayedThisRun.push({
    playedText: validSegments.length > 0 ? validSegments.map(s => s.word).join(' + ') : playedLetters.join(''),
    words: validSegments.map(s => s.word),
    score: result.score,
    letters: playedLetters,
    categoryMatches,
    categoryBonus: categoryMatches.length > 0,
    order: ++gameState._playOrder,
    timestamp: Date.now(),
  });
  updateRevealedLetters();

  const displayWord = validSegments.length > 0
    ? validSegments.map(s => s.word).join(' + ')
    : playedLetters.join('');
  emitter.emit('wordPlayed', { word: displayWord, result, state: gameState });

  if (gameState.runningScore >= currentBlind.targetScore) endBlind(true);
  else if (gameState.playsLeft <= 0) endBlind(false);
}

// Proporcjonalne odkrywanie liter docelowego słowa
function updateRevealedLetters() {
  const word = gameState.currentBlind?.word ?? '';
  if (!word) return;
  const progress = Math.min(1, gameState.runningScore / gameState.currentBlind.targetScore);
  const toReveal = Math.floor(progress * word.length);
  for (let i = 0; i < toReveal; i++) {
    gameState.revealedLetters.add(i);
  }
}

// ---- Odgadywanie hasła w trakcie rundy ----------------------

export function guessBlindWord(attempt) {
  if (gameState.phase !== 'game') return false;
  if (gameState.guessAttemptedThisBlind) {
    emitter.emit('guessRejected', { reason: 'already_attempted', state: gameState });
    return false;
  }
  const correct = attempt.trim().toUpperCase() === gameState.currentBlind.word.toUpperCase();
  if (correct) {
    endBlind(true, { wonByGuess: true });
  } else {
    gameState.guessAttemptedThisBlind = true;
    emitter.emit('guessRejected', { reason: 'incorrect', state: gameState });
  }
  return correct;
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

  const discarded = gameState.selectedIndices.map(i => gameState.hand[i]);
  removeFromHandAndRefill(gameState.selectedIndices, discarded);
  gameState.discardsLeft -= 1;
  if (gameState.activeFigures.includes('apostrofa')) {
    gameState._figureState.apostrofaMult = (gameState._figureState.apostrofaMult ?? 0) + 1;
  }

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

function endBlind(won, opts = {}) {
  gameState.phase = 'summary';

  // Atrament za wygranie
  let inkReward = 0;
  if (won) {
    inkReward = calcInkReward(gameState.playsUsedThisBlind, gameState.maxPlaysThisBlind, true);
    if (gameState.passiveBonuses.includes('kalamarz')) inkReward += 2;

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

    if (gameState.currentBlind.type === 'boss') {
      gameState.bossesDefeated += 1;
    }
  }

  gameState._summaryWon = won;
  gameState._wonByGuess = opts.wonByGuess || false;
  gameState._lastInkReward = inkReward; // do odtworzenia ekranu podsumowania po wznowieniu
  emitter.emit('blindEnded', { won, inkReward, score: gameState.runningScore, wonByGuess: opts.wonByGuess, state: gameState });
}

// Po zamknięciu Skryptorium
export function closeScriptorium() {
  advanceAfterBlind();
}

function advanceAfterBlind() {
  const category = gameState.currentCategory;
  const doneIds = completedBlindIds(category.id);
  const nextOpen = category.blinds.findIndex(b => !doneIds.has(b.id));

  if (nextOpen !== -1) {
    gameState.blindIndex = nextOpen;
    gameState.phase = 'blind-select';
    emitter.emit('nextBlind', { state: gameState });
  } else if (allCategoriesCompleted()) {
    endGame(true);
  } else {
    gameState.phase = 'map';
    emitter.emit('categoryCompleted', { state: gameState });
  }
}

// ---- Koniec gry ---------------------------------------------

export function endGame(victory) {
  gameState.phase = victory ? 'victory' : 'defeat';

  if (gameState.totalScore > gameState.highScore) {
    gameState.highScore = gameState.totalScore;
    localStorage.setItem(HIGHSCORE_KEY, String(gameState.totalScore));
  }
  if (gameState.mode === 'daily' && gameState.dailyDate) {
    saveDailyResult(victory);
  }

  emitter.emit('gameOver', { victory, state: gameState });
}

// ---- Figury: dodawanie/usuwanie (używane przez Skryptorium) --

export function addFigure(figureId) {
  const fig = FIGURES[figureId];
  if (!fig) return false;

  if (fig.type === 'passive') {
    if (gameState.activeFigures.length >= MAX_PASSIVE_FIGURES) return false;
    if (gameState.activeFigures.includes(figureId)) return false;
    gameState.activeFigures.push(figureId);
  } else {
    if (gameState.handFigures.length >= MAX_ONESHOT_FIGURES) return false;
    gameState.handFigures.push(figureId);
  }
  return true;
}

export function removeFigure(figureId) {
  // Sprawdź pasywne
  const pIdx = gameState.activeFigures.indexOf(figureId);
  if (pIdx !== -1) {
    gameState.activeFigures.splice(pIdx, 1);
    gameState.ink += getFigureSellValue(figureId);
    return true;
  }
  // Sprawdź jednorazowe
  const hIdx = gameState.handFigures.indexOf(figureId);
  if (hIdx !== -1) {
    gameState.handFigures.splice(hIdx, 1);
    gameState.ink += getFigureSellValue(figureId);
    return true;
  }
  return false;
}

// ---- Bonusy pasywne -----------------------------------------

export function pickPassiveBonus(bonusId) {
  if (gameState.passiveBonuses.includes(bonusId)) return false;
  gameState.passiveBonuses.push(bonusId);
  emitter.emit('passiveBonusPicked', { bonusId, state: gameState });
  return true;
}

// ---- Helpers ------------------------------------------------

export function randomFloat() {
  const next = nextRandom(gameState._rngState);
  gameState._rngState = next.state;
  return next.value;
}

function shuffleArray(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(randomFloat() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Tagi za pominięcie blinda. 'ink3' działa natychmiast,
// pozostałe trafiają do pendingTags i są konsumowane w startBlind.
const SKIP_TAGS = [
  { id: 'ink3',     label: '+3 atrament' },
  { id: 'play1',    label: '+1 zagranie (następny blind)' },
  { id: 'discard1', label: '+1 odrzucenie (następny blind)' },
  { id: 'mult15',   label: 'Mnożnik od ×1.5 (następny blind)' },
];

function randomTag() {
  return SKIP_TAGS[Math.floor(randomFloat() * SKIP_TAGS.length)];
}

function applyTag(tag) {
  if (tag.id === 'ink3') {
    gameState.ink += 3;
  } else {
    gameState.pendingTags.push(tag);
  }
}

function saveDailyResult(victory) {
  const key = `${DAILY_RESULT_PREFIX}${gameState.dailyDate}`;
  const completedCategories = gameState.shuffledCategories.filter(isCategoryCompleted).length;
  const result = {
    date: gameState.dailyDate,
    difficulty: gameState.difficulty,
    victory,
    score: gameState.totalScore,
    completedCategories,
    completedBlinds: gameState.completedBlinds.length,
  };
  try {
    const previous = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!previous || result.score > previous.score) {
      localStorage.setItem(key, JSON.stringify(result));
    }
  } catch {
    localStorage.setItem(key, JSON.stringify(result));
  }
}

export function buildDailyShareText() {
  const totalCategories = gameState.shuffledCategories.length || CATEGORIES.length;
  const completedCategories = gameState.shuffledCategories.filter(isCategoryCompleted).length;
  const marks = gameState.shuffledCategories
    .map(category => isCategoryCompleted(category) ? '🟩' : '⬛')
    .join('');
  const difficulty = DIFFICULTIES[gameState.difficulty]?.label ?? 'Akademicki';
  return [
    `Litero Daily ${gameState.dailyDate ?? localDateString()}`,
    difficulty,
    `Wynik: ${gameState.totalScore.toLocaleString('pl')}`,
    `Kategorie: ${completedCategories}/${totalCategories}`,
    marks,
  ].join('\n');
}
