// src/figures.js — 15 figur retorycznych (przepisane hooki pod nową mechanikę)

export const FIGURES = {
  // ---- PASYWNE (10) ------------------------------------------

  hiperbola: {
    id: 'hiperbola',
    name: 'Hiperbola',
    description: 'Mnożnik startuje od ×2 zamiast ×1',
    linguisticMeaning: 'Przesada, wyolbrzymienie',
    type: 'passive',
    rarity: 'rare',
    cost: 5,
    icon: '⬆',
    sellValue: 3,
    hooks: {
      onBlindStart: (state) => {
        state._figureState.hiperbola = true;
      },
    },
  },

  aliteracja: {
    id: 'aliteracja',
    name: 'Aliteracja',
    description: 'Powtarzające się litery w słowie warte 2× punktów',
    linguisticMeaning: 'Powtórzenie tej samej głoski na początku kolejnych wyrazów',
    type: 'passive',
    rarity: 'common',
    cost: 3,
    icon: '↩',
    sellValue: 1,
    hooks: {},
    // efekt obsługiwany bezpośrednio w scoring.js
  },

  polonizm: {
    id: 'polonizm',
    name: 'Polonizm',
    description: 'Polskie znaki (ą, ę, ć…) dają +2 mnożnik każdy',
    linguisticMeaning: 'Wyrażenie charakterystyczne dla języka polskiego',
    type: 'passive',
    rarity: 'common',
    cost: 3,
    icon: 'Ą',
    sellValue: 1,
    hooks: {},
    // efekt obsługiwany w scoring.js
  },

  pleonazm: {
    id: 'pleonazm',
    name: 'Pleonazm',
    description: 'Figury w Skryptorium tańsze o 1 atrament (min. 1)',
    linguisticMeaning: 'Nadmiarowe użycie słów o tym samym znaczeniu',
    type: 'passive',
    rarity: 'common',
    cost: 2,
    icon: '−',
    sellValue: 1,
    hooks: {},
    // efekt w scriptorium.js: getFigureCost() sprawdza pleonazm
  },

  litotes: {
    id: 'litotes',
    name: 'Litotes',
    description: '+1 zagranie na każdy blind',
    linguisticMeaning: 'Niedopowiedzenie, umniejszenie',
    type: 'passive',
    rarity: 'rare',
    cost: 5,
    icon: '⏱',
    sellValue: 3,
    hooks: {
      onBlindStart: (state) => {
        state.playsLeft += 1;
      },
    },
  },

  bezblednik: {
    id: 'bezblednik',
    name: 'Bezbłędnik',
    description: 'Pierwsze niepoprawne słowo nie kosztuje zagrania',
    linguisticMeaning: 'Wyrażenie pozbawione błędów',
    type: 'passive',
    rarity: 'rare',
    cost: 5,
    icon: '✓',
    sellValue: 3,
    hooks: {
      onBlindStart: (state) => {
        state._figureState.bezblednikUsed = false;
      },
    },
  },

  inicjal: {
    id: 'inicjal',
    name: 'Inicjał',
    description: 'Pierwsza litera każdego zagranego słowa liczy się 2×',
    linguisticMeaning: 'Ozdobna pierwsza litera tekstu',
    type: 'passive',
    rarity: 'common',
    cost: 3,
    icon: 'I',
    sellValue: 1,
    hooks: {},
    // efekt obsługiwany w scoring.js: pierwsza litera słowa daje val*2 znaków
  },

  kombo: {
    id: 'kombo',
    name: 'Kombo',
    description: '3 słowa z kategorii z rzędu → +5 mnożnik na następne',
    linguisticMeaning: 'Połączenie kilku elementów w jedną całość',
    type: 'passive',
    rarity: 'rare',
    cost: 4,
    icon: '⚡',
    sellValue: 2,
    hooks: {},
    // sprawdzane w game.js: _figureState.categoryStreak
  },

  skryba: {
    id: 'skryba',
    name: 'Skryba',
    description: '+2 atrament za każde zagrane słowo',
    linguisticMeaning: 'Przepisywacz ksiąg, pisarz',
    type: 'passive',
    rarity: 'common',
    cost: 2,
    icon: '✦',
    sellValue: 1,
    hooks: {},
    // obsługiwane w game.js po zagraniu słowa
  },

  perfekcjonista: {
    id: 'perfekcjonista',
    name: 'Perfekcjonista',
    description: 'Wygrana z ≥2 zagraniami w rezerwie → ×2 atrament',
    linguisticMeaning: 'Ktoś dążący do doskonałości',
    type: 'passive',
    rarity: 'legendary',
    cost: 7,
    icon: '★',
    sellValue: 4,
    hooks: {
      onBlindEnd: (state, inkReward) => {
        if (state.won && state.playsLeft >= 2) {
          return inkReward * 2;
        }
        return inkReward;
      },
    },
  },

  // ---- JEDNORAZOWE (5) ----------------------------------------

  elipsa: {
    id: 'elipsa',
    name: 'Elipsa',
    description: '+1 odrzucenie (natychmiast)',
    linguisticMeaning: 'Opuszczenie wyrazu domyślnego z kontekstu',
    type: 'oneshot',
    rarity: 'common',
    cost: 2,
    icon: '⏸',
    sellValue: 1,
    hooks: {
      onUse: (state) => {
        state.discardsLeft += 1;
        return { message: '+1 odrzucenie!' };
      },
    },
  },

  synekdocha: {
    id: 'synekdocha',
    name: 'Synekdocha',
    description: 'Następne słowo: każda litera warta 2× znaków',
    linguisticMeaning: 'Użycie części zamiast całości lub odwrotnie',
    type: 'oneshot',
    rarity: 'rare',
    cost: 4,
    icon: '◎',
    sellValue: 2,
    hooks: {
      onUse: (state) => {
        state._figureState.synekdochaActive = true;
        return { message: 'Następne słowo: litery ×2 znaków!' };
      },
    },
  },

  anakolut: {
    id: 'anakolut',
    name: 'Anakolut',
    description: 'Odzyskaj ostatnio zużyte zagranie',
    linguisticMeaning: 'Nielogiczna zmiana konstrukcji zdania w połowie',
    type: 'oneshot',
    rarity: 'rare',
    cost: 3,
    icon: '↺',
    sellValue: 2,
    hooks: {
      onUse: (state) => {
        if (state.playsLeft < 5) {
          state.playsLeft += 1;
          return { message: '+1 zagranie!' };
        }
        return { message: 'Już masz maksymalnie zagrań' };
      },
    },
  },

  emfaza: {
    id: 'emfaza',
    name: 'Emfaza',
    description: 'Podwój mnożnik następnego słowa',
    linguisticMeaning: 'Szczególny nacisk, wyróżnienie',
    type: 'oneshot',
    rarity: 'legendary',
    cost: 5,
    icon: '×2',
    sellValue: 3,
    hooks: {
      onUse: (state) => {
        state._figureState.emfazaActive = true;
        return { message: 'Następne słowo ×2 mnożnik!' };
      },
    },
  },

  akrostych: {
    id: 'akrostych',
    name: 'Akrostych',
    description: 'Dobierz 3 dodatkowe litery do ręki',
    linguisticMeaning: 'Ukryty tekst w pierwszych literach wersów',
    type: 'oneshot',
    rarity: 'common',
    cost: 3,
    icon: '▣',
    sellValue: 1,
    hooks: {
      onUse: (state) => {
        const count = Math.min(3, state.letterPool.length);
        const drawn = state.letterPool.splice(0, count);
        state.hand.push(...drawn);
        return { message: `+${count} litery w ręce!` };
      },
    },
  },
};

// Pomocnicza — zachowana dla kompatybilności (akrostych już nie wymaga replenishHand)
let import_replenishHand = null;
export function setReplenishHand(fn) { import_replenishHand = fn; }

// ---- Hook dispatch ------------------------------------------

export function applyFigureHooks(figureIds, hookName, state, ...args) {
  let result = args[0];
  for (const id of figureIds) {
    const fig = FIGURES[id];
    if (!fig?.hooks?.[hookName]) continue;
    const ret = fig.hooks[hookName](state, result);
    if (ret !== undefined) result = ret;
  }
  return result;
}

// ---- Losowanie figur ----------------------------------------

const RARITY_WEIGHTS = { common: 5, rare: 2, legendary: 1 };

export function getRandomFigures(count, excludeIds = [], ante = 1) {
  const pool = Object.values(FIGURES).filter(f => {
    if (excludeIds.includes(f.id)) return false;
    if (ante < 2 && f.rarity === 'legendary') return false;
    return true;
  });

  const weighted = [];
  for (const fig of pool) {
    const w = RARITY_WEIGHTS[fig.rarity] ?? 1;
    for (let i = 0; i < w; i++) weighted.push(fig);
  }

  const result = [];
  const seen = new Set();
  const shuffled = [...weighted].sort(() => Math.random() - 0.5);
  for (const fig of shuffled) {
    if (!seen.has(fig.id)) {
      seen.add(fig.id);
      result.push(fig);
      if (result.length >= count) break;
    }
  }
  return result;
}

export function getFigureCost(figureId, activeFigures = []) {
  const base = FIGURES[figureId]?.cost ?? 3;
  const discount = activeFigures.includes('pleonazm') ? 1 : 0;
  return Math.max(1, base - discount);
}

export function getFigureSellValue(figureId) {
  return FIGURES[figureId]?.sellValue ?? 1;
}
