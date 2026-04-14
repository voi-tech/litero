// src/figures.js — definicje 15 figur retorycznych + hook system

import { emitter } from './eventEmitter.js';

// ---- Definicje figur ----------------------------------------

export const FIGURES = {
  // ---- PASYWNE -----------------------------------------------

  hiperbola: {
    id: 'hiperbola',
    name: 'Hiperbola',
    description: 'Mnożnik startuje od 1.5 zamiast 1.0',
    linguisticMeaning: 'Przesada, wyolbrzymienie',
    type: 'passive',
    rarity: 'rare',
    cost: 4,
    icon: '⬆',
    hooks: {
      onRoundStart: (state) => {
        state.multiplier = 1.5;
      },
    },
  },

  aliteracja: {
    id: 'aliteracja',
    name: 'Aliteracja',
    description: 'Powtarzające się litery w słowie warte 2×',
    linguisticMeaning: 'Powtórzenie tej samej litery',
    type: 'passive',
    rarity: 'common',
    cost: 3,
    icon: '↩',
    hooks: {
      // Efekt zawarty w scoring.js (sprawdza activeFigures)
    },
  },

  polonizm: {
    id: 'polonizm',
    name: 'Polonizm',
    description: 'Polskie znaki (ą, ę, ć...) warte 3×',
    linguisticMeaning: 'Cecha charakterystyczna polszczyzny',
    type: 'passive',
    rarity: 'common',
    cost: 3,
    icon: 'Ą',
    hooks: {
      // Efekt zawarty w scoring.js
    },
  },

  pleonazm: {
    id: 'pleonazm',
    name: 'Pleonazm',
    description: 'Odkrycie litery kosztuje 30% mniej atramentu',
    linguisticMeaning: 'Nadmiar, redundancja',
    type: 'passive',
    rarity: 'common',
    cost: 2,
    icon: '−',
    hooks: {
      // Flaga sprawdzana w scriptorium/ui przy kosztach odkrycia
    },
  },

  litotes: {
    id: 'litotes',
    name: 'Litotes',
    description: 'Timer startuje od 45s zamiast 30s',
    linguisticMeaning: 'Niedopowiedzenie, umniejszenie',
    type: 'passive',
    rarity: 'rare',
    cost: 4,
    icon: '⏱',
    hooks: {
      onRoundStart: (state) => {
        state.timeLeft = 90;
      },
    },
  },

  bezblednik: {
    id: 'bezblednik',
    name: 'Bezbłędnik',
    description: 'Pierwszy błąd w rundzie nie odejmuje punktów ani nie liczy się jako błąd',
    linguisticMeaning: 'Poprawność językowa',
    type: 'passive',
    rarity: 'rare',
    cost: 5,
    icon: '✓',
    hooks: {
      // Efekt zawarty w scoring.calculateMiss
    },
  },

  inicjal: {
    id: 'inicjal',
    name: 'Inicjał',
    description: 'Na starcie rundy pierwsza litera słowa jest odkryta',
    linguisticMeaning: 'Pierwsza ozdobna litera',
    type: 'passive',
    rarity: 'common',
    cost: 3,
    icon: 'I',
    hooks: {
      onRoundStart: (state) => {
        if (state.word.length > 0) {
          state.revealed[0] = true;
        }
      },
    },
  },

  kombo: {
    id: 'kombo',
    name: 'Kombo',
    description: 'Bonus za combo +0.5 zamiast +0.3',
    linguisticMeaning: 'Ciągłość, seria',
    type: 'passive',
    rarity: 'rare',
    cost: 4,
    icon: '⚡',
    hooks: {
      // Efekt zawarty w scoring.calculateHit
    },
  },

  skryba: {
    id: 'skryba',
    name: 'Skryba',
    description: '+1 atrament za każde trafienie',
    linguisticMeaning: 'Przepisywacz, kolekcjoner',
    type: 'passive',
    rarity: 'common',
    cost: 2,
    icon: '✦',
    hooks: {
      // Efekt zawarty w scoring.calculateHit
    },
  },

  perfekcjonista: {
    id: 'perfekcjonista',
    name: 'Perfekcjonista',
    description: 'Brak błędów w rundzie = podwójne punkty końcowe',
    linguisticMeaning: 'Dążenie do ideału',
    type: 'passive',
    rarity: 'legendary',
    cost: 6,
    icon: '★',
    hooks: {
      onRoundEnd: (state) => {
        if (state.errors === 0) {
          state.roundScore = Math.floor(state.roundScore * 2);
        }
      },
    },
  },

  // ---- JEDNORAZOWE -------------------------------------------

  elipsa: {
    id: 'elipsa',
    name: 'Elipsa',
    description: 'Pauzuje timer na 10 sekund',
    linguisticMeaning: 'Opuszczenie, pominięcie',
    type: 'oneshot',
    rarity: 'common',
    cost: 2,
    icon: '⏸',
    activate: (state) => {
      emitter.emit('timerPause', { duration: 10 });
    },
  },

  synekdocha: {
    id: 'synekdocha',
    name: 'Synekdocha',
    description: 'Odkrywa najrzadszą zakrytą literę za darmo',
    linguisticMeaning: 'Część zamiast całości',
    type: 'oneshot',
    rarity: 'rare',
    cost: 4,
    icon: '◎',
    activate: (state) => {
      emitter.emit('revealRarest', { state });
    },
  },

  anakolut: {
    id: 'anakolut',
    name: 'Anakolut',
    description: 'Przywraca combo do wartości sprzed ostatniego błędu',
    linguisticMeaning: 'Zerwanie ciągłości, błąd który staje się regułą',
    type: 'oneshot',
    rarity: 'rare',
    cost: 3,
    icon: '↺',
    activate: (state) => {
      state.combo = state.comboBeforeLastMiss;
    },
  },

  emfaza: {
    id: 'emfaza',
    name: 'Emfaza',
    description: 'Podwaja mnożnik do końca rundy',
    linguisticMeaning: 'Wzmocnienie wybranego elementu',
    type: 'oneshot',
    rarity: 'legendary',
    cost: 5,
    icon: '×2',
    activate: (state) => {
      state.multiplier = parseFloat((state.multiplier * 2).toFixed(2));
    },
  },

  akrostych: {
    id: 'akrostych',
    name: 'Akrostych',
    description: 'Pokazuje pierwszą i ostatnią literę słowa',
    linguisticMeaning: 'Ukryta informacja w pierwszych literach',
    type: 'oneshot',
    rarity: 'common',
    cost: 3,
    icon: '▣',
    activate: (state) => {
      if (state.word.length > 0) {
        state.revealed[0] = true;
        state.revealed[state.word.length - 1] = true;
      }
    },
  },
};

// ---- Wagi rzadkości -----------------------------------------

const RARITY_WEIGHTS = { common: 5, rare: 2, legendary: 1 };

// ---- Losowanie figur ----------------------------------------

export function getRandomFigures(count, excludeIds = [], ante = 1) {
  const allIds = Object.keys(FIGURES);

  // Ante 1: tylko common + rare; Ante 2+: wszystkie
  const rarityFilter = ante >= 2
    ? ['common', 'rare', 'legendary']
    : ['common', 'rare'];

  const available = allIds.filter(id =>
    !excludeIds.includes(id) &&
    rarityFilter.includes(FIGURES[id].rarity)
  );

  if (available.length === 0) return [];

  // Ważone losowanie
  const picked = [];
  const pool = [...available];

  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const totalWeight = pool.reduce(
      (sum, id) => sum + RARITY_WEIGHTS[FIGURES[id].rarity], 0
    );
    let rand = Math.random() * totalWeight;
    let chosen = pool[pool.length - 1];

    for (const id of pool) {
      rand -= RARITY_WEIGHTS[FIGURES[id].rarity];
      if (rand <= 0) { chosen = id; break; }
    }

    picked.push(chosen);
    pool.splice(pool.indexOf(chosen), 1);
  }

  return picked;
}

// ---- Stosowanie hooków ------------------------------------

export function applyFigureHooks(figureIds, hookName, state) {
  for (const id of figureIds) {
    const fig = FIGURES[id];
    if (fig?.hooks?.[hookName]) {
      fig.hooks[hookName](state);
    }
  }
}

// ---- Aktywacja figury jednorazowej -------------------------

export function activateFigure(figureId, state) {
  const fig = FIGURES[figureId];
  if (!fig || fig.type !== 'oneshot') return false;
  if (!fig.activate) return false;
  fig.activate(state);
  return true;
}

// ---- Koszt figury w Scriptorium ----------------------------

export function getFigureCost(figureId, discount = false) {
  const fig = FIGURES[figureId];
  if (!fig) return 0;
  return discount ? Math.max(1, Math.floor(fig.cost * 0.75)) : fig.cost;
}
