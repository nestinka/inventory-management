import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  // Ignore generated / dependency dirs
  {
    ignores: ['node_modules/**', '.next/**', 'dist/**'],
  },

  // Extend Next.js recommended rules via compat shim
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),

  // Project-wide rules (applies to all TS/TSX files)
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

  // Internal module files + tests: allow direct internal imports
  {
    files: ['src/server/modules/**/*.ts', 'tests/**/*.{ts,tsx}', 'prisma/seed.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];

export default eslintConfig;
