import { describe, it, expect } from 'vitest';
import { buildPool, shufflePool, buildHand, ALPHABET } from '../src/letters.js';

describe('buildPool', () => {
  it('buduje pełną pulę liter wg częstości', () => {
    const pool = buildPool();
    expect(pool.length).toBeGreaterThan(90);
    // każda litera alfabetu występuje przynajmniej raz
    for (const letter of ALPHABET) {
      expect(pool).toContain(letter);
    }
  });
});

describe('shufflePool', () => {
  it('zwraca nową tablicę z tymi samymi literami', () => {
    const pool = buildPool();
    const shuffled = shufflePool(pool);
    expect(shuffled).not.toBe(pool);
    expect(shuffled.length).toBe(pool.length);
    expect([...shuffled].sort()).toEqual([...pool].sort());
  });
});

describe('buildHand', () => {
  it('rozdaje 8 liter, reszta zostaje w puli', () => {
    const { hand, pool } = buildHand();
    expect(hand.length).toBe(8);
    expect(hand.length + pool.length).toBe(buildPool().length);
  });
});
