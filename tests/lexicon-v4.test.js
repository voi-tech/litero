import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import categoriesData from '../data/categories-v4.json';
import {
  getLexiconEntry,
  isAcceptedWord,
  setLexiconEntries,
} from '../src/lexicon.js';

const payload = JSON.parse(readFileSync('public/data/lexicon-v4.json', 'utf8'));

describe('kuratorowany słownik v4', () => {
  it('zawiera kilka tysięcy opisanych form, a nie surową listę ciągów', () => {
    expect(payload.license).toContain('BSD');
    expect(payload.sourceLinks).toEqual(expect.arrayContaining([
      'https://morfeusz.sgjp.pl/doc/license/',
      'https://github.com/rspeer/wordfreq/',
    ]));
    expect(payload.notice).toContain('THIRD_PARTY_NOTICES.md');
    expect(payload.entries.length).toBeGreaterThanOrEqual(20_000);
    expect(payload.entries[0]).toMatchObject({
      surface: expect.any(String),
      lemma: expect.any(String),
      analyses: expect.any(Array),
      spellingTags: expect.any(Array),
    });
  });

  it('zawiera wszystkie słowa używane przez definicje kategorii', () => {
    const available = new Set(payload.entries.map(entry => entry.surface));
    const targets = categoriesData.categories
      .flatMap(category => [...category.easyWords, ...category.hardWords])
      .map(entry => entry.word.toLocaleLowerCase('pl-PL'));

    for (const target of targets) expect(available.has(target)).toBe(true);
  });

  it('zawiera zwykłe polskie słowa potrzebne w rozgrywce', () => {
    const available = new Set(payload.entries.map(entry => entry.surface));

    for (const word of ['byk', 'byki', 'kot', 'tok']) {
      expect(available.has(word), `brak zwykłego słowa: ${word}`).toBe(true);
    }
  });

  it('ogranicza formy do polskich słów długości 2–8 i pomija nazwy własne', () => {
    for (const entry of payload.entries) {
      expect(entry.surface).toMatch(/^[a-ząćęłńóśźż]{2,8}$/u);
      expect(entry.analyses.length).toBeGreaterThan(0);
      expect(entry.analyses.every(analysis => analysis.partOfSpeech)).toBe(true);
      expect(entry.analyses.every(analysis => !analysis.properName)).toBe(true);
    }
  });

  it('pomija formy nieodpowiednie dla rodzinnej gry 10+', () => {
    const forbidden = new Set(['porno', 'seks', 'seksu', 'gwałt', 'gwałtu']);
    expect(payload.entries.some(entry => forbidden.has(entry.surface))).toBe(false);
  });

  it('wyszukuje formę bez rozróżniania wielkości liter', () => {
    setLexiconEntries([
      {
        surface: 'kot',
        lemma: 'kot',
        analyses: [{ partOfSpeech: 'rzeczownik', features: [] }],
        spellingTags: [],
      },
    ]);

    expect(isAcceptedWord('KOT')).toBe(true);
    expect(getLexiconEntry(' Kot ')).toMatchObject({ lemma: 'kot' });
    expect(isAcceptedWord('pies')).toBe(false);
  });
});
