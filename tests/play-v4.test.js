import { beforeEach, describe, expect, it } from 'vitest';
import { setLexiconEntries } from '../src/lexicon.js';
import { analyzeSelection, scoreSelection } from '../src/v4-play.js';

const entry = surface => ({
  surface: surface.toLocaleLowerCase('pl-PL'),
  lemma: surface.toLocaleLowerCase('pl-PL'),
  analyses: [{ partOfSpeech: 'rzeczownik', features: [], properName: false }],
  spellingTags: [],
});

describe('analiza zagrania Litero v4', () => {
  beforeEach(() => {
    setLexiconEntries(['kot', 'tok', 'kottok'].map(entry));
  });

  it('wybiera całe najdłuższe słowo zamiast krótszego podziału', () => {
    expect(analyzeSelection('KOTTOK').words.map(item => item.word)).toEqual([
      'KOTTOK',
    ]);
  });

  it('rozpoznaje kolejne słowa od lewej', () => {
    setLexiconEntries(['kot', 'tok'].map(entry));

    const result = analyzeSelection('KOTTOK');

    expect(result.words.map(item => item.word)).toEqual(['KOT', 'TOK']);
    expect(result.ignored).toBe('');
  });

  it('zatrzymuje analizę na pierwszym nierozpoznanym fragmencie', () => {
    setLexiconEntries(['kot', 'tok'].map(entry));

    const result = analyzeSelection('KOTXYZTOK');

    expect(result.words.map(item => item.word)).toEqual(['KOT']);
    expect(result.ignored).toBe('XYZTOK');
  });

  it('bez słowa wybiera najwyżej wycenioną literę', () => {
    setLexiconEntries([]);

    expect(analyzeSelection('ABĄF').letter).toMatchObject({
      letter: 'Ą',
      index: 2,
    });
  });

  it('przy remisie wybiera pierwszą najwyżej wycenioną literę', () => {
    setLexiconEntries([]);

    expect(analyzeSelection('ABFJ').letter).toMatchObject({
      letter: 'B',
      index: 1,
    });
  });

  it('sumuje osobno punktowane słowa i zużywa Podwojenie tylko na pierwszym', () => {
    setLexiconEntries(['kot', 'tok'].map(entry));

    const result = scoreSelection('KOTTOK', { doubleNext: true });

    expect(result.kind).toBe('words');
    expect(result.units.map(unit => unit.score)).toEqual([42, 21]);
    expect(result.score).toBe(63);
    expect(result.previousWord).toBe('TOK');
    expect(result.consumesDoubleNext).toBe(true);
  });

  it('punktuje pojedynczą literę mnożnikiem jeden bez zużycia Podwojenia', () => {
    setLexiconEntries([]);

    const result = scoreSelection('ABFJ', {
      doubleNext: true,
      previousWord: 'KOT',
    });

    expect(result).toMatchObject({
      kind: 'letter',
      score: 3,
      previousWord: 'KOT',
      consumesDoubleNext: false,
    });
  });
});
