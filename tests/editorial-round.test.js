import { describe, expect, test } from 'vitest';
import {
  answerKnowledge,
  attemptSolve,
  chooseReward,
  composeWord,
  createRound,
} from '../src/editorial/roundEngine.js';

const puzzle = {
  id: 'nauka-atom',
  word: 'ATOM',
  category: 'Nauka',
  definitions: { simple: 'Bardzo mała część materii.', full: 'Najmniejszy składnik pierwiastka.' },
  knowledgeQuestion: { prompt: 'Czym jest atom?', options: ['Częścią materii', 'Gatunkiem ptaka'], correctIndex: 0 },
};

describe('editorial round state machine', () => {
  test('moves through compose, reward, solve, learn and complete', () => {
    let state = createRound({ puzzle, hand: ['A', 'T', 'O', 'M', 'K', 'O', 'T', 'Y'], letterPool: ['R', 'S', 'N'], supportLevel: 1 });
    expect(state.phase).toBe('compose');

    state = composeWord(state, { word: 'KOT', valid: true, categoryRelated: false, indices: [4, 5, 6] });
    expect(state.phase).toBe('reward');
    expect(state.history).toHaveLength(1);

    state = chooseReward(state, 'reveal-consonant');
    expect(state.phase).toBe('compose');
    expect(state.revealed.size).toBe(1);
    expect(state.hand).toEqual(['A', 'T', 'O', 'M', 'R', 'S', 'N', 'Y']);

    state = attemptSolve({ ...state, phase: 'solve' }, 'ATOM');
    expect(state.phase).toBe('learn');
    expect(state.solved).toBe(true);

    state = answerKnowledge(state, 0);
    expect(state.phase).toBe('complete');
    expect(state.knowledgeCorrect).toBe(true);
  });

  test('wrong solution consumes an attempt and reveals a controlled hint', () => {
    const initial = createRound({ puzzle, hand: ['A', 'T', 'O', 'M'], supportLevel: 2 });
    const state = attemptSolve({ ...initial, phase: 'solve' }, 'DOM');
    expect(state.phase).toBe('compose');
    expect(state.attemptsLeft).toBe(initial.attemptsLeft - 1);
    expect(state.revealed.size).toBe(1);
  });
});
