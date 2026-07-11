import { describe, expect, test } from 'vitest';
import { decodeEditorialSave, encodeEditorialSave } from '../src/editorial/persistence.js';

describe('editorial persistence v3', () => {
  test('round-trips a current run and Set fields', () => {
    const run = { phase: 'round', revealed: new Set([0, 2]), score: 120 };
    const restored = decodeEditorialSave(encodeEditorialSave(run));
    expect(restored.revealed).toEqual(new Set([0, 2]));
    expect(restored.score).toBe(120);
  });

  test('rejects a v2 run while preserving safe preferences', () => {
    const result = decodeEditorialSave(JSON.stringify({ version: 2, run: { phase: 'game' }, preferences: { theme: 'dark' } }));
    expect(result).toEqual({ incompatible: true, preferences: { theme: 'dark' } });
  });
});
