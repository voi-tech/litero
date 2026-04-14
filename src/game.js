// src/game.js — core game loop i stan gry

import { emitter } from './eventEmitter.js';
import { getRandomWord } from './words.js';
import {
  calculateHit,
  calculateMiss,
  calculateInkReward,
  calculateTimeBonus,
} from './scoring.js';
import { applyFigureHooks, activateFigure, FIGURES } from './figures.js';
import { createTimer } from './timer.js';

// ---- Stan gry ----------------------------------------------

export const gameState = {
  // meta
  round: 1,
  maxRounds: 10,
  ante: 1,
  phase: 'start',
  difficultyMode: 'normal',

  // ekonomia
  score: 0,
  ink: 0,
  multiplier: 1.0,
  basePoints: 0,
  roundScore: 0,

  // słowo
  word: '',
  definition: '',
  hint: '',
  category: '',
  revealed: [],
  usedLetters: {},
  errors: 0,
  bezblednikUsed: false,

  // figury
  activeFigures: [],
  handFigures: [],

  // combo
  combo: 0,
  comboBeforeLastMiss: 0,
  maxComboThisRun: 0,

  // timer
  timeLeft: 60,
  timerRunning: false,

  // statystyki
  wordsGuessed: 0,
  wordsFailed: 0,
  totalScore: 0,
  highScore: 0,

  // pula użytych słów
  usedWordIds: [],
};

let currentTimer = null;

// ---- Inicjalizacja gry ------------------------------------

export function initGame() {
  const hs = localStorage.getItem('zgadka_highscore');
  gameState.highScore = hs ? parseInt(hs, 10) : 0;
}

export function startGame(settings) {
  const { maxRounds, difficulty, category = 'all' } = settings;

  gameState.round = 1;
  gameState.maxRounds = maxRounds;
  gameState.ante = 1;
  gameState.difficultyMode = difficulty;
  gameState.selectedCategory = category;
  gameState.score = 0;
  gameState.ink = 0;
  gameState.totalScore = 0;
  gameState.wordsGuessed = 0;
  gameState.wordsFailed = 0;
  gameState.maxComboThisRun = 0;
  gameState.activeFigures = [];
  gameState.handFigures = [];
  gameState.usedWordIds = [];
  gameState.phase = 'figure-pick';
}

// ---- Start rundy ------------------------------------------

export async function startRound() {
  if (currentTimer) currentTimer.stop();

  // Wybierz słowo
  const wordEntry = getRandomWord(gameState.usedWordIds, gameState.ante, gameState.difficultyMode, gameState.selectedCategory);
  if (!wordEntry) {
    endGame();
    return;
  }

  gameState.usedWordIds.push(wordEntry.id);

  // Inicjalizacja stanu rundy
  gameState.word = wordEntry.word.toUpperCase();
  gameState.hint = wordEntry.hint || '';
  gameState.category = wordEntry.category || '';
  gameState.definition = wordEntry.definition || '';
  gameState.revealed = new Array(gameState.word.length).fill(false);
  gameState.usedLetters = {};
  gameState.errors = 0;
  gameState.bezblednikUsed = false;
  gameState.multiplier = 1.0;
  gameState.basePoints = 0;
  gameState.roundScore = 0;
  gameState.combo = 0;
  gameState.comboBeforeLastMiss = 0;
  gameState.timeLeft = getBaseTime();
  gameState.phase = 'guessing';

  // Zastosuj hooki onRoundStart (Hiperbola, Litotes, Inicjał)
  applyFigureHooks(gameState.activeFigures, 'onRoundStart', gameState);

  // Emituj stan wstępny dla UI
  emitter.emit('roundStarted', { state: gameState, wordEntry });

  // Uruchom timer
  currentTimer = createTimer(
    gameState.timeLeft,
    (timeLeft) => {
      gameState.timeLeft = timeLeft;
      emitter.emit('timerTick', { timeLeft });
    },
    () => {
      if (gameState.phase === 'guessing') endRound('timeout');
    }
  );
  currentTimer.start();
  gameState.timerRunning = true;
}

function getBaseTime() {
  const baseTimes = { normal: 60, hard: 50, insane: 40 };
  const base = baseTimes[gameState.difficultyMode] ?? 60;
  return Math.max(20, base - (gameState.ante - 1) * 10);
}

// ---- Obsługa litery ----------------------------------------

export function handleLetterGuess(letter) {
  if (gameState.phase !== 'guessing') return;
  const l = letter.toUpperCase();
  if (gameState.usedLetters[l]) return;

  gameState.usedLetters[l] = true;

  // Sprawdź, czy litera jest w słowie
  const positions = [];
  for (let i = 0; i < gameState.word.length; i++) {
    if (gameState.word[i] === l) positions.push(i);
  }

  if (positions.length > 0) {
    // Trafienie
    positions.forEach(i => { gameState.revealed[i] = true; });

    const result = calculateHit(l, gameState, gameState.activeFigures);

    gameState.basePoints += result.points;
    gameState.multiplier = result.multiplier;
    gameState.combo = result.combo;
    gameState.ink += result.inkGain;

    if (gameState.combo > gameState.maxComboThisRun) {
      gameState.maxComboThisRun = gameState.combo;
    }

    emitter.emit('letterHit', {
      letter: l,
      points: result.points,
      positions,
      multiplier: gameState.multiplier,
      combo: gameState.combo,
      ink: gameState.ink,
    });

    if (isWordComplete()) {
      endRound('guessed');
    }
  } else {
    // Pudło
    const missResult = calculateMiss(gameState, gameState.activeFigures);

    if (missResult.shouldCancel) {
      gameState.bezblednikUsed = true;
      emitter.emit('letterMissCancelled', { letter: l });
    } else {
      gameState.comboBeforeLastMiss = gameState.combo;
      gameState.combo = 0;
      gameState.errors++;

      emitter.emit('letterMiss', {
        letter: l,
        errors: gameState.errors,
        combo: gameState.combo,
      });

      if (gameState.errors >= 6) {
        endRound('maxErrors');
      }
    }
  }
}

// ---- Aktywacja figury jednorazowej -------------------------

export function handleOneshot(figureId) {
  if (gameState.phase !== 'guessing') return;
  const idx = gameState.handFigures.indexOf(figureId);
  if (idx === -1) return;

  const success = activateFigure(figureId, gameState);
  if (success) {
    gameState.handFigures.splice(idx, 1);
    emitter.emit('oneshotActivated', { figureId, state: gameState });
  }
}

// ---- Obsługa zdarzenia revealRarest (Synekdocha) ----------

emitter.on('revealRarest', ({ state }) => {
  const LETTER_POINTS = {
    A: 20, E: 20, I: 20, O: 20, U: 20,
    N: 30, S: 30, T: 30, R: 30, L: 30,
    W: 40, K: 40, D: 40, P: 40, M: 40,
    G: 55, B: 55, H: 55, F: 55, J: 55, C: 55,
    Ą: 70, Ć: 70, Ę: 70, Ł: 70, Ń: 70, Ó: 70, Ś: 70, Ź: 70, Ż: 70,
    Z: 45, V: 60, X: 60, Y: 35, Q: 60,
  };

  const hidden = [];
  for (let i = 0; i < state.word.length; i++) {
    if (!state.revealed[i]) hidden.push({ i, letter: state.word[i] });
  }
  if (hidden.length === 0) return;

  hidden.sort((a, b) =>
    (LETTER_POINTS[b.letter] ?? 30) - (LETTER_POINTS[a.letter] ?? 30)
  );

  const { i, letter } = hidden[0];
  state.revealed[i] = true;
  state.usedLetters[letter] = true;

  emitter.emit('letterHit', {
    letter,
    points: 0, // za darmo — bez punktów
    positions: [i],
    multiplier: state.multiplier,
    combo: state.combo,
    ink: state.ink,
  });

  if (isWordComplete()) endRound('guessed');
});

// ---- Sprawdzenie kompletności słowa ------------------------

function isWordComplete() {
  return gameState.revealed.every(Boolean);
}

// ---- Koniec rundy ------------------------------------------

export function endRound(reason) {
  if (gameState.phase !== 'guessing') return;
  gameState.phase = 'result';

  if (currentTimer) {
    currentTimer.stop();
    gameState.timerRunning = false;
  }

  const guessed = reason === 'guessed';

  // Bonus za czas
  const timeBonus = guessed ? calculateTimeBonus(gameState.timeLeft) : 0;

  // Wynik rundy przed mnożnikiem i modyfikatorami figur
  gameState.roundScore = Math.floor(gameState.basePoints * gameState.multiplier) + timeBonus;

  // Hook onRoundEnd (Perfekcjonista)
  applyFigureHooks(gameState.activeFigures, 'onRoundEnd', gameState);

  // Atrament
  const inkReward = calculateInkReward(gameState.basePoints, guessed);
  gameState.ink += inkReward;

  // Aktualizacja statystyk
  gameState.totalScore += gameState.roundScore;
  gameState.score = gameState.totalScore;

  if (guessed) {
    gameState.wordsGuessed++;
  } else {
    gameState.wordsFailed++;
  }

  emitter.emit('roundEnded', {
    state: gameState,
    reason,
    roundScore: gameState.roundScore,
    inkReward,
    timeBonus,
  });
}

// ---- Następna runda ----------------------------------------

export function nextRound() {
  // Sprawdź koniec gry
  if (gameState.round >= gameState.maxRounds) {
    endGame();
    return;
  }

  gameState.round++;

  // Sprawdź ante (co 3 rundy)
  const newAnte = Math.floor((gameState.round - 1) / 3) + 1;
  const anteChanged = newAnte > gameState.ante;
  gameState.ante = newAnte;

  if (anteChanged) {
    gameState.phase = 'ante';
    emitter.emit('anteChanged', { ante: gameState.ante, state: gameState });
  } else {
    gameState.phase = 'figure-pick';
    emitter.emit('figurePick', { state: gameState });
  }
}

// ---- Scriptorium -------------------------------------------

export function openScriptorium() {
  gameState.phase = 'scriptorium';
  emitter.emit('scriptoriumOpen', { state: gameState });
}

export function closeScriptorium() {
  gameState.phase = 'figure-pick';
  emitter.emit('figurePick', { state: gameState });
}

// ---- Koniec gry --------------------------------------------

export function endGame() {
  if (currentTimer) currentTimer.stop();
  gameState.phase = 'game-over';

  // Zapisz highscore
  if (gameState.totalScore > gameState.highScore) {
    gameState.highScore = gameState.totalScore;
    localStorage.setItem('zgadka_highscore', String(gameState.totalScore));
  }

  // Zapisz statystyki
  const prevStats = JSON.parse(localStorage.getItem('zgadka_stats') || '{}');
  const newStats = {
    gamesPlayed: (prevStats.gamesPlayed || 0) + 1,
    totalWords: (prevStats.totalWords || 0) + gameState.wordsGuessed,
    bestCombo: Math.max(prevStats.bestCombo || 0, gameState.maxComboThisRun),
  };
  localStorage.setItem('zgadka_stats', JSON.stringify(newStats));

  emitter.emit('gameOver', { state: gameState });
}

// ---- Figury — dodawanie/usuwanie --------------------------

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
    return true;
  }
  return false;
}
