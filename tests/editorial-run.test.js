import { describe, expect, test } from 'vitest';
import { completeRound, createEditorialRun, selectRunPuzzles } from '../src/editorial/runEngine.js';

const puzzles = Array.from({ length: 12 }, (_, index) => ({ id: `p${index}`, word: `SLOWO${index}` }));

describe('editorial run', () => {
  test('normal mode selects five puzzles and a finale', () => {
    const selected = selectRunPuzzles(puzzles, { mode: 'normal', seed: 'test' });
    expect(selected).toHaveLength(6);
    expect(new Set(selected.map(puzzle => puzzle.id)).size).toBe(6);
  });

  test('daily mode deterministically selects three puzzles', () => {
    const first = selectRunPuzzles(puzzles, { mode: 'daily', seed: '2026-07-11' });
    const second = selectRunPuzzles(puzzles, { mode: 'daily', seed: '2026-07-11' });
    expect(first).toHaveLength(3);
    expect(first.map(item => item.id)).toEqual(second.map(item => item.id));
  });

  test('a failed puzzle continues the run and lowers circulation', () => {
    const run = createEditorialRun({ puzzles, mode: 'daily', seed: 'today' });
    const next = completeRound(run, {
      solved: false, turnsUsed: 6, maxTurns: 6, hintsUsed: 2,
      wrongGuesses: 2, wordCraftPoints: 40, knowledgeCorrect: false, stylePoints: 0,
    });
    expect(next.phase).toBe('between');
    expect(next.currentIndex).toBe(1);
    expect(next.circulation).toBeLessThan(run.circulation);
  });
});
