import { describe, expect, it } from 'vitest';
import {
  buildPlayableHand,
  refillPlayableHand,
} from '../src/v4-letters.js';

const entries = [
  { surface: 'kot' },
  { surface: 'dom' },
  { surface: 'atom' },
  { surface: 'neutron' },
];

describe('ręka Litero v4', () => {
  it('ma rozmiar wybranego Zestawu liter i zawiera przynajmniej jedno słowo', () => {
    const result = buildPlayableHand(entries, {
      handSize: 7,
      vowelWeight: 1,
      consonantWeight: 1,
      polishLetterWeight: 1,
    }, () => 0.25);

    expect(result.hand).toHaveLength(7);
    expect(result.guaranteedWord).toBeTruthy();
    for (const letter of [...result.guaranteedWord.toUpperCase()]) {
      expect(result.hand).toContain(letter);
    }
  });

  it('jest deterministyczna dla tego samego generatora', () => {
    const rng = () => 0.5;
    expect(buildPlayableHand(entries, { handSize: 8 }, rng)).toEqual(
      buildPlayableHand(entries, { handSize: 8 }, rng),
    );
  });

  it('uzupełnia rękę do limitu po zagraniu lub odrzuceniu', () => {
    const result = refillPlayableHand(
      ['K', 'O', 'T', 'A'],
      8,
      () => 0.1,
    );
    expect(result).toHaveLength(8);
    expect(result.slice(0, 4)).toEqual(['K', 'O', 'T', 'A']);
  });

  it('zachowuje rozkład wybranego Zestawu przy każdym uzupełnieniu', () => {
    const result = refillPlayableHand(
      [],
      8,
      () => 0.1,
      { vowelWeight: 1, consonantWeight: 0, polishLetterWeight: 1 },
    );
    expect(result.every(letter => ['A', 'Ą', 'E', 'Ę', 'I', 'O', 'Ó', 'U', 'Y'].includes(letter)))
      .toBe(true);
  });
});
