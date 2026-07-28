import { describe, expect, it } from 'vitest';
import {
  ACTION_CARDS,
  LANGUAGE_CARDS,
  getUnlockedCards,
  updateUnlockProgress,
} from '../src/language-cards.js';
import {
  LETTER_SETS,
  getLetterSetRules,
  updateLetterSetProgress,
} from '../src/letter-sets.js';
import { scoreWord } from '../src/v4-scoring.js';
import { createEmptyProfile } from '../src/profile.js';

const noun = {
  surface: 'KOT',
  lemma: 'kot',
  analyses: [{ partOfSpeech: 'rzeczownik', features: ['mianownik'] }],
  spellingTags: [],
};

describe('Karty językowe', () => {
  it('ma dokładnie osiem kart dostępnych od początku i pięć odblokowywanych', () => {
    const cards = Object.values(LANGUAGE_CARDS);
    expect(cards).toHaveLength(13);
    expect(cards.filter(card => card.defaultUnlocked)).toHaveLength(8);
    expect(cards.filter(card => !card.defaultUnlocked)).toHaveLength(5);
    expect(cards.every(card => card.name && card.description)).toBe(true);
  });

  it('nie używa dawnych, semantycznie błędnych figur', () => {
    const serialized = JSON.stringify({ LANGUAGE_CARDS, ACTION_CARDS });
    expect(serialized).not.toMatch(/Polonizm|Pleonazm|Litotes|Apostrofa|Skryba|Perfekcjonista/);
  });

  it('premia części mowy działa tylko dla jednoznacznej analizy', () => {
    const nounScore = scoreWord(noun, { activeCardIds: ['rzeczownik'] });
    const ambiguousScore = scoreWord({
      ...noun,
      analyses: [
        { partOfSpeech: 'rzeczownik', features: [] },
        { partOfSpeech: 'czasownik', features: [] },
      ],
    }, { activeCardIds: ['rzeczownik'] });

    expect(nounScore.mult).toBeGreaterThan(ambiguousScore.mult);
    expect(ambiguousScore.appliedCards).not.toContain('rzeczownik');
  });

  it('aliteracja premiuje kolejne słowa o tym samym inicjale, nie powtórzenia wewnątrz słowa', () => {
    const first = scoreWord(
      { ...noun, surface: 'KOK' },
      { activeCardIds: ['aliteracja'], previousWord: null, aliterationStreak: 0 },
    );
    const next = scoreWord(
      noun,
      { activeCardIds: ['aliteracja'], previousWord: 'KOK', aliterationStreak: 1 },
    );

    expect(first.appliedCards).not.toContain('aliteracja');
    expect(next.appliedCards).toContain('aliteracja');
    expect(next.mult).toBeGreaterThan(first.mult);
  });

  it('odrzuca zagranie niebędące dokładnie jednym poprawnym słowem', () => {
    expect(scoreWord(null)).toMatchObject({ valid: false, score: 0 });
    expect(scoreWord({ ...noun, surface: 'KOT DOM' })).toMatchObject({
      valid: false,
      score: 0,
    });
  });

  it('odblokowuje Aliterację po trzech kolejnych słowach o tym samym inicjale', () => {
    const profile = updateUnlockProgress(createEmptyProfile(), {
      mode: 'normal',
      seeded: false,
      aliterationStreak: 3,
    });

    expect(getUnlockedCards(profile).map(card => card.id)).toContain('aliteracja');
  });

  it('nie nalicza odblokowań w trybie dziennym ani seedowanym', () => {
    const daily = updateUnlockProgress(createEmptyProfile(), {
      mode: 'daily',
      seeded: true,
      aliterationStreak: 3,
      palindromeLength: 5,
    });

    expect(daily.unlockedCardIds).toHaveLength(8);
  });
});

describe('Zestawy liter', () => {
  it('udostępnia sześć jawnie opisanych wariantów', () => {
    expect(Object.values(LETTER_SETS)).toHaveLength(6);
    expect(LETTER_SETS.standardowy.defaultUnlocked).toBe(true);
    expect(Object.values(LETTER_SETS).every(set => set.description)).toBe(true);
  });

  it('Mały i Duży zestaw zmieniają rękę oraz liczbę zagrań zgodnie z opisem', () => {
    expect(getLetterSetRules('maly')).toMatchObject({
      handSize: 7,
      playDelta: 1,
      shortWordMultiplier: 1.5,
    });
    expect(getLetterSetRules('duzy')).toMatchObject({
      handSize: 9,
      playDelta: -1,
      longWordMultiplier: 1.5,
    });
  });

  it('odblokowania zestawów naliczają się tylko w zwykłej grze', () => {
    let profile = createEmptyProfile();
    profile = updateLetterSetProgress(profile, {
      mode: 'normal',
      seeded: false,
      vowelRichWords: 20,
      eightLetterWords: 3,
    });
    expect(profile.unlockedLetterSetIds).toEqual(
      expect.arrayContaining(['standardowy', 'samogloski', 'duzy']),
    );

    const daily = updateLetterSetProgress(createEmptyProfile(), {
      mode: 'daily',
      seeded: true,
      vowelRichWords: 20,
    });
    expect(daily.unlockedLetterSetIds).toEqual(['standardowy']);
  });
});
