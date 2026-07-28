import { buildPool, shufflePool } from './letters.js';

const VOWELS = new Set(['A', 'Ą', 'E', 'Ę', 'I', 'O', 'Ó', 'U', 'Y']);
const POLISH_LETTERS = new Set(['Ą', 'Ć', 'Ę', 'Ł', 'Ń', 'Ó', 'Ś', 'Ź', 'Ż']);

function weightedPool(rules = {}) {
  const result = [];
  for (const letter of buildPool()) {
    let weight = VOWELS.has(letter)
      ? (rules.vowelWeight ?? 1)
      : (rules.consonantWeight ?? 1);
    if (POLISH_LETTERS.has(letter)) weight *= rules.polishLetterWeight ?? 1;
    const wholeCopies = Math.floor(weight);
    for (let copy = 0; copy < wholeCopies; copy += 1) result.push(letter);
    if (weight - wholeCopies >= 0.25) result.push(letter);
  }
  return result;
}

export function buildPlayableHand(entries, rules = {}, rng = Math.random) {
  const handSize = rules.handSize ?? 8;
  const candidates = (entries ?? []).filter(entry => {
    const length = [...entry.surface].length;
    return length >= 2 && length <= handSize && !entry.surface.includes(' ');
  });
  const picked = candidates[Math.floor(rng() * candidates.length)] ?? { surface: 'as' };
  const guaranteedWord = picked.surface.toLocaleUpperCase('pl-PL');
  const hand = [...guaranteedWord];
  const pool = shufflePool(weightedPool(rules), rng);
  while (hand.length < handSize) {
    hand.push(pool.shift() ?? 'A');
  }
  return {
    hand: shufflePool(hand.slice(0, handSize), rng),
    guaranteedWord,
  };
}

export function refillPlayableHand(hand, handSize = 8, rng = Math.random, rules = {}) {
  const result = [...hand];
  const pool = shufflePool(weightedPool(rules), rng);
  while (result.length < handSize) result.push(pool.shift() ?? 'A');
  return result.slice(0, handSize);
}
