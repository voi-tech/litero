// src/scriptorium.js — ekran sklepu z figurami

import { emitter } from './eventEmitter.js';
import { gameState, addFigure, removeFigure, closeScriptorium } from './game.js';
import { FIGURES, getFigureCost, getFigureSellValue } from './figures.js';
import { buildFigureCardEl, showScreen } from './ui.js';

let shopOffer = [];

export function openScriptorium() {
  // Generuj ofertę: 4 figury których gracz nie posiada (pasywne i jednorazowe)
  const owned = new Set([...gameState.activeFigures, ...gameState.handFigures]);
  const available = Object.values(FIGURES).filter(f => !owned.has(f.id));
  shopOffer = pickRandom(available, 4);

  renderScriptorium();
  showScreen('screen-scriptorium');
}

function pickRandom(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function renderScriptorium() {
  renderInk();
  renderShop();
  renderActiveFigures();
}

function renderInk() {
  const el = document.getElementById('scr-ink-value');
  if (el) el.textContent = gameState.ink;
}

function renderShop() {
  const grid = document.getElementById('scr-shop-grid');
  if (!grid) return;
  grid.innerHTML = '';

  shopOffer.forEach(fig => {
    const cost = getFigureCost(fig.id, gameState.activeFigures);
    const card = buildFigureCardEl(fig, cost, false);

    const canAfford = gameState.ink >= cost;
    const passiveFull = fig.type === 'passive' && gameState.activeFigures.length >= 5;
    const alreadyOwns = gameState.activeFigures.includes(fig.id) || gameState.handFigures.includes(fig.id);

    if (!canAfford || passiveFull || alreadyOwns) {
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

function renderActiveFigures() {
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

  // Jednorazowe figury w ręce
  gameState.handFigures.forEach(figId => {
    const fig = FIGURES[figId];
    if (!fig) return;
    const card = buildFigureCardEl(fig, 0, false);
    card.classList.add('owned');
    card.style.borderColor = 'var(--gold)';

    const note = document.createElement('div');
    note.style.cssText = 'font-size:.68rem;color:var(--gold);';
    note.textContent = 'Jednorazowa';
    card.appendChild(note);

    grid.appendChild(card);
  });

  if (gameState.activeFigures.length === 0 && gameState.handFigures.length === 0) {
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

  renderScriptorium();
}

function sellFigure(figureId) {
  const ok = removeFigure(figureId);
  if (ok) {
    emitter.emit('figureSold', { figureId, state: gameState });
    renderScriptorium();
  }
}

export function bindScriptoriumEvents() {
  const closeBtn = document.getElementById('btn-scr-close');
  if (closeBtn) {
    closeBtn.onclick = () => closeScriptorium();
  }
}
