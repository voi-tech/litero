import { appendSupportResult } from './adaptation.js';
import { scoreEditorialRound } from './scoring.js';
import { hashSeed, nextRandom } from '../rng.js';

export function selectRunPuzzles(puzzles, { mode = 'normal', seed = Date.now() } = {}) {
  const wanted = mode === 'daily' ? 3 : 6;
  let rngState = hashSeed(`${mode}:${seed}`);
  const copy = [...puzzles];
  for (let index = copy.length - 1; index > 0; index--) {
    const random = nextRandom(rngState);
    rngState = random.state;
    const target = Math.floor(random.value * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy.slice(0, Math.min(wanted, copy.length));
}

export function createEditorialRun({ puzzles, mode = 'normal', seed = Date.now(), supportMode = 'auto' }) {
  return {
    version: 3,
    mode,
    seed: String(seed),
    phase: 'round',
    puzzles: selectRunPuzzles(puzzles, { mode, seed }),
    currentIndex: 0,
    results: [],
    score: 0,
    ink: 0,
    circulation: 100,
    tools: [],
    supportProfile: { level: 1, mode: supportMode, history: [] },
  };
}

export function completeRound(run, result) {
  const score = scoreEditorialRound(result);
  const currentIndex = run.currentIndex + 1;
  const completed = currentIndex >= run.puzzles.length;
  const circulationLoss = result.solved ? 0 : 15;
  const supportResult = {
    solved: Boolean(result.solved),
    hintsUsed: result.hintsUsed ?? 0,
    wrongGuesses: result.wrongGuesses ?? 0,
    turnsUsed: result.turnsUsed ?? result.maxTurns ?? 0,
  };
  return {
    ...run,
    phase: completed ? 'complete' : 'between',
    currentIndex,
    results: [...run.results, { ...result, score }],
    score: run.score + score.total,
    ink: run.ink + Math.max(1, Math.round(score.total / 250)),
    circulation: Math.max(0, run.circulation - circulationLoss),
    supportProfile: appendSupportResult(run.supportProfile, supportResult),
  };
}

export function continueRun(run) {
  return run.phase === 'between' ? { ...run, phase: 'round' } : run;
}
