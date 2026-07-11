export const EDITORIAL_SAVE_KEY = 'litero_save_v3';
export const PREFERENCES_KEY = 'litero_preferences_v1';

function replacer(_key, value) {
  if (value instanceof Set) return { __type: 'Set', values: [...value] };
  return value;
}

function reviver(_key, value) {
  if (value?.__type === 'Set' && Array.isArray(value.values)) return new Set(value.values);
  return value;
}

export function encodeEditorialSave(run, preferences = {}) {
  return JSON.stringify({ version: 3, run, preferences }, replacer);
}

export function decodeEditorialSave(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw, reviver);
    if (parsed.version !== 3) return { incompatible: true, preferences: parsed.preferences ?? {} };
    return { ...parsed.run, preferences: parsed.preferences ?? {} };
  } catch {
    return null;
  }
}

export function saveEditorialRun(run, preferences = {}) {
  try {
    localStorage.setItem(EDITORIAL_SAVE_KEY, encodeEditorialSave(run, preferences));
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Gra pozostaje dostępna, nawet jeśli magazyn przeglądarki jest niedostępny.
  }
}

export function loadEditorialRun() {
  try {
    return decodeEditorialSave(localStorage.getItem(EDITORIAL_SAVE_KEY));
  } catch {
    return null;
  }
}

export function clearEditorialRun() {
  try { localStorage.removeItem(EDITORIAL_SAVE_KEY); } catch { /* bez zapisu */ }
}

export function loadPreferences() {
  try { return JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}'); } catch { return {}; }
}
