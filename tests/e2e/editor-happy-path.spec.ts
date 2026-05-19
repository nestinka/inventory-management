import { test, expect } from '@playwright/test';

test.describe('Editor happy path', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('editor@inventory.local');
    await page.getByLabel('Password').fill('Editor1234!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');
  });

  test('can view inventory', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  });

  test('cannot access audit log (403)', async ({ page }) => {
    const response = await page.request.get('/api/v1/audit-logs');
    expect(response.status()).toBe(403);
  });

  test('can view own requests', async ({ page }) => {
    await page.goto('/requests');
    await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible();
  });
});
