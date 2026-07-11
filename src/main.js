import puzzles from '../data/editorial-puzzles.json';
import { loadDictionary, isValidWord } from './dictionary.js';
import { localDateString, hashSeed, nextRandom } from './rng.js';
import { validatePuzzleContent } from './editorial/content.js';
import { SUPPORT_LEVELS } from './editorial/adaptation.js';
import { answerKnowledge, attemptSolve, chooseReward, composeWord, continueComposing, createRound } from './editorial/roundEngine.js';
import { completeRound, continueRun, createEditorialRun } from './editorial/runEngine.js';
import { scoreEditorialRound } from './editorial/scoring.js';
import {
  clearEditorialRun, loadEditorialRun, loadPreferences, saveEditorialRun,
  EDITORIAL_SAVE_KEY,
} from './editorial/persistence.js';

const OLD_SAVE_KEY = 'litero_save_v2';
const app = document.getElementById('app-main');
const liveRegion = document.getElementById('live-region');
let run = null;
let round = null;
let selectedIndices = [];
let ready = false;
let preferences = { theme: 'auto', supportMode: 'auto', tutorialSeen: false, ...loadPreferences() };

document.documentElement.dataset.theme = preferences.theme;
bindShell();
bootstrap();

async function bootstrap() {
  renderLoading();
  registerServiceWorker();
  try {
    const dictionary = await loadDictionary();
    const validation = validatePuzzleContent(puzzles, dictionary);
    if (!validation.valid) throw new Error(validation.errors.join('\n'));
    ready = true;
    handleOldSave();
    renderStart();
  } catch (error) {
    renderLoadError(error);
  }
}

function bindShell() {
  const rulesDialog = document.getElementById('rules-dialog');
  document.getElementById('rules-button')?.addEventListener('click', () => rulesDialog.showModal());
  document.getElementById('theme-button')?.addEventListener('click', cycleTheme);
  document.querySelector('.brand')?.addEventListener('click', event => {
    event.preventDefault();
    renderStart();
  });
}

function handleOldSave() {
  try {
    if (localStorage.getItem(OLD_SAVE_KEY) && !localStorage.getItem(EDITORIAL_SAVE_KEY)) {
      document.getElementById('migration-dialog')?.showModal();
      localStorage.removeItem(OLD_SAVE_KEY);
    }
  } catch { /* pamięć jest opcjonalna */ }
}

function cycleTheme() {
  const themes = ['auto', 'light', 'dark'];
  const next = themes[(themes.indexOf(preferences.theme) + 1) % themes.length];
  preferences = { ...preferences, theme: next };
  document.documentElement.dataset.theme = next;
  persist();
  announce(`Motyw: ${next === 'auto' ? 'zgodny z systemem' : next === 'light' ? 'jasny' : 'ciemny'}`);
}

function renderLoading() {
  app.innerHTML = `<section class="page error-page"><span class="brand__mark" aria-hidden="true">L</span><p class="eyebrow">Przygotowanie wydania</p><h1>Wczytujemy słownik…</h1><p class="lede">To może potrwać chwilę przy pierwszym uruchomieniu.</p></section>`;
}

function renderLoadError(error) {
  app.innerHTML = `<section class="page error-page"><span class="brand__mark" aria-hidden="true">!</span><p class="eyebrow">Nie udało się otworzyć redakcji</p><h1>Brakuje słownika lub treści</h1><p class="lede">${escapeHTML(error.message || 'Nieznany błąd ładowania.')}</p><button class="button button--primary" id="retry-load">Spróbuj ponownie</button></section>`;
  document.getElementById('retry-load')?.addEventListener('click', bootstrap);
}

function renderStart() {
  const saved = loadEditorialRun();
  const canContinue = saved && !saved.incompatible && saved.phase !== 'complete';
  const tutorial = !preferences.tutorialSeen;
  app.innerHTML = `<section class="page">
    <div class="start-grid">
      <article class="cover">
        <p class="eyebrow">Wydanie pierwsze • gra edukacyjna 7+</p>
        <h1 class="display">Redakcja<br>słów</h1>
        <div class="rule"></div>
        <p class="lede">Układaj słowa, zdobywaj wskazówki i odkrywaj pojęcia. Każde rozwiązanie kończy się krótką porcją wiedzy.</p>
        <div class="button-row">
          <button class="button button--primary" id="start-normal" ${ready ? '' : 'disabled'}>Nowe wydanie</button>
          <button class="button button--yellow" id="start-daily" ${ready ? '' : 'disabled'}>Hasła dnia</button>
          ${canContinue ? '<button class="button button--blue" id="continue-run">Kontynuuj</button>' : ''}
        </div>
      </article>
      <aside class="start-panel">
        ${tutorial ? `<article class="paper-card"><p class="eyebrow">Pierwsza wizyta</p><h2>Zacznij od próby</h2><p>Jedno prowadzone hasło pokaże wszystkie decyzje bez ryzyka porażki.</p><button class="button button--blue button--wide" id="start-tutorial">Samouczek</button></article>` : ''}
        <article class="paper-card mode-card"><span class="mode-card__number">6</span><div><h2>Pełne wydanie</h2><p>Pięć haseł i finał. Około 12–20 minut.</p></div></article>
        <article class="paper-card mode-card"><span class="mode-card__number">3</span><div><h2>Hasła dnia</h2><p>Ta sama łamigłówka dla wszystkich. Około 5–8 minut.</p></div></article>
        <article class="paper-card">
          <label for="support-mode"><strong>Poziom wskazówek</strong></label>
          <select class="text-input button--wide" id="support-mode">
            <option value="auto" ${preferences.supportMode === 'auto' ? 'selected' : ''}>Automatyczny</option>
            <option value="fixed" ${preferences.supportMode === 'fixed' ? 'selected' : ''}>Stałe wsparcie</option>
          </select>
          <p><small>Automatyczny poziom zmienia się najwyżej o jeden stopień między hasłami.</small></p>
        </article>
      </aside>
    </div>
  </section>`;
  bindStartEvents(saved);
  focusMain();
}

function bindStartEvents(saved) {
  document.getElementById('support-mode')?.addEventListener('change', event => {
    preferences = { ...preferences, supportMode: event.target.value };
    persist();
  });
  document.getElementById('start-normal')?.addEventListener('click', () => startRun('normal'));
  document.getElementById('start-daily')?.addEventListener('click', () => startRun('daily'));
  document.getElementById('start-tutorial')?.addEventListener('click', startTutorial);
  document.getElementById('continue-run')?.addEventListener('click', () => {
    run = saved;
    if (run.phase === 'between') renderBetween();
    else if (run.activeRound) {
      round = run.activeRound;
      selectedIndices = [];
      renderRound();
    } else startCurrentRound();
  });
}

function startRun(mode) {
  clearEditorialRun();
  const seed = mode === 'daily' ? localDateString() : `${Date.now()}:${Math.random()}`;
  run = createEditorialRun({ puzzles, mode, seed, supportMode: preferences.supportMode });
  startCurrentRound();
}

function startTutorial() {
  run = createEditorialRun({ puzzles: [puzzles.find(item => item.id === 'przyroda-rzeka')], mode: 'tutorial', seed: 'tutorial', supportMode: 'fixed' });
  run.isTutorial = true;
  run.supportProfile.level = 3;
  startCurrentRound();
}

function makeHand(puzzle, seed) {
  const target = [...new Set([...puzzle.word])].slice(0, 6);
  const fillers = ['A', 'E', 'I', 'K', 'O', 'T', 'R', 'S'];
  const hand = [...target];
  for (const letter of fillers) if (hand.length < 8 && !hand.includes(letter)) hand.push(letter);
  let state = hashSeed(seed);
  for (let index = hand.length - 1; index > 0; index--) {
    const random = nextRandom(state); state = random.state;
    const targetIndex = Math.floor(random.value * (index + 1));
    [hand[index], hand[targetIndex]] = [hand[targetIndex], hand[index]];
  }
  return hand;
}

function applyToolsToRound(nextRound) {
  const tools = [...run.tools];
  if (tools.includes('zakladka')) nextRound.turnsLeft += 1;
  if (tools.includes('korektor')) nextRound.attemptsLeft += 1;
  if (tools.includes('lupa')) nextRound.hintsUsed = -1;
  if (tools.includes('slownik')) {
    nextRound.revealed.add(0);
    nextRound.hintsUsed += 1;
  }
  run.tools = [];
  return nextRound;
}

function startCurrentRound() {
  run = continueRun(run);
  const puzzle = run.puzzles[run.currentIndex];
  if (!puzzle) return renderEnd();
  round = applyToolsToRound(createRound({
    puzzle,
    hand: makeHand(puzzle, `${run.seed}:${run.currentIndex}`),
    supportLevel: run.supportProfile.level,
  }));
  if (run.currentIndex === run.puzzles.length - 1 && run.results.length) {
    const remembered = run.results.filter(item => item.knowledgeCorrect).length;
    for (let index = 0; index < Math.min(remembered, 2); index++) round.revealed.add(index);
    round.stylePoints += remembered * 10;
  }
  selectedIndices = [];
  persist();
  renderRound();
}

function renderRound() {
  const puzzle = round.puzzle;
  const support = SUPPORT_LEVELS[round.supportLevel];
  const definition = puzzle.definitions[support.definition];
  const progress = run.puzzles.map((_, index) => `<span class="${index < run.currentIndex ? 'done' : index === run.currentIndex ? 'current' : ''}"></span>`).join('');
  const roundLabel = run.isTutorial ? 'Samouczek' : run.currentIndex === run.puzzles.length - 1 ? 'Finał wydania' : escapeHTML(puzzle.category);
  app.innerHTML = `<section class="page">
    <header class="page-header"><div><p class="eyebrow">${roundLabel} • hasło ${run.currentIndex + 1}/${run.puzzles.length}</p><h1>${run.isTutorial ? 'Próba redakcyjna' : 'Odkryj znaczenie'}</h1><div class="progress-strip" role="progressbar" aria-label="Postęp wydania" aria-valuemin="0" aria-valuemax="${run.puzzles.length}" aria-valuenow="${run.currentIndex + 1}">${progress}</div></div><div class="stats-line"><span>Atrament <strong>${run.ink}</strong></span><span>Nakład <strong>${run.circulation}%</strong></span></div></header>
    <div class="game-layout">
      <div>
        <article class="paper-card definition-card"><p class="eyebrow">Definicja</p><blockquote>${escapeHTML(definition)}</blockquote><div class="masked-word" role="group" aria-label="Hasło ma ${puzzle.word.length} liter">${renderMaskedWord()}</div></article>
        ${renderPhasePanel()}
      </div>
      <aside class="round-sidebar">
        <article class="paper-card"><h2>Stan łamu</h2><div class="metric"><span>Tury</span><strong>${round.turnsLeft}</strong></div><div class="metric"><span>Próby</span><strong>${round.attemptsLeft}</strong></div><div class="metric"><span>Warsztat</span><strong>${round.wordCraftPoints}</strong></div></article>
        <article class="paper-card"><p class="eyebrow">Poziom wsparcia</p><h3>${capitalize(support.id)}</h3><p>Poziom zmienia się tylko między hasłami.</p></article>
        ${run.isTutorial ? `<article class="paper-card"><p class="eyebrow">Podpowiedź samouczka</p><p>${tutorialHint()}</p></article>` : ''}
      </aside>
    </div>
  </section>`;
  bindRoundEvents();
  focusMain();
}

function renderMaskedWord() {
  return [...round.puzzle.word].map((letter, index) => `<span class="masked-letter">${round.revealed.has(index) || round.phase === 'learn' ? escapeHTML(letter) : '<span aria-hidden="true">·</span>'}</span>`).join('');
}

function renderPhasePanel() {
  if (round.phase === 'compose') {
    const word = selectedIndices.map(index => round.hand[index]).join('');
    return `<section class="composer" aria-labelledby="compose-title"><p class="eyebrow">Kaszta liter</p><h2 id="compose-title">Ułóż słowo</h2><div class="selected-word" id="selected-word">${word || '—'}</div><div class="letter-rack">${round.hand.map((letter, index) => `<button class="letter-tile" type="button" data-letter-index="${index}" aria-pressed="${selectedIndices.includes(index)}" aria-label="Litera ${letter}">${letter}</button>`).join('')}</div><div class="button-row"><button class="button button--quiet" id="clear-word">Wyczyść</button><button class="button button--primary" id="play-word" ${word.length < 2 ? 'disabled' : ''}>Złóż słowo</button><button class="button button--blue" id="open-guess">Odgadnij hasło</button></div><p id="word-message" role="status"></p></section>`;
  }
  if (round.phase === 'reward') {
    return `<section class="composer"><p class="eyebrow">Korekta przyjęta</p><h2>Wybierz wskazówkę</h2><div class="reward-grid"><button class="button reward" data-reward="reveal-consonant"><strong>Spółgłoska</strong>Odsłoń pierwszą ukrytą spółgłoskę.</button><button class="button reward" data-reward="buy-vowel"><strong>Samogłoska</strong>Odsłoń pierwszą ukrytą samogłoskę.</button><button class="button reward" data-reward="locate-letter"><strong>Pozycja</strong>Odkryj kolejną literę hasła.</button><button class="button reward" data-reward="extra-attempt"><strong>Dodatkowa próba</strong>Zyskaj jeszcze jedną odpowiedź.</button></div></section>`;
  }
  if (round.phase === 'solve') return renderGuessPanel(true);
  return '';
}

function renderGuessPanel(canContinue) {
  return `<section class="composer"><p class="eyebrow">Decyzja redaktora</p><h2>Jak brzmi hasło?</h2><form class="guess-row" id="guess-form"><label class="live-region" for="guess-input">Odpowiedź</label><input class="text-input" id="guess-input" autocomplete="off" maxlength="32" required><button class="button button--primary">Sprawdź</button></form>${canContinue ? '<button class="button button--quiet" id="continue-compose">Ułóż kolejne słowo</button>' : ''}</section>`;
}

function bindRoundEvents() {
  document.querySelectorAll('[data-letter-index]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.letterIndex);
    selectedIndices = selectedIndices.includes(index) ? selectedIndices.filter(item => item !== index) : [...selectedIndices, index];
    renderRound();
  }));
  document.getElementById('clear-word')?.addEventListener('click', () => { selectedIndices = []; renderRound(); });
  document.getElementById('play-word')?.addEventListener('click', playSelectedWord);
  document.getElementById('open-guess')?.addEventListener('click', () => {
    round = { ...round, phase: 'solve' }; renderRound(); document.getElementById('guess-input')?.focus();
  });
  document.querySelectorAll('[data-reward]').forEach(button => button.addEventListener('click', () => {
    round = chooseReward(round, button.dataset.reward); persist(); renderRound(); announce('Wskazówka została dodana.');
  }));
  document.getElementById('continue-compose')?.addEventListener('click', () => { round = continueComposing(round); renderRound(); });
  document.getElementById('guess-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const previousAttempts = round.attemptsLeft;
    round = attemptSolve(round, document.getElementById('guess-input').value);
    persist();
    if (round.phase === 'learn') renderLearn();
    else { renderRound(); announce(`To nie jest hasło. Pozostało prób: ${previousAttempts - 1}.`); }
  });
  document.addEventListener('keydown', handleRoundKeyboard, { once: true });
}

function handleRoundKeyboard(event) {
  if (round?.phase !== 'compose' || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  if (event.key === 'Escape') { selectedIndices = []; renderRound(); }
  if (event.key === 'Backspace') { event.preventDefault(); selectedIndices.pop(); renderRound(); }
  if (/^[a-ząćęłńóśźż]$/i.test(event.key)) {
    const letter = event.key.toLocaleUpperCase('pl-PL');
    const index = round.hand.findIndex((item, position) => item === letter && !selectedIndices.includes(position));
    if (index >= 0) { selectedIndices.push(index); renderRound(); }
  }
}

function playSelectedWord() {
  const word = selectedIndices.map(index => round.hand[index]).join('');
  if (!isValidWord(word)) {
    const message = document.getElementById('word-message');
    if (message) message.textContent = 'Tego słowa nie ma w słowniku. Spróbuj innego układu.';
    announce('Słowo nie zostało przyjęte.');
    return;
  }
  const related = round.puzzle.synonyms.some(item => item.toLocaleUpperCase('pl-PL') === word) || round.puzzle.word.includes(word);
  round = composeWord(round, { word, valid: true, categoryRelated: related });
  selectedIndices = [];
  persist(); renderRound(); announce(`Przyjęto słowo ${word}. Wybierz wskazówkę.`);
}

function renderLearn() {
  const puzzle = round.puzzle;
  app.innerHTML = `<section class="page knowledge"><p class="eyebrow">${round.solved ? 'Hasło rozwiązane' : 'Poznaj odpowiedź'}</p><h1 class="knowledge__word">${escapeHTML(puzzle.word)}</h1><p class="lede">${escapeHTML(puzzle.definitions.full)}</p><blockquote class="quote">${escapeHTML(puzzle.example)}</blockquote><article class="paper-card"><h2>Czy wiesz?</h2><p>${escapeHTML(puzzle.curiosity)}</p><p><strong>Synonim:</strong> ${escapeHTML(puzzle.synonyms.join(', '))}</p></article><section><p class="eyebrow">Jedno pytanie na utrwalenie</p><h2>${escapeHTML(puzzle.knowledgeQuestion.prompt)}</h2><div class="knowledge-options">${puzzle.knowledgeQuestion.options.map((option, index) => `<button class="button" data-answer="${index}">${escapeHTML(option)}</button>`).join('')}</div></section></section>`;
  document.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => finishKnowledge(Number(button.dataset.answer))));
  focusMain();
}

function finishKnowledge(answerIndex) {
  round = answerKnowledge(round, answerIndex);
  const result = roundResult();
  const score = scoreEditorialRound(result);
  run = completeRound(run, result);
  persist();
  if (run.isTutorial) {
    preferences = { ...preferences, tutorialSeen: true };
    clearEditorialRun(); persist();
    return renderTutorialComplete(score);
  }
  if (run.phase === 'complete') renderEnd();
  else renderBetween(score, round.knowledgeCorrect);
}

function roundResult() {
  return {
    puzzleId: round.puzzle.id,
    word: round.puzzle.word,
    solved: Boolean(round.solved),
    turnsUsed: round.maxTurns - round.turnsLeft,
    maxTurns: round.maxTurns,
    hintsUsed: Math.max(0, round.hintsUsed),
    wrongGuesses: round.wrongGuesses,
    wordCraftPoints: round.wordCraftPoints,
    knowledgeCorrect: Boolean(round.knowledgeCorrect),
    stylePoints: round.stylePoints,
  };
}

function renderBetween(score = run.results.at(-1)?.score, knowledgeCorrect = run.results.at(-1)?.knowledgeCorrect) {
  app.innerHTML = `<section class="page knowledge"><p class="eyebrow">Koniec łamu</p><h1>${knowledgeCorrect ? 'Wiedza zostaje.' : 'Następnym razem będzie łatwiej.'}</h1><div class="score-grid"><article class="paper-card"><span>Rozwiązanie</span><strong>${score.solution}</strong></article><article class="paper-card"><span>Warsztat</span><strong>${score.craft}</strong></article><article class="paper-card"><span>Wiedza</span><strong>${score.knowledge}</strong></article><article class="paper-card"><span>Styl</span><strong>${score.style}</strong></article></div><article class="paper-card"><p class="eyebrow">Skład narzędzi • atrament: ${run.ink}</p><h2>Przygotuj następne hasło</h2><div class="tool-grid">${renderTools()}</div></article><button class="button button--primary button--wide" id="next-round">Następne hasło</button></section>`;
  document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => buyTool(button.dataset.tool, Number(button.dataset.cost))));
  document.getElementById('next-round')?.addEventListener('click', startCurrentRound);
  focusMain();
}

function renderTools() {
  const tools = [
    ['zakladka', 3, 'Zakładka', '+1 tura w następnym haśle'],
    ['korektor', 3, 'Korektor', '+1 próba rozwiązania'],
    ['slownik', 4, 'Słownik', 'Pierwsza litera od razu odkryta'],
    ['lupa', 2, 'Lupa', 'Pierwsza wskazówka nie obniża wyniku'],
  ];
  return tools.map(([id, cost, name, description]) => `<button class="button reward" data-tool="${id}" data-cost="${cost}" ${run.ink < cost || run.tools.includes(id) ? 'disabled' : ''}><strong>${name} • ${cost}</strong>${description}</button>`).join('');
}

function buyTool(id, cost) {
  if (run.ink < cost || run.tools.includes(id)) return;
  run = { ...run, ink: run.ink - cost, tools: [...run.tools, id] };
  persist(); renderBetween(); announce('Narzędzie dodane do następnego hasła.');
}

function renderEnd() {
  clearEditorialRun();
  const solved = run.results.filter(result => result.solved).length;
  const learned = run.results.filter(result => result.knowledgeCorrect).length;
  app.innerHTML = `<section class="page knowledge"><p class="eyebrow">Wydanie zamknięte</p><h1>${run.mode === 'daily' ? 'Hasła dnia gotowe' : 'Redakcja zakończona'}</h1><div class="result-score">${run.score}</div><p class="lede">punktów za całe wydanie</p><div class="score-grid"><article class="paper-card"><span>Rozwiązane</span><strong>${solved}/${run.puzzles.length}</strong></article><article class="paper-card"><span>Utrwalone</span><strong>${learned}</strong></article><article class="paper-card"><span>Nakład</span><strong>${run.circulation}%</strong></article><article class="paper-card"><span>Poziom</span><strong>${run.supportProfile.level + 1}</strong></article></div><div class="button-row"><button class="button button--primary" id="home-button">Nowe wydanie</button>${run.mode === 'daily' ? '<button class="button button--blue" id="share-button">Kopiuj wynik</button>' : ''}</div></section>`;
  document.getElementById('home-button')?.addEventListener('click', renderStart);
  document.getElementById('share-button')?.addEventListener('click', shareResult);
  focusMain();
}

function renderTutorialComplete(score) {
  app.innerHTML = `<section class="page knowledge"><p class="eyebrow">Próba ukończona</p><h1>Masz legitymację redaktora!</h1><p class="lede">Wiesz już, jak układać słowa, wybierać wskazówki, odgadywać hasła i utrwalać ich znaczenia.</p><div class="result-score">${score.total}</div><button class="button button--primary" id="tutorial-home">Przejdź do gry</button></section>`;
  document.getElementById('tutorial-home')?.addEventListener('click', renderStart);
  focusMain();
}

async function shareResult() {
  const marks = run.results.map(result => result.solved ? '■' : '□').join('');
  const text = `Litero ${localDateString()} ${marks} • ${run.score} pkt • bez spoilerów`;
  try { await navigator.clipboard.writeText(text); announce('Wynik skopiowany.'); }
  catch { announce('Nie udało się skopiować wyniku.'); }
}

function tutorialHint() {
  if (round.phase === 'compose') return 'Kliknij litery, aby ułożyć poprawne słowo. Klawiatura również działa.';
  if (round.phase === 'reward') return 'Każde przyjęte słowo pozwala wybrać informację o haśle.';
  return 'Możesz już zgadywać albo wrócić do układania słów.';
}

function persist() {
  if (run && run.phase !== 'complete') saveEditorialRun({ ...run, activeRound: round }, preferences);
  else {
    try { localStorage.setItem('litero_preferences_v1', JSON.stringify(preferences)); } catch { /* opcjonalne */ }
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

function announce(message) { liveRegion.textContent = ''; requestAnimationFrame(() => { liveRegion.textContent = message; }); }
function focusMain() { requestAnimationFrame(() => app.focus()); }
function capitalize(value) { return value.charAt(0).toLocaleUpperCase('pl-PL') + value.slice(1); }
function escapeHTML(value) { const node = document.createElement('span'); node.textContent = String(value ?? ''); return node.innerHTML; }

if (import.meta.env.DEV) window.__litero = { get run() { return run; }, get round() { return round; }, puzzles };
