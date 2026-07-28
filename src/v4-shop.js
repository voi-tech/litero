import { ACTION_CARDS, LANGUAGE_CARDS } from './language-cards.js';

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function offerPool(profile) {
  const unlocked = new Set(profile?.unlockedCardIds ?? []);
  const language = Object.values(LANGUAGE_CARDS)
    .filter(card => unlocked.has(card.id))
    .map(item => ({ type: 'language', item }));
  const actions = Object.values(ACTION_CARDS)
    .map(item => ({ type: 'action', item }));
  return [...language, ...actions];
}

function offersFor(profile, seed) {
  const pool = offerPool(profile);
  const start = hashText(seed) % pool.length;
  return [0, 1, 2].map(offset => pool[(start + offset * 5) % pool.length]);
}

export function getInterest(ink) {
  return Math.min(5, Math.floor(Math.max(0, Number(ink) || 0) / 5));
}

export function createShop({ profile, seed, rerolls = 0 } = {}) {
  return {
    offers: offersFor(profile, `${seed}:${rerolls}`),
    rerolls,
    rerollCost: 2,
  };
}

export function buyOffer(state, offer) {
  const cost = offer?.item?.cost ?? Infinity;
  if ((state.ink ?? 0) < cost) return { ...state, bought: false };
  if (offer.type === 'language') {
    if ((state.languageCardIds ?? []).length >= 5) return { ...state, bought: false };
    if ((state.languageCardIds ?? []).includes(offer.item.id)) return { ...state, bought: false };
    return {
      ...state,
      ink: state.ink - cost,
      languageCardIds: [...(state.languageCardIds ?? []), offer.item.id],
      bought: true,
    };
  }
  if (offer.type === 'action') {
    if ((state.actionCardIds ?? []).length >= 3) return { ...state, bought: false };
    return {
      ...state,
      ink: state.ink - cost,
      actionCardIds: [...(state.actionCardIds ?? []), offer.item.id],
      bought: true,
    };
  }
  return { ...state, bought: false };
}

export function rerollShop({ shop, ink, profile, seed = 'shop' }) {
  if (ink < shop.rerollCost) return { shop, ink };
  const rerolls = shop.rerolls + 1;
  return {
    ink: ink - shop.rerollCost,
    shop: createShop({ profile, seed, rerolls }),
  };
}
