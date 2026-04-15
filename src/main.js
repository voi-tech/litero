// src/main.js — bootstrap, routing, event bindings

import { emitter } from './eventEmitter.js';
import { initGame, startGame, playWord, discardLetters, gameState, endGame, sortHand, closeScriptorium } from './game.js';
import {
  initScreens,
  showScreen,
  renderStartScreen,
  renderMapScreen,
  renderBlindSelectScreen,
  renderGameScreen,
  renderHand,
  updateGameAfterPlay,
  showScorePopup,
  showWordRejected,
  renderSummaryScreen,
  renderEndScreen,
  showTagToast,
  bindBlindSelectEvents,
} from './ui.js';
import { openScriptorium, bindScriptoriumEvents } from './scriptorium.js';

// ---- Bootstrap -------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initScreens();
  initGame();

  bindStaticEvents();
  bindGameEvents();

  renderStartScreen();
  showScreen('screen-start');
});

// ---- Statyczne eventy przycisków ------------------------------------

function bindStaticEvents() {
  document.getElementById('btn-start')?.addEventListener('click', () => startGame());

  document.getElementById('btn-summary-continue')?.addEventListener('click', () => {
    if (gameState.phase !== 'summary') return;
    if (!gameState._summaryWon) {
      endGame(false);
    } else if (gameState._wonByGuess) {
      // Wygrana przez odgadnięcie → pomiń Skryptorium
      closeScriptorium();
    } else {
      openScriptorium();
    }
  });

  document.getElementById('btn-play-again')?.addEventListener('click', () => startGame());

  document.getElementById('btn-play')?.addEventListener('click', () => playWord());
  document.getElementById('btn-discard')?.addEventListener('click', () => discardLetters());

  document.getElementById('btn-sort')?.addEventListener('click', () => sortHand());

  bindBlindSelectEvents();
  bindScriptoriumEvents();
}

// ---- Event emitter listeners ----------------------------------------

function bindGameEvents() {
  emitter.on('gameStarted', () => {
    renderMapScreen();
    showScreen('screen-map');
  });

  emitter.on('categoryEntered', () => {
    renderBlindSelectScreen();
    showScreen('screen-blind-select');
    bindBlindSelectEvents();
  });

  emitter.on('blindStarted', () => {
    renderGameScreen();
    showScreen('screen-game');
  });

  emitter.on('blindSkipped', ({ tag }) => {
    showTagToast(tag);
  });

  emitter.on('selectionChanged', () => {
    updateGameAfterPlay();
  });

  emitter.on('wordPlayed', ({ word, result }) => {
    showScorePopup({ word, result });
    updateGameAfterPlay();
  });

  emitter.on('wordRejected', (data) => {
    showWordRejected(data);
    renderHand();
  });

  emitter.on('lettersDiscarded', () => {
    updateGameAfterPlay();
  });

  emitter.on('discardFailed', ({ reason }) => {
    const msg = reason === 'no_discards'
      ? 'Brak odrzuceń!'
      : 'Zaznacz litery do odrzucenia';
    showToast(msg, 'var(--red)');
  });

  emitter.on('oneshotUsed', ({ result }) => {
    if (result?.message) showToast(result.message, 'var(--gold)');
    updateGameAfterPlay();
  });

  emitter.on('handSorted', () => {
    updateGameAfterPlay();
  });

  emitter.on('passiveBonusPicked', () => {
    showToast('Bonus pasywny aktywny!', 'var(--green)');
  });

  emitter.on('blindEnded', ({ won, inkReward, score }) => {
    renderSummaryScreen({ won, inkReward, score });
    showScreen('screen-summary');
  });

  emitter.on('nextBlind', () => {
    renderBlindSelectScreen();
    showScreen('screen-blind-select');
    bindBlindSelectEvents();
  });

  emitter.on('categoryCompleted', () => {
    renderMapScreen();
    showScreen('screen-map');
  });

  emitter.on('gameOver', ({ victory }) => {
    renderEndScreen({ victory });
    showScreen('screen-end');
  });
}

// ---- Prosty toast ---------------------------------------------------

function showToast(message, color = 'var(--text)') {
  const toast = document.createElement('div');
  toast.className = 'tag-toast';
  toast.style.color = color;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}
