import { describe, it, expect, beforeEach } from 'vitest';
import { saveRun, loadRun, clearSave, applySaveToState, SAVE_KEY } from '../src/persistence.js';

// Atrapa localStorage dla Node
globalThis.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] ?? null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
};

function makeState(overrides = {}) {
  return {
    phase: 'game',
    difficulty: 'szkolny',
    mode: 'daily',
    dailyDate: '2026-06-12',
    runSeed: 'daily:2026-06-12:szkolny',
    _rngState: 12345,
    categoryIndex: 0,
    blindIndex: 1,
    completedBlinds: [{ categoryId: 'nauka', blindId: 'atom', skipped: false, score: 130 }],
    ink: 7,
    currentBlind: { id: 'gen', word: 'GENOM', targetScore: 240, type: 'big' },
    currentCategory: { id: 'nauka', name: 'Nauka', words: ['atom'], blinds: [] },
    runningScore: 55,
    playsLeft: 3,
    discardsLeft: 2,
    playsUsedThisBlind: 2,
    maxPlaysThisBlind: 5,
    guessAttemptedThisBlind: true,
    hand: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    letterPool: ['I', 'J'],
    discardPile: ['K'],
    selectedIndices: [0, 2],
    activeFigures: ['skryba'],
    handFigures: ['elipsa'],
    _figureState: { mult15: true },
    categoryStreak: 1,
    totalScore: 130,
    wordsPlayedThisRun: [{
      playedText: 'KOT',
      words: ['KOT'],
      score: 21,
      letters: ['K', 'O', 'T'],
      categoryMatches: [],
      categoryBonus: false,
      order: 1,
      timestamp: 123,
    }],
    wordsPlayedThisBlind: ['kot'],
    _playOrder: 1,
    pendingTags: [{ id: 'play1', label: '+1 zagranie' }],
    shuffledCategories: [{ id: 'nauka', blinds: [] }],
    _categoryBlindCache: { nauka: { blindWords: [], skipTags: [] } },
    _activeBlindWords: [],
    _pendingSkipTags: [],
    passiveBonuses: ['pioro'],
    bossesDefeated: 1,
    scriptoriumOffer: [{ id: 'lakonizm' }],
    _scriptoriumBlindKey: 'nauka:gen:1',
    lastInterestReward: 2,
    _summaryWon: true,
    _wonByGuess: false,
    _lastInkReward: 5,
    revealedLetters: new Set([0, 1]),
    highScore: 999, // nie powinno wejść do zapisu
    ...overrides,
  };
}

beforeEach(() => {
  clearSave();
});

describe('saveRun / loadRun', () => {
  it('zapisuje i wczytuje run z zachowaniem pól', () => {
    saveRun(makeState());
    const loaded = loadRun();
    expect(loaded).not.toBeNull();
    expect(loaded.phase).toBe('game');
    expect(loaded.runningScore).toBe(55);
    expect(loaded.hand).toHaveLength(8);
    expect(loaded.pendingTags[0].id).toBe('play1');
    expect(loaded.revealedLetters).toEqual([0, 1]);
    expect(loaded.guessAttemptedThisBlind).toBe(true);
    expect(loaded._playOrder).toBe(1);
    expect(loaded.difficulty).toBe('szkolny');
    expect(loaded.mode).toBe('daily');
    expect(loaded.dailyDate).toBe('2026-06-12');
    expect(loaded._rngState).toBe(12345);
    expect(loaded.scriptoriumOffer[0].id).toBe('lakonizm');
    expect(loaded.lastInterestReward).toBe(2);
    expect(loaded.highScore).toBeUndefined();
  });

  it('czyści zapis przy fazach końcowych (victory/defeat/start)', () => {
    saveRun(makeState());
    saveRun(makeState({ phase: 'victory' }));
    expect(loadRun()).toBeNull();
  });

  it('czyści zapis przy przegranym summary (koniec runa)', () => {
    saveRun(makeState());
    saveRun(makeState({ phase: 'summary', _summaryWon: false }));
    expect(loadRun()).toBeNull();
  });

  it('odrzuca uszkodzony zapis', () => {
    localStorage.setItem(SAVE_KEY, '{nie-json');
    expect(loadRun()).toBeNull();
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
  });

  it('odrzuca zapis bez kategorii lub ręki', () => {
    saveRun(makeState({ shuffledCategories: [] }));
    expect(loadRun()).toBeNull();
  });

  it('ignoruje stary zapis v1 po zmianie schematu', () => {
    localStorage.setItem('litero_save_v1', JSON.stringify(makeState()));
    expect(loadRun()).toBeNull();
    expect(localStorage.getItem('litero_save_v1')).not.toBeNull();
  });
});

describe('applySaveToState', () => {
  it('odtwarza stan łącznie z Setem odkrytych liter', () => {
    saveRun(makeState());
    const loaded = loadRun();
    const target = { revealedLetters: new Set(), highScore: 42 };
    applySaveToState(loaded, target);
    expect(target.runningScore).toBe(55);
    expect(target.revealedLetters).toBeInstanceOf(Set);
    expect(target.revealedLetters.has(1)).toBe(true);
    expect(target.highScore).toBe(42); // rekord nie jest nadpisywany
  });
});
