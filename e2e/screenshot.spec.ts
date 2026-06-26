import { test } from '@playwright/test';

// Captures a visual of the finished tool with the example model run.
test('captura screenshot do resultado final', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByTestId('load-example').click();

  // Optional renaming: generic by default, custom names if the user wants them.
  const headers = page.locator('thead input');
  await headers.nth(0).fill('Vendas');
  await headers.nth(1).fill('Meta Ads');
  await headers.nth(2).fill('Google');
  await headers.nth(3).fill('TikTok');

  await page.getByTestId('run').click();
  await page.getByTestId('results').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(900); // let charts settle
  await page.screenshot({ path: 'docs/screenshots/final.png', fullPage: true });
});
