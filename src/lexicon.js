let entries = new Map();

function normalize(word) {
  return String(word ?? '').trim().toLocaleLowerCase('pl-PL');
}

export function setLexiconEntries(nextEntries) {
  entries = new Map(
    (nextEntries ?? []).map(entry => [normalize(entry.surface), entry]),
  );
}

export async function loadLexicon() {
  const response = await fetch(`${import.meta.env.BASE_URL}data/lexicon-v4.json`);
  if (!response.ok) {
    throw new Error(`Nie udało się wczytać słownika (${response.status})`);
  }
  const payload = await response.json();
  setLexiconEntries(payload.entries);
  return payload;
}

export function getLexiconEntry(word) {
  return entries.get(normalize(word)) ?? null;
}

export function isAcceptedWord(word) {
  return entries.has(normalize(word));
}
