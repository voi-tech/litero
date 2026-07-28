import { SUPPORT_LEVELS } from './adaptation.js';
import { normalizeAnswer } from './content.js';
import { scoreCraftWord } from './scoring.js';

const VOWELS = new Set(['A', 'Ą', 'E', 'Ę', 'I', 'O', 'Ó', 'U', 'Y']);

function copy(state, changes = {}) {
  return { ...state, revealed: new Set(state.revealed), history: [...state.history], ...changes };
}

function revealFirst(state, predicate) {
  const letters = [...normalizeAnswer(state.puzzle.word)];
  const index = letters.findIndex((letter, position) => !state.revealed.has(position) && predicate(letter));
  if (index >= 0) state.revealed.add(index);
}

export function createRound({ puzzle, hand, supportLevel = 1 }) {
  const support = SUPPORT_LEVELS[supportLevel] ?? SUPPORT_LEVELS[1];
  return {
    phase: 'compose', puzzle, hand: [...hand], supportLevel,
    maxTurns: support.maxTurns, turnsLeft: support.maxTurns,
    attemptsLeft: support.attempts, revealed: new Set(), history: [],
    hintsUsed: 0, wrongGuesses: 0, wordCraftPoints: 0, stylePoints: 0,
    pendingReward: null, solved: null, knowledgeCorrect: null,
  };
}

export function composeWord(state, play) {
  if (state.phase !== 'compose' || !play.valid || state.turnsLeft <= 0) return state;
  const normalized = normalizeAnswer(play.word);
  const wordCraftPoints = scoreCraftWord(normalized, {
    categoryRelated: play.categoryRelated,
    previousWords: state.history.map(item => item.word),
  });
  return copy(state, {
    phase: 'reward', turnsLeft: state.turnsLeft - 1,
    wordCraftPoints: state.wordCraftPoints + wordCraftPoints,
    history: [...state.history, { word: normalized, points: wordCraftPoints, categoryRelated: Boolean(play.categoryRelated) }],
    pendingReward: play.categoryRelated || normalized.length >= 6 ? 'strong' : 'standard',
  });
}

export function chooseReward(state, reward) {
  if (state.phase !== 'reward') return state;
  const next = copy(state, { phase: 'solve', pendingReward: null });
  if (reward === 'reveal-consonant') revealFirst(next, letter => !VOWELS.has(letter));
  if (reward === 'buy-vowel') revealFirst(next, letter => VOWELS.has(letter));
  if (reward === 'locate-letter') revealFirst(next, () => true);
  if (reward === 'extra-attempt') next.attemptsLeft += 1;
  next.hintsUsed += 1;
  return next;
}

export function continueComposing(state) {
  if (state.phase !== 'solve') return state;
  return copy(state, { phase: state.turnsLeft > 0 && state.attemptsLeft > 0 ? 'compose' : 'learn', solved: false });
}

export function attemptSolve(state, answer) {
  if (!['compose', 'solve'].includes(state.phase) || state.attemptsLeft <= 0) return state;
  if (normalizeAnswer(answer) === normalizeAnswer(state.puzzle.word)) return copy(state, { phase: 'learn', solved: true });

  const next = copy(state, {
    attemptsLeft: state.attemptsLeft - 1,
    wrongGuesses: state.wrongGuesses + 1,
  });
  revealFirst(next, () => true);
  next.phase = next.attemptsLeft > 0 && next.turnsLeft > 0 ? 'compose' : 'learn';
  if (next.phase === 'learn') next.solved = false;
  return next;
}

export function answerKnowledge(state, answerIndex) {
  if (state.phase !== 'learn') return state;
  return copy(state, {
    phase: 'complete',
    knowledgeCorrect: answerIndex === state.puzzle.knowledgeQuestion.correctIndex,
  });
}
