// src/scriptorium.js — ekran Skryptorium (sklep z figurami i bonusy pasywne)

import { emitter } from './eventEmitter.js';
import { gameState, addFigure, removeFigure, closeScriptorium, pickPassiveBonus } from './game.js';
import { FIGURES, getFigureCost, getFigureSellValue } from './figures.js';
import { PASSIVE_BONUSES, getRandomPassiveBonus } from './passiveBonuses.js';
import { buildFigureCardEl, showScreen } from './ui.js';

let shopOffer = [];       // 3 figury retoryczne do kupienia
let passiveBonusOffer = null; // 1 bonus pasywny (jeśli dostępny)

export function openScriptorium() {
  // Generuj ofertę: 3 figury których gracz nie posiada
  const owned = new Set([...gameState.activeFigures, ...gameState.handFigures]);
  const available = Object.values(FIGURES).filter(f => !owned.has(f.id));
  shopOffer = pickRandom(available, 3);

  // Bonus pasywny: tylko jeśli boss pokonany i bonus jeszcze nie wybrany
  passiveBonusOffer = null;
  if (gameState.hasDefeatedBoss && !gameState.passiveBonusTaken) {
    passiveBonusOffer = getRandomPassiveBonus(gameState.passiveBonuses);
  }

  renderSkryptorium();
  showScreen('screen-scriptorium');
}

function pickRandom(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function renderSkryptorium() {
  renderInk();
  renderShop();
  renderPassiveBonus();
  renderOwnedFigures();
}

// Backwards compat alias
export const renderScriptorium = renderSkryptorium;

function renderInk() {
  const el = document.getElementById('scr-ink-value');
  if (el) el.textContent = gameState.ink;
}

function renderShop() {
  const grid = document.getElementById('scr-shop-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (shopOffer.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color:var(--text-muted);font-size:.85rem;';
    empty.textContent = 'Brak figur do kupienia.';
    grid.appendChild(empty);
    return;
  }

  shopOffer.forEach(fig => {
    const cost = getFigureCost(fig.id, gameState.activeFigures);
    const card = buildFigureCardEl(fig, cost, false);

    const canAfford = gameState.ink >= cost;
    const passiveFull = fig.type === 'passive' && gameState.activeFigures.length >= 5;
    const oneshotFull = fig.type !== 'passive' && gameState.handFigures.length >= 3;
    const alreadyOwns = gameState.activeFigures.includes(fig.id) || gameState.handFigures.includes(fig.id);

    if (!canAfford || passiveFull || oneshotFull || alreadyOwns) {
      card.style.opacity = '0.45';
      card.style.cursor = 'not-allowed';
    } else {
      card.addEventListener('click', () => {
        buyFigure(fig.id, cost);
      });
    }

    grid.appendChild(card);
  });
}

function renderPassiveBonus() {
  const section = document.getElementById('scr-passive-section');
  if (!section) return;

  if (!passiveBonusOffer) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  const container = document.getElementById('scr-passive-card');
  if (!container) return;
  container.innerHTML = '';

  const bonus = passiveBonusOffer;
  const card = buildPassiveBonusCardEl(bonus);
  card.addEventListener('click', () => {
    pickPassiveBonus(bonus.id);
    passiveBonusOffer = null;
    renderSkryptorium();
    showToast(`Bonus: ${bonus.name} aktywny!`);
  });
  container.appendChild(card);
}

function renderOwnedFigures() {
  const grid = document.getElementById('scr-active-grid');
  const countEl = document.getElementById('scr-active-count');
  if (!grid) return;

  grid.innerHTML = '';
  if (countEl) countEl.textContent = gameState.activeFigures.length;

  // Pasywne figury (z opcją sprzedaży)
  gameState.activeFigures.forEach(figId => {
    const fig = FIGURES[figId];
    if (!fig) return;
    const sellVal = getFigureSellValue(figId);
    const card = buildFigureCardEl(fig, sellVal, true);
    card.classList.add('owned');

    const sellBtn = card.querySelector('.sell-btn');
    if (sellBtn) {
      sellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sellFigure(figId);
      });
    }

    grid.appendChild(card);
  });

  // Jednorazowe figury w ręce (z opcją sprzedaży)
  gameState.handFigures.forEach(figId => {
    const fig = FIGURES[figId];
    if (!fig) return;
    const sellVal = getFigureSellValue(figId);
    const card = buildFigureCardEl(fig, sellVal, true);
    card.classList.add('owned');
    card.style.borderColor = 'var(--gold)';

    const sellBtn = card.querySelector('.sell-btn');
    if (sellBtn) {
      sellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sellFigure(figId);
      });
    }

    grid.appendChild(card);
  });

  // Aktywne bonusy pasywne
  gameState.passiveBonuses.forEach(bonusId => {
    const bonus = PASSIVE_BONUSES[bonusId];
    if (!bonus) return;
    const card = buildPassiveBonusCardEl(bonus);
    card.classList.add('owned');
    card.style.cursor = 'default';
    grid.appendChild(card);
  });

  if (
    gameState.activeFigures.length === 0 &&
    gameState.handFigures.length === 0 &&
    gameState.passiveBonuses.length === 0
  ) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color:var(--text-muted);font-size:.85rem;';
    empty.textContent = 'Brak figur. Kup coś w sklepie!';
    grid.appendChild(empty);
  }
}

function buyFigure(figureId, cost) {
  if (gameState.ink < cost) return;

  const fig = FIGURES[figureId];
  if (!fig) return;

  if (fig.type === 'passive' && gameState.activeFigures.length >= 5) return;

  gameState.ink -= cost;
  addFigure(figureId);
  emitter.emit('figureBought', { figureId, state: gameState });

  renderSkryptorium();
}

function sellFigure(figureId) {
  const ok = removeFigure(figureId);
  if (ok) {
    emitter.emit('figureSold', { figureId, state: gameState });
    renderSkryptorium();
  }
}

export function buildPassiveBonusCardEl(bonus) {
  const card = document.createElement('div');
  card.className = 'figure-card passive-bonus-card';
  card.innerHTML = `
    <div class="figure-card__icon">${bonus.icon}</div>
    <div class="figure-card__name">${bonus.name}</div>
    <div class="figure-card__desc">${bonus.description}</div>
    <div class="figure-card__cost" style="color:var(--green)">Bezpłatny</div>
    <div class="figure-card__rarity passive">Bonus pasywny</div>
  `;
  return card;
}

export function bindScriptoriumEvents() {
  const closeBtn = document.getElementById('btn-scr-close');
  if (closeBtn) {
    closeBtn.onclick = () => closeScriptorium();
  }
}

function showToast(message, color = 'var(--gold)') {
  const toast = document.createElement('div');
  toast.className = 'tag-toast';
  toast.style.color = color;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}
