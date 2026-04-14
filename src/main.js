// src/main.js — bootstrap i routing między ekranami

import { initGame, gameState, startGame } from './game.js';
import { initUI, renderFigurePickScreen } from './ui.js';
import { initScriptorium } from './scriptorium.js';
import { getRandomFigures } from './figures.js';

// ---- Przełączanie ekranów ----------------------------------

export function showScreen(id) {
  const prev = document.querySelector('.screen--active');
  if (prev) prev.classList.remove('screen--active');
  const next = document.getElementById(id);
  if (next) next.classList.add('screen--active');
}

// ---- localStorage helpers ----------------------------------

function loadHighscore() {
  const hs = localStorage.getItem('zgadka_highscore');
  return hs ? parseInt(hs, 10) : 0;
}

function updateStartHighscore() {
  const el = document.getElementById('start-highscore');
  if (el) el.textContent = loadHighscore().toLocaleString('pl-PL');
}

// ---- Opcje startowe ----------------------------------------

function setupStartOptions() {
  ['rounds-selector', 'difficulty-selector', 'category-selector'].forEach(groupId => {
    const btns = document.querySelectorAll(`#${groupId} .opt-btn`);
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('opt-btn--active'));
        btn.classList.add('opt-btn--active');
      });
    });
  });
}

function getStartSettings() {
  const activeRounds = document.querySelector('#rounds-selector .opt-btn--active');
  const activeDiff = document.querySelector('#difficulty-selector .opt-btn--active');
  const activeCat = document.querySelector('#category-selector .opt-btn--active');
  return {
    maxRounds: activeRounds ? parseInt(activeRounds.dataset.value, 10) : 10,
    difficulty: activeDiff ? activeDiff.dataset.value : 'normal',
    category: activeCat ? activeCat.dataset.value : 'all',
  };
}

// ---- Przyciski startowe ------------------------------------

function setupStartButtons() {
  document.getElementById('btn-start').addEventListener('click', () => {
    const settings = getStartSettings();
    startGame(settings);
    gameState._figureOffer = getRandomFigures(3, [], 1);
    renderFigurePickScreen(gameState);
    showScreen('screen-figure-pick');
  });

  document.getElementById('btn-play-again').addEventListener('click', () => {
    updateStartHighscore();
    showScreen('screen-start');
  });
}

// ---- Bootstrap ---------------------------------------------

function init() {
  updateStartHighscore();
  setupStartOptions();
  setupStartButtons();
  initGame();
  initUI();
  initScriptorium();
  showScreen('screen-start');
}

init();
