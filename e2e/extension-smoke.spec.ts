import { test, expect } from '@playwright/test';

test('popup markup is available', async ({ page }) => {
  await page.goto('file:///C:/tmp/note-toc-extension/popup.html');
  await expect(page.locator('h1')).toHaveText('note TOC Exporter');
});
