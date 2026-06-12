// src/dictionary.js — walidacja słów z lokalnego słownika
// Źródło: https://sjp.pl/sl/growy/ (GPL 2 / CC BY 4.0)
// Plik public/data/dictionary.json generowany przez: npm run build:dict
// Słownik jest pobierany asynchronicznie (fetch), żeby ~4,5 MB słów
// nie trafiało do bundla JS.

let wordSet = null;
let loadPromise = null;

export function loadDictionary() {
  if (!loadPromise) {
    const url = `${import.meta.env.BASE_URL}data/dictionary.json`;
    loadPromise = fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`Nie udało się pobrać słownika (HTTP ${res.status})`);
        return res.json();
      })
      .then(words => {
        wordSet = new Set(words);
        return wordSet;
      })
      .catch(err => {
        loadPromise = null; // pozwól na ponowną próbę
        throw err;
      });
  }
  return loadPromise;
}

export function isDictionaryReady() {
  return wordSet !== null;
}

export function isValidWord(word) {
  return wordSet ? wordSet.has(word.toLowerCase()) : false;
}

// Do testów: wstrzyknięcie własnej listy słów bez fetch
export function setWordList(words) {
  wordSet = new Set(words);
}
