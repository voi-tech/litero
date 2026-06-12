// src/persistence.js — zapis i wznowienie runa w localStorage
// Zapisywane są tylko dane serializowalne (revealedLetters: Set → tablica).
// Zmiana schematu stanu wymaga podbicia SAVE_KEY (stary zapis jest odrzucany).

export const SAVE_KEY = 'litero_save_v2';

// Fazy, w których run ma sens do wznowienia
const RESUMABLE_PHASES = ['map', 'blind-select', 'game', 'summary', 'scriptorium'];

// Pola gameState wchodzące do zapisu
const SAVED_FIELDS = [
  'phase', 'difficulty', 'mode', 'dailyDate', 'runSeed', '_rngState',
  'categoryIndex', 'blindIndex', 'completedBlinds', 'ink',
  'currentBlind', 'currentCategory', 'runningScore', 'playsLeft',
  'discardsLeft', 'playsUsedThisBlind', 'maxPlaysThisBlind',
  'guessAttemptedThisBlind',
  'hand', 'letterPool', 'discardPile', 'selectedIndices',
  'activeFigures', 'handFigures', '_figureState', 'categoryStreak',
  'totalScore', 'wordsPlayedThisRun', 'wordsPlayedThisBlind', '_playOrder',
  'pendingTags', 'shuffledCategories', '_categoryBlindCache',
  '_activeBlindWords', '_pendingSkipTags', 'passiveBonuses',
  'bossesDefeated', 'scriptoriumOffer', '_scriptoriumBlindKey', 'lastInterestReward',
  '_summaryWon', '_wonByGuess', '_lastInkReward',
];

export function saveRun(state) {
  try {
    if (!RESUMABLE_PHASES.includes(state.phase)) {
      clearSave();
      return;
    }
    // Przegrana w fazie summary = koniec runa, nie ma czego wznawiać
    if (state.phase === 'summary' && !state._summaryWon) {
      clearSave();
      return;
    }
    const data = {};
    for (const key of SAVED_FIELDS) data[key] = state[key];
    data.revealedLetters = [...state.revealedLetters];
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // localStorage pełny/niedostępny — gra działa dalej bez zapisu
  }
}

export function loadRun() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!RESUMABLE_PHASES.includes(data?.phase)) return null;
    if (!Array.isArray(data.shuffledCategories) || data.shuffledCategories.length === 0) return null;
    if (!Array.isArray(data.hand)) return null;
    return data;
  } catch {
    clearSave();
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignoruj
  }
}

// Wgraj zapis do żywego gameState (rekonstrukcja typów nie-JSON)
export function applySaveToState(saved, state) {
  for (const key of SAVED_FIELDS) {
    if (key in saved) state[key] = saved[key];
  }
  state.revealedLetters = new Set(saved.revealedLetters ?? []);
}
