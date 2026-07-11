import { describe, expect, test } from 'vitest';
import { adaptSupportProfile } from '../src/editorial/adaptation.js';
import { scoreEditorialRound } from '../src/editorial/scoring.js';

describe('adaptive support', () => {
  test('changes by at most one level and respects a locked profile', () => {
    const struggling = [{ solved: false }, { solved: false }, { solved: true, hintsUsed: 3, turnsUsed: 6 }];
    expect(adaptSupportProfile({ level: 1, mode: 'auto', history: struggling }).level).toBe(2);
    expect(adaptSupportProfile({ level: 2, mode: 'fixed', history: struggling }).level).toBe(2);
  });

  test('reduces support after consistently strong rounds', () => {
    const strong = Array.from({ length: 3 }, () => ({ solved: true, hintsUsed: 0, wrongGuesses: 0, turnsUsed: 2 }));
    expect(adaptSupportProfile({ level: 2, mode: 'auto', history: strong }).level).toBe(1);
  });
});

describe('editorial scoring', () => {
  test('caps each component and the total at 1000', () => {
    const score = scoreEditorialRound({
      solved: true,
      turnsUsed: 1,
      maxTurns: 9,
      hintsUsed: 0,
      wrongGuesses: 0,
      wordCraftPoints: 999,
      knowledgeCorrect: true,
      stylePoints: 999,
    });
    expect(score).toEqual({ solution: 500, craft: 300, knowledge: 100, style: 100, total: 1000 });
  });

  test('never penalizes an incorrect knowledge answer below zero', () => {
    expect(scoreEditorialRound({ solved: false, knowledgeCorrect: false }).knowledge).toBe(0);
  });
});
