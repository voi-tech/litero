// src/passiveBonuses.js — bonusy pasywne do zdobycia po pokonaniu bossa

export const PASSIVE_BONUSES = {
  pergamin: {
    id: 'pergamin',
    name: 'Pergamin',
    icon: '📜',
    description: '+1 odrzucenie na każdą rundę',
    rarity: 'passive',
  },
  kalamarz: {
    id: 'kalamarz',
    name: 'Kałamarz',
    icon: '🖋',
    description: 'Za wygrane rundy +2 atramentu',
    rarity: 'passive',
  },
  manuskrypt: {
    id: 'manuskrypt',
    name: 'Manuskrypt',
    icon: '📖',
    description: '+1 zagranie na każdą rundę',
    rarity: 'passive',
  },
  pioro: {
    id: 'pioro',
    name: 'Pióro',
    icon: '✒',
    description: 'Wszystkie litery warte 2× znaków',
    rarity: 'passive',
  },
  iluminacja: {
    id: 'iluminacja',
    name: 'Iluminacja',
    icon: '✨',
    description: 'Słowa kategorii dają +5 mnożnik (zamiast +3)',
    rarity: 'passive',
  },
  folio: {
    id: 'folio',
    name: 'Folio',
    icon: '📚',
    description: 'Słowa 6+ liter: dodatkowy ×1.5 mnożnik',
    rarity: 'passive',
  },
};

export function getRandomPassiveBonus(excludeIds = []) {
  const pool = Object.values(PASSIVE_BONUSES).filter(b => !excludeIds.includes(b.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
