// src/words.js — pula słów + fetch z Wikisłownika

import wordsData from '../data/words.json';

const WORDS = wordsData.words;

// ---- Fetch definicji z Wikisłownika -----------------------

export async function fetchDefinition(word) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const url = `https://pl.wiktionary.org/w/api.php`
      + `?action=query`
      + `&titles=${encodeURIComponent(word.toLowerCase())}`
      + `&prop=extracts&exintro=1&explaintext=1`
      + `&format=json&origin=*`;

    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json();

    const pages = data?.query?.pages;
    if (!pages) return null;

    const page = pages[Object.keys(pages)[0]];
    if (!page || page.missing !== undefined) return null;

    return parseWikionaryExtract(page.extract || '');
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseWikionaryExtract(text) {
  if (!text || text.trim().length < 20) return null;

  const lines = text
    .split('\n')
    .map(l => l
      .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
      .replace(/\{\{[^}]+\}\}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    )
    .filter(l =>
      l.length > 20 &&
      !l.startsWith('==') &&
      !l.startsWith('(') &&
      !/^\d+\./.test(l)
    );

  if (!lines[0]) return null;
  const result = lines[0].slice(0, 220);
  return result.length > 20 ? result : null;
}

// ---- Losowanie słowa ---------------------------------------

export function getRandomWord(usedIds = [], ante = 1, difficultyMode = 'normal') {
  let pool = WORDS.filter(w => !usedIds.includes(w.id));

  // Filtrowanie wg ante i trybu trudności
  const diffFilter = getDifficultyFilter(ante, difficultyMode);
  let filtered = pool.filter(w => diffFilter.includes(w.difficulty));

  // Fallback: jeśli brak słów w puli dla danego filtru, użyj wszystkich
  if (filtered.length === 0) filtered = pool;
  if (filtered.length === 0) filtered = WORDS; // reset puli

  const idx = Math.floor(Math.random() * filtered.length);
  return filtered[idx];
}

function getDifficultyFilter(ante, mode) {
  if (mode === 'insane') {
    return ante >= 2 ? [2, 3] : [1, 2, 3];
  }
  if (mode === 'hard') {
    if (ante === 1) return [1, 2];
    if (ante === 2) return [2, 3];
    return [2, 3];
  }
  // normal
  if (ante === 1) return [1, 2];
  if (ante === 2) return [1, 2, 3];
  return [2, 3];
}

// ---- Eksport słownika --------------------------------------
export function getAllWords() {
  return WORDS;
}
