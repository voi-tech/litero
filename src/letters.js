// src/letters.js — pula liter z częstościami jak w polskim Scrabble

// Częstości liter w polskim Scrabble
const LETTER_FREQ = {
  A: 9, Ą: 1, B: 2, C: 3, Ć: 1, D: 3, E: 7, Ę: 1, F: 1, G: 2,
  H: 2, I: 8, J: 2, K: 3, L: 3, Ł: 2, M: 3, N: 5, Ń: 1, O: 6,
  Ó: 1, P: 3, R: 4, S: 4, Ś: 1, T: 3, U: 2, W: 4, Y: 4, Z: 5,
  Ź: 1, Ż: 1,
};

export const ALPHABET = Object.keys(LETTER_FREQ);

const HAND_SIZE = 8;

// Zbuduj pulę wszystkich liter wg częstości (~100 kafelków)
export function buildPool() {
  const pool = [];
  for (const [letter, count] of Object.entries(LETTER_FREQ)) {
    for (let i = 0; i < count; i++) pool.push(letter);
  }
  return pool;
}

// Fisher-Yates shuffle (zwraca nową tablicę)
export function shufflePool(pool, rng = Math.random) {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Zbuduj rękę 8 liter (nowa potasowana pula)
export function buildHand(rng = Math.random) {
  const pool = shufflePool(buildPool(), rng);
  return {
    hand: pool.slice(0, HAND_SIZE),
    pool: pool.slice(HAND_SIZE),
  };
}
