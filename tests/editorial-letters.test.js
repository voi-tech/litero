import { describe, expect, test } from 'vitest';
import { createLetterSupply, replaceUsedLetters } from '../src/editorial/letters.js';

describe('editorial letter supply', () => {
  test('is deterministic for the same seed and varies between seeds', () => {
    const first = createLetterSupply('run-a', 'RZEKA');
    const repeated = createLetterSupply('run-a', 'RZEKA');
    const different = createLetterSupply('run-b', 'RZEKA');
    expect(first).toEqual(repeated);
    expect(different.hand).not.toEqual(first.hand);
    expect(first.hand).toHaveLength(8);
  });

  test('replaces only used positions and advances the pool', () => {
    const result = replaceUsedLetters(
      ['K', 'O', 'T', 'A', 'R', 'E', 'M', 'S'],
      ['N', 'I', 'E', 'B'],
      [0, 2],
    );
    expect(result.hand).toEqual(['N', 'O', 'I', 'A', 'R', 'E', 'M', 'S']);
    expect(result.pool).toEqual(['E', 'B']);
  });
});
