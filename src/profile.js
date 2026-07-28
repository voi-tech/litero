export function createEmptyProfile() {
  return {
    version: 1,
    dictionary: {},
    unlockedCardIds: [
      'rzeczownik',
      'czasownik',
      'przymiotnik',
      'samogloska',
      'spolgloska',
      'polska-litera',
      'dwuznak',
      'inicjal',
    ],
    unlockedLetterSetIds: ['standardowy'],
    stats: {},
  };
}

export function commitCompletedCategory(profile, result) {
  if (!result?.categoryWon) return profile;

  const previous = profile.dictionary[result.categoryId];
  const byWord = new Map(
    (previous?.words ?? []).map(entry => [entry.word.toLocaleUpperCase('pl-PL'), entry]),
  );
  for (const discovery of result.discoveries ?? []) {
    byWord.set(discovery.word.toLocaleUpperCase('pl-PL'), { ...discovery });
  }

  return {
    ...profile,
    dictionary: {
      ...profile.dictionary,
      [result.categoryId]: {
        id: result.categoryId,
        name: result.categoryName,
        definition: result.categoryDefinition,
        words: [...byWord.values()].slice(0, 2),
      },
    },
  };
}
