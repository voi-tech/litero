import { describe, expect, it } from 'vitest';
import categoriesData from '../data/categories.json';

describe('categories data', () => {
  it('ma 8-10 haseł w każdej puli blinda', () => {
    for (const category of categoriesData.categories) {
      for (const blind of category.blinds) {
        expect(blind.pool.length, `${category.id}/${blind.id}`).toBeGreaterThanOrEqual(8);
        expect(blind.pool.length, `${category.id}/${blind.id}`).toBeLessThanOrEqual(10);
        for (const item of blind.pool) {
          expect(item.word).toBeTruthy();
          expect(item.definition).toBeTruthy();
          expect([...item.word].length, item.word).toBeGreaterThanOrEqual(2);
          expect([...item.word].length, item.word).toBeLessThanOrEqual(8);
        }
      }
    }
  });
});
