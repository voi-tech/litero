const REQUIRED_TEXT = ['id', 'word', 'category', 'example', 'curiosity'];
const DIFFICULTY_KEYS = ['commonness', 'abstraction', 'readingLevel'];

export function validatePuzzleContent(puzzles, dictionary = null) {
  const errors = [];
  const seenWords = new Set();

  for (const puzzle of puzzles) {
    const label = puzzle.id || puzzle.word || 'bez-id';
    for (const key of REQUIRED_TEXT) {
      if (typeof puzzle[key] !== 'string' || !puzzle[key].trim()) {
        errors.push(`${label}: brak pola ${key}`);
      }
    }
    if (!puzzle.definitions?.simple || !puzzle.definitions?.full) {
      errors.push(`${label}: wymagane są definicje simple i full`);
    }
    if (!Array.isArray(puzzle.synonyms) || puzzle.synonyms.length === 0) {
      errors.push(`${label}: wymagany jest co najmniej jeden synonim`);
    }
    if (!puzzle.knowledgeQuestion?.prompt
      || !Array.isArray(puzzle.knowledgeQuestion.options)
      || !Number.isInteger(puzzle.knowledgeQuestion.correctIndex)
      || puzzle.knowledgeQuestion.correctIndex < 0
      || puzzle.knowledgeQuestion.correctIndex >= puzzle.knowledgeQuestion.options.length) {
      errors.push(`${label}: niepoprawne pytanie utrwalające`);
    }

    const normalizedWord = puzzle.word?.trim().toUpperCase();
    if (normalizedWord) {
      if (seenWords.has(normalizedWord)) errors.push(`${label}: słowo ${normalizedWord} występuje więcej niż raz`);
      seenWords.add(normalizedWord);
      if (dictionary && !dictionary.has(normalizedWord.toLowerCase())) {
        errors.push(`${label}: słowa ${normalizedWord} nie ma w słowniku`);
      }
    }

    for (const key of DIFFICULTY_KEYS) {
      const value = puzzle.difficulty?.[key];
      if (!Number.isInteger(value) || value < 1 || value > 3) {
        errors.push(`${label}: ${key} musi mieścić się w zakresie 1–3`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function normalizeAnswer(value) {
  return String(value ?? '').trim().toLocaleUpperCase('pl-PL');
}
