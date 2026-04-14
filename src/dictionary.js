// src/dictionary.js — walidacja słów z lokalnego słownika

import wordList from '../data/dictionary.json';

let wordSet = null;

export function loadDictionary() {
  if (!wordSet) {
    wordSet = new Set(wordList);
  }
  return wordSet;
}

export function isValidWord(word) {
  if (!wordSet) loadDictionary();
  return wordSet.has(word.toLowerCase());
}
