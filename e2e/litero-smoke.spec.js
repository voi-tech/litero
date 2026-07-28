import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('samouczek prowadzi przez słowo, wskazówkę, hasło i kartę wiedzy', async ({ page }) => {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.getByRole('heading', { name: /Redakcja słów/i })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Samouczek' }).click();
  await expect(page.getByRole('heading', { name: 'Próba redakcyjna' })).toBeVisible();

  for (const letter of ['K', 'O', 'T']) {
    await page.getByRole('button', { name: `Litera ${letter}`, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Złóż słowo' }).click();
  await expect(page.getByRole('heading', { name: 'Wybierz wskazówkę' })).toBeVisible();
  await page.getByRole('button', { name: /Spółgłoska/ }).click();

  await page.getByLabel('Odpowiedź').fill('RZEKA');
  await page.getByRole('button', { name: 'Sprawdź' }).click();
  await expect(page.getByRole('heading', { name: 'RZEKA' })).toBeVisible();
  await page.getByRole('button', { name: 'Źródło' }).click();
  await expect(page.getByRole('heading', { name: /legitymację redaktora/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test('motyw można przełączyć i zachować w preferencjach', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zmień motyw' }).click();
  await page.getByRole('button', { name: 'Zmień motyw' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('wznowienie zachowuje postęp wewnątrz rundy', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Hasła dnia' }).click();
  await page.getByRole('button', { name: 'Odgadnij hasło' }).click();
  await page.getByLabel('Odpowiedź').fill('BŁĘDNAODPOWIEDŹ');
  await page.getByRole('button', { name: 'Sprawdź' }).click();
  const before = await page.evaluate(() => ({
    attempts: window.__litero.round.attemptsLeft,
    revealed: window.__litero.round.revealed.size,
  }));
  await page.reload();
  await page.getByRole('button', { name: 'Kontynuuj' }).click();
  const after = await page.evaluate(() => ({
    attempts: window.__litero.round.attemptsLeft,
    revealed: window.__litero.round.revealed.size,
  }));
  expect(after).toEqual(before);
});

test('start i runda nie mają poważnych naruszeń dostępności', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('button', { name: 'Samouczek' })).toBeVisible();
  let audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([]);

  await page.getByRole('button', { name: 'Samouczek' }).click();
  audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([]);
});
