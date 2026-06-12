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

export const POLISH_LETTERS = ['Ą', 'Ć', 'Ę', 'Ł', 'Ń', 'Ó', 'Ś', 'Ź', 'Ż'];

// Tiery długości słów (jak układy pokerowe)
export const WORD_TIERS = [
  { minLen: 2, maxLen: 2, chipsMultiplier: 1.0, multBonus: 0,  name: 'Para',       color: '#6b7280' },
  { minLen: 3, maxLen: 3, chipsMultiplier: 1.5, multBonus: 2,  name: 'Trójka',     color: '#3b82f6' },
  { minLen: 4, maxLen: 4, chipsMultiplier: 2.0, multBonus: 3,  name: 'Czwórka',    color: '#8b5cf6' },
  { minLen: 5, maxLen: 5, chipsMultiplier: 2.5, multBonus: 5,  name: 'Piątka',     color: '#f59e0b' },
  { minLen: 6, maxLen: 6, chipsMultiplier: 3.5, multBonus: 8,  name: 'Szóstka',    color: '#f97316' },
  { minLen: 7, maxLen: 7, chipsMultiplier: 4.5, multBonus: 12, name: 'Siódemka',   color: '#ef4444' },
  { minLen: 8, maxLen: 8, chipsMultiplier: 6.0, multBonus: 18, name: 'Ósemka',     color: '#ec4899' },
];

// Dla długości powyżej najwyższego tieru zwracamy najwyższy tier
// (łączna długość kilku słów w jednym zagraniu może przekroczyć 8)
export function getTier(wordLength) {
  const top = WORD_TIERS[WORD_TIERS.length - 1];
  if (wordLength >= top.minLen) return top;
  return WORD_TIERS.find(t => wordLength >= t.minLen && wordLength <= t.maxLen)
    || WORD_TIERS[0];
}

export function getLetterValue(letter) {
  return LETTER_VALUES[letter.toUpperCase()] ?? 1;
}

/**
 * Oblicz wynik całego zagrania (jedno lub więcej słów + luźne litery).
 * Jedyne źródło prawdy o punktacji — używane zarówno przy zagraniu,
 * jak i w podglądzie wyniku w UI.
 *
 * @param {{word: string}[]} validSegments - rozpoznane słowa
 * @param {{letter: string}[]} extraSegments - litery niewchodzące w żadne słowo
 * @param {object} ctx - kontekst punktacji:
 *   { categoryWords, activeFigures, passiveBonuses, figureState, categoryStreak }
 * @returns {{ chips, mult, score, tier, categoryBonus, extraChips, words, lettersOnly }}
 */
export function scorePlaySegments(validSegments, extraSegments, ctx = {}) {
  const {
    categoryWords = [],
    activeFigures = [],
    passiveBonuses = [],
    figureState = {},
    categoryStreak = 0,
  } = ctx;

  const pioro = passiveBonuses.includes('pioro');
  const iluminacja = passiveBonuses.includes('iluminacja');
  const folio = passiveBonuses.includes('folio');
  const komboBonus = activeFigures.includes('kombo') && categoryStreak >= 2;

  // ---- Chips (litery wszystkich słów) -------------------------
  let totalChips = 0;
  let totalWordLen = 0;
  let totalCategoryBonus = 0;
  let totalPolishCount = 0;

  for (const seg of validSegments) {
    const letters = seg.word.toUpperCase().split('');
    totalWordLen += activeFigures.includes('lakonizm') && letters.length === 3 ? 5 : letters.length;
    for (let i = 0; i < letters.length; i++) {
      let val = LETTER_VALUES[letters[i]] ?? 1;
      // Aliteracja: powtarzająca się litera w słowie warta 2×
      if (activeFigures.includes('aliteracja')
          && letters.filter(l => l === letters[i]).length > 1) {
        val *= 2;
      }
      // Inicjał: pierwsza litera słowa liczy się 2×
      if (i === 0 && activeFigures.includes('inicjal')) val *= 2;
      // Inwersja: ostatnia litera słowa mocno domyka zagranie
      if (i === letters.length - 1 && activeFigures.includes('inwersja')) val *= 4;
      totalChips += val;
    }
    totalPolishCount += letters.filter(l => POLISH_LETTERS.includes(l)).length;
    if (categoryWords.some(w => w.toLowerCase() === seg.word.toLowerCase())) {
      totalCategoryBonus += iluminacja ? 5 : 3;
    }
  }

  // Tier na podstawie łącznej długości słów
  const tier = getTier(totalWordLen);
  totalChips = Math.floor(totalChips * tier.chipsMultiplier);

  if (figureState.synekdochaActive) totalChips *= 2;
  if (pioro) totalChips *= 2;

  // ---- Mnożnik -------------------------------------------------
  // Tag mult15 (za pominięcie blinda): mnożnik startuje od ×1.5
  let mult = (figureState.mult15 ? 1.5 : 1) + tier.multBonus + totalCategoryBonus;
  if (activeFigures.includes('polonizm')) mult += totalPolishCount * 2;
  if (activeFigures.includes('apostrofa')) mult += figureState.apostrofaMult ?? 0;
  if (komboBonus) mult += 5;
  if (folio && totalWordLen >= 6) mult = Math.round(mult * 1.5);
  if (figureState.emfazaActive) mult *= 2;
  if (activeFigures.includes('hiperbola') && mult < 2) mult = 2;

  const baseScore = Math.floor(totalChips * mult);

  // Luźne litery: surowa wartość, bez mnożników
  let extraChips = 0;
  for (const seg of extraSegments) {
    extraChips += LETTER_VALUES[seg.letter.toUpperCase()] ?? 1;
  }

  return {
    chips: totalChips,
    mult,
    score: baseScore + extraChips,
    tier,
    categoryBonus: totalCategoryBonus,
    extraChips,
    words: validSegments.map(s => s.word),
    lettersOnly: validSegments.length === 0,
  };
}

// Oblicz nagrodę atramentu za wygrany blind
export function calcInkReward(playsUsed, maxPlays, won) {
  if (!won) return 0;
  const remaining = Math.max(0, maxPlays - playsUsed);
  return 2 + remaining; // bazowo 2 + 1 za każde niezużyte zagranie
}
