export const LANGUAGE_CARDS = {
  rzeczownik: {
    id: 'rzeczownik',
    name: 'Rzeczownik',
    category: 'części mowy',
    description: 'Jednoznaczne rzeczowniki otrzymują +2 do mnożnika.',
    defaultUnlocked: true,
    cost: 3,
  },
  czasownik: {
    id: 'czasownik',
    name: 'Czasownik',
    category: 'części mowy',
    description: 'Jednoznaczne czasowniki otrzymują +2 do mnożnika.',
    defaultUnlocked: true,
    cost: 3,
  },
  przymiotnik: {
    id: 'przymiotnik',
    name: 'Przymiotnik',
    category: 'części mowy',
    description: 'Jednoznaczne przymiotniki otrzymują +2 do mnożnika.',
    defaultUnlocked: true,
    cost: 3,
  },
  samogloska: {
    id: 'samogloska',
    name: 'Samogłoska',
    category: 'litery i głoski',
    description: 'Każda samogłoska jest warta o 1 punkt podstawowy więcej.',
    defaultUnlocked: true,
    cost: 3,
  },
  spolgloska: {
    id: 'spolgloska',
    name: 'Spółgłoska',
    category: 'litery i głoski',
    description: 'Każda spółgłoska jest warta o 1 punkt podstawowy więcej.',
    defaultUnlocked: true,
    cost: 3,
  },
  'polska-litera': {
    id: 'polska-litera',
    name: 'Polska litera',
    category: 'pisownia',
    description: 'Litery ą, ć, ę, ł, ń, ó, ś, ź i ż dają +1 do mnożnika.',
    defaultUnlocked: true,
    cost: 3,
  },
  dwuznak: {
    id: 'dwuznak',
    name: 'Dwuznak',
    category: 'pisownia',
    description: 'Każdy polski dwuznak daje +2 do mnożnika.',
    defaultUnlocked: true,
    cost: 3,
  },
  inicjal: {
    id: 'inicjal',
    name: 'Inicjał',
    category: 'budowa wyrazu',
    description: 'Pierwsza litera słowa ma podwójną wartość podstawową.',
    defaultUnlocked: true,
    cost: 3,
  },
  aliteracja: {
    id: 'aliteracja',
    name: 'Aliteracja',
    category: 'stylistyka',
    description: 'Kolejne słowa zaczynające się tą samą literą zwiększają mnożnik.',
    defaultUnlocked: false,
    unlockDescription: 'Zagraj trzy słowa z rzędu zaczynające się tą samą literą.',
    cost: 4,
  },
  palindrom: {
    id: 'palindrom',
    name: 'Palindrom',
    category: 'budowa wyrazu',
    description: 'Palindrom ma podwójną wartość punktów podstawowych.',
    defaultUnlocked: false,
    unlockDescription: 'Zagraj palindrom mający co najmniej trzy litery.',
    cost: 4,
  },
  zdrobnienie: {
    id: 'zdrobnienie',
    name: 'Zdrobnienie',
    category: 'słowotwórstwo',
    description: 'Zdrobnienie otrzymuje +5 do mnożnika.',
    defaultUnlocked: false,
    unlockDescription: 'Zagraj dziesięć oznaczonych zdrobnień.',
    cost: 4,
  },
  lakonizm: {
    id: 'lakonizm',
    name: 'Lakonizm',
    category: 'stylistyka',
    description: 'Słowa mające najwyżej cztery litery liczą się jak słowa o dwie litery dłuższe.',
    defaultUnlocked: false,
    unlockDescription: 'Pokonaj kategorię, używając wyłącznie słów do czterech liter.',
    cost: 5,
  },
  hiperbola: {
    id: 'hiperbola',
    name: 'Hiperbola',
    category: 'stylistyka',
    description: 'Końcowy mnożnik każdego słowa zwiększa się o połowę.',
    defaultUnlocked: false,
    unlockDescription: 'Zdobądź co najmniej 300 punktów jednym słowem.',
    cost: 6,
  },
};

export const ACTION_CARDS = {
  dobranie: {
    id: 'dobranie',
    name: 'Dobranie',
    description: 'Dobierz trzy dodatkowe litery.',
    effect: 'draw',
    amount: 3,
    cost: 2,
  },
  wymiana: {
    id: 'wymiana',
    name: 'Wymiana',
    description: 'Wymień do trzech zaznaczonych liter.',
    effect: 'exchange',
    amount: 3,
    cost: 3,
  },
  'dodatkowe-zagranie': {
    id: 'dodatkowe-zagranie',
    name: 'Dodatkowe zagranie',
    description: 'Otrzymaj jedno dodatkowe zagranie.',
    effect: 'play',
    amount: 1,
    cost: 3,
  },
  'dodatkowe-odrzucenie': {
    id: 'dodatkowe-odrzucenie',
    name: 'Dodatkowe odrzucenie',
    description: 'Otrzymaj jedno dodatkowe odrzucenie.',
    effect: 'discard',
    amount: 1,
    cost: 2,
  },
  podwojenie: {
    id: 'podwojenie',
    name: 'Podwojenie',
    description: 'Podwój wynik następnego poprawnego słowa.',
    effect: 'double-next',
    amount: 2,
    cost: 4,
  },
};

export function getUnlockedCards(profile) {
  const unlocked = new Set(profile?.unlockedCardIds ?? []);
  return Object.values(LANGUAGE_CARDS).filter(card => unlocked.has(card.id));
}

export function updateUnlockProgress(profile, event) {
  if (event?.mode !== 'normal' || event?.seeded) return profile;

  const unlocked = new Set(profile.unlockedCardIds);
  const stats = { ...profile.stats };
  if ((event.aliterationStreak ?? 0) >= 3) unlocked.add('aliteracja');
  if ((event.palindromeLength ?? 0) >= 3) unlocked.add('palindrom');

  stats.diminutivesPlayed = (stats.diminutivesPlayed ?? 0) + (event.diminutivesPlayed ?? 0);
  if (stats.diminutivesPlayed >= 10) unlocked.add('zdrobnienie');
  if (event.categoryWonWithMaxWordLength != null
    && event.categoryWonWithMaxWordLength <= 4) {
    unlocked.add('lakonizm');
  }
  if ((event.singleWordScore ?? 0) >= 300) unlocked.add('hiperbola');

  return {
    ...profile,
    unlockedCardIds: [...unlocked],
    stats,
  };
}
