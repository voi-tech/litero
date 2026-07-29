import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: /Znajdź słowa/i })).toBeVisible();
});

test('płynnie przechodzi z definicji do stołu bez zgadywania podczas gry', async ({ page }) => {
  await page.getByRole('button', { name: 'Pełna gra' }).click();
  await expect(page.getByRole('article').getByText('Łatwe słowo', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Odpowiedź')).toBeVisible();
  await page.getByRole('button', { name: 'Rozpocznij wyzwanie' }).click();

  await expect(page.getByRole('button', { name: 'Zagraj litery' })).toBeVisible();
  await expect(page.getByLabel('Odpowiedź')).toHaveCount(0);
  await expect(page.locator('#table-message')).toContainText(
    'Punktują kolejne słowa od lewej',
  );
});

test('pokazuje pozostałe akcje i pozwala zagrać jedną literę', async ({ page }) => {
  await page.getByRole('button', { name: 'Pełna gra' }).click();
  await page.getByRole('button', { name: 'Rozpocznij wyzwanie' }).click();

  await expect(page.getByText('pozostałe zagrania', { exact: true })).toBeVisible();
  await expect(page.getByText('pozostałe odrzucenia', { exact: true })).toBeVisible();
  await expect(page.locator('.attempt-stats div').first().locator('strong')).toHaveText('5');

  await page.locator('.letter-tile').first().click();
  await page.getByRole('button', { name: 'Zagraj litery' }).click();

  await expect(page.locator('.attempt-stats div').first().locator('strong')).toHaveText('4');
});

test('wybór kafelka zachowuje fokus klawiatury', async ({ page }) => {
  await page.getByRole('button', { name: 'Pełna gra' }).click();
  await page.getByRole('button', { name: 'Rozpocznij wyzwanie' }).click();
  await page.locator('.letter-tile').first().click();
  await expect(page.locator('.letter-tile').first()).toBeFocused();
});

test('błędne odgadnięcie pomija słowo i stosuje skutek przy kolejnym wyzwaniu', async ({ page }) => {
  await page.getByRole('button', { name: 'Pełna gra' }).click();
  await page.getByLabel('Odpowiedź').fill('NIEPOPRAWNE');
  await page.getByRole('button', { name: 'Sprawdź' }).click();
  await expect(page.getByRole('article').getByText('Trudne słowo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rozpocznij wyzwanie' }).click();
  await expect(page.locator('.letter-tile')).toHaveCount(7);
});

test('tryb dzienny jest deterministyczny dla lokalnej daty', async ({ page }) => {
  await page.getByRole('button', { name: 'Wyzwanie dzienne' }).click();
  const firstCategory = await page.locator('.run-header h1').textContent();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Wyzwanie dzienne' }).click();
  await expect(page.locator('.run-header h1')).toHaveText(firstCategory);
});

test('motyw i profil są zapisywane niezależnie od podejścia', async ({ page }) => {
  await page.getByRole('button', { name: 'Zmień motyw' }).click();
  await page.getByRole('button', { name: 'Zmień motyw' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('ekran startowy i stół nie mają poważnych naruszeń dostępności', async ({ page }) => {
  let audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([]);

  await page.getByRole('button', { name: 'Pełna gra' }).click();
  await page.getByRole('button', { name: 'Rozpocznij wyzwanie' }).click();
  audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([]);
});
