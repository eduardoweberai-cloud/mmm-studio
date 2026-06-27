import { chromium } from '@playwright/test';

const URL = process.env.PROD_URL || 'https://mmm-studio-ten.vercel.app';
const browser = await chromium.launch();
const page = await browser.newPage();
try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByTestId('load-example').click();
  await page.getByTestId('run').click();
  await page.getByTestId('results').waitFor({ state: 'visible', timeout: 20000 });
  const hasFTest = await page.getByTestId('f-test').isVisible().catch(() => false);
  const fValue = hasFTest
    ? await page.getByTestId('f-test').locator('div').nth(1).innerText().catch(() => '?')
    : null;
  console.log(JSON.stringify({ url: URL, hasFTest, significanciaF: fValue }));
  await browser.close();
  process.exit(hasFTest ? 0 : 1);
} catch (e) {
  console.log(JSON.stringify({ url: URL, error: String(e).split('\n')[0] }));
  await browser.close();
  process.exit(2);
}
