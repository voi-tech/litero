const LABELS = {
  easy: 'Łatwe słowo',
  hard: 'Trudne słowo',
  category: 'Kategoria',
};

const DEFAULT_SKIP_EFFECTS = {
  positive: { id: 'extra-play', label: '+1 zagranie', plays: 1 },
  negative: { id: 'smaller-hand', label: 'Ręka mniejsza o 1', handSize: -1 },
};

export const BOSS_MODIFIERS = [
  {
    id: 'fewer-play',
    label: 'Mniej zagrań',
    description: 'To wyzwanie ma o jedno zagranie mniej.',
    playDelta: -1,
  },
  {
    id: 'no-discards',
    label: 'Bez odrzuceń',
    description: 'W tym wyzwaniu nie można odrzucać liter.',
    discards: 0,
  },
  {
    id: 'smaller-hand',
    label: 'Mniejszy zestaw',
    description: 'Ręka zawiera najwyżej siedem liter.',
    handSize: 7,
  },
  {
    id: 'higher-target',
    label: 'Wyższy cel',
    description: 'Cel punktowy jest wyższy o 20%.',
    targetMultiplier: 1.2,
  },
  {
    id: 'weaker-first-play',
    label: 'Słabsze pierwsze słowo',
    description: 'Pierwsze poprawne słowo daje połowę punktów.',
    firstPlayMultiplier: 0.5,
  },
  {
    id: 'vowels-no-chips',
    label: 'Samogłoski bez punktów podstawowych',
    description: 'Samogłoski nie dają punktów podstawowych.',
    vowelsGiveNoChips: true,
  },
];

export const UPGRADES = [
  {
    id: 'extra-play',
    name: 'Dodatkowe zagranie',
    description: 'Każde wyzwanie ma jedno dodatkowe zagranie.',
    playDelta: 1,
  },
  {
    id: 'extra-discard',
    name: 'Dodatkowe odrzucenie',
    description: 'Każde wyzwanie ma jedno dodatkowe odrzucenie.',
    discardDelta: 1,
  },
  {
    id: 'larger-hand',
    name: 'Większa ręka',
    description: 'Ręka zawiera jedną literę więcej.',
    handSizeDelta: 1,
  },
  {
    id: 'letter-value',
    name: 'Wyższa wartość liter',
    description: 'Punkty podstawowe liter są wyższe o 25%.',
    chipMultiplier: 1.25,
  },
  {
    id: 'larger-reward',
    name: 'Większa nagroda',
    description: 'Wygrane wyzwanie daje dwa dodatkowe atramenty.',
    inkDelta: 2,
  },
];

function wordFor(category, kind) {
  const pool = kind === 'easy' ? category.easyWords : category.hardWords;
  return pool?.[0] ?? null;
}

function targetFor(run, kind) {
  return run.targets[kind]?.[run.categoryIndex]
    ?? run.targets[kind]?.at(-1)
    ?? 1;
}

function buildChallenge(run, kind) {
  const category = run.categories[run.categoryIndex];
  if (kind === 'category') {
    const bossModifier = BOSS_MODIFIERS[
      Math.abs(hashText(`${run.seed}:${category.id}`)) % BOSS_MODIFIERS.length
    ];
    return {
      kind,
      label: LABELS[kind],
      categoryId: category.id,
      categoryName: category.name,
      definition: null,
      targetScore: Math.round(
        targetFor(run, kind) * (bossModifier.targetMultiplier ?? 1),
      ),
      canSkip: false,
      bossModifier,
      discoveredWord: null,
    };
  }

  const entry = wordFor(category, kind);
  return {
    kind,
    label: LABELS[kind],
    categoryId: category.id,
    word: entry.word,
    lemma: entry.lemma,
    partOfSpeech: entry.partOfSpeech,
    letterCount: [...entry.word].length,
    definition: entry.definition,
    targetScore: targetFor(run, kind),
    canSkip: true,
    positiveEffect: { ...DEFAULT_SKIP_EFFECTS.positive },
    negativeEffect: { ...DEFAULT_SKIP_EFFECTS.negative },
    discoveredWord: null,
  };
}

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRun({
  categories,
  seed,
  targets = {
    easy: [120, 200, 280],
    hard: [240, 400, 560],
    category: [420, 690, 960],
  },
  mode = 'normal',
  difficulty = 'standardowy',
} = {}) {
  const run = {
    version: 4,
    phase: 'definition-select',
    mode,
    difficulty,
    seed,
    categories: [...(categories ?? [])],
    targets,
    categoryIndex: 0,
    challengeIndex: 0,
    completedChallenges: [],
    discoveries: [],
    pendingEffects: [],
    runningScore: 0,
    playsLeft: 5,
    discardsLeft: 3,
    categoryWon: false,
    upgrades: [],
    upgradeOffer: [],
    ink: 0,
  };
  return {
    ...run,
    challenge: buildChallenge(run, 'easy'),
  };
}

function currentEntry(run) {
  const category = run.categories[run.categoryIndex];
  return wordFor(category, run.challenge.kind);
}

function nextKind(challengeIndex) {
  return ['easy', 'hard', 'category'][challengeIndex] ?? null;
}

function advanceAfterSkip(run, completion, effect) {
  const challengeIndex = run.challengeIndex + 1;
  const advanced = {
    ...run,
    phase: 'definition-select',
    challengeIndex,
    completedChallenges: [...run.completedChallenges, completion],
    pendingEffects: effect
      ? [...run.pendingEffects, effect]
      : [...run.pendingEffects],
  };
  return {
    ...advanced,
    challenge: buildChallenge(advanced, nextKind(challengeIndex)),
  };
}

export function enterCurrentChallenge(run, letterSetRules = {}) {
  if (run.phase !== 'definition-select') return run;
  const upgradeRules = run.upgrades
    .map(id => UPGRADES.find(upgrade => upgrade.id === id))
    .filter(Boolean);
  let playsLeft = 5 + (letterSetRules.playDelta ?? 0)
    + upgradeRules.reduce((sum, item) => sum + (item.playDelta ?? 0), 0);
  let discardsLeft = 3 + (letterSetRules.discardDelta ?? 0) + upgradeRules.reduce(
    (sum, item) => sum + (item.discardDelta ?? 0),
    0,
  );
  let handSize = (letterSetRules.handSize ?? 8) + upgradeRules.reduce(
    (sum, item) => sum + (item.handSizeDelta ?? 0),
    0,
  );

  for (const effect of run.pendingEffects) {
    playsLeft += effect.plays ?? 0;
    discardsLeft += effect.discards ?? 0;
    handSize += effect.handSize ?? 0;
  }

  if (run.challenge.kind === 'category') {
    const modifier = run.challenge.bossModifier;
    playsLeft += modifier.playDelta ?? 0;
    if (modifier.discards != null) discardsLeft = modifier.discards;
    if (modifier.handSize != null) handSize = Math.min(handSize, modifier.handSize);
  }
  return {
    ...run,
    phase: 'playing',
    runningScore: 0,
    playsLeft,
    discardsLeft,
    handSize,
    pendingEffects: [],
  };
}

export function playValidWord(run, play) {
  if (run.phase !== 'playing' || !play?.valid) return run;

  const runningScore = run.runningScore + Math.max(0, Number(play.score) || 0);
  const playsLeft = run.playsLeft - 1;
  if (runningScore < run.challenge.targetScore) {
    return {
      ...run,
      runningScore,
      playsLeft,
      phase: playsLeft <= 0 ? 'defeat' : 'playing',
    };
  }

  if (run.challenge.kind === 'category') {
    const category = run.categories[run.categoryIndex];
    return {
      ...run,
      runningScore,
      playsLeft,
      phase: 'category-reveal',
      nextPhase: run.categoryIndex >= run.categories.length - 1
        ? 'victory'
        : 'upgrade',
      categoryWon: true,
      challenge: {
        ...run.challenge,
        definition: category.definition,
      },
      completedChallenges: [
        ...run.completedChallenges,
        {
          kind: 'category',
          skipped: false,
          discovered: true,
          score: runningScore,
        },
      ],
    };
  }

  const entry = currentEntry(run);
  const discovery = { ...entry, categoryId: run.challenge.categoryId };
  return {
    ...run,
    runningScore,
    playsLeft,
    phase: 'word-reveal',
    nextPhase: 'shop',
    challenge: {
      ...run.challenge,
      discoveredWord: entry.word,
    },
    discoveries: [...run.discoveries, discovery],
    completedChallenges: [
      ...run.completedChallenges,
      {
        kind: run.challenge.kind,
        skipped: false,
        discovered: true,
        score: runningScore,
      },
    ],
  };
}

export function skipByGuess(run, attempt) {
  if (run.phase !== 'definition-select' || !run.challenge.canSkip) return run;
  const entry = currentEntry(run);
  const correct = String(attempt ?? '').trim().toLocaleUpperCase('pl-PL')
    === entry.word.toLocaleUpperCase('pl-PL');
  const completion = {
    kind: run.challenge.kind,
    skipped: true,
    discovered: correct,
    skipOutcome: correct ? 'positive' : 'negative',
    score: 0,
  };
  const withDiscovery = correct
    ? {
        ...run,
        discoveries: [
          ...run.discoveries,
          { ...entry, categoryId: run.challenge.categoryId },
        ],
      }
    : run;
  return advanceAfterSkip(
    withDiscovery,
    completion,
    correct ? run.challenge.positiveEffect : run.challenge.negativeEffect,
  );
}

export function skipWithoutGuess(run) {
  if (run.phase !== 'definition-select' || !run.challenge.canSkip) return run;
  return advanceAfterSkip(
    run,
    {
      kind: run.challenge.kind,
      skipped: true,
      discovered: false,
      skipOutcome: 'negative',
      score: 0,
    },
    run.challenge.negativeEffect,
  );
}

export function completeReveal(run) {
  if (run.phase === 'word-reveal') {
    return {
      ...run,
      phase: 'shop',
      shopContext: 'word',
    };
  }
  if (run.phase !== 'category-reveal') return run;
  if (run.categoryIndex >= run.categories.length - 1) {
    return {
      ...run,
      phase: 'victory',
      nextPhase: null,
    };
  }
  const start = Math.abs(hashText(`${run.seed}:upgrade:${run.categoryIndex}`))
    % UPGRADES.length;
  const offer = [0, 1, 2].map(offset => UPGRADES[(start + offset) % UPGRADES.length]);
  return {
    ...run,
    phase: 'upgrade',
    upgradeOffer: offer,
    nextPhase: 'shop',
  };
}

function advanceToNextWord(run) {
  const challengeIndex = run.challengeIndex + 1;
  const advanced = {
    ...run,
    phase: 'definition-select',
    challengeIndex,
    shopContext: null,
  };
  return {
    ...advanced,
    challenge: buildChallenge(advanced, nextKind(challengeIndex)),
  };
}

function advanceToNextCategory(run) {
  const categoryIndex = run.categoryIndex + 1;
  const advanced = {
    ...run,
    phase: 'definition-select',
    categoryIndex,
    challengeIndex: 0,
    categoryWon: false,
    shopContext: null,
  };
  return {
    ...advanced,
    challenge: buildChallenge(advanced, 'easy'),
  };
}

export function closeShop(run) {
  if (run.phase !== 'shop') return run;
  return run.shopContext === 'category'
    ? advanceToNextCategory(run)
    : advanceToNextWord(run);
}

export function chooseUpgrade(run, upgradeId) {
  if (run.phase !== 'upgrade') return run;
  const selected = run.upgradeOffer.find(upgrade => upgrade.id === upgradeId);
  if (!selected) return run;
  return {
    ...run,
    phase: 'shop',
    shopContext: 'category',
    upgrades: [...run.upgrades, selected.id],
    upgradeOffer: [],
  };
}

export function getCompletedCategoryResult(run) {
  const category = run.categories[run.categoryIndex];
  return {
    categoryId: category.id,
    categoryName: category.name,
    categoryDefinition: category.definition,
    categoryWon: run.categoryWon,
    discoveries: run.discoveries.filter(
      discovery => discovery.categoryId === category.id,
    ),
  };
}
