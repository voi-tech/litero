import { expect, test } from '@playwright/test';

test('start -> kategoria -> blind -> zagranie słowa -> wynik rośnie', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.getByRole('heading', { name: 'LITERO' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zagraj' })).toBeEnabled({ timeout: 10000 });
  await page.getByRole('button', { name: 'Zagraj' }).click();

  await expect(page.getByText('Wybierz kategorię')).toBeVisible();
  await page.locator('#category-map .category-card').first().click();

  await expect(page.locator('#blind-cards .blind-card.active-blind')).toBeVisible();
  await page.locator('#blind-cards .blind-card.active-blind').getByRole('button', { name: 'Zagraj' }).click();

  await expect(page.locator('#screen-game.active')).toBeVisible();
  await page.evaluate(() => {
    window.__litero.gameState.hand = ['K', 'O', 'T', 'A', 'B', 'C', 'D', 'E'];
    window.__litero.gameState.selectedIndices = [];
    window.__litero.emitter.emit('selectionChanged', { selectedIndices: [] });
  });

  await page.locator('#hand .letter-tile').filter({ hasText: 'K' }).click();
  await page.locator('#hand .letter-tile').filter({ hasText: 'O' }).click();
  await page.locator('#hand .letter-tile').filter({ hasText: 'T' }).click();
  await page.getByRole('button', { name: /Zagraj zaznaczone litery/ }).click();

  await expect(page.locator('#g-score')).not.toHaveText('0');
  await expect(page.locator('.score-combo')).toContainText('+');
});
