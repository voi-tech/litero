function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value || 0)));
}

export function scoreEditorialRound(result = {}) {
  const maxTurns = Math.max(1, result.maxTurns ?? 6);
  const efficiency = Math.max(0, maxTurns - (result.turnsUsed ?? maxTurns));
  const solution = result.solved
    ? clamp(360 + efficiency * 35 - (result.hintsUsed ?? 0) * 45 - (result.wrongGuesses ?? 0) * 55, 0, 500)
    : 0;
  const craft = clamp(result.wordCraftPoints, 0, 300);
  const knowledge = result.knowledgeCorrect ? 100 : 0;
  const style = clamp(result.stylePoints, 0, 100);
  return { solution, craft, knowledge, style, total: solution + craft + knowledge + style };
}

export function scoreCraftWord(word, { categoryRelated = false, previousWords = [] } = {}) {
  const normalized = String(word).toLocaleUpperCase('pl-PL');
  const polishLetters = normalized.match(/[ĄĆĘŁŃÓŚŹŻ]/g)?.length ?? 0;
  const repeated = previousWords.filter(item => item === normalized).length;
  const raw = normalized.length * 8 + polishLetters * 8 + (categoryRelated ? 24 : 0);
  return Math.max(5, Math.round(raw / (repeated + 1)));
}
