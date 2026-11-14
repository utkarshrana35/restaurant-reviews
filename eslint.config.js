import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/node_modules/', '**/dist/', '**/.next/', '**/next-env.d.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['frontend/**/*.{ts,tsx}'],
    extends: [nextVitals],
    settings: { next: { rootDir: 'frontend/' } },
  },
  {
    // Material UI stays behind the app's own UI kit; only the kit and the theme setup import it.
    files: ['frontend/src/**/*.{ts,tsx}'],
    ignores: [
      'frontend/src/components/ui/**',
      'frontend/src/theme.ts',
      'frontend/src/app/providers.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@mui/material', '@mui/material/*'],
              message: 'Import UI components from @/components/ui instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // Hexagonal layering: the core knows nothing of frameworks, databases or the network. Only the
    // shared package and the core's own files may be imported; adapters live in infrastructure/.
    files: ['backend/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.|@restaurant-reviews/common$)',
              message: 'The domain may only import @restaurant-reviews/common and its own files.',
            },
            {
              group: [
                '**/application',
                '**/application/**',
                '**/infrastructure',
                '**/infrastructure/**',
              ],
              message: 'The domain may not depend on the application or infrastructure layers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['backend/src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.|@restaurant-reviews/common$)',
              message:
                'The application layer may only import @restaurant-reviews/common, the domain and ' +
                'its own files. Reach frameworks and services through a port in application/ports.',
            },
            {
              group: ['**/infrastructure', '**/infrastructure/**'],
              message:
                'The application layer may not depend on infrastructure; add a port instead.',
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
]);
