import { describe, it, expect, beforeEach } from 'vitest';
import {
  gameState, startGame, enterCategory, startBlind, playWord, discardLetters,
  trySkipBlind, guessBlindWord, findWordSequence, toggleLetter, returnToMap,
  addFigure, removeFigure, isCategoryCompleted, allCategoriesCompleted,
  clearSelection, removeLastSelectedLetter, selectFirstMatchingLetter,
  getTargetScore, BLIND_TARGETS,
  HAND_SIZE, BASE_PLAYS, BASE_DISCARDS,
} from '../src/game.js';
import { setWordList } from '../src/dictionary.js';

// game.js zapisuje rekord w localStorage — w Node podstawiamy atrapę
globalThis.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] ?? null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
};

beforeEach(() => {
  setWordList(['kot', 'dom', 'as']);
  startGame();
});

describe('startGame', () => {
  it('resetuje stan i rozdaje pełną rękę', () => {
    expect(gameState.phase).toBe('map');
    expect(gameState.hand.length).toBe(HAND_SIZE);
    expect(gameState.ink).toBe(0);
    expect(gameState.completedBlinds).toEqual([]);
    expect(gameState.shuffledCategories.length).toBeGreaterThan(0);
  });

  it('tryb szkolny obniża cele i daje 6 zagrań', () => {
    startGame({ difficulty: 'szkolny' });
    enterCategory(0);
    startBlind(0);
    expect(gameState.difficulty).toBe('szkolny');
    expect(gameState.playsLeft).toBe(6);
    expect(gameState.currentBlind.targetScore).toBeLessThan(BLIND_TARGETS[gameState.currentBlind.type].base);
  });

  it('tryb dzienny powtarza rękę i kolejność kategorii dla tej samej daty', () => {
    startGame({ difficulty: 'akademicki', mode: 'daily', dailyDate: '2026-06-12' });
    const firstHand = [...gameState.hand];
    const firstCategories = gameState.shuffledCategories.map(c => c.id);

    startGame({ difficulty: 'akademicki', mode: 'daily', dailyDate: '2026-06-12' });
    expect(gameState.hand).toEqual(firstHand);
    expect(gameState.shuffledCategories.map(c => c.id)).toEqual(firstCategories);
    expect(gameState.mode).toBe('daily');
    expect(gameState.dailyDate).toBe('2026-06-12');
  });
});

describe('findWordSequence', () => {
  it('wykrywa pojedyncze słowo', () => {
    const segs = findWordSequence(['K', 'O', 'T']);
    expect(segs).toHaveLength(1);
    expect(segs[0].word).toBe('KOT');
  });

  it('wykrywa kilka słów po kolei (greedy)', () => {
    const segs = findWordSequence(['K', 'O', 'T', 'D', 'O', 'M']);
    expect(segs.map(s => s.word)).toEqual(['KOT', 'DOM']);
  });

  it('litery niewchodzące w słowa zwraca jako pojedyncze segmenty', () => {
    const segs = findWordSequence(['X', 'K', 'O', 'T']);
    expect(segs[0].word).toBeNull();
    expect(segs[0].letter).toBe('X');
    expect(segs[1].word).toBe('KOT');
  });
});

describe('enterCategory', () => {
  it('losuje hasła blindów i ustawia fazę blind-select', () => {
    enterCategory(0);
    expect(gameState.phase).toBe('blind-select');
    expect(gameState._activeBlindWords).toHaveLength(3);
    expect(gameState._activeBlindWords[0].word).toBeTruthy();
    expect(gameState._activeBlindWords[0].targetScore).toBeGreaterThan(0);
  });

  it('nie reroluje haseł przy ponownym wejściu (cache per kategoria)', () => {
    enterCategory(0);
    const words = gameState._activeBlindWords.map(b => b.word);
    returnToMap();
    enterCategory(0);
    expect(gameState._activeBlindWords.map(b => b.word)).toEqual(words);
  });

  it('wznawia od pierwszego nieukończonego blinda', () => {
    enterCategory(0);
    const cat = gameState.currentCategory;
    gameState.completedBlinds.push({
      categoryId: cat.id, blindId: cat.blinds[0].id, skipped: false, score: 100,
    });
    returnToMap();
    enterCategory(gameState.categoryIndex);
    expect(gameState.blindIndex).toBe(1);
  });

  it('cele rosną wraz z liczbą ukończonych kategorii', () => {
    enterCategory(0);
    const firstTarget = gameState._activeBlindWords[0].targetScore;
    // oznacz pierwszą kategorię jako ukończoną
    const cat = gameState.currentCategory;
    for (const b of cat.blinds) {
      gameState.completedBlinds.push({ categoryId: cat.id, blindId: b.id, skipped: false, score: 0 });
    }
    returnToMap();
    enterCategory(1);
    expect(gameState._activeBlindWords[0].targetScore).toBeGreaterThan(firstTarget);
  });

  it('po 5 kategoriach używa łagodniejszego kroku trudności', () => {
    gameState.difficulty = 'akademicki';
    const target5 = getTargetScore(BLIND_TARGETS.boss, 5);
    const target6 = getTargetScore(BLIND_TARGETS.boss, 6);
    expect(target6 - target5).toBe(BLIND_TARGETS.boss.lateStep);
  });
});

describe('startBlind', () => {
  it('ustawia bazowe zagrania i odrzucenia', () => {
    enterCategory(0);
    startBlind(0);
    expect(gameState.phase).toBe('game');
    expect(gameState.playsLeft).toBe(BASE_PLAYS);
    expect(gameState.discardsLeft).toBe(BASE_DISCARDS);
    expect(gameState.maxPlaysThisBlind).toBe(BASE_PLAYS);
  });

  it('konsumuje oczekujące tagi za pominięcie', () => {
    enterCategory(0);
    gameState.pendingTags = [
      { id: 'play1', label: '' },
      { id: 'discard1', label: '' },
      { id: 'mult15', label: '' },
    ];
    startBlind(0);
    expect(gameState.playsLeft).toBe(BASE_PLAYS + 1);
    expect(gameState.discardsLeft).toBe(BASE_DISCARDS + 1);
    expect(gameState._figureState.mult15).toBe(true);
    expect(gameState.pendingTags).toEqual([]);
    expect(gameState.maxPlaysThisBlind).toBe(BASE_PLAYS + 1);
  });
});

describe('trySkipBlind', () => {
  it('poprawne hasło pomija blind i przyznaje tag', () => {
    enterCategory(0);
    const word = gameState._activeBlindWords[0].word;
    const ok = trySkipBlind(0, `  ${word.toLowerCase()} `);
    expect(ok).toBe(true);
    expect(gameState.completedBlinds[0].skipped).toBe(true);
    expect(gameState.blindIndex).toBe(1);
  });

  it('błędne hasło natychmiast startuje blind', () => {
    enterCategory(0);
    const ok = trySkipBlind(0, 'xxxxx');
    expect(ok).toBe(false);
    expect(gameState.phase).toBe('game');
  });

  it('bossa nie można pominąć', () => {
    enterCategory(0);
    const bossWord = gameState._activeBlindWords[2].word;
    expect(trySkipBlind(2, bossWord)).toBe(false);
  });
});

describe('playWord', () => {
  function setupBlind() {
    enterCategory(0);
    startBlind(0);
    gameState.hand = ['K', 'O', 'T', 'A', 'B', 'C', 'D', 'E'];
    gameState.selectedIndices = [];
  }

  it('zagranie poprawnego słowa dodaje punkty i uzupełnia rękę', () => {
    setupBlind();
    toggleLetter(0); toggleLetter(1); toggleLetter(2);
    playWord();
    expect(gameState.runningScore).toBeGreaterThan(0);
    expect(gameState.playsLeft).toBe(BASE_PLAYS - 1);
    expect(gameState.hand.length).toBe(HAND_SIZE);
    expect(gameState.selectedIndices).toEqual([]);
    expect(gameState.wordsPlayedThisBlind).toEqual(['KOT']);
    expect(gameState.wordsPlayedThisRun[0]).toMatchObject({
      playedText: 'KOT',
      words: ['KOT'],
      letters: ['K', 'O', 'T'],
      order: 1,
    });
  });

  it('litery bez słowa punktują surowo i zużywają zagranie', () => {
    setupBlind();
    toggleLetter(3); toggleLetter(4); // 'A','B' — brak słowa
    playWord();
    expect(gameState.runningScore).toBe(4); // A=1 + B=3
    expect(gameState.playsLeft).toBe(BASE_PLAYS - 1);
  });

  it('brak zaznaczenia nie zużywa zagrania', () => {
    setupBlind();
    playWord();
    expect(gameState.playsLeft).toBe(BASE_PLAYS);
  });

  it('osiągnięcie celu kończy blind wygraną i nagradza atramentem', () => {
    setupBlind();
    gameState.runningScore = gameState.currentBlind.targetScore - 1;
    toggleLetter(0); toggleLetter(1); toggleLetter(2);
    playWord();
    expect(gameState.phase).toBe('summary');
    expect(gameState._summaryWon).toBe(true);
    expect(gameState.ink).toBeGreaterThan(0);
    expect(gameState.completedBlinds).toHaveLength(1);
  });

  it('wyczerpanie zagrań bez celu kończy blind przegraną', () => {
    setupBlind();
    gameState.playsLeft = 1;
    toggleLetter(3); toggleLetter(4);
    playWord();
    expect(gameState.phase).toBe('summary');
    expect(gameState._summaryWon).toBe(false);
    expect(gameState.completedBlinds).toHaveLength(0);
  });

  it('bezbłędnik ratuje pierwsze niepoprawne zagranie', () => {
    setupBlind();
    gameState.activeFigures = ['bezblednik'];
    gameState._figureState.bezblednikUsed = false;
    toggleLetter(3); toggleLetter(4);
    playWord();
    expect(gameState.playsLeft).toBe(BASE_PLAYS);
    expect(gameState._figureState.bezblednikUsed).toBe(true);
  });
});

describe('discardLetters', () => {
  it('odrzuca zaznaczone litery i dobiera nowe', () => {
    enterCategory(0);
    startBlind(0);
    toggleLetter(0); toggleLetter(1);
    discardLetters();
    expect(gameState.hand.length).toBe(HAND_SIZE);
    expect(gameState.discardsLeft).toBe(BASE_DISCARDS - 1);
  });

  it('bez odrzuceń nie zmienia stanu', () => {
    enterCategory(0);
    startBlind(0);
    gameState.discardsLeft = 0;
    toggleLetter(0);
    discardLetters();
    expect(gameState.discardsLeft).toBe(0);
    expect(gameState.selectedIndices).toEqual([0]);
  });

  it('apostrofa wzmacnia mnożnik po odrzuceniu', () => {
    enterCategory(0);
    startBlind(0);
    gameState.activeFigures = ['apostrofa'];
    gameState._figureState.apostrofaMult = 0;
    toggleLetter(0);
    discardLetters();
    expect(gameState._figureState.apostrofaMult).toBe(1);
  });
});

describe('guessBlindWord', () => {
  it('trafne hasło natychmiast wygrywa blind', () => {
    enterCategory(0);
    startBlind(0);
    const ok = guessBlindWord(gameState.currentBlind.word.toLowerCase());
    expect(ok).toBe(true);
    expect(gameState.phase).toBe('summary');
    expect(gameState._wonByGuess).toBe(true);
  });

  it('błędne hasło nie kończy blinda', () => {
    enterCategory(0);
    startBlind(0);
    expect(guessBlindWord('xxxxx')).toBe(false);
    expect(gameState.phase).toBe('game');
    expect(gameState.guessAttemptedThisBlind).toBe(true);
  });

  it('po błędnym haśle blokuje kolejne próby do końca blinda', () => {
    enterCategory(0);
    startBlind(0);
    const word = gameState.currentBlind.word;
    expect(guessBlindWord('xxxxx')).toBe(false);
    expect(guessBlindWord(word)).toBe(false);
    expect(gameState.phase).toBe('game');
  });

  it('resetuje limit zgadywania przy starcie nowego blinda', () => {
    enterCategory(0);
    startBlind(0);
    guessBlindWord('xxxxx');
    expect(gameState.guessAttemptedThisBlind).toBe(true);
    startBlind(1);
    expect(gameState.guessAttemptedThisBlind).toBe(false);
  });
});

describe('selection helpers', () => {
  it('czyści wybór liter', () => {
    enterCategory(0);
    startBlind(0);
    toggleLetter(0);
    toggleLetter(1);
    clearSelection();
    expect(gameState.selectedIndices).toEqual([]);
  });

  it('usuwa ostatnio wybraną literę', () => {
    enterCategory(0);
    startBlind(0);
    toggleLetter(0);
    toggleLetter(1);
    removeLastSelectedLetter();
    expect(gameState.selectedIndices).toEqual([0]);
  });

  it('wybiera pierwszy niezaznaczony kafelek z podaną literą', () => {
    enterCategory(0);
    startBlind(0);
    gameState.hand = ['A', 'K', 'A', 'T'];
    expect(selectFirstMatchingLetter('a')).toBe(true);
    expect(selectFirstMatchingLetter('A')).toBe(true);
    expect(gameState.selectedIndices).toEqual([0, 2]);
    expect(selectFirstMatchingLetter('A')).toBe(false);
  });
});

describe('figury', () => {
  it('limit 5 figur pasywnych', () => {
    gameState.activeFigures = ['hiperbola', 'aliteracja', 'polonizm', 'pleonazm', 'litotes'];
    expect(addFigure('inicjal')).toBe(false);
  });

  it('sprzedaż figury zwraca atrament', () => {
    gameState.activeFigures = ['hiperbola'];
    const inkBefore = gameState.ink;
    expect(removeFigure('hiperbola')).toBe(true);
    expect(gameState.ink).toBeGreaterThan(inkBefore);
    expect(gameState.activeFigures).toEqual([]);
  });
});

describe('ukończenie kategorii', () => {
  it('isCategoryCompleted wymaga wszystkich blindów', () => {
    const cat = gameState.shuffledCategories[0];
    expect(isCategoryCompleted(cat)).toBe(false);
    for (const b of cat.blinds) {
      gameState.completedBlinds.push({ categoryId: cat.id, blindId: b.id, skipped: false, score: 0 });
    }
    expect(isCategoryCompleted(cat)).toBe(true);
    expect(allCategoriesCompleted()).toBe(false);
  });
});
