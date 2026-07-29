import { getLetterSetRules } from './letter-sets.js';

export const LETTER_VALUES = {
  A: 1, E: 1, I: 1, O: 1, N: 1, R: 1, S: 1,
  C: 2, D: 2, K: 2, L: 2, M: 2, P: 2, T: 2, W: 2, Y: 2, Z: 2,
  B: 3, F: 3, G: 3, H: 3, J: 3, Ł: 3, Ó: 3, U: 3,
  Ą: 5, Ć: 5, Ę: 5, Ń: 5, Ś: 5, Ź: 5, Ż: 5,
};
export const POLISH_LETTERS = ['Ą', 'Ć', 'Ę', 'Ł', 'Ń', 'Ó', 'Ś', 'Ź', 'Ż'];
const LENGTH_TIERS = [
  { length: 2, chipsMultiplier: 1, multBonus: 0 },
  { length: 3, chipsMultiplier: 1.5, multBonus: 2 },
  { length: 4, chipsMultiplier: 2, multBonus: 3 },
  { length: 5, chipsMultiplier: 2.5, multBonus: 5 },
  { length: 6, chipsMultiplier: 3.5, multBonus: 8 },
  { length: 7, chipsMultiplier: 4.5, multBonus: 12 },
  { length: 8, chipsMultiplier: 6, multBonus: 18 },
];
const VOWELS = new Set(['A', 'Ą', 'E', 'Ę', 'I', 'O', 'Ó', 'U', 'Y']);
const DIGRAPHS = ['CH', 'CZ', 'DZ', 'DŹ', 'DŻ', 'RZ', 'SZ'];
const WORD_PATTERN = /^[A-ZĄĆĘŁŃÓŚŹŻ]+$/u;

function unambiguousPartOfSpeech(entry) {
  const values = new Set(
    (entry.analyses ?? []).map(analysis => analysis.partOfSpeech).filter(Boolean),
  );
  return values.size === 1 ? [...values][0] : null;
}

function hasFeature(entry, feature) {
  return (entry.analyses ?? []).some(analysis => analysis.features?.includes(feature));
}

function digraphCount(word) {
  return DIGRAPHS.reduce((count, digraph) => {
    let from = 0;
    let found = 0;
    while ((from = word.indexOf(digraph, from)) !== -1) {
      found += 1;
      from += digraph.length;
    }
    return count + found;
  }, 0);
}

function getLengthTier(length) {
  return LENGTH_TIERS.find(item => item.length === Math.min(8, length))
    ?? LENGTH_TIERS[0];
}

export function scoreLetter(letter) {
  const normalized = String(letter ?? '').toLocaleUpperCase('pl-PL');
  const chips = LETTER_VALUES[normalized] ?? 0;
  return {
    valid: chips > 0,
    chips,
    mult: 1,
    score: chips,
    appliedCards: [],
    aliterationStreak: 0,
  };
}

export function scoreWord(entry, context = {}) {
  const surface = entry?.surface?.toLocaleUpperCase('pl-PL') ?? '';
  if (!WORD_PATTERN.test(surface) || [...surface].length < 2 || [...surface].length > 8) {
    return {
      valid: false,
      chips: 0,
      mult: 1,
      score: 0,
      appliedCards: [],
      aliterationStreak: 0,
    };
  }

  const activeCards = new Set(context.activeCardIds ?? []);
  const setRules = getLetterSetRules(context.letterSetId ?? 'standardowy');
  const letters = [...surface];
  const appliedCards = [];

  let chips = 0;
  for (let index = 0; index < letters.length; index += 1) {
    const letter = letters[index];
    let value = LETTER_VALUES[letter] ?? 1;
    if (activeCards.has('samogloska') && VOWELS.has(letter)) {
      value += 1;
      appliedCards.push('samogloska');
    }
    if (activeCards.has('spolgloska') && !VOWELS.has(letter)) {
      value += 1;
      appliedCards.push('spolgloska');
    }
    if (activeCards.has('inicjal') && index === 0) {
      value *= 2;
      appliedCards.push('inicjal');
    }
    chips += value;
  }

  const useLakonizm = activeCards.has('lakonizm') && letters.length <= 4;
  const tierLength = useLakonizm ? Math.min(8, letters.length + 2) : letters.length;
  if (useLakonizm) appliedCards.push('lakonizm');
  const tier = getLengthTier(tierLength);
  chips = Math.floor(chips * tier.chipsMultiplier);

  if (activeCards.has('palindrom') && surface === [...surface].reverse().join('')) {
    chips *= 2;
    appliedCards.push('palindrom');
  }
  if (letters.length <= 4) chips = Math.floor(chips * setRules.shortWordMultiplier);
  if (letters.length >= 6) chips = Math.floor(chips * setRules.longWordMultiplier);

  let mult = 1 + tier.multBonus;
  const partOfSpeech = unambiguousPartOfSpeech(entry);
  if (partOfSpeech && activeCards.has(partOfSpeech)) {
    mult += 2;
    appliedCards.push(partOfSpeech);
  }

  if (activeCards.has('polska-litera')) {
    const count = letters.filter(letter => POLISH_LETTERS.includes(letter)).length;
    if (count > 0) {
      mult += count;
      appliedCards.push('polska-litera');
    }
  }

  if (activeCards.has('dwuznak')) {
    const count = digraphCount(surface);
    if (count > 0) {
      mult += count * 2;
      appliedCards.push('dwuznak');
    }
  }

  const previousInitial = context.previousWord?.[0]?.toLocaleUpperCase('pl-PL');
  const initial = letters[0];
  const aliterationStreak = previousInitial === initial
    ? (context.aliterationStreak ?? 0) + 1
    : 1;
  if (activeCards.has('aliteracja') && previousInitial === initial) {
    mult += aliterationStreak * 2;
    appliedCards.push('aliteracja');
  }

  if (activeCards.has('zdrobnienie') && hasFeature(entry, 'zdrobnienie')) {
    mult += 5;
    appliedCards.push('zdrobnienie');
  }
  if (activeCards.has('hiperbola')) {
    mult *= 1.5;
    appliedCards.push('hiperbola');
  }
  if (context.doubleNext) {
    mult *= 2;
  }

  return {
    valid: true,
    chips,
    mult,
    score: Math.floor(chips * mult),
    tier,
    appliedCards: [...new Set(appliedCards)],
    aliterationStreak,
  };
}
