// src/scriptorium.js — ekran sklepu między rundami

import { emitter } from './eventEmitter.js';
import { gameState, addFigure, removeFigure, closeScriptorium } from './game.js';
import { FIGURES, getRandomFigures, getFigureCost } from './figures.js';
import { showToast, renderFigurePickScreen } from './ui.js';

// ---- Stan scriptorium --------------------------------------

let currentOffer = [];

// ---- Inicjalizacja scriptorium -----------------------------

export function initScriptorium() {
  emitter.on('scriptoriumOpen', ({ state }) => {
    renderScriptorium(state);
  });
}

// ---- Renderowanie ------------------------------------------

function renderScriptorium(state) {
  const inkEl = document.getElementById('scriptorium-ink');
  if (inkEl) inkEl.innerHTML = `${state.ink} <span class="ink-icon">✦</span>`;

  // Losuj ofertę (wyklucz już aktywne figury pasywne)
  const excludePassive = state.activeFigures;
  currentOffer = getRandomFigures(4, excludePassive, state.ante);

  renderShop(state);
  renderActiveList(state);

  // Przycisk zamknij
  const closeBtn = document.getElementById('btn-close-scriptorium');
  if (closeBtn) {
    closeBtn.onclick = () => onCloseScriptorium(state);
  }
}

function renderShop(state) {
  const shop = document.getElementById('scriptorium-shop');
  if (!shop) return;
  shop.innerHTML = '';

  const discount = state.ante >= 2;

  currentOffer.forEach(figId => {
    const fig = FIGURES[figId];
    if (!fig) return;
    const cost = getFigureCost(figId, discount);

    const card = document.createElement('div');
    card.className = 'shop-card';
    card.innerHTML = `
      <div class="figure-icon">${fig.icon}</div>
      <div class="shop-card-info">
        <div class="shop-card-name">${fig.name}
          <span class="figure-type-badge figure-type-badge--${fig.type}" style="margin-left:6px">
            ${fig.type === 'passive' ? 'Pasywna' : 'Jednorazowa'}
          </span>
        </div>
        <div class="shop-card-desc">${fig.description}</div>
        ${discount ? `<div class="shop-card-cost" style="text-decoration:line-through;opacity:0.5">${fig.cost} ✦</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
        <div class="shop-card-cost">${cost} ✦</div>
        <button class="btn btn--buy" data-figure-id="${figId}" data-cost="${cost}">Kup</button>
      </div>
    `;

    const buyBtn = card.querySelector('.btn--buy');
    if (buyBtn) {
      buyBtn.addEventListener('click', () => onBuyFigure(figId, cost, state, card, buyBtn));
    }

    shop.appendChild(card);
  });

  if (currentOffer.length === 0) {
    shop.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Brak dostępnych figur do zakupu.</p>';
  }
}

function renderActiveList(state) {
  const list = document.getElementById('scriptorium-active-list');
  if (!list) return;
  list.innerHTML = '';

  if (state.activeFigures.length === 0) {
    list.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem">Nie masz żadnych aktywnych figur.</p>';
    return;
  }

  state.activeFigures.forEach(id => {
    const fig = FIGURES[id];
    if (!fig) return;

    const row = document.createElement('div');
    row.className = 'active-figure-row';
    row.innerHTML = `
      <div>
        <div class="active-figure-name">${fig.icon} ${fig.name}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${fig.description}</div>
      </div>
      <button class="btn btn--drop" data-figure-id="${id}">Porzuć (1 ✦)</button>
    `;

    const dropBtn = row.querySelector('.btn--drop');
    if (dropBtn) {
      dropBtn.addEventListener('click', () => onDropFigure(id, state, list));
    }

    list.appendChild(row);
  });
}

// ---- Akcje -------------------------------------------------

function onBuyFigure(figId, cost, state, card, buyBtn) {
  if (state.ink < cost) {
    showToast('Za mało atramentu!');
    card.style.animation = 'none';
    card.offsetHeight;
    card.style.animation = 'gridShake 0.4s ease-out';
    return;
  }

  if (FIGURES[figId]?.type === 'passive' && state.activeFigures.length >= 5) {
    showToast('Możesz mieć maksymalnie 5 aktywnych figur!');
    return;
  }

  state.ink -= cost;
  addFigure(figId);

  // Aktualizuj UI
  const inkEl = document.getElementById('scriptorium-ink');
  if (inkEl) inkEl.innerHTML = `${state.ink} <span class="ink-icon">✦</span>`;

  buyBtn.textContent = 'Kupiono!';
  buyBtn.disabled = true;

  // Odśwież listę aktywnych
  renderActiveList(state);

  // Usuń z oferty w UI
  currentOffer = currentOffer.filter(id => id !== figId);
}

function onDropFigure(figId, state, listEl) {
  if (state.ink < 1) {
    showToast('Potrzebujesz 1 ✦ atramentu, aby porzucić figurę!');
    return;
  }

  state.ink -= 1;
  removeFigure(figId);

  const inkEl = document.getElementById('scriptorium-ink');
  if (inkEl) inkEl.innerHTML = `${state.ink} <span class="ink-icon">✦</span>`;

  // Dodaj porzuconą figurę z powrotem do oferty (jeśli pasywna)
  if (FIGURES[figId]?.type === 'passive' && !currentOffer.includes(figId)) {
    currentOffer.push(figId);
    renderShop(state);
  }

  renderActiveList(state);
}

function onCloseScriptorium(state) {
  currentOffer = [];
  // Wyklucz już aktywne figury pasywne z oferty
  state._figureOffer = getRandomFigures(3, state.activeFigures, state.ante);
  closeScriptorium(); // emituje 'figurePick' -> ui.js renderuje ekran wyboru
}
