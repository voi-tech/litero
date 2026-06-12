// src/scriptorium.js — ekran Skryptorium (sklep z figurami i bonusy pasywne)

import { emitter } from './eventEmitter.js';
import {
  gameState, addFigure, removeFigure, closeScriptorium, pickPassiveBonus,
  MAX_PASSIVE_FIGURES, MAX_ONESHOT_FIGURES, randomFloat,
} from './game.js';
import { FIGURES, getFigureCost, getFigureSellValue, getRandomFigures } from './figures.js';
import { PASSIVE_BONUSES, getRandomPassiveBonus } from './passiveBonuses.js';
import { buildFigureCardEl, showScreen, showToast } from './ui.js';
import { icon, initIcons } from './icons.js';

export function openScriptorium() {
  const blindKey = `${gameState.currentCategory?.id ?? 'none'}:${gameState.currentBlind?.id ?? 'none'}:${gameState.completedBlinds.length}`;
  if (gameState._scriptoriumBlindKey !== blindKey) {
    gameState._scriptoriumBlindKey = blindKey;
    gameState.lastInterestReward = Math.floor(gameState.ink / 5);
    gameState.ink += gameState.lastInterestReward;
    rollScriptoriumOffer();
  }

  // Bonus pasywny: jeden za każdego pokonanego bossa
  while (gameState.passiveBonuses.length < gameState.bossesDefeated) {
    const bonus = getRandomPassiveBonus(gameState.passiveBonuses, randomFloat);
    if (!bonus) break;
    pickPassiveBonus(bonus.id);
    showToast(`Bonus pasywny: ${bonus.name}!`, 'var(--green)', 2000);
  }

  gameState.phase = 'scriptorium';
  renderSkryptorium();
  showScreen('screen-scriptorium');
}

export function renderSkryptorium() {
  renderInk();
  renderShop();
  renderOwnedFigures();
}

function renderInk() {
  const el = document.getElementById('scr-ink-value');
  if (el) el.textContent = gameState.ink;
  const interest = document.getElementById('scr-interest-value');
  if (interest) interest.textContent = `Odsetki: +${gameState.lastInterestReward ?? 0}`;
}

function renderShop() {
  const grid = document.getElementById('scr-shop-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (gameState.scriptoriumOffer.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color:var(--text-muted);font-size:.85rem;';
    empty.textContent = 'Brak figur do kupienia.';
    grid.appendChild(empty);
    return;
  }

  gameState.scriptoriumOffer.forEach(fig => {
    const cost = getFigureCost(fig.id, gameState.activeFigures);
    const card = buildFigureCardEl(fig, cost, false);

    const canAfford = gameState.ink >= cost;
    const passiveFull = fig.type === 'passive' && gameState.activeFigures.length >= MAX_PASSIVE_FIGURES;
    const oneshotFull = fig.type !== 'passive' && gameState.handFigures.length >= MAX_ONESHOT_FIGURES;
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

function rollScriptoriumOffer() {
  const owned = [...gameState.activeFigures, ...gameState.handFigures];
  gameState.scriptoriumOffer = getRandomFigures(3, owned, randomFloat);
}

export function rerollScriptoriumOffer() {
  if (gameState.ink < 2) {
    showToast('Reroll kosztuje 2 atramentu', 'var(--red)');
    return false;
  }
  gameState.ink -= 2;
  rollScriptoriumOffer();
  emitter.emit('scriptoriumRerolled', { state: gameState });
  renderSkryptorium();
  return true;
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

  // addFigure pilnuje limitów (5 pasywnych / 3 jednorazowe) i duplikatów —
  // atrament schodzi dopiero po udanym dodaniu
  if (!addFigure(figureId)) return;
  gameState.ink -= cost;
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
    <div class="figure-card__icon">${icon(bonus.icon, 20)}</div>
    <div class="figure-card__name">${bonus.name}</div>
    <div class="figure-card__desc">${bonus.description}</div>
    <div class="figure-card__cost" style="color:var(--green)">Bezpłatny</div>
    <div class="figure-card__rarity passive">Bonus pasywny</div>
  `;
  initIcons();
  return card;
}

export function bindScriptoriumEvents() {
  const closeBtn = document.getElementById('btn-scr-close');
  if (closeBtn) {
    closeBtn.onclick = () => closeScriptorium();
  }
  const rerollBtn = document.getElementById('btn-scr-reroll');
  if (rerollBtn) {
    rerollBtn.onclick = () => rerollScriptoriumOffer();
  }
}
