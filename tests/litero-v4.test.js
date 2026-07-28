import { beforeEach, describe, expect, it } from 'vitest';
import {
  chooseUpgrade,
  closeShop,
  completeReveal,
  createRun,
  enterCurrentChallenge,
  getCompletedCategoryResult,
  playValidWord,
  skipByGuess,
  skipWithoutGuess,
} from '../src/litero-v4.js';
import {
  createEmptyProfile,
  commitCompletedCategory,
} from '../src/profile.js';

const category = {
  id: 'nauka',
  name: 'Nauka',
  definition: 'Uporządkowana działalność służąca zdobywaniu wiedzy.',
  easyWords: [
    {
      word: 'ATOM',
      lemma: 'atom',
      partOfSpeech: 'rzeczownik',
      definition: 'Najmniejsza część pierwiastka zachowująca jego właściwości.',
    },
  ],
  hardWords: [
    {
      word: 'NEUTRON',
      lemma: 'neutron',
      partOfSpeech: 'rzeczownik',
      definition: 'Cząstka elektrycznie obojętna występująca w jądrze atomu.',
    },
  ],
};

describe('pętla kategorii Litero v4', () => {
  let run;

  beforeEach(() => {
    run = createRun({
      categories: [category],
      seed: 'test',
      targets: { easy: [120], hard: [240], category: [420] },
    });
  });

  it('zaczyna od Łatwego słowa i udostępnia opis bez odkrywania odpowiedzi', () => {
    expect(run.phase).toBe('definition-select');
    expect(run.challenge.kind).toBe('easy');
    expect(run.challenge.label).toBe('Łatwe słowo');
    expect(run.challenge.partOfSpeech).toBe('rzeczownik');
    expect(run.challenge.letterCount).toBe(4);
    expect(run.challenge.definition).toContain('Najmniejsza część');
    expect(run.challenge.discoveredWord).toBeNull();
  });

  it('poprawne odgadnięcie pomija słowo, zachowuje odkrycie tymczasowo i nie otwiera sklepu', () => {
    run = skipByGuess(run, ' atom ');

    expect(run.discoveries).toEqual([
      expect.objectContaining({ word: 'ATOM', definition: expect.any(String) }),
    ]);
    expect(run.completedChallenges[0]).toMatchObject({
      kind: 'easy',
      skipped: true,
      discovered: true,
    });
    expect(run.phase).toBe('definition-select');
    expect(run.challenge.kind).toBe('hard');
  });

  it('błędne odgadnięcie pomija słowo z negatywnym skutkiem i go nie odkrywa', () => {
    run = skipByGuess(run, 'cząstka');

    expect(run.discoveries).toEqual([]);
    expect(run.completedChallenges[0]).toMatchObject({
      skipped: true,
      discovered: false,
      skipOutcome: 'negative',
    });
    expect(run.challenge.kind).toBe('hard');
  });

  it('pominięcie bez odpowiedzi nie odkrywa słowa', () => {
    run = skipWithoutGuess(run);

    expect(run.discoveries).toEqual([]);
    expect(run.completedChallenges[0]).toMatchObject({
      skipped: true,
      discovered: false,
    });
  });

  it('w czasie gry nie udostępnia operacji zgadywania, a niepoprawne słowo niczego nie zużywa', () => {
    run = enterCurrentChallenge(run);
    const before = run.playsLeft;

    run = playValidWord(run, {
      word: 'XYZ',
      score: 0,
      valid: false,
    });

    expect(run.phase).toBe('playing');
    expect(run.playsLeft).toBe(before);
    expect(run).not.toHaveProperty('guessDuringPlay');
  });

  it('pokonanie celu odkrywa słowo i przechodzi przez sklep', () => {
    run = enterCurrentChallenge(run);
    run = playValidWord(run, {
      word: 'KOT',
      score: 120,
      valid: true,
    });

    expect(run.phase).toBe('word-reveal');
    expect(run.challenge.discoveredWord).toBe('ATOM');
    expect(run.discoveries[0].word).toBe('ATOM');
    expect(run.nextPhase).toBe('shop');
  });

  it('finał pokazuje nazwę kategorii, ale ukrywa jej definicję do zwycięstwa', () => {
    run = skipWithoutGuess(run);
    run = skipWithoutGuess(run);

    expect(run.challenge.kind).toBe('category');
    expect(run.challenge.label).toBe('Kategoria');
    expect(run.challenge.categoryName).toBe('Nauka');
    expect(run.challenge.definition).toBeNull();
    expect(run.challenge.canSkip).toBe(false);
  });

  it('po odkryciu przechodzi przez sklep do następnego słowa', () => {
    run = enterCurrentChallenge(run);
    run = playValidWord(run, { word: 'KOT', score: 120, valid: true });
    run = completeReveal(run);

    expect(run.phase).toBe('shop');
    expect(run.challenge.kind).toBe('easy');

    run = closeShop(run);
    expect(run.phase).toBe('definition-select');
    expect(run.challenge.kind).toBe('hard');
  });

  it('konsumuje skutek pominięcia tylko przy następnym rozegranym wyzwaniu', () => {
    run = skipByGuess(run, 'atom');
    expect(run.pendingEffects).toHaveLength(1);

    run = enterCurrentChallenge(run);
    expect(run.playsLeft).toBe(6);
    expect(run.pendingEffects).toEqual([]);
  });

  it('finał ma obowiązkowe, jawne utrudnienie', () => {
    run = skipWithoutGuess(run);
    run = skipWithoutGuess(run);

    expect(run.challenge.bossModifier).toMatchObject({
      id: expect.any(String),
      label: expect.any(String),
      description: expect.any(String),
    });
    expect(skipWithoutGuess(run)).toBe(run);
  });

  it('utrudnienie Kategorii ma pierwszeństwo przed Zestawem liter', () => {
    run = skipWithoutGuess(run);
    run = skipWithoutGuess(run);
    run = {
      ...run,
      pendingEffects: [],
      challenge: {
        ...run.challenge,
        bossModifier: {
          id: 'test',
          label: 'Test',
          description: 'Test',
          discards: 0,
          handSize: 7,
        },
      },
    };
    run = enterCurrentChallenge(run, { handSize: 9, discardDelta: 1 });

    expect(run.discardsLeft).toBe(0);
    expect(run.handSize).toBe(7);
  });

  it('po pokonaniu finału odsłania definicję i tworzy wynik kategorii dla Słownika', () => {
    run = skipByGuess(run, 'atom');
    run = skipWithoutGuess(run);
    run = enterCurrentChallenge(run);
    run = playValidWord(run, { word: 'KOT', score: 999, valid: true });

    expect(run.phase).toBe('category-reveal');
    expect(run.challenge.definition).toBe(category.definition);
    expect(getCompletedCategoryResult(run)).toMatchObject({
      categoryId: 'nauka',
      categoryName: 'Nauka',
      categoryDefinition: category.definition,
      categoryWon: true,
      discoveries: [expect.objectContaining({ word: 'ATOM' })],
    });
  });

  it('po pierwszej kategorii wymaga wyboru Ulepszenia, a po ostatniej kończy grę', () => {
    const secondCategory = {
      ...category,
      id: 'technika',
      name: 'Technika',
      definition: 'Dziedzina praktycznego wykorzystywania wiedzy, narzędzi oraz urządzeń.',
    };
    run = createRun({
      categories: [category, secondCategory],
      seed: 'test',
      targets: { easy: [1, 1], hard: [1, 1], category: [1, 1] },
    });
    run = skipWithoutGuess(run);
    run = skipWithoutGuess(run);
    run = enterCurrentChallenge(run);
    run = playValidWord(run, { word: 'KOT', score: 10, valid: true });
    run = completeReveal(run);

    expect(run.phase).toBe('upgrade');
    expect(run.upgradeOffer).toHaveLength(3);

    const upgradeId = run.upgradeOffer[0].id;
    run = chooseUpgrade(run, upgradeId);
    expect(run.phase).toBe('shop');
    expect(run.upgrades).toContain(upgradeId);

    run = closeShop(run);
    expect(run.categoryIndex).toBe(1);
    expect(run.challenge.kind).toBe('easy');

    run = skipWithoutGuess(run);
    run = skipWithoutGuess(run);
    run = enterCurrentChallenge(run);
    run = playValidWord(run, { word: 'KOT', score: 10, valid: true });
    run = completeReveal(run);
    expect(run.phase).toBe('victory');
  });
});

describe('trwały Słownik', () => {
  it('zapisuje odkrycia dopiero po pokonaniu kategorii', () => {
    const profile = createEmptyProfile();
    const unfinished = {
      categoryId: 'nauka',
      categoryName: 'Nauka',
      categoryDefinition: category.definition,
      categoryWon: false,
      discoveries: [category.easyWords[0]],
    };

    expect(commitCompletedCategory(profile, unfinished).dictionary).toEqual({});

    const completed = commitCompletedCategory(profile, {
      ...unfinished,
      categoryWon: true,
    });
    expect(completed.dictionary.nauka).toMatchObject({
      name: 'Nauka',
      definition: category.definition,
      words: [expect.objectContaining({ word: 'ATOM' })],
    });
  });

  it('uzupełnia brakujące słowa bez duplikatów przy kolejnym zwycięstwie', () => {
    const first = commitCompletedCategory(createEmptyProfile(), {
      categoryId: 'nauka',
      categoryName: 'Nauka',
      categoryDefinition: category.definition,
      categoryWon: true,
      discoveries: [category.easyWords[0]],
    });
    const second = commitCompletedCategory(first, {
      categoryId: 'nauka',
      categoryName: 'Nauka',
      categoryDefinition: category.definition,
      categoryWon: true,
      discoveries: [category.easyWords[0], category.hardWords[0]],
    });

    expect(second.dictionary.nauka.words.map(item => item.word)).toEqual([
      'ATOM',
      'NEUTRON',
    ]);
  });

  it('zachowuje dokładnie dwa miejsca na słowa w dziale Słownika', () => {
    const result = commitCompletedCategory(createEmptyProfile(), {
      categoryId: 'nauka',
      categoryName: 'Nauka',
      categoryDefinition: category.definition,
      categoryWon: true,
      discoveries: [
        category.easyWords[0],
        category.hardWords[0],
        { ...category.easyWords[0], word: 'JON' },
      ],
    });

    expect(result.dictionary.nauka.words).toHaveLength(2);
  });
});
