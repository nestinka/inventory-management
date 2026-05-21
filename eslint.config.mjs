import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,

  globalIgnores(['node_modules/**', '.next/**', 'dist/**', '.claude/**']),

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/server/modules/*/repo',
                '@/server/modules/*/service',
                '@/server/modules/*/domain',
                '@/server/modules/*/dto',
              ],
              message:
                "Import from a module's public barrel only (@/server/modules/<name>), never its internals.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/server/modules/**/*.ts', 'tests/**/*.{ts,tsx}', 'prisma/seed.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]);

export default eslintConfig;
