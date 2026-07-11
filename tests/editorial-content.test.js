import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { validatePuzzleContent } from '../src/editorial/content.js';
import editorialPuzzles from '../data/editorial-puzzles.json';

const validPuzzle = {
  id: 'nauka-grawitacja',
  word: 'GRAWITACJA',
  category: 'Nauka',
  definitions: {
    simple: 'Siła, która przyciąga przedmioty do Ziemi.',
    full: 'Zjawisko wzajemnego przyciągania się ciał mających masę.',
  },
  example: 'Grawitacja sprawia, że piłka spada na ziemię.',
  synonyms: ['ciążenie'],
  curiosity: 'Na Księżycu grawitacja jest około sześć razy słabsza niż na Ziemi.',
  knowledgeQuestion: {
    prompt: 'Co robi grawitacja?',
    options: ['Przyciąga ciała', 'Zmienia kolory', 'Wytwarza dźwięk'],
    correctIndex: 0,
  },
  difficulty: { commonness: 2, abstraction: 2, readingLevel: 2 },
};

describe('validatePuzzleContent', () => {
  test('accepts complete unique Polish puzzle content', () => {
    expect(validatePuzzleContent([validPuzzle])).toEqual({ valid: true, errors: [] });
  });

  test('reports duplicate words and invalid difficulty ranges', () => {
    const invalid = { ...validPuzzle, id: 'duplicate', difficulty: { ...validPuzzle.difficulty, readingLevel: 7 } };
    const result = validatePuzzleContent([validPuzzle, invalid]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('duplicate: słowo GRAWITACJA występuje więcej niż raz');
    expect(result.errors).toContain('duplicate: readingLevel musi mieścić się w zakresie 1–3');
  });

  test('accepts every shipped puzzle against the production dictionary', () => {
    const dictionary = new Set(JSON.parse(readFileSync('public/data/dictionary.json', 'utf8')));
    expect(validatePuzzleContent(editorialPuzzles, dictionary)).toEqual({ valid: true, errors: [] });
  });
});
