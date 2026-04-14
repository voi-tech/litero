// src/words.js — dynamiczne słowa z Wikisłownika + lokalny fallback

import wordsData from '../data/words.json';

const LOCAL_WORDS = wordsData.words;

// ---- Pamięć podręczna słów z Wikisłownika ------------------

const cache = { 1: [], 2: [], 3: [] };
let fetchInProgress = false;
const REFILL_THRESHOLD = 3; // uzupełnij, gdy mniej niż N słów per difficulty

// ---- Główna funkcja: async pobierz losowe słowo -------------

export async function getRandomWordAsync(usedIds = [], ante = 1, difficultyMode = 'normal') {
  const diffFilter = getDifficultyFilter(ante, difficultyMode);

  for (const diff of diffFilter) {
    const pool = cache[diff].filter(w => !usedIds.includes(w.id));
    if (pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      const word = pool[idx];
      // Usuń ze cache żeby nie powtarzać
      cache[diff] = cache[diff].filter(w => w.id !== word.id);
      scheduleRefill();
      return word;
    }
  }

  // Cache pusty — fallback do lokalnych słów
  scheduleRefill();
  return getLocalRandomWord(usedIds, ante, difficultyMode);
}

// Synchroniczny fallback (wsteczna kompatybilność)
export function getRandomWord(usedIds = [], ante = 1, difficultyMode = 'normal') {
  return getLocalRandomWord(usedIds, ante, difficultyMode);
}

// Wywołaj na starcie gry żeby cache był gotowy przed rundą 1
export function preloadWords() {
  scheduleRefill();
}

// ---- Zarządzanie cache --------------------------------------

function scheduleRefill() {
  const total = cache[1].length + cache[2].length + cache[3].length;
  if (total < REFILL_THRESHOLD * 3 && !fetchInProgress) {
    fillCache();
  }
}

async function fillCache() {
  if (fetchInProgress) return;
  fetchInProgress = true;
  try {
    const words = await fetchWordBatch(50);
    for (const w of words) {
      if (w && cache[w.difficulty]) {
        cache[w.difficulty].push(w);
      }
    }
  } finally {
    fetchInProgress = false;
    // Uzupełnij ponownie jeśli nadal za mało
    const total = cache[1].length + cache[2].length + cache[3].length;
    if (total < REFILL_THRESHOLD * 2) fillCache();
  }
}

// ---- Pobieranie słów z Wikisłownika -------------------------

async function fetchWordBatch(count = 50) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const url = `https://pl.wiktionary.org/w/api.php`
      + `?action=query`
      + `&generator=random`
      + `&grnnamespace=0`
      + `&grnlimit=${Math.min(count, 50)}`
      + `&prop=extracts`
      + `&explaintext=1`
      + `&format=json`
      + `&origin=*`;

    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return [];

    return Object.values(pages).map(processWikiPage).filter(Boolean);
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---- Parsowanie strony Wikisłownika -------------------------

const POLISH_LETTERS = /^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+$/;
const PARTS_OF_SPEECH = [
  'rzeczownik', 'przymiotnik', 'czasownik',
  'przysłówek', 'zaimek', 'liczebnik', 'przyimek', 'spójnik',
];
const META_PREFIXES = [
  'język', 'odmiana', 'wymowa', 'znaczenia', 'przykłady',
  'składnia', 'kolokacje', 'synonimy', 'antonimy', 'hiperonimy',
  'hiponimy', 'holonimy', 'meronimy', 'wyrazy', 'związki',
  'tłumaczenia', 'źródła', 'uwagi', 'forma',
];

function processWikiPage(page) {
  const title = page.title || '';
  const extract = page.extract || '';

  // Tylko litery polskie, długość 5–10
  if (!POLISH_LETTERS.test(title)) return null;
  if (title.length < 5 || title.length > 10) return null;

  // Musi zawierać sekcję polską
  if (!extract.toLowerCase().includes('język polski')) return null;

  const polishSection = getPolishSection(extract);
  if (!polishSection) return null;

  const definition = extractDefinition(polishSection, title.toLowerCase());
  if (!definition) return null;

  const partOfSpeech = extractPartOfSpeech(polishSection);
  const len = title.length;

  return {
    id: title.toLowerCase(),
    word: title.toLowerCase(),
    definition,
    hint: buildHint(definition),
    category: partOfSpeech,
    difficulty: len <= 6 ? 1 : len <= 8 ? 2 : 3,
  };
}

function getPolishSection(text) {
  const lower = text.toLowerCase();
  const idx = lower.indexOf('język polski');
  if (idx === -1) return null;

  // Cofnij do początku linii
  const from = text.lastIndexOf('\n', idx) + 1;
  const rest = text.slice(from + 13); // pomiń "język polski"

  // Szukaj następnej sekcji językowej
  const nextLang = rest.search(/\njęzyk \w/i);
  return nextLang !== -1 ? text.slice(from, from + 13 + nextLang) : text.slice(from);
}

function extractDefinition(polishText, titleLower) {
  const lines = polishText
    .split('\n')
    .map(l =>
      l
        .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
        .replace(/\{\{[^}]+\}\}/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);

  for (const line of lines) {
    // Pomiń zapis fonetyczny (IPA, AS, wymowa)
    if (/IPA:/i.test(line)) continue;
    if (/\bAS:/i.test(line)) continue;
    if (/\/[^\s/]{2,}\//.test(line)) continue;    // /ˈkɔlaʂ/
    if (/^\[[^\]]{2,}\]/.test(line)) continue;    // [fonetyka]

    // Definicje oznaczone "1.1 tekst" lub "1. tekst"
    const numbered = line.match(/^\d+\.\d*\s+(.{15,})/);
    if (numbered) return numbered[1].trim().slice(0, 220);

    // Długa linia niebędąca metadanymi
    const lineLower = line.toLowerCase();
    if (
      line.length > 35 &&
      !lineLower.startsWith(titleLower) &&
      !META_PREFIXES.some(p => lineLower.startsWith(p)) &&
      !/^[=\[\{(\/]/.test(line)
    ) {
      return line.slice(0, 220);
    }
  }
  return null;
}

function extractPartOfSpeech(text) {
  const lower = text.toLowerCase();
  for (const pos of PARTS_OF_SPEECH) {
    if (lower.includes(pos)) return pos;
  }
  return 'słownik';
}

function buildHint(definition) {
  const words = definition.split(/\s+/);
  const short = words.slice(0, 6).join(' ');
  return words.length > 6 ? short + '\u2026' : short;
}

// ---- Lokalny fallback ---------------------------------------

function getLocalRandomWord(usedIds = [], ante = 1, difficultyMode = 'normal') {
  const diffFilter = getDifficultyFilter(ante, difficultyMode);
  let pool = LOCAL_WORDS.filter(w => !usedIds.includes(w.id));
  let filtered = pool.filter(w => diffFilter.includes(w.difficulty));
  if (filtered.length === 0) filtered = pool;
  if (filtered.length === 0) filtered = LOCAL_WORDS;
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

// ---- Eksporty pomocnicze ------------------------------------

export function getAllWords() {
  return LOCAL_WORDS;
}
