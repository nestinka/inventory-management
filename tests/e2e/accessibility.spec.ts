import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/axe';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@inventory.local');
  await page.locator('#password').fill('Admin1234!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

// ─── Auth pages (no login required) ──────────────────────────────────────────

test.describe('Accessibility — public auth pages', () => {
  test('/login has no critical/serious WCAG violations', async ({ page, makeAxeBuilder }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const results = await makeAxeBuilder().analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(
      serious,
      `Critical/serious violations on /login:\n${serious.map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    Nodes: ${v.nodes.map((n) => n.html).join(', ')}`).join('\n')}`,
    ).toHaveLength(0);
  });
});

// ─── Authenticated pages (admin) ─────────────────────────────────────────────

test.describe('Accessibility — authenticated pages (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  const pages: Array<{ name: string; path: string; skipIf404?: boolean }> = [
    { name: 'dashboard',            path: '/' },
    { name: 'inventory list',       path: '/inventory' },
    { name: 'quick stock update',   path: '/inventory/quick-update' },
    { name: 'catalogue items',      path: '/catalogue/items' },
    { name: 'catalogue categories', path: '/catalogue/categories' },
    { name: 'requests',             path: '/requests' },
    { name: 'audit log',            path: '/audit' },
    { name: 'reports hub',          path: '/reports', skipIf404: true },
  ];

  for (const { name, path, skipIf404 } of pages) {
    test(`${path} has no critical/serious WCAG violations`, async ({ page, makeAxeBuilder }) => {
      const response = await page.goto(path);

      if (skipIf404 && response?.status() === 404) {
        test.skip(true, `Page ${path} returned 404 — skipping`);
        return;
      }

      await page.waitForLoadState('networkidle');

      const results = await makeAxeBuilder().analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(
        serious,
        `Critical/serious WCAG violations on ${name} (${path}):\n${serious
          .map(
            (v) =>
              `  [${v.impact}] ${v.id}: ${v.description}\n    Nodes: ${v.nodes
                .map((n) => n.html)
                .join(', ')}`,
          )
          .join('\n')}`,
      ).toHaveLength(0);
    });
  }
});
