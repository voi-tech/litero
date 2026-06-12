// src/main.js — bootstrap, routing, event bindings

import { emitter } from './eventEmitter.js';
import {
  initGame, startGame, playWord, discardLetters, gameState,
  endGame, closeScriptorium, allCategoriesCompleted, restoreRun,
  clearSelection, removeLastSelectedLetter, selectFirstMatchingLetter,
  buildDailyShareText,
} from './game.js';
import { saveRun, loadRun, clearSave } from './persistence.js';
import {
  initScreens,
  showScreen,
  showToast,
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
  resetGuessForm,
} from './ui.js';
import { openScriptorium, bindScriptoriumEvents } from './scriptorium.js';
import { initIcons } from './icons.js';

// ---- Bootstrap -------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initScreens();
  registerServiceWorker();

  bindStaticEvents();
  bindGameEvents();

  renderStartScreen();
  showScreen('screen-start');
  initIcons();

  // Hook debugowy — tylko w trybie dev (usuwany z builda produkcyjnego)
  if (import.meta.env.DEV) {
    window.__litero = { gameState, emitter };
  }

  // Słownik (~4,5 MB) ładuje się asynchronicznie — przycisk startu
  // czeka, aż walidacja słów będzie możliwa
  const startBtn = document.getElementById('btn-start');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = 'Wczytywanie słownika…';
  }
  initGame()
    .then(() => {
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = 'Zagraj';
      }
      // Pokaż „Kontynuuj grę", jeśli istnieje zapisany run
      const saved = loadRun();
      const continueBtn = document.getElementById('btn-continue');
      if (saved && continueBtn) {
        continueBtn.style.display = '';
        continueBtn.addEventListener('click', () => {
          const current = loadRun();
          if (current) restoreRun(current);
        }, { once: true });
      }
      renderStartScreen();
    })
    .catch(() => {
      if (startBtn) startBtn.textContent = 'Błąd wczytywania — odśwież stronę';
      showToast('Nie udało się wczytać słownika. Sprawdź połączenie i odśwież stronę.', 'var(--red)', 4000);
    });
});

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // PWA jest dodatkiem; gra ma działać dalej bez service workera.
  });
}

// ---- Statyczne eventy przycisków ------------------------------------

function bindStaticEvents() {
  let selectedDifficulty = 'akademicki';
  document.querySelectorAll('.difficulty-option').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDifficulty = btn.dataset.difficulty || 'akademicki';
      document.querySelectorAll('.difficulty-option').forEach(el => {
        el.classList.toggle('active', el === btn);
      });
    });
  });

  const startNewRun = () => {
    clearSave();
    startGame({ difficulty: selectedDifficulty });
  };

  document.getElementById('btn-start')?.addEventListener('click', () => {
    if (loadRun()) {
      showOverwriteDialog(startNewRun);
    } else {
      startGame({ difficulty: selectedDifficulty });
    }
  });

  document.getElementById('btn-daily')?.addEventListener('click', () => {
    const startDaily = () => {
      clearSave();
      startGame({ difficulty: selectedDifficulty, mode: 'daily' });
    };
    if (loadRun()) showOverwriteDialog(startDaily);
    else startDaily();
  });

  bindKeyboardControls();

  document.getElementById('btn-summary-continue')?.addEventListener('click', () => {
    if (gameState.phase !== 'summary') return;
    if (!gameState._summaryWon) {
      endGame(false);
      return;
    }
    if (allCategoriesCompleted()) {
      endGame(true);
      return;
    }
    // Po odgadnięciu hasła — pomiń Skryptorium
    if (gameState._wonByGuess) {
      closeScriptorium();
      return;
    }
    openScriptorium();
  });

  document.getElementById('btn-play-again')?.addEventListener('click', () => startGame({ difficulty: selectedDifficulty }));
  document.getElementById('btn-share-daily')?.addEventListener('click', () => shareDailyResult());

  document.getElementById('btn-play')?.addEventListener('click', () => playWord());
  document.getElementById('btn-discard')?.addEventListener('click', () => discardLetters());

  bindBlindSelectEvents();
  bindScriptoriumEvents();
}

async function shareDailyResult() {
  const text = buildDailyShareText();
  try {
    await navigator.clipboard.writeText(text);
    showToast('Wynik skopiowany', 'var(--green)');
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    showToast('Wynik skopiowany', 'var(--green)');
  }
}

function showOverwriteDialog(onConfirm) {
  const modal = document.getElementById('save-overwrite-modal');
  const cancel = document.getElementById('btn-overwrite-cancel');
  const confirm = document.getElementById('btn-overwrite-confirm');
  if (!modal || !cancel || !confirm) {
    onConfirm();
    return;
  }

  modal.style.display = 'flex';
  cancel.focus();

  const close = () => {
    modal.style.display = 'none';
    cancel.onclick = null;
    confirm.onclick = null;
  };

  cancel.onclick = close;
  confirm.onclick = () => {
    close();
    onConfirm();
  };
}

function bindKeyboardControls() {
  document.addEventListener('keydown', (event) => {
    if (gameState.phase !== 'game') return;
    if (isTypingTarget(event.target)) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      playWord();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      clearSelection();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      removeLastSelectedLetter();
      return;
    }
    if (event.key.length === 1 && event.key.match(/[a-ząćęłńóśźż]/i)) {
      const selected = selectFirstMatchingLetter(event.key);
      if (selected) event.preventDefault();
    }
  });
}

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

// ---- Event emitter listeners ----------------------------------------

function bindGameEvents() {
  // Auto-zapis runa po każdym zdarzeniu gry (czyści się przy victory/defeat)
  emitter.on('*', () => saveRun(gameState));

  emitter.on('runRestored', () => {
    resetGuessForm();
    switch (gameState.phase) {
      case 'game':
        renderGameScreen();
        showScreen('screen-game');
        break;
      case 'blind-select':
        renderBlindSelectScreen();
        showScreen('screen-blind-select');
        break;
      case 'summary':
        renderSummaryScreen({
          won: gameState._summaryWon,
          inkReward: gameState._lastInkReward ?? 0,
          score: gameState.runningScore,
        });
        showScreen('screen-summary');
        break;
      case 'scriptorium':
        openScriptorium();
        break;
      default:
        renderMapScreen();
        showScreen('screen-map');
    }
    showToast('Wznowiono zapisaną grę', 'var(--green)');
  });

  emitter.on('gameStarted', () => {
    renderMapScreen();
    showScreen('screen-map');
  });

  emitter.on('categoryEntered', () => {
    renderBlindSelectScreen();
    showScreen('screen-blind-select');
  });

  emitter.on('returnedToMap', () => {
    renderMapScreen();
    showScreen('screen-map');
  });

  emitter.on('blindStarted', () => {
    resetGuessForm();
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

  emitter.on('playFailed', () => {
    showToast('Zaznacz litery, by ułożyć słowo', 'var(--red)');
  });

  emitter.on('oneshotUsed', ({ result }) => {
    if (result?.message) showToast(result.message, 'var(--gold)');
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
