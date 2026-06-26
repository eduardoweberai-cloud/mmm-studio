import { chromium } from '@playwright/test';

const URL = process.env.SHOT_URL || 'http://localhost:3200/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.getByTestId('load-example').click();
await page.getByTestId('run').click();
await page.getByTestId('results').waitFor({ state: 'visible', timeout: 20000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: 'docs/screenshots/final.png', fullPage: true });
await browser.close();
console.log('screenshot saved to docs/screenshots/final.png');
