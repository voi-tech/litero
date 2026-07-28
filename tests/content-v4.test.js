import { describe, expect, it } from 'vitest';
import categoriesData from '../data/categories-v4.json';
import { buildGameCategories, validateGameCategories } from '../src/content.js';

describe('treści kategorii v4', () => {
  it('buduje osobne pule łatwych i trudnych słów z metadanymi', () => {
    const categories = buildGameCategories(categoriesData.categories);

    expect(categories.length).toBeGreaterThanOrEqual(3);
    for (const category of categories) {
      expect(category.definition.length).toBeGreaterThan(20);
      expect(category.easyWords.length).toBeGreaterThan(0);
      expect(category.hardWords.length).toBeGreaterThan(0);

      for (const entry of category.easyWords) {
        expect([...entry.word].length).toBeGreaterThanOrEqual(4);
        expect([...entry.word].length).toBeLessThanOrEqual(5);
        expect(entry.partOfSpeech).toBe('rzeczownik');
        expect(entry.definition.length).toBeGreaterThan(20);
      }
      for (const entry of category.hardWords) {
        expect([...entry.word].length).toBeGreaterThanOrEqual(6);
        expect([...entry.word].length).toBeLessThanOrEqual(8);
        expect(entry.partOfSpeech).toBe('rzeczownik');
        expect(entry.definition.length).toBeGreaterThan(20);
      }
    }
  });

  it('nie przepuszcza kategorii bez definicji lub właściwych pul', () => {
    expect(validateGameCategories([
      {
        id: 'bledna',
        name: 'Błędna',
        definition: '',
        easyWords: [],
        hardWords: [],
      },
    ])).toEqual({
      valid: false,
      errors: expect.arrayContaining([
        expect.stringContaining('definicji'),
        expect.stringContaining('łatwych'),
        expect.stringContaining('trudnych'),
      ]),
    });
  });

  it('nie wystawia dawnych nazw etapów w danych użytkowych', () => {
    const serialized = JSON.stringify(buildGameCategories(categoriesData.categories));
    expect(serialized).not.toMatch(/Szkic|Esej|Artykuł|Traktat|blind/i);
  });

  it('każde słowo ma definicję pozwalającą odróżnić je od innych słów kategorii', () => {
    expect(JSON.stringify(categoriesData)).not.toContain('Termin związany z kategorią');
  });
});
