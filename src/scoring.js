// src/scoring.js — system punktacji Litery × Mnożnik (jak Chips × Mult w Balatro)

// Wartości liter (inspirowane polskim Scrabble)
export const LETTER_VALUES = {
  A: 1, E: 1, I: 1, O: 1, N: 1, R: 1, S: 1,
  C: 2, D: 2, K: 2, L: 2, M: 2, P: 2, T: 2, W: 2, Y: 2, Z: 2,
  B: 3, F: 3, G: 3, H: 3, J: 3, Ł: 3, Ó: 3, U: 3,
  Ą: 5, Ć: 5, Ę: 5, Ń: 5, Ś: 5, Ź: 5, Ż: 5,
  // rzadkie
  V: 4, X: 4, Q: 4,
};

// Tiery długości słów (jak układy pokerowe)
// { chipsMultiplier, multBonus, name }
export const WORD_TIERS = [
  { minLen: 2, maxLen: 2, chipsMultiplier: 1.0, multBonus: 0,  name: 'Para',         color: '#6b7280' },
  { minLen: 3, maxLen: 3, chipsMultiplier: 1.5, multBonus: 2,  name: 'Trójka',       color: '#3b82f6' },
  { minLen: 4, maxLen: 4, chipsMultiplier: 2.0, multBonus: 3,  name: 'Czwórka',      color: '#8b5cf6' },
  { minLen: 5, maxLen: 5, chipsMultiplier: 2.5, multBonus: 5,  name: 'Pięciorak',    color: '#f59e0b' },
  { minLen: 6, maxLen: 6, chipsMultiplier: 3.5, multBonus: 8,  name: 'Szesciorak',   color: '#f97316' },
  { minLen: 7, maxLen: 7, chipsMultiplier: 4.5, multBonus: 12, name: 'Siedmiorak',   color: '#ef4444' },
  { minLen: 8, maxLen: 8, chipsMultiplier: 6.0, multBonus: 18, name: 'Ósemka',       color: '#ec4899' },
];

export function getTier(wordLength) {
  return WORD_TIERS.find(t => wordLength >= t.minLen && wordLength <= t.maxLen)
    || WORD_TIERS[0];
}

export function getLetterValue(letter) {
  return LETTER_VALUES[letter.toUpperCase()] ?? 1;
}

/**
 * Oblicz wynik zagrania słowa.
 * @param {string} word - zagrane słowo (uppercase lub lowercase)
 * @param {string} categoryId - ID aktualnej kategorii
 * @param {string[]} categoryWords - lista słów powiązanych z kategorią
 * @param {string[]} activeFigures - ID aktywnych figur
 * @param {object} figureState - dodatkowy stan figur (np. emfaza)
 * @returns {{ chips, mult, score, tier, categoryBonus, figureBonus }}
 */
export function scoreWord(word, categoryId, categoryWords, activeFigures = [], figureState = {}) {
  const letters = word.toUpperCase().split('');
  const tier = getTier(letters.length);

  // ---- Chips (litery) ----------------------------------------
  let chips = 0;
  for (const letter of letters) {
    let val = getLetterValue(letter);

    // Aliteracja: powtarzająca się litera w słowie warta 2×
    if (activeFigures.includes('aliteracja')) {
      const count = letters.filter(l => l === letter).length;
      if (count > 1) val *= 2;
    }

    chips += val;
  }

  chips = Math.floor(chips * tier.chipsMultiplier);

  // ---- Mnożnik -----------------------------------------------
  let mult = 1 + tier.multBonus;

  // Bonus kategorii: słowo należy do listy słów kategorii
  let categoryBonus = 0;
  if (categoryWords.some(w => w.toLowerCase() === word.toLowerCase())) {
    categoryBonus = 3;
    mult += categoryBonus;
  }

  // Polonizm: każda polska litera dodaje +2 mult
  let figureBonus = 0;
  if (activeFigures.includes('polonizm')) {
    const polishLetters = ['Ą','Ć','Ę','Ł','Ń','Ó','Ś','Ź','Ż'];
    const polishCount = letters.filter(l => polishLetters.includes(l)).length;
    figureBonus += polishCount * 2;
    mult += polishCount * 2;
  }

  // Kombo: 3 kolejne słowa z kategorii → +5 mult (sprawdzane w game.js, tu dodajemy)
  if (figureState.komboBonus) {
    mult += 5;
    figureBonus += 5;
  }

  // Emfaza: podwój mnożnik
  if (figureState.emfazaActive) {
    mult *= 2;
  }

  // Hiperbola: mnożnik startuje od ×2 (uwzględnione przez minMult w game.js)
  if (activeFigures.includes('hiperbola') && mult < 2) {
    mult = 2;
  }

  const score = Math.floor(chips * mult);

  return { chips, mult, score, tier, categoryBonus, figureBonus };
}

// Oblicz nagrodę atramentu za wygrany blind
export function calcInkReward(playsUsed, maxPlays, won) {
  if (!won) return 0;
  const remaining = maxPlays - playsUsed;
  return 2 + remaining; // bazowo 2 + 1 za każde niezużyte zagranie
}
