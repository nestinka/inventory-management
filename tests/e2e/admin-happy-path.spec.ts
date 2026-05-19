import { test, expect } from '@playwright/test';

test.describe('Admin happy path', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@inventory.local');
    await page.getByLabel('Password').fill('Admin1234!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');
  });

  test('dashboard loads with stat cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Active Items')).toBeVisible();
    await expect(page.getByText('Out of Stock')).toBeVisible();
  });

  test('inventory list shows items', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
    // Seeded data has items
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('audit log is accessible', async ({ page }) => {
    await page.goto('/audit');
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
  });
});
