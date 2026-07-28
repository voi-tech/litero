import { createEmptyProfile } from './profile.js';

export const RUN_KEY = 'litero_run_v4';
export const PROFILE_KEY = 'litero_profile_v1';

const ACTIVE_PHASES = new Set([
  'definition-select',
  'playing',
  'word-reveal',
  'shop',
  'upgrade',
  'category-reveal',
]);

export function saveRunV4(run) {
  try {
    if (!run || run.version !== 4 || !ACTIVE_PHASES.has(run.phase)) {
      clearRunV4();
      return;
    }
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    // Gra pozostaje grywalna bez localStorage.
  }
}

export function loadRunV4() {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw);
    if (run?.version !== 4) return null;
    if (!ACTIVE_PHASES.has(run.phase)) return null;
    if (!Array.isArray(run.categories) || run.categories.length === 0) return null;
    return run;
  } catch {
    clearRunV4();
    return null;
  }
}

export function clearRunV4() {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch {
    // Brak zapisu nie blokuje gry.
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Profil jest opcjonalną metagrą.
  }
}

function migrateSafeLegacyValues(profile) {
  try {
    const highScore = Number(localStorage.getItem('litero_highscore'));
    if (Number.isFinite(highScore) && highScore > 0) {
      profile.highScore = highScore;
    }
    const preferences = JSON.parse(
      localStorage.getItem('litero_preferences_v1') ?? 'null',
    );
    if (preferences && typeof preferences === 'object') {
      profile.preferences = {
        theme: preferences.theme ?? 'auto',
        reducedMotion: Boolean(preferences.reducedMotion),
      };
    }
  } catch {
    // Uszkodzone stare ustawienia są pomijane.
  }
  return profile;
}

export function loadProfile() {
  const fallback = migrateSafeLegacyValues(createEmptyProfile());
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return fallback;
    const profile = JSON.parse(raw);
    if (profile?.version !== 1) return fallback;
    if (!profile.dictionary || !Array.isArray(profile.unlockedCardIds)) {
      return fallback;
    }
    return {
      ...fallback,
      ...profile,
      dictionary: { ...profile.dictionary },
      unlockedCardIds: [...profile.unlockedCardIds],
      unlockedLetterSetIds: Array.isArray(profile.unlockedLetterSetIds)
        ? [...profile.unlockedLetterSetIds]
        : ['standardowy'],
      stats: { ...(profile.stats ?? {}) },
    };
  } catch {
    return fallback;
  }
}
