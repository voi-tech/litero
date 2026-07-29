import { getLexiconEntry } from './lexicon.js';
import {
  LETTER_VALUES,
  scoreLetter,
  scoreWord,
} from './v4-scoring.js';

function normalizeSelection(selection) {
  return [...String(selection ?? '').toLocaleUpperCase('pl-PL')];
}

function bestLetter(letters) {
  return letters.reduce((best, letter, index) => {
    const value = LETTER_VALUES[letter] ?? 0;
    return !best || value > best.value
      ? { letter, index, value }
      : best;
  }, null);
}

export function analyzeSelection(selection, lookup = getLexiconEntry) {
  const letters = normalizeSelection(selection);
  if (!letters.length) {
    return {
      kind: 'empty',
      words: [],
      letter: null,
      ignored: '',
    };
  }

  const words = [];
  let offset = 0;
  while (offset < letters.length) {
    let match = null;
    const maxLength = Math.min(8, letters.length - offset);
    for (let length = maxLength; length >= 2; length -= 1) {
      const word = letters.slice(offset, offset + length).join('');
      const entry = lookup(word);
      if (entry) {
        match = {
          word,
          entry,
          start: offset,
          end: offset + length,
        };
        break;
      }
    }
    if (!match) break;
    words.push(match);
    offset = match.end;
  }

  if (words.length) {
    return {
      kind: 'words',
      words,
      letter: null,
      ignored: letters.slice(offset).join(''),
    };
  }

  return {
    kind: 'letter',
    words: [],
    letter: bestLetter(letters),
    ignored: letters.join(''),
  };
}

export function scoreSelection(selection, context = {}, options = {}) {
  const analysis = analyzeSelection(
    selection,
    options.lookup ?? getLexiconEntry,
  );
  const adjustScore = options.adjustScore
    ?? (({ result }) => result.score);

  if (analysis.kind === 'empty') {
    return {
      valid: false,
      ...analysis,
      score: 0,
      units: [],
      previousWord: context.previousWord ?? null,
      aliterationStreak: context.aliterationStreak ?? 0,
      consumesDoubleNext: false,
    };
  }

  if (analysis.kind === 'letter') {
    const rawScore = scoreLetter(analysis.letter.letter);
    const score = adjustScore({
      result: rawScore,
      word: analysis.letter.letter,
      index: 0,
      isWord: false,
    });
    return {
      valid: true,
      ...analysis,
      score,
      units: [{
        word: analysis.letter.letter,
        entry: null,
        rawScore,
        score,
        index: 0,
        isWord: false,
      }],
      previousWord: context.previousWord ?? null,
      aliterationStreak: context.aliterationStreak ?? 0,
      consumesDoubleNext: false,
    };
  }

  let previousWord = context.previousWord ?? null;
  let aliterationStreak = context.aliterationStreak ?? 0;
  const units = analysis.words.map((item, index) => {
    const rawScore = scoreWord(item.entry, {
      ...context,
      previousWord,
      aliterationStreak,
      doubleNext: Boolean(context.doubleNext && index === 0),
    });
    const score = adjustScore({
      result: rawScore,
      word: item.word,
      index,
      isWord: true,
    });
    previousWord = item.word;
    aliterationStreak = rawScore.aliterationStreak;
    return {
      ...item,
      rawScore,
      score,
      index,
      isWord: true,
    };
  });

  return {
    valid: true,
    ...analysis,
    score: units.reduce((sum, unit) => sum + unit.score, 0),
    units,
    previousWord,
    aliterationStreak,
    consumesDoubleNext: Boolean(context.doubleNext),
  };
}
