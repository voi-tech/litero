import { describe, it, expect } from 'vitest';
import {
  getTier, getLetterValue, scorePlaySegments, calcInkReward, WORD_TIERS,
} from '../src/scoring.js';

describe('getTier', () => {
  it('zwraca tier odpowiadający długości słowa', () => {
    expect(getTier(2).name).toBe('Para');
    expect(getTier(5).name).toBe('Piątka');
    expect(getTier(8).name).toBe('Ósemka');
  });

  it('dla długości powyżej 8 zwraca najwyższy tier (kilka słów w zagraniu)', () => {
    expect(getTier(9)).toBe(WORD_TIERS[WORD_TIERS.length - 1]);
    expect(getTier(16)).toBe(WORD_TIERS[WORD_TIERS.length - 1]);
  });

  it('dla długości poniżej 2 zwraca najniższy tier', () => {
    expect(getTier(1)).toBe(WORD_TIERS[0]);
  });
});

describe('scorePlaySegments', () => {
  const seg = word => ({ word });

  it('liczy chips × mult dla pojedynczego słowa', () => {
    // KOT: K=2, O=1, T=2 → 5 chips; tier Trójka ×1.5 → 7; mult 1+2=3 → 21
    const r = scorePlaySegments([seg('KOT')], [], {});
    expect(r.chips).toBe(7);
    expect(r.mult).toBe(3);
    expect(r.score).toBe(21);
    expect(r.lettersOnly).toBe(false);
  });

  it('dodaje bonus kategorii do mnożnika', () => {
    const r = scorePlaySegments([seg('KOT')], [], { categoryWords: ['kot'] });
    expect(r.categoryBonus).toBe(3);
    expect(r.mult).toBe(6);
    expect(r.score).toBe(42);
  });

  it('iluminacja zwiększa bonus kategorii do +5', () => {
    const r = scorePlaySegments([seg('KOT')], [], {
      categoryWords: ['kot'],
      passiveBonuses: ['iluminacja'],
    });
    expect(r.categoryBonus).toBe(5);
  });

  it('tag mult15 podnosi startowy mnożnik do 1.5', () => {
    const r = scorePlaySegments([seg('KOT')], [], { figureState: { mult15: true } });
    expect(r.mult).toBe(3.5);
    expect(r.score).toBe(Math.floor(7 * 3.5));
  });

  it('kilka słów: tier liczony z łącznej długości', () => {
    // KOT + DOM = 6 liter → tier Szóstka (×3.5, +8 mult)
    const r = scorePlaySegments([seg('KOT'), seg('DOM')], [], {});
    expect(r.tier.name).toBe('Szóstka');
    expect(r.words).toEqual(['KOT', 'DOM']);
  });

  it('luźne litery dają surowe punkty bez mnożnika', () => {
    const r = scorePlaySegments([], [{ letter: 'Ż' }, { letter: 'A' }], {});
    expect(r.extraChips).toBe(6); // Ż=5, A=1
    expect(r.score).toBe(6);
    expect(r.lettersOnly).toBe(true);
  });

  it('polonizm dodaje +2 mult za każdą polską literę', () => {
    // ŻAL: Ż=5, A=1, L=2 → 8 chips; tier Trójka → 12; mult 1+2+2=5
    const r = scorePlaySegments([seg('ŻAL')], [], { activeFigures: ['polonizm'] });
    expect(r.mult).toBe(5);
  });

  it('hiperbola podnosi mnożnik minimum do 2', () => {
    // Para (2 litery): mult 1+0=1 → hiperbola → 2
    const r = scorePlaySegments([seg('AS')], [], { activeFigures: ['hiperbola'] });
    expect(r.mult).toBe(2);
  });

  it('emfaza podwaja mnożnik', () => {
    const r = scorePlaySegments([seg('KOT')], [], { figureState: { emfazaActive: true } });
    expect(r.mult).toBe(6);
  });

  it('pioro podwaja chips', () => {
    const r = scorePlaySegments([seg('KOT')], [], { passiveBonuses: ['pioro'] });
    expect(r.chips).toBe(14);
  });

  it('kombo wymaga streaka ≥ 2', () => {
    const base = scorePlaySegments([seg('KOT')], [], { activeFigures: ['kombo'], categoryStreak: 1 });
    const combo = scorePlaySegments([seg('KOT')], [], { activeFigures: ['kombo'], categoryStreak: 2 });
    expect(combo.mult).toBe(base.mult + 5);
  });

  it('lakonizm punktuje słowo 3-literowe tierem 5-literowym', () => {
    const r = scorePlaySegments([seg('KOT')], [], { activeFigures: ['lakonizm'] });
    expect(r.tier.name).toBe('Piątka');
  });

  it('inwersja mnoży ostatnią literę słowa przez 4', () => {
    const base = scorePlaySegments([seg('KOT')], [], {});
    const inv = scorePlaySegments([seg('KOT')], [], { activeFigures: ['inwersja'] });
    expect(inv.chips).toBeGreaterThan(base.chips);
    expect(inv.score).toBeGreaterThan(base.score);
  });

  it('apostrofa dodaje mnożnik z odrzuceń do końca blinda', () => {
    const r = scorePlaySegments([seg('KOT')], [], {
      activeFigures: ['apostrofa'],
      figureState: { apostrofaMult: 2 },
    });
    expect(r.mult).toBe(5);
  });
});

describe('getLetterValue', () => {
  it('zwraca wartość litery niezależnie od wielkości', () => {
    expect(getLetterValue('ż')).toBe(5);
    expect(getLetterValue('A')).toBe(1);
  });

  it('nieznane znaki mają wartość 1', () => {
    expect(getLetterValue('@')).toBe(1);
  });
});

describe('calcInkReward', () => {
  it('daje 2 + niezużyte zagrania', () => {
    expect(calcInkReward(3, 5, true)).toBe(4);
    expect(calcInkReward(5, 5, true)).toBe(2);
  });

  it('nie schodzi poniżej bazy przy dodatkowych zagraniach', () => {
    expect(calcInkReward(6, 5, true)).toBe(2);
  });

  it('przegrana = 0 atramentu', () => {
    expect(calcInkReward(2, 5, false)).toBe(0);
  });
});
