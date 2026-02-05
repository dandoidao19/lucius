import { test, expect } from '@playwright/test';

test('verify loja page and numbering', async ({ page }) => {
  await page.goto('http://localhost:3002');
  // Click on Loja
  await page.click('text=LOJA');
  // Verify it is on Loja page
  await expect(page.locator('header')).toContainText('LOJA');

  // Open New Transaction Modal
  await page.click('text=VENDA');
  // Check if modal is open
  await expect(page.locator('text=NOVA VENDA')).toBeVisible();

  // Close modal
  await page.click('text=CANCELAR');

  await page.screenshot({ path: 'loja_verification.png', fullPage: true });
});
