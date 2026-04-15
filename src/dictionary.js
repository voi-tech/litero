// src/dictionary.js — walidacja słów z lokalnego słownika
// Źródło: https://sjp.pl/sl/growy/ (GPL 2 / CC BY 4.0)
// Słownik wygenerowany przez: node scripts/build-dictionary.mjs

import rawWordList from '../data/dictionary.json';

let wordSet = null;

export function loadDictionary() {
  if (!wordSet) {
    wordSet = new Set(rawWordList);
  }
  return wordSet;
}

export function isValidWord(word) {
  if (!wordSet) loadDictionary();
  return wordSet.has(word.toLowerCase());
}
