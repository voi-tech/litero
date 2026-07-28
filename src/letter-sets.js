const BASE_RULES = {
  handSize: 8,
  playDelta: 0,
  discardDelta: 0,
  vowelWeight: 1,
  consonantWeight: 1,
  polishLetterWeight: 1,
  shortWordMultiplier: 1,
  longWordMultiplier: 1,
};

export const LETTER_SETS = {
  standardowy: {
    id: 'standardowy',
    name: 'Standardowy',
    description: 'Osiem liter i zrównoważona częstość znaków.',
    defaultUnlocked: true,
    rules: {},
  },
  samogloski: {
    id: 'samogloski',
    name: 'Przewaga samogłosek',
    description: 'Samogłoski pojawiają się o połowę częściej.',
    defaultUnlocked: false,
    unlockDescription: 'Zagraj 20 słów złożonych co najmniej w połowie z samogłosek.',
    rules: { vowelWeight: 1.5 },
  },
  spolgloski: {
    id: 'spolgloski',
    name: 'Przewaga spółgłosek',
    description: 'Spółgłoski pojawiają się częściej, a każde wyzwanie ma dodatkowe odrzucenie.',
    defaultUnlocked: false,
    unlockDescription: 'Zagraj 20 słów złożonych co najmniej w dwóch trzecich ze spółgłosek.',
    rules: { consonantWeight: 1.25, discardDelta: 1 },
  },
  'polskie-litery': {
    id: 'polskie-litery',
    name: 'Polskie litery',
    description: 'Litery z polskimi znakami pojawiają się trzy razy częściej.',
    defaultUnlocked: false,
    unlockDescription: 'Użyj wszystkich dziewięciu polskich liter.',
    rules: { polishLetterWeight: 3 },
  },
  maly: {
    id: 'maly',
    name: 'Mały zestaw',
    description: 'Siedem liter, dodatkowe zagranie i premia dla słów do czterech liter.',
    defaultUnlocked: false,
    unlockDescription: 'Pokonaj kategorię bez słowa dłuższego niż cztery litery.',
    rules: { handSize: 7, playDelta: 1, shortWordMultiplier: 1.5 },
  },
  duzy: {
    id: 'duzy',
    name: 'Duży zestaw',
    description: 'Dziewięć liter, jedno zagranie mniej i premia dla słów od sześciu liter.',
    defaultUnlocked: false,
    unlockDescription: 'Zagraj trzy słowa mające osiem liter.',
    rules: { handSize: 9, playDelta: -1, longWordMultiplier: 1.5 },
  },
};

export function getLetterSetRules(id) {
  return {
    ...BASE_RULES,
    ...(LETTER_SETS[id] ?? LETTER_SETS.standardowy).rules,
  };
}

export function updateLetterSetProgress(profile, event) {
  if (event?.mode !== 'normal' || event?.seeded) return profile;
  const unlocked = new Set(profile.unlockedLetterSetIds ?? ['standardowy']);
  const stats = { ...(profile.stats ?? {}) };

  for (const key of ['vowelRichWords', 'consonantRichWords', 'eightLetterWords']) {
    stats[key] = (stats[key] ?? 0) + (event[key] ?? 0);
  }
  const usedPolishLetters = new Set([
    ...(stats.usedPolishLetters ?? []),
    ...(event.usedPolishLetters ?? []),
  ]);
  stats.usedPolishLetters = [...usedPolishLetters];

  if (stats.vowelRichWords >= 20) unlocked.add('samogloski');
  if (stats.consonantRichWords >= 20) unlocked.add('spolgloski');
  if (usedPolishLetters.size >= 9) unlocked.add('polskie-litery');
  if (event.categoryWonWithMaxWordLength != null
    && event.categoryWonWithMaxWordLength <= 4) unlocked.add('maly');
  if (stats.eightLetterWords >= 3) unlocked.add('duzy');

  return {
    ...profile,
    stats,
    unlockedLetterSetIds: [...unlocked],
  };
}
