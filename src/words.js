// src/words.js — pula słów z lokalnego słownika

import wordsData from '../data/words.json';

const WORDS = wordsData.words;

export function getRandomWord(usedIds = [], ante = 1, difficultyMode = 'normal') {
  let pool = WORDS.filter(w => !usedIds.includes(w.id));

  const diffFilter = getDifficultyFilter(ante, difficultyMode);
  let filtered = pool.filter(w => diffFilter.includes(w.difficulty));

  if (filtered.length === 0) filtered = pool;
  if (filtered.length === 0) filtered = WORDS;

  return filtered[Math.floor(Math.random() * filtered.length)];
}

function getDifficultyFilter(ante, mode) {
  if (mode === 'insane') return ante >= 2 ? [2, 3] : [1, 2, 3];
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

export function getAllWords() {
  return WORDS;
}
