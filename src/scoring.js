// src/scoring.js — system punktów, mnożniki, atrament

// ---- Tabela punktów per litera ----------------------------

const LETTER_POINTS = {
  // Samogłoski
  A: 20, E: 20, I: 20, O: 20, U: 20,
  // Popularne spółgłoski
  N: 30, S: 30, T: 30, R: 30, L: 30,
  // Rzadkie spółgłoski
  W: 40, K: 40, D: 40, P: 40, M: 40,
  // Bardzo rzadkie
  G: 55, B: 55, H: 55, F: 55, J: 55, C: 55,
  // Polskie znaki
  Ą: 70, Ć: 70, Ę: 70, Ł: 70, Ń: 70, Ó: 70, Ś: 70, Ź: 70, Ż: 70,
  // Pozostałe (V, X, Q, Z - rzadkie w polskim)
  Z: 45, V: 60, X: 60, Y: 35, Q: 60,
};

const POLISH_CHARS = new Set(['Ą', 'Ć', 'Ę', 'Ł', 'Ń', 'Ó', 'Ś', 'Ź', 'Ż']);

export function isPolishChar(letter) {
  return POLISH_CHARS.has(letter.toUpperCase());
}

export function getLetterPoints(letter) {
  return LETTER_POINTS[letter.toUpperCase()] ?? 30;
}

// ---- Obliczenie trafienia ----------------------------------
// Zwraca: { basePoints, multiplier, combo, inkGain }

export function calculateHit(letter, state, activeFigures) {
  let points = getLetterPoints(letter);
  const word = state.word;

  // Aliteracja: litera powtarza się w słowie
  if (activeFigures.includes('aliteracja')) {
    const count = [...word].filter(c => c === letter).length;
    if (count > 1) points *= 2;
  }

  // Polonizm: polskie znaki warte 3×
  if (activeFigures.includes('polonizm') && isPolishChar(letter)) {
    points *= 3;
  }

  // Aktualizacja combo
  const newCombo = state.combo + 1;

  // Mnożnik: każde trafienie +0.1
  let newMultiplier = parseFloat((state.multiplier + 0.1).toFixed(2));

  // Bonus za combo ≥ 3
  let comboBonus = 0;
  if (newCombo >= 3 && newCombo % 3 === 0) {
    // Kombo figura: +0.5, domyślnie +0.3
    comboBonus = activeFigures.includes('kombo') ? 0.5 : 0.3;
    newMultiplier = parseFloat((newMultiplier + comboBonus).toFixed(2));
  }

  // Skryba: +1 atrament za trafienie
  let inkGain = 0;
  if (activeFigures.includes('skryba')) {
    inkGain = 1;
  }

  return {
    points,
    multiplier: newMultiplier,
    combo: newCombo,
    comboBonus,
    inkGain,
  };
}

// ---- Obliczenie pudeł -----------------------------------------------
// Zwraca { shouldCancel } — jeśli Bezbłędnik pochłania błąd

export function calculateMiss(state, activeFigures) {
  // Bezbłędnik: pierwszy błąd w rundzie jest anulowany
  if (activeFigures.includes('bezblednik') && state.errors === 0 && !state.bezblednikUsed) {
    return { shouldCancel: true };
  }
  return { shouldCancel: false };
}

// ---- Atrament za rundę -------------------------------------

export function calculateInkReward(basePoints, guessedCorrectly) {
  if (!guessedCorrectly) return 0;
  return 3 + Math.floor(basePoints / 100);
}

// ---- Bonus za czas -----------------------------------------

export function calculateTimeBonus(timeLeft) {
  return timeLeft * 5;
}
