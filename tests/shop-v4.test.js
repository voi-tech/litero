import { describe, expect, it } from 'vitest';
import {
  buyOffer,
  createShop,
  getInterest,
  rerollShop,
} from '../src/v4-shop.js';

const profile = {
  unlockedCardIds: [
    'rzeczownik',
    'czasownik',
    'przymiotnik',
    'samogloska',
    'spolgloska',
    'polska-litera',
    'dwuznak',
    'inicjal',
  ],
};

describe('sklep v4', () => {
  it('pokazuje trzy deterministyczne oferty z odblokowanej puli', () => {
    expect(createShop({ profile, seed: 'abc' }).offers).toHaveLength(3);
    expect(createShop({ profile, seed: 'abc' }).offers)
      .toEqual(createShop({ profile, seed: 'abc' }).offers);
  });

  it('nalicza najwyżej pięć atramentów odsetek', () => {
    expect(getInterest(4)).toBe(0);
    expect(getInterest(10)).toBe(2);
    expect(getInterest(99)).toBe(5);
  });

  it('nie przekracza pięciu kart językowych ani trzech kart działań', () => {
    const language = { type: 'language', item: { id: 'rzeczownik', cost: 1 } };
    const action = { type: 'action', item: { id: 'dobranie', cost: 1 } };
    expect(buyOffer({ ink: 5, languageCardIds: Array(5).fill('x'), actionCardIds: [] }, language))
      .toMatchObject({ bought: false });
    expect(buyOffer({ ink: 5, languageCardIds: [], actionCardIds: Array(3).fill('x') }, action))
      .toMatchObject({ bought: false });
  });

  it('przerzucenie kosztuje dwa atramenty i zmienia oferty', () => {
    const shop = createShop({ profile, seed: 'abc' });
    const result = rerollShop({ shop, ink: 4, profile });
    expect(result.ink).toBe(2);
    expect(result.shop.rerolls).toBe(1);
    expect(result.shop.offers).not.toEqual(shop.offers);
  });
});
