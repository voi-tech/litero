export const SUPPORT_LEVELS = {
  0: { id: 'samodzielny', maxTurns: 5, attempts: 2, definition: 'full', hintCost: 2 },
  1: { id: 'zrownowazony', maxTurns: 6, attempts: 2, definition: 'full', hintCost: 2 },
  2: { id: 'wspierajacy', maxTurns: 7, attempts: 3, definition: 'simple', hintCost: 1 },
  3: { id: 'prowadzony', maxTurns: 8, attempts: 3, definition: 'simple', hintCost: 1 },
};

function performanceScore(result) {
  if (!result?.solved) return -2;
  let score = 1;
  if ((result.hintsUsed ?? 0) === 0 && (result.wrongGuesses ?? 0) === 0) score += 1;
  if ((result.turnsUsed ?? 9) > 4) score -= 1;
  return score;
}

export function adaptSupportProfile(profile) {
  const history = (profile.history ?? []).slice(-3);
  if (profile.mode !== 'auto' || history.length < 3) return { ...profile, history };

  const total = history.reduce((sum, result) => sum + performanceScore(result), 0);
  let level = profile.level ?? 1;
  if (total <= 0) level += 1;
  if (total >= 5) level -= 1;
  return { ...profile, history, level: Math.max(0, Math.min(3, level)) };
}

export function appendSupportResult(profile, result) {
  return adaptSupportProfile({ ...profile, history: [...(profile.history ?? []), result].slice(-3) });
}
