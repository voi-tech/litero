import { buildPool } from '../letters.js';
import { hashSeed, nextRandom } from '../rng.js';

function seededShuffle(items, seed) {
  const result = [...items];
  let state = hashSeed(seed);
  for (let index = result.length - 1; index > 0; index--) {
    const random = nextRandom(state);
    state = random.state;
    const target = Math.floor(random.value * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function createLetterSupply(seed, puzzleWord = '') {
  const pool = seededShuffle(buildPool(), seed);
  const anchors = [...new Set(puzzleWord.toLocaleUpperCase('pl-PL'))].slice(0, 5);
  const hand = [];

  for (const letter of anchors) {
    const index = pool.indexOf(letter);
    if (index >= 0) hand.push(...pool.splice(index, 1));
  }
  hand.push(...pool.splice(0, 8 - hand.length));

  return { hand: seededShuffle(hand, `${seed}:hand`), pool };
}

export function replaceUsedLetters(hand, pool, usedIndices) {
  const nextHand = [...hand];
  const nextPool = [...pool];
  for (const index of [...new Set(usedIndices)].sort((a, b) => a - b)) {
    if (index >= 0 && index < nextHand.length && nextPool.length) nextHand[index] = nextPool.shift();
  }
  return { hand: nextHand, pool: nextPool };
}
