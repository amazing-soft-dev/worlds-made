// ESLint 10 flat config for all three workspaces. `npm run lint` fails on any warning.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/out/**',
    '**/dist/**',
    '**/coverage/**',
    'audit/**',
    'frontend/next-env.d.ts',
  ]),

  // Node code: backend service, shared package, repo scripts.
  {
    files: ['backend/**/*.ts', 'shared/**/*.ts', 'scripts/**/*.{js,mjs}', 'frontend/scripts/**/*.{js,mjs}', 'backend/scripts/**/*.{js,mjs}', '*.mjs'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
  },

  // Next.js app: core web vitals + TypeScript rules from eslint-config-next.
  {
    files: ['frontend/**/*.{ts,tsx}'],
    extends: [nextVitals, nextTs],
    settings: { next: { rootDir: 'frontend' } },
  },

  // Rules shared by everything.
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // TypeScript-only rules (the plugin is registered by the configs above for these files).
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },

  // Scripts and the dev server are allowed to log.
  {
    files: ['backend/src/server.ts', 'scripts/**', 'frontend/scripts/**', 'backend/scripts/**'],
    rules: { 'no-console': 'off' },
  },
]);
