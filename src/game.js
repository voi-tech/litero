// src/game.js — rdzeń gry Litero (Balatro-inspired)

import { emitter } from './eventEmitter.js';
import categoriesData from '../data/categories.json';
import { buildHand, replenishHand, drawLetters, shufflePool, buildPool } from './letters.js';
import { loadDictionary, isValidWord } from './dictionary.js';
import { scoreWord, calcInkReward, LETTER_VALUES, getTier, WORD_TIERS } from './scoring.js';
import { applyFigureHooks, FIGURES, getFigureSellValue, setReplenishHand } from './figures.js';

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
  ink: 0,

  // Aktualny blind
  currentBlind: null,
  currentCategory: null,
  runningScore: 0,
  playsLeft: 5,
  discardsLeft: 3,
  playsUsedThisBlind: 0,

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
  highScore: 0,

  // Tagi (bonusy ze skipowania)
  pendingTags: [],

  // Potasowana kolejność kategorii (nowa per rozgrywka)
  shuffledCategories: [],

  // Aktywne słowa blindów (losowane z pool przy enterCategory)
  _activeBlindWords: [],

  // Pre-generowane tagi skip (jedna per blind, losowane przy enterCategory)
  _pendingSkipTags: [],

  // Bonusy pasywne
  passiveBonuses: [],
  hasDefeatedBoss: false,
  passiveBonusTaken: false,
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
  gameState.ink = 0;
  gameState.activeFigures = [];
  gameState.handFigures = [];
  gameState.totalScore = 0;
  gameState.wordsPlayedThisRun = [];
  gameState.pendingTags = [];
  gameState.hand = hand;
  gameState.letterPool = pool;
  gameState.discardPile = [];
  // Tasuj kategorie i przypisz progresywne cele (wzrost przez całą grę)
  const shuffled = [...CATEGORIES].sort(() => Math.random() - 0.5);
  gameState.shuffledCategories = shuffled.map((cat, i) => ({
    ...cat,
    blinds: cat.blinds.map(b => ({
      ...b,
      targetScore:
        b.type === 'small' ? 120 + i * 80  :
        b.type === 'big'   ? 240 + i * 160 :
                             420 + i * 270,
    })),
  }));
  gameState.passiveBonuses = [];
  gameState.hasDefeatedBoss = false;
  gameState.passiveBonusTaken = false;

  emitter.emit('gameStarted', { state: gameState });
}

// ---- Wejście w kategorię ------------------------------------

export function enterCategory(categoryIndex) {
  gameState.categoryIndex = categoryIndex;
  gameState.blindIndex = 0;
  gameState.currentCategory = gameState.shuffledCategories[categoryIndex];
  gameState.phase = 'blind-select';

  // Losuj słowa blindów z puli
  gameState._activeBlindWords = gameState.currentCategory.blinds.map(blind => {
    const pick = blind.pool[Math.floor(Math.random() * blind.pool.length)];
    return { ...blind, word: pick.word, definition: pick.definition };
  });

  // Pre-generuj tagi za skip (jeden na blind)
  gameState._pendingSkipTags = gameState.currentCategory.blinds.map(() => randomTag());

  emitter.emit('categoryEntered', { state: gameState });
}

// ---- Próba pominięcia blinda --------------------------------

export function trySkipBlind(blindIndex, attempt) {
  const blind = gameState._activeBlindWords[blindIndex];
  if (blind.type === 'boss') return false; // Traktat nie może być pominięty

  const correct = attempt.trim().toUpperCase() === blind.word.toUpperCase();

  if (correct) {
    const tag = gameState._pendingSkipTags[blindIndex];
    gameState.pendingTags.push(tag);
    applyTag(tag);
    gameState.completedBlinds.push({
      categoryId: gameState.currentCategory.id,
      blindId: blind.id,
      skipped: true,
      score: 0,
    });
    emitter.emit('blindSkipped', { blind, tag, state: gameState });
    advanceAfterBlind(true);
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
  gameState.playsLeft = 5;
  gameState.discardsLeft = 3;
  gameState.playsUsedThisBlind = 0;
  gameState.selectedIndices = [];
  gameState.revealedLetters = new Set();
  gameState.categoryStreak = 0;
  gameState._figureState = {};
  gameState.wordsPlayedThisBlind = [];

  // Hooki onBlindStart (hiperbola, litotes, bezblednik)
  applyFigureHooks(gameState.activeFigures, 'onBlindStart', gameState);

  // Bonusy pasywne: pergamin (+1 odrzucenie), manuskrypt (+1 zagranie)
  if (gameState.passiveBonuses.includes('pergamin')) gameState.discardsLeft += 1;
  if (gameState.passiveBonuses.includes('manuskrypt')) gameState.playsLeft += 1;

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

// ---- Tłumaczenie sortowania liter ------------------------------

function sortHandInPlace() {
  gameState.hand = [...gameState.hand].sort((a, b) => a.localeCompare(b, 'pl'));
}

// ---- Dobieranie ze stosem odrzuconym ------------------------

export function drawFromPool(count) {
  const drawn = [];
  while (drawn.length < count) {
    if (gameState.letterPool.length === 0) {
      if (gameState.discardPile && gameState.discardPile.length > 0) {
        gameState.letterPool = shufflePool(gameState.discardPile);
        gameState.discardPile = [];
      } else {
        gameState.letterPool = shufflePool(buildPool());
      }
    }
    drawn.push(gameState.letterPool.shift());
  }
  return drawn;
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

// ---- Scoring dla jednego lub wielu słów ----------------------

function scorePlay(validSegments, extraSegments, currentCategory, activeFigures) {
  const passiveBonuses = gameState.passiveBonuses;
  const figureState = {
    emfazaActive: gameState._figureState.emfazaActive,
    synekdochaActive: gameState._figureState.synekdochaActive,
    komboBonus: activeFigures.includes('kombo') && gameState.categoryStreak >= 2,
    pioro: passiveBonuses.includes('pioro'),
    iluminacja: passiveBonuses.includes('iluminacja'),
    folio: passiveBonuses.includes('folio'),
  };

  // Chips z liter wszystkich słów
  const polishLetters = ['Ą','Ć','Ę','Ł','Ń','Ó','Ś','Ź','Ż'];
  let totalChips = 0;
  let totalWordLen = 0;
  let totalCategoryBonus = 0;
  let totalPolishCount = 0;

  for (const seg of validSegments) {
    const letters = seg.word.toUpperCase().split('');
    totalWordLen += letters.length;
    for (let i = 0; i < letters.length; i++) {
      let val = LETTER_VALUES[letters[i]] ?? 1;
      if (activeFigures.includes('aliteracja')) {
        if (letters.filter(l => l === letters[i]).length > 1) val *= 2;
      }
      if (i === 0 && activeFigures.includes('inicjal')) val *= 2;
      totalChips += val;
    }
    totalPolishCount += letters.filter(l => polishLetters.includes(l)).length;
    if (currentCategory.words.some(w => w.toLowerCase() === seg.word.toLowerCase())) {
      totalCategoryBonus += figureState.iluminacja ? 5 : 3;
    }
  }

  // Tier na podstawie łącznej długości słów
  const tier = getTier(totalWordLen) || WORD_TIERS[0];
  totalChips = Math.floor(totalChips * tier.chipsMultiplier);

  if (figureState.synekdochaActive) totalChips *= 2;
  if (figureState.pioro) totalChips *= 2;

  // Mnożnik
  let mult = 1 + tier.multBonus + totalCategoryBonus;
  if (activeFigures.includes('polonizm')) mult += totalPolishCount * 2;
  if (figureState.komboBonus) mult += 5;
  if (figureState.folio && totalWordLen >= 6) mult = Math.round(mult * 1.5);
  if (figureState.emfazaActive) mult *= 2;
  if (activeFigures.includes('hiperbola') && mult < 2) mult = 2;

  const baseScore = Math.floor(totalChips * mult);

  // Surowe znaki z dodatkowych liter
  let extraChips = 0;
  for (const seg of extraSegments) {
    extraChips += LETTER_VALUES[seg.letter.toUpperCase()] ?? 1;
  }

  return {
    chips: totalChips,
    mult,
    score: baseScore + extraChips,
    tier,
    categoryBonus: totalCategoryBonus,
    figureBonus: 0,
    extraChips,
    words: validSegments.map(s => s.word),
  };
}

// ---- Zagranie słowa -----------------------------------------

export function playWord() {
  if (gameState.phase !== 'game') return;
  const { selectedIndices, hand, currentBlind, currentCategory, activeFigures } = gameState;

  if (selectedIndices.length < 1) {
    emitter.emit('discardFailed', { reason: 'nothing_selected' });
    return;
  }

  const wordLetters = selectedIndices.map(i => hand[i]);
  const segments = findWordSequence(wordLetters);
  const validSegments = segments.filter(s => s.word);
  const extraSegments = segments.filter(s => !s.word);

  if (validSegments.length > 0) {
    // --- Słowa znalezione ---
    const result = scorePlay(validSegments, extraSegments, currentCategory, activeFigures);
    gameState._figureState.emfazaActive = false;
    gameState._figureState.synekdochaActive = false;

    if (result.categoryBonus > 0) gameState.categoryStreak += 1;
    else gameState.categoryStreak = 0;

    gameState.runningScore += result.score;
    gameState.playsLeft -= 1;
    gameState.playsUsedThisBlind += 1;
    if (activeFigures.includes('skryba')) gameState.ink += 2;

    // Uzupełnij rękę max do 8 liter
    const handAfterPlay = hand.filter((_, i) => !selectedIndices.includes(i));
    const refillCountWords = Math.max(0, 8 - handAfterPlay.length);
    if (!gameState.discardPile) gameState.discardPile = [];
    gameState.discardPile.push(...wordLetters); // wrzuć zużyte na stos odrzuceń

    const drawnChars = drawFromPool(refillCountWords);
    gameState.hand = [...handAfterPlay, ...drawnChars];
    gameState.selectedIndices = [];
    sortHandInPlace();

    for (const seg of validSegments) {
      const isCatWord = currentCategory.words.some(w => w.toLowerCase() === seg.word.toLowerCase());
      gameState.wordsPlayedThisRun.push({ word: seg.word, score: 0, categoryBonus: isCatWord });
      gameState.wordsPlayedThisBlind.push(seg.word);
    }
    updateRevealedLetters();

    const displayWord = validSegments.map(s => s.word).join(' + ');
    emitter.emit('wordPlayed', { word: displayWord, result, state: gameState });

  } else {
    // --- Brak słowa: surowe znaki ---
    if (activeFigures.includes('bezblednik') && !gameState._figureState.bezblednikUsed) {
      gameState._figureState.bezblednikUsed = true;
      emitter.emit('wordRejected', { reason: 'invalid', bezblednik: true });
      gameState.selectedIndices = [];
      emitter.emit('selectionChanged', { selectedIndices: [] });
      return;
    }

    let chips = 0;
    const fullWord = wordLetters.join('');
    for (const idx of selectedIndices) {
      chips += (LETTER_VALUES[hand[idx].toUpperCase()] ?? 1);
    }
    gameState.runningScore += chips;
    gameState.playsLeft -= 1;
    gameState.playsUsedThisBlind += 1;
    if (activeFigures.includes('skryba')) gameState.ink += 2;

    // Uzupełnij rękę max do 8 liter (surowe znaki)
    const handAfterRaw = hand.filter((_, i) => !selectedIndices.includes(i));
    const refillCountRaw = Math.max(0, 8 - handAfterRaw.length);
    if (!gameState.discardPile) gameState.discardPile = [];
    gameState.discardPile.push(...wordLetters);

    const drawnRaw = drawFromPool(refillCountRaw);
    gameState.hand = [...handAfterRaw, ...drawnRaw];
    gameState.selectedIndices = [];
    sortHandInPlace();
    gameState.wordsPlayedThisRun.push({ word: fullWord, score: chips, categoryBonus: false });
    updateRevealedLetters();

    emitter.emit('wordPlayed', {
      word: fullWord,
      result: { score: chips, chips, mult: 1, tier: { name: 'Litery', color: '#6b7280' }, categoryBonus: 0, lettersOnly: true },
      state: gameState,
    });
  }

  if (gameState.runningScore >= currentBlind.targetScore) endBlind(true);
  else if (gameState.playsLeft <= 0) endBlind(false);
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

// ---- Odgadywanie hasła w trakcie rundy ----------------------

export function guessBlindWord(attempt) {
  if (gameState.phase !== 'game') return false;
  const correct = attempt.trim().toUpperCase() === gameState.currentBlind.word.toUpperCase();
  if (correct) {
    endBlind(true, { wonByGuess: true });
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

  const discardedLetters = gameState.selectedIndices.map(i => gameState.hand[i]);
  
  // Usuń odrzucone litery z ręki
  const newHand = gameState.hand.filter((_, i) => !gameState.selectedIndices.includes(i));
  
  // Zawsze dąż do wypełnienia ręki limitowanej do 8 liter
  const refillCount = Math.max(0, 8 - newHand.length);

  // Dodaj do stosu odrzuceń!
  if (!gameState.discardPile) gameState.discardPile = [];
  gameState.discardPile.push(...discardedLetters);

  // Używaj naszego nowego helpera
  const drawn = drawFromPool(refillCount);

  gameState.hand = [...newHand, ...drawn];
  gameState.selectedIndices = [];
  sortHandInPlace();
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

function endBlind(won, opts = {}) {
  gameState.phase = 'summary';

  // Atrament za wygranie
  let inkReward = 0;
  if (won) {
    inkReward = calcInkReward(gameState.playsUsedThisBlind, 5, true);
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

    // Sprawdź czy boss pokonany
    if (gameState.currentBlind.type === 'boss') {
      gameState.hasDefeatedBoss = true;
    }
  }

  gameState._summaryWon = won;
  gameState._wonByGuess = opts.wonByGuess || false;
  emitter.emit('blindEnded', { won, inkReward, score: gameState.runningScore, wonByGuess: opts.wonByGuess, state: gameState });
}

// Po zamknięciu Skryptorium
export function closeScriptorium() {
  advanceAfterBlind(false);
}

function advanceAfterBlind(skipped) {
  const category = gameState.shuffledCategories[gameState.categoryIndex];
  const nextBlindIndex = gameState.blindIndex + 1;

  if (nextBlindIndex < category.blinds.length) {
    gameState.blindIndex = nextBlindIndex;
    gameState.phase = 'blind-select';
    emitter.emit('nextBlind', { state: gameState });
  } else {
    const nextCategoryIndex = gameState.categoryIndex + 1;
    if (nextCategoryIndex < gameState.shuffledCategories.length) {
      gameState.categoryIndex = nextCategoryIndex;
      gameState.blindIndex = 0;
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

// ---- Figury: dodawanie/usuwanie (używane przez Skryptorium) --

export function addFigure(figureId) {
  const fig = FIGURES[figureId];
  if (!fig) return false;

  if (fig.type === 'passive') {
    if (gameState.activeFigures.length >= 5) return false;
    if (gameState.activeFigures.includes(figureId)) return false;
    gameState.activeFigures.push(figureId);
  } else {
    if (gameState.handFigures.length >= 3) return false; // max 3 jednorazowe
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
  if (gameState.passiveBonusTaken) return false;
  gameState.passiveBonuses.push(bonusId);
  gameState.passiveBonusTaken = true;
  emitter.emit('passiveBonusPicked', { bonusId, state: gameState });
  return true;
}

// ---- Helpers ------------------------------------------------

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
