import { test, expect } from '@playwright/test';

test('carrega exemplo, roda o modelo e mostra os resultados', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'MMM Studio' })).toBeVisible();

  await page.getByTestId('load-example').click();
  await page.getByTestId('run').click();

  const results = page.getByTestId('results');
  await expect(results).toBeVisible({ timeout: 15000 });

  // Fit-quality card, coefficients table, and the simulator all rendered.
  await expect(results.getByText('R²', { exact: true })).toBeVisible();
  await expect(results.getByText('Intercepto')).toBeVisible();
  await expect(page.getByTestId('sim-output')).toBeVisible();

  // The example data should produce a strong fit (R^2 shown with 4 decimals like 0,9xxx).
  const r2Card = results.getByText('R²', { exact: true }).locator('xpath=following-sibling::div[1]');
  await expect(r2Card).toHaveText(/0,\d{4}|1,0000/);
});

test('simulador recalcula a previsao ao digitar', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('load-example').click();
  await page.getByTestId('run').click();
  await expect(page.getByTestId('simulator')).toBeVisible({ timeout: 15000 });

  const before = await page.getByTestId('sim-output').innerText();
  const firstInput = page.getByTestId('simulator').locator('input').first();
  await firstInput.fill('10000');
  const after = await page.getByTestId('sim-output').innerText();
  expect(after).not.toEqual(before);
});

test('entrada vazia mostra erro de validacao', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('clear').click();
  await page.getByTestId('run').click();
  await expect(page.getByTestId('error')).toBeVisible();
});

test('valor em branco: ignora a linha e ainda roda', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('load-example').click();
  // Clear one X cell in the first data row (inputs: period, Y, X1, X2, X3).
  await page.locator('tbody tr').first().locator('input').nth(2).fill('');
  await page.getByTestId('run').click();
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('warnings')).toContainText(/ignorada/);
});

test('colar do Excel cria linhas e colunas que faltam', async ({ page }) => {
  await page.goto('/');
  const lines: string[] = [];
  for (let i = 0; i < 38; i++) lines.push([`${100 + i}`, '1', '2', '3', '4'].join('\t'));
  const tsv = lines.join('\n');

  // Dispatch a paste into the Y cell of the first row (5 columns x 38 rows).
  await page
    .locator('tbody tr')
    .first()
    .locator('input')
    .nth(1)
    .evaluate((el, data) => {
      const dt = new DataTransfer();
      dt.setData('text', data);
      el.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    }, tsv);

  // Grew from 3 to 4 X columns (thead inputs = Y + 4 X = 5) and from 36 to 38 rows.
  await expect(page.locator('thead input')).toHaveCount(5);
  await expect(page.locator('tbody tr')).toHaveCount(38);
  await expect(page.locator('tbody tr').first().locator('input').nth(1)).toHaveValue('100');
});

test('coluna desativada com valor invalido nao bloqueia o modelo', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('load-example').click();
  // Put an Excel artifact into an X3 cell (inputs: period, Y, X1, X2, X3 -> nth(4)).
  await page.locator('tbody tr').first().locator('input').nth(4).fill('#########');
  // Deactivate X3 (third variable checkbox).
  await page.getByRole('checkbox').nth(2).uncheck();
  await page.getByTestId('run').click();
  // Runs fine: the invalid value sits in an unused column.
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('error')).toHaveCount(0);
});

test('exporta o resultado em CSV', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('load-example').click();
  await page.getByTestId('run').click();
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('export-pdf')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-csv').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/mmm-studio-.*\.csv/);
});
