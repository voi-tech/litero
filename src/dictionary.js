// src/dictionary.js — walidacja słów z lokalnego słownika

import rawWordList from '../data/dictionary.json';

// Prawdziwe polskie słowa 2-literowe (spójniki, zaimki, przyimki, wykrzykniki itp.)
const TWO_CHAR_WHITELIST = new Set([
  'ab','ba','bo','by','ci','co','da','do','ej','go',
  'ha','he','ho','hu','id','im','ja','je','jo','ku',
  'la','le','li','lo','lu','ma','mi','mu','na','ni',
  'no','nu','od','oj','ok','on','po','se','si','ta',
  'te','to','tu','ty','ul','we','wi','wo','za','ze',
  'aż','już','bu','bi','du','dy','fu','ry','wy','ny',
  'ją','ją','łu','łe','ot','pi','pu','uf',
]);

const POLISH_VOWELS = new Set('aąeęioóuy');

function isValidEntry(word) {
  const w = word.toLowerCase();
  if (w.length < 2) return false;
  if (w.length === 2) return TWO_CHAR_WHITELIST.has(w);

  // Dla słów 3+ liter: musi mieć co najmniej jedną samogłoskę i jedną spółgłoskę
  const chars = [...w];
  const hasVowel = chars.some(c => POLISH_VOWELS.has(c));
  const hasConsonant = chars.some(c => !POLISH_VOWELS.has(c));
  return hasVowel && hasConsonant;
}

let wordSet = null;

export function loadDictionary() {
  if (!wordSet) {
    const arr = Array.isArray(rawWordList) ? rawWordList : rawWordList.words;
    wordSet = new Set(arr.filter(isValidEntry));
  }
  return wordSet;
}

export function isValidWord(word) {
  if (!wordSet) loadDictionary();
  return wordSet.has(word.toLowerCase());
}
