import { beforeEach, describe, expect, it } from 'vitest';
import {
  PROFILE_KEY,
  RUN_KEY,
  clearRunV4,
  loadProfile,
  loadRunV4,
  saveProfile,
  saveRunV4,
} from '../src/v4-persistence.js';
import { createEmptyProfile } from '../src/profile.js';

globalThis.localStorage = {
  _data: {},
  getItem(key) { return this._data[key] ?? null; },
  setItem(key, value) { this._data[key] = String(value); },
  removeItem(key) { delete this._data[key]; },
};

beforeEach(() => {
  localStorage._data = {};
});

describe('zapis podejścia v4', () => {
  it('zapisuje wyłącznie aktywne fazy i odrzuca starszy schemat', () => {
    saveRunV4({
      version: 4,
      phase: 'playing',
      categories: [{ id: 'nauka' }],
      hand: ['K', 'O', 'T'],
    });
    expect(loadRunV4()).toMatchObject({ version: 4, phase: 'playing' });

    localStorage.setItem(RUN_KEY, JSON.stringify({
      version: 3,
      phase: 'game',
      categories: [],
    }));
    expect(loadRunV4()).toBeNull();
  });

  it('usuwa zapis po zwycięstwie lub porażce', () => {
    saveRunV4({ version: 4, phase: 'playing', categories: [{}], hand: [] });
    saveRunV4({ version: 4, phase: 'defeat', categories: [{}], hand: [] });
    expect(localStorage.getItem(RUN_KEY)).toBeNull();

    clearRunV4();
    expect(loadRunV4()).toBeNull();
  });
});

describe('profil v1', () => {
  it('przechowuje Słownik i odblokowania niezależnie od podejścia', () => {
    const profile = createEmptyProfile();
    profile.dictionary.nauka = {
      name: 'Nauka',
      definition: 'Definicja kategorii.',
      words: [],
    };
    saveProfile(profile);

    expect(loadProfile()).toMatchObject({
      version: 1,
      dictionary: { nauka: { name: 'Nauka' } },
      unlockedLetterSetIds: ['standardowy'],
    });
    expect(localStorage.getItem(PROFILE_KEY)).toBeTruthy();
  });

  it('wraca do bezpiecznego profilu po uszkodzonych danych', () => {
    localStorage.setItem(PROFILE_KEY, '{');
    const profile = loadProfile();
    expect(profile.dictionary).toEqual({});
    expect(profile.unlockedCardIds).toHaveLength(8);
  });
});
