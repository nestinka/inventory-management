import { test as base } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export { expect } from '@playwright/test';
export const test = base.extend<{ makeAxeBuilder: () => AxeBuilder }>({
  makeAxeBuilder: async ({ page }, use) => {
    const makeAxeBuilder = () =>
      new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('#__next_error__'); // exclude Next.js dev error overlay if present
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use` is not a React hook
    await use(makeAxeBuilder);
  },
});
