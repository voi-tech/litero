// src/letters.js — pula liter z częstościami jak w polskim Scrabble

// Częstości liter w polskim Scrabble
const LETTER_FREQ = {
  A: 9, Ą: 1, B: 2, C: 3, Ć: 1, D: 3, E: 7, Ę: 1, F: 1, G: 2,
  H: 2, I: 8, J: 2, K: 3, L: 3, Ł: 2, M: 3, N: 5, Ń: 1, O: 6,
  Ó: 1, P: 3, R: 4, S: 4, Ś: 1, T: 3, U: 2, W: 4, Y: 4, Z: 5,
  Ź: 1, Ż: 1,
};

export const ALPHABET = Object.keys(LETTER_FREQ);

// Zbuduj pulę wszystkich liter wg częstości (~100 kafelków)
export function buildPool() {
  const pool = [];
  for (const [letter, count] of Object.entries(LETTER_FREQ)) {
    for (let i = 0; i < count; i++) pool.push(letter);
  }
  return pool;
}

// Fisher-Yates shuffle
export function shufflePool(pool) {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Pobierz N liter z puli (z początku)
export function drawLetters(pool, count) {
  if (pool.length < count) {
    // Uzupełnij pulę świeżą potasowaną talią jeśli za mało
    const refill = shufflePool(buildPool());
    pool = [...pool, ...refill];
  }
  return {
    letters: pool.slice(0, count),
    remaining: pool.slice(count),
  };
}

// Zbuduj rękę 8 liter (nowa potasowana pula)
export function buildHand() {
  const pool = shufflePool(buildPool());
  return {
    hand: pool.slice(0, 8),
    pool: pool.slice(8),
  };
}

// Uzupełnij rękę po zagraniu/odrzuceniu
// usedIndices: indeksy liter usuniętych z ręki
export function replenishHand(hand, usedIndices, pool) {
  // Usuń użyte litery z ręki (zaznaczone indeksy)
  const newHand = hand.filter((_, i) => !usedIndices.includes(i));
  const count = usedIndices.length;

  if (pool.length < count) {
    pool = [...pool, ...shufflePool(buildPool())];
  }

  const drawn = pool.slice(0, count);
  const remaining = pool.slice(count);

  return {
    hand: [...newHand, ...drawn],
    pool: remaining,
  };
}

// Czy dane litery są podzbiorem ręki gracza (można je ułożyć)
export function canFormWord(selectedLetters, hand) {
  const handCopy = [...hand];
  for (const letter of selectedLetters) {
    const idx = handCopy.indexOf(letter);
    if (idx === -1) return false;
    handCopy.splice(idx, 1);
  }
  return true;
}
