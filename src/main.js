import categoryData from '../data/categories-v4.json';
import { buildGameCategories, validateGameCategories } from './content.js';
import {
  chooseUpgrade,
  closeShop,
  completeReveal,
  createRun,
  enterCurrentChallenge,
  getCompletedCategoryResult,
  playValidWord,
  skipByGuess,
  skipWithoutGuess,
} from './litero-v4.js';
import { commitCompletedCategory } from './profile.js';
import {
  clearRunV4,
  loadProfile,
  loadRunV4,
  saveProfile,
  saveRunV4,
} from './v4-persistence.js';
import { loadLexicon } from './lexicon.js';
import { buildPlayableHand, refillPlayableHand } from './v4-letters.js';
import { scoreSelection } from './v4-play.js';
import { LETTER_VALUES } from './v4-scoring.js';
import { LANGUAGE_CARDS, ACTION_CARDS, updateUnlockProgress } from './language-cards.js';
import {
  LETTER_SETS,
  getLetterSetRules,
  updateLetterSetProgress,
} from './letter-sets.js';
import { buyOffer, createShop, getInterest, rerollShop } from './v4-shop.js';
import { hashSeed, localDateString, nextRandom } from './rng.js';

const app = document.querySelector('#app-main');
const live = document.querySelector('#live-region');
const allCategories = buildGameCategories(categoryData.categories);
const POLISH_LETTERS = new Set(['Ą', 'Ć', 'Ę', 'Ł', 'Ń', 'Ó', 'Ś', 'Ź', 'Ż']);
const VOWELS = new Set(['A', 'Ą', 'E', 'Ę', 'I', 'O', 'Ó', 'U', 'Y']);
const DIFFICULTIES = {
  spokojny: { name: 'Spokojny', multiplier: 0.85 },
  standardowy: { name: 'Standardowy', multiplier: 1 },
  wymagajacy: { name: 'Wymagający', multiplier: 1.15 },
};

let profile = loadProfile();
let run = null;
let lexiconEntries = [];
let selectedIndices = [];
let view = 'start';
let setup = { difficulty: 'standardowy', letterSetId: 'standardowy' };

applyTheme();
bindShell();
bootstrap();

async function bootstrap() {
  app.innerHTML = loadingView();
  try {
    const contentCheck = validateGameCategories(allCategories);
    if (!contentCheck.valid) throw new Error(contentCheck.errors.join('\n'));
    const payload = await loadLexicon();
    lexiconEntries = payload.entries;
    renderStart();
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    }
  } catch (error) {
    app.innerHTML = `<section class="centered card"><p class="overline">Błąd danych</p><h1>Nie udało się przygotować gry</h1><p>${escapeHTML(error.message)}</p><button class="button primary" id="retry">Spróbuj ponownie</button></section>`;
    document.querySelector('#retry')?.addEventListener('click', bootstrap);
  }
}

function bindShell() {
  document.querySelector('#home-button')?.addEventListener('click', renderStart);
  document.querySelector('#dictionary-button')?.addEventListener('click', renderDictionary);
  document.querySelector('#cards-button')?.addEventListener('click', renderCards);
  document.querySelector('#sets-button')?.addEventListener('click', renderSets);
  document.querySelector('#rules-button')?.addEventListener('click', () => {
    document.querySelector('#rules-dialog')?.showModal();
  });
  document.querySelector('#theme-button')?.addEventListener('click', cycleTheme);
}

function applyTheme() {
  document.documentElement.dataset.theme = profile.preferences?.theme ?? 'auto';
}

function cycleTheme() {
  const values = ['auto', 'light', 'dark'];
  const current = profile.preferences?.theme ?? 'auto';
  const next = values[(values.indexOf(current) + 1) % values.length];
  profile = {
    ...profile,
    preferences: { ...(profile.preferences ?? {}), theme: next },
  };
  saveProfile(profile);
  applyTheme();
  announce(`Motyw: ${next === 'auto' ? 'systemowy' : next === 'light' ? 'jasny' : 'ciemny'}`);
}

function renderStart() {
  view = 'start';
  run = null;
  selectedIndices = [];
  const saved = loadRunV4();
  const unlockedSets = Object.values(LETTER_SETS)
    .filter(item => profile.unlockedLetterSetIds.includes(item.id));
  app.innerHTML = `<section class="start-layout">
    <div class="hero">
      <p class="overline">Polska gra słowna</p>
      <h1>Znajdź słowa.<br><span>Poznaj znaczenia.</span></h1>
      <p class="lead">Układaj poprawne słowa z liter, rozwijaj wynik i odkrywaj działy trwałego Słownika. Jedno podejście to trzy kategorie.</p>
      <div class="start-actions">
        <button class="button primary" id="start-full">Pełna gra</button>
        <button class="button blue" id="start-daily">Wyzwanie dzienne</button>
        ${saved ? '<button class="button" id="continue-run">Kontynuuj</button>' : ''}
      </div>
    </div>
    <aside class="setup card">
      <p class="overline">Ustawienia podejścia</p>
      <label>Poziom trudności
        <select id="difficulty">
          ${Object.entries(DIFFICULTIES).map(([id, item]) => `<option value="${id}" ${setup.difficulty === id ? 'selected' : ''}>${item.name}</option>`).join('')}
        </select>
      </label>
      <label>Zestaw liter
        <select id="letter-set">
          ${unlockedSets.map(item => `<option value="${item.id}" ${setup.letterSetId === item.id ? 'selected' : ''}>${item.name}</option>`).join('')}
        </select>
      </label>
      <div class="start-facts">
        <div><strong>3</strong><span>kategorie</span></div>
        <div><strong>9</strong><span>wyzwań</span></div>
        <div><strong>1</strong><span>trwały stół</span></div>
      </div>
    </aside>
  </section>`;
  document.querySelector('#difficulty')?.addEventListener('change', event => {
    setup.difficulty = event.target.value;
  });
  document.querySelector('#letter-set')?.addEventListener('change', event => {
    setup.letterSetId = event.target.value;
  });
  document.querySelector('#start-full')?.addEventListener('click', () => startRun('normal'));
  document.querySelector('#start-daily')?.addEventListener('click', () => startRun('daily'));
  document.querySelector('#continue-run')?.addEventListener('click', () => {
    run = saved;
    renderRun();
  });
  focusMain();
}

function deterministicRandom(seedText) {
  let state = hashSeed(seedText);
  return () => {
    const next = nextRandom(state);
    state = next.state;
    return next.value;
  };
}

function shuffled(items, seed) {
  const result = [...items];
  const random = deterministicRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function pickCategoryWords(categories, seed) {
  return categories.map((category, index) => {
    const random = deterministicRandom(`${seed}:${category.id}:${index}`);
    const easy = category.easyWords[Math.floor(random() * category.easyWords.length)];
    const hard = category.hardWords[Math.floor(random() * category.hardWords.length)];
    return { ...category, easyWords: [easy], hardWords: [hard] };
  });
}

function targetsFor(count, multiplier) {
  const slice = values => values.slice(0, count).map(value => Math.round(value * multiplier));
  return {
    easy: slice([120, 200, 280]),
    hard: slice([240, 400, 560]),
    category: slice([420, 690, 960]),
  };
}

function startRun(mode) {
  const seed = mode === 'daily' ? localDateString() : `${Date.now()}:${Math.random()}`;
  const count = mode === 'daily' ? 1 : 3;
  const categories = pickCategoryWords(shuffled(allCategories, seed).slice(0, count), seed);
  run = createRun({
    categories,
    seed,
    mode,
    difficulty: setup.difficulty,
    targets: targetsFor(count, DIFFICULTIES[setup.difficulty].multiplier),
  });
  run.letterSetId = setup.letterSetId;
  run.languageCardIds = [];
  run.actionCardIds = [];
  run.previousWord = null;
  run.aliterationStreak = 0;
  run.maxWordLengthInCategory = 0;
  clearRunV4();
  persistRun();
  renderRun();
}

function renderRun() {
  if (!run) return renderStart();
  if (run.phase === 'definition-select') renderDefinitionSelect();
  else if (run.phase === 'playing') renderTable();
  else if (run.phase === 'word-reveal') renderWordReveal();
  else if (run.phase === 'category-reveal') renderCategoryReveal();
  else if (run.phase === 'shop') renderShop();
  else if (run.phase === 'upgrade') renderUpgrade();
  else if (run.phase === 'victory') renderEnd(true);
  else if (run.phase === 'defeat') renderEnd(false);
}

function runProgress() {
  return run.categories.map((category, categoryIndex) => {
    const active = categoryIndex === run.categoryIndex;
    const done = categoryIndex < run.categoryIndex || (active && run.categoryWon);
    return `<li class="${active ? 'active' : ''} ${done ? 'done' : ''}">
      <span>${categoryIndex + 1}</span><div><strong>${escapeHTML(category.name)}</strong><small>${done ? 'odkryta' : active ? run.challenge.label : 'ukryta'}</small></div>
    </li>`;
  }).join('');
}

function tableShell(center, options = {}) {
  const category = run.categories[run.categoryIndex];
  return `<section class="table-page">
    <header class="run-header">
      <div><p class="overline">${run.mode === 'daily' ? 'Wyzwanie dzienne' : `Kategoria ${run.categoryIndex + 1} z ${run.categories.length}`}</p><h1>${escapeHTML(category.name)}</h1></div>
      <div class="run-money"><span>Atrament</span><strong>${run.ink}</strong></div>
    </header>
    <div class="game-grid">
      <aside class="progress-panel card"><h2>Postęp</h2><ol class="category-progress">${runProgress()}</ol>
        <div class="compact-list"><span>Zestaw</span><strong>${escapeHTML(LETTER_SETS[run.letterSetId]?.name ?? 'Standardowy')}</strong><span>Ulepszenia</span><strong>${run.upgrades.length}</strong></div>
      </aside>
      <div class="table-center">${center}</div>
      <aside class="cards-panel card">
        <div class="panel-heading"><h2>Karty językowe</h2><span>${run.languageCardIds.length}/5</span></div>
        <div class="owned-cards">${run.languageCardIds.length ? run.languageCardIds.map(id => miniCard(LANGUAGE_CARDS[id])).join('') : '<p class="muted">Kupisz je po zwycięskim wyzwaniu.</p>'}</div>
        <div class="panel-heading"><h2>Karty działań</h2><span>${run.actionCardIds.length}/3</span></div>
        <div class="owned-cards">${run.actionCardIds.length ? run.actionCardIds.map(id => miniCard(ACTION_CARDS[id], true)).join('') : '<p class="muted">Brak kart działań.</p>'}</div>
      </aside>
    </div>
  </section>`;
}

function renderDefinitionSelect() {
  selectedIndices = [];
  const challenge = run.challenge;
  const isCategory = challenge.kind === 'category';
  const content = `<article class="challenge card ${isCategory ? 'boss-card' : ''}">
    <div class="challenge-top"><span class="badge ${isCategory ? 'red' : challenge.kind === 'hard' ? 'yellow' : 'blue'}">${challenge.label}</span><strong>Cel: ${challenge.targetScore} pkt</strong></div>
    <h2>${isCategory ? escapeHTML(challenge.categoryName) : `${capitalize(challenge.partOfSpeech)} · ${challenge.letterCount} ${letterWord(challenge.letterCount)}`}</h2>
    ${isCategory
      ? `<p class="hidden-definition">Definicja kategorii zostanie odsłonięta po zwycięstwie.</p>
        <div class="consequence negative"><strong>${escapeHTML(challenge.bossModifier.label)}</strong><span>${escapeHTML(challenge.bossModifier.description)}</span></div>`
      : `<blockquote>${escapeHTML(challenge.definition)}</blockquote>
        <div class="skip-grid">
          <form id="guess-form" class="consequence positive">
            <strong>Odgadnij i pomiń</strong><span>${escapeHTML(challenge.positiveEffect.label)}</span>
            <label class="sr-only" for="guess">Odpowiedź</label><div class="inline-form"><input id="guess" autocomplete="off" placeholder="Wpisz słowo"><button class="button small blue">Sprawdź</button></div>
          </form>
          <div class="consequence negative"><strong>Pomiń bez odpowiedzi</strong><span>${escapeHTML(challenge.negativeEffect.label)}</span><button class="text-button" id="skip">Pomiń</button></div>
        </div>`}
    <button class="button primary wide" id="enter-challenge">${isCategory ? 'Rozpocznij kategorię' : 'Rozpocznij wyzwanie'}</button>
  </article>`;
  app.innerHTML = tableShell(content);
  document.querySelector('#enter-challenge')?.addEventListener('click', beginChallenge);
  document.querySelector('#skip')?.addEventListener('click', () => {
    run = skipWithoutGuess(run);
    persistRun();
    announce(`Wyzwanie pominięte. ${challenge.negativeEffect.label}.`);
    renderRun();
  });
  document.querySelector('#guess-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const answer = document.querySelector('#guess').value;
    const before = run.discoveries.length;
    run = skipByGuess(run, answer);
    persistRun();
    announce(run.discoveries.length > before
      ? `Poprawna odpowiedź. ${challenge.positiveEffect.label}.`
      : `Błędna odpowiedź. ${challenge.negativeEffect.label}.`);
    renderRun();
  });
  focusMain();
}

function beginChallenge() {
  const setRules = getLetterSetRules(run.letterSetId);
  run = enterCurrentChallenge(run, setRules);
  const random = deterministicRandom(`${run.seed}:hand:${run.categoryIndex}:${run.challengeIndex}`);
  run.hand = buildPlayableHand(lexiconEntries, { ...setRules, handSize: run.handSize }, random).hand;
  run.wordsPlayedInChallenge = 0;
  run.doubleNext = false;
  selectedIndices = [];
  persistRun();
  renderRun();
}

function renderTable(focusIndex = null) {
  const target = run.challenge.targetScore;
  const percent = Math.min(100, Math.round(run.runningScore / target * 100));
  const selectedWord = selectedIndices.map(index => run.hand[index]).join('');
  const center = `<article class="score-card card">
      <div class="challenge-top"><span class="badge">${run.challenge.label}</span><span>${run.challenge.kind === 'category' ? escapeHTML(run.challenge.categoryName) : `${capitalize(run.challenge.partOfSpeech)} · ${run.challenge.letterCount} ${letterWord(run.challenge.letterCount)}`}</span></div>
      <div class="score-line"><strong>${run.runningScore}</strong><span>/ ${target} pkt</span></div>
      <div class="progress-track" role="progressbar" aria-label="Wynik wyzwania" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${run.runningScore}"><span style="width:${percent}%"></span></div>
      <div class="attempt-stats"><div><strong>${run.playsLeft}</strong><span>pozostałe zagrania</span></div><div><strong>${run.discardsLeft}</strong><span>pozostałe odrzucenia</span></div><div><strong>${selectedWord || '—'}</strong><span>wybrane litery</span></div></div>
    </article>
    <article class="hand-area" aria-label="Ręka liter">
      <div class="letter-hand">${run.hand.map((letter, index) => `<button class="letter-tile ${selectedIndices.includes(index) ? 'selected' : ''}" data-letter-index="${index}" aria-pressed="${selectedIndices.includes(index)}" aria-label="Litera ${letter}">${letter}<small>${letterValue(letter)}</small></button>`).join('')}</div>
      <div class="play-actions"><button class="button" id="discard" ${!selectedIndices.length || run.discardsLeft <= 0 ? 'disabled' : ''}>Odrzuć</button><button class="button primary" id="play" ${selectedWord.length < 1 ? 'disabled' : ''}>Zagraj litery</button></div>
      <p class="table-message" id="table-message">Punktują kolejne słowa od lewej. Bez słowa punktuje najlepsza litera.</p>
    </article>`;
  app.innerHTML = tableShell(center);
  document.querySelectorAll('[data-letter-index]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.letterIndex);
    selectedIndices = selectedIndices.includes(index)
      ? selectedIndices.filter(item => item !== index)
      : [...selectedIndices, index];
    renderTable(index);
  }));
  document.querySelector('#play')?.addEventListener('click', playSelection);
  document.querySelector('#discard')?.addEventListener('click', discardSelection);
  document.querySelectorAll('[data-action-id]').forEach(button => button.addEventListener('click', () => useAction(button.dataset.actionId)));
  focusMain(false);
  if (focusIndex != null) {
    document.querySelector(`[data-letter-index="${focusIndex}"]`)?.focus();
  }
}

function adjustedPlayScore(result, word, index, isWord) {
  let score = result.score;
  const upgradeMultiplier = run.upgrades.includes('letter-value') ? 1.25 : 1;
  score = Math.floor(score * upgradeMultiplier);
  const boss = run.challenge.kind === 'category' ? run.challenge.bossModifier : null;
  if (boss?.vowelsGiveNoChips) {
    const letters = [...word];
    const vowelShare = letters.filter(letter => VOWELS.has(letter)).length / letters.length;
    score = Math.max(1, Math.floor(score * (1 - vowelShare)));
  }
  if (
    isWord
    && boss?.firstPlayMultiplier
    && run.wordsPlayedInChallenge + index === 0
  ) {
    score = Math.floor(score * boss.firstPlayMultiplier);
  }
  return score;
}

function playSelection() {
  const selection = selectedIndices.map(index => run.hand[index]).join('');
  const play = scoreSelection(selection, {
    activeCardIds: run.languageCardIds,
    letterSetId: run.letterSetId,
    previousWord: run.previousWord,
    aliterationStreak: run.aliterationStreak,
    doubleNext: run.doubleNext,
  }, {
    adjustScore: ({ result, word, index, isWord }) => (
      adjustedPlayScore(result, word, index, isWord)
    ),
  });
  if (!play.valid) return;

  const oldPhase = run.phase;
  run = playValidWord(run, { valid: true, score: play.score });
  if (play.kind === 'words') {
    run.previousWord = play.previousWord;
    run.aliterationStreak = play.aliterationStreak;
    run.wordsPlayedInChallenge += play.units.length;
    run.doubleNext = false;
    for (const unit of play.units) {
      run.maxWordLengthInCategory = Math.max(
        run.maxWordLengthInCategory ?? 0,
        [...unit.word].length,
      );
      updateMetaForWord(unit.entry, unit.rawScore, unit.score);
    }
  }

  const remaining = run.hand.filter((_, index) => !selectedIndices.includes(index));
  run.hand = refillPlayableHand(
    remaining,
    run.handSize,
    deterministicRandom(`${run.seed}:refill:${run.completedChallenges.length}:${run.playsLeft}:${selection}`),
    getLetterSetRules(run.letterSetId),
  );
  selectedIndices = [];
  if (oldPhase === 'playing' && run.phase !== 'playing' && run.phase !== 'defeat') awardChallenge();
  persistRun();
  announce(play.kind === 'words'
    ? `${play.words.map(item => item.word).join(' + ')}: ${play.score} punktów.`
    : `${play.letter.letter}: ${play.score} punktów — najlepsza litera.`);
  renderRun();
}

function updateMetaForWord(entry, score, finalScore) {
  const letters = [...entry.surface.toLocaleUpperCase('pl-PL')];
  const vowelCount = letters.filter(letter => VOWELS.has(letter)).length;
  const event = {
    mode: run.mode,
    seeded: run.mode !== 'normal',
    aliterationStreak: score.aliterationStreak,
    palindromeLength: entry.spellingTags?.includes('palindrom') ? letters.length : 0,
    diminutivesPlayed: entry.analyses?.some(item => item.features?.includes('zdrobnienie')) ? 1 : 0,
    singleWordScore: finalScore,
  };
  profile = updateUnlockProgress(profile, event);
  profile = updateLetterSetProgress(profile, {
    mode: run.mode,
    seeded: run.mode !== 'normal',
    vowelRichWords: vowelCount >= Math.ceil(letters.length / 2) ? 1 : 0,
    consonantRichWords: letters.length - vowelCount >= Math.ceil(letters.length * 2 / 3) ? 1 : 0,
    eightLetterWords: letters.length === 8 ? 1 : 0,
    usedPolishLetters: letters.filter(letter => POLISH_LETTERS.has(letter)),
  });
  saveProfile(profile);
}

function discardSelection() {
  if (!selectedIndices.length || run.discardsLeft <= 0) return;
  const remaining = run.hand.filter((_, index) => !selectedIndices.includes(index));
  run.hand = refillPlayableHand(
    remaining,
    run.handSize,
    Math.random,
    getLetterSetRules(run.letterSetId),
  );
  run.discardsLeft -= 1;
  selectedIndices = [];
  persistRun();
  announce('Litery wymienione.');
  renderTable();
}

function useAction(id) {
  const action = ACTION_CARDS[id];
  if (!action) return;
  if (action.effect === 'play') run.playsLeft += action.amount;
  else if (action.effect === 'discard') run.discardsLeft += action.amount;
  else if (action.effect === 'double-next') run.doubleNext = true;
  else if (action.effect === 'draw') {
    run.hand = refillPlayableHand(
      run.hand,
      run.hand.length + action.amount,
      Math.random,
      getLetterSetRules(run.letterSetId),
    );
  } else if (action.effect === 'exchange') {
    if (!selectedIndices.length) return announce('Najpierw zaznacz litery do wymiany.');
    const remaining = run.hand.filter((_, index) => !selectedIndices.slice(0, action.amount).includes(index));
    run.hand = refillPlayableHand(
      remaining,
      run.handSize,
      Math.random,
      getLetterSetRules(run.letterSetId),
    );
    selectedIndices = [];
  }
  const usedIndex = run.actionCardIds.indexOf(id);
  run.actionCardIds.splice(usedIndex, 1);
  persistRun();
  announce(`Użyto karty: ${action.name}.`);
  renderTable();
}

function awardChallenge() {
  const interest = getInterest(run.ink);
  const upgradeInk = run.upgrades.includes('larger-reward') ? 2 : 0;
  run.lastReward = 4 + Math.max(0, run.playsLeft) + interest + upgradeInk;
  run.ink += run.lastReward;
}

function renderWordReveal() {
  const entry = run.discoveries.at(-1);
  const center = `<article class="reveal card"><p class="overline">Słowo odkryte</p><h2>${escapeHTML(entry.word)}</h2><p class="word-meta">${capitalize(entry.partOfSpeech)} · ${[...entry.word].length} ${letterWord([...entry.word].length)}</p><blockquote>${escapeHTML(entry.definition)}</blockquote><p class="reward">+${run.lastReward ?? 0} atramentu</p><button class="button primary" id="continue-reveal">Przejdź do sklepu</button></article>`;
  app.innerHTML = tableShell(center);
  document.querySelector('#continue-reveal')?.addEventListener('click', () => {
    run = completeReveal(run);
    persistRun();
    renderRun();
  });
  focusMain();
}

function commitCurrentCategory() {
  const categoryId = run.categories[run.categoryIndex].id;
  if (run.committedCategoryIds?.includes(categoryId)) return;
  profile = commitCompletedCategory(profile, getCompletedCategoryResult(run));
  profile = updateLetterSetProgress(profile, {
    mode: run.mode,
    seeded: run.mode !== 'normal',
    categoryWonWithMaxWordLength: run.maxWordLengthInCategory,
  });
  profile = updateUnlockProgress(profile, {
    mode: run.mode,
    seeded: run.mode !== 'normal',
    categoryWonWithMaxWordLength: run.maxWordLengthInCategory,
  });
  saveProfile(profile);
  run.committedCategoryIds = [...(run.committedCategoryIds ?? []), categoryId];
}

function renderCategoryReveal() {
  commitCurrentCategory();
  persistRun();
  const category = run.categories[run.categoryIndex];
  const words = run.discoveries.filter(item => item.categoryId === category.id);
  const center = `<article class="reveal category-reveal card"><p class="overline">Kategoria odkryta</p><h2>${escapeHTML(category.name)}</h2><blockquote>${escapeHTML(category.definition)}</blockquote><div class="discovery-list">${[0, 1].map(index => words[index] ? `<div><strong>${escapeHTML(words[index].word)}</strong><span>${escapeHTML(words[index].definition)}</span></div>` : '<div class="empty"><strong>Nieodkryte słowo</strong><span>Możesz uzupełnić je w przyszłym podejściu.</span></div>').join('')}</div><button class="button primary" id="continue-category">${run.categoryIndex === run.categories.length - 1 ? 'Zakończ podejście' : 'Wybierz ulepszenie'}</button></article>`;
  app.innerHTML = tableShell(center);
  document.querySelector('#continue-category')?.addEventListener('click', () => {
    run = completeReveal(run);
    persistRun();
    renderRun();
  });
  focusMain();
}

function ensureShop() {
  if (!run.shop) {
    run.shop = createShop({
      profile,
      seed: `${run.seed}:shop:${run.categoryIndex}:${run.challengeIndex}`,
    });
  }
}

function renderShop() {
  ensureShop();
  persistRun();
  const offers = run.shop.offers.map((offer, index) => {
    const item = offer.item;
    const owned = offer.type === 'language' && run.languageCardIds.includes(item.id);
    return `<article class="shop-offer ${offer.type}">
      <p class="overline">${offer.type === 'language' ? 'Karta językowa' : 'Karta działań'}</p>
      <h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.description)}</p>
      <button class="button ${offer.type === 'language' ? 'blue' : 'yellow'}" data-buy="${index}" ${owned || run.ink < item.cost ? 'disabled' : ''}>${owned ? 'Posiadasz' : `Kup · ${item.cost}`}</button>
    </article>`;
  }).join('');
  const center = `<article class="shop card"><div class="challenge-top"><div><p class="overline">Sklep</p><h2>Wybierz pomoc przed następnym wyzwaniem</h2></div><strong>${run.ink} atramentu</strong></div><div class="shop-grid">${offers}</div><div class="shop-actions"><button class="button" id="reroll" ${run.ink < 2 ? 'disabled' : ''}>Nowe oferty · 2</button><button class="button primary" id="leave-shop">Dalej</button></div></article>`;
  app.innerHTML = tableShell(center);
  document.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', () => {
    const offer = run.shop.offers[Number(button.dataset.buy)];
    const result = buyOffer(run, offer);
    if (!result.bought) return;
    run = { ...run, ...result, shop: { ...run.shop, offers: run.shop.offers.filter(item => item !== offer) } };
    persistRun();
    announce(`Kupiono: ${offer.item.name}.`);
    renderShop();
  }));
  document.querySelector('#reroll')?.addEventListener('click', () => {
    const result = rerollShop({
      shop: run.shop,
      ink: run.ink,
      profile,
      seed: `${run.seed}:shop:${run.categoryIndex}:${run.challengeIndex}`,
    });
    run.shop = result.shop;
    run.ink = result.ink;
    persistRun();
    renderShop();
  });
  document.querySelector('#leave-shop')?.addEventListener('click', () => {
    run.shop = null;
    run = closeShop(run);
    if (run.challengeIndex === 0) run.maxWordLengthInCategory = 0;
    persistRun();
    renderRun();
  });
  focusMain();
}

function renderUpgrade() {
  const center = `<article class="shop card"><p class="overline">Ulepszenie</p><h2>Wybierz stałą zmianę tego podejścia</h2><div class="shop-grid">${run.upgradeOffer.map(item => `<article class="shop-offer upgrade"><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.description)}</p><button class="button yellow" data-upgrade="${item.id}">Wybierz</button></article>`).join('')}</div></article>`;
  app.innerHTML = tableShell(center);
  document.querySelectorAll('[data-upgrade]').forEach(button => button.addEventListener('click', () => {
    run = chooseUpgrade(run, button.dataset.upgrade);
    persistRun();
    renderRun();
  }));
  focusMain();
}

function renderEnd(victory) {
  clearRunV4();
  const total = run?.completedChallenges?.reduce((sum, item) => sum + (item.score ?? 0), 0) ?? 0;
  app.innerHTML = `<section class="centered card end-card"><span class="end-mark ${victory ? 'success' : 'failure'}">${victory ? '✓' : '×'}</span><p class="overline">${victory ? 'Podejście ukończone' : 'Podejście zakończone'}</p><h1>${victory ? 'Słownik został poszerzony' : 'Zabrakło punktów'}</h1><p>${victory ? 'Pokonane kategorie i odkryte słowa są już zapisane.' : 'Odkrycia z niedokończonej kategorii nie trafiły do trwałego Słownika.'}</p><div class="end-score"><span>Łączny wynik</span><strong>${total}</strong></div><div class="start-actions"><button class="button primary" id="again">Nowa gra</button><button class="button" id="see-dictionary">Słownik</button></div></section>`;
  document.querySelector('#again')?.addEventListener('click', renderStart);
  document.querySelector('#see-dictionary')?.addEventListener('click', renderDictionary);
  focusMain();
}

function renderDictionary() {
  view = 'dictionary';
  const sections = Object.values(profile.dictionary);
  app.innerHTML = `<section class="collection-page"><header><p class="overline">Trwałe odkrycia</p><h1>Słownik</h1><p>Każdy dział trafia tutaj dopiero po pokonaniu kategorii.</p></header>${sections.length ? `<div class="dictionary-grid">${sections.map(section => `<article class="dictionary-section card"><span class="badge">${escapeHTML(section.name)}</span><h2>${escapeHTML(section.name)}</h2><p>${escapeHTML(section.definition)}</p><div class="dictionary-words">${[0, 1].map(index => section.words[index] ? `<div><strong>${escapeHTML(section.words[index].word)}</strong><span>${escapeHTML(section.words[index].definition)}</span></div>` : '<div class="empty"><strong>Nieodkryte słowo</strong><span>To miejsce może zostać uzupełnione później.</span></div>').join('')}</div></article>`).join('')}</div>` : '<article class="empty-state card"><h2>Słownik jest jeszcze pusty</h2><p>Pokonaj finałową Kategorię, aby zapisać pierwszy dział.</p><button class="button primary" id="empty-start">Rozpocznij grę</button></article>'}</section>`;
  document.querySelector('#empty-start')?.addEventListener('click', renderStart);
  focusMain();
}

function renderCards() {
  view = 'cards';
  const unlocked = new Set(profile.unlockedCardIds);
  app.innerHTML = `<section class="collection-page"><header><p class="overline">Metagra</p><h1>Karty językowe</h1><p>Premie wynikają z rzeczywistych części mowy, zapisu i cech słowa.</p></header><div class="catalog-grid">${Object.values(LANGUAGE_CARDS).map(card => `<article class="catalog-card card ${unlocked.has(card.id) ? '' : 'locked'}"><span class="badge">${escapeHTML(card.category)}</span><h2>${escapeHTML(card.name)}</h2><p>${escapeHTML(card.description)}</p><small>${unlocked.has(card.id) ? 'Odblokowana' : escapeHTML(card.unlockDescription)}</small></article>`).join('')}</div></section>`;
  focusMain();
}

function renderSets() {
  view = 'sets';
  const unlocked = new Set(profile.unlockedLetterSetIds);
  app.innerHTML = `<section class="collection-page"><header><p class="overline">Metagra</p><h1>Zestawy liter</h1><p>Każdy zestaw zmienia rozkład lub zasady ręki. Warunki są zawsze jawne.</p></header><div class="catalog-grid">${Object.values(LETTER_SETS).map(set => `<article class="catalog-card card ${unlocked.has(set.id) ? '' : 'locked'}"><span class="badge">${unlocked.has(set.id) ? 'Dostępny' : 'Zablokowany'}</span><h2>${escapeHTML(set.name)}</h2><p>${escapeHTML(set.description)}</p><small>${unlocked.has(set.id) ? 'Możesz wybrać przed podejściem.' : escapeHTML(set.unlockDescription)}</small></article>`).join('')}</div></section>`;
  focusMain();
}

function miniCard(item, actionable = false) {
  if (!item) return '';
  return `<button class="mini-card ${actionable ? 'actionable' : ''}" ${actionable ? `data-action-id="${item.id}"` : 'disabled'} title="${escapeHTML(item.description)}"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.description)}</span></button>`;
}

function letterValue(letter) {
  return LETTER_VALUES[letter] ?? 1;
}

function letterWord(count) {
  if (count === 1) return 'litera';
  if ([2, 3, 4].includes(count)) return 'litery';
  return 'liter';
}

function persistRun() {
  if (run?.phase === 'victory' || run?.phase === 'defeat') clearRunV4();
  else saveRunV4(run);
  window.__litero = { run, profile, view };
}

function announce(message) {
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = message; });
}

function focusMain(move = true) {
  if (move) app.focus({ preventScroll: true });
  window.__litero = { run, profile, view };
}

function capitalize(value) {
  return value ? value[0].toLocaleUpperCase('pl-PL') + value.slice(1) : '';
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char]);
}

function loadingView() {
  return '<section class="centered card"><span class="loader" aria-hidden="true"></span><p class="overline">Przygotowanie stołu</p><h1>Wczytujemy Słownik…</h1></section>';
}
