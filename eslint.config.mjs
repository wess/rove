import { fileURLToPath } from 'url';
import { dirname } from 'path';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

// Get the current directory path for ignores
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  {
    // Ignore patterns for ESLint
    ignores: [
      'node_modules/**',
      'dist/**'
    ],
  },
  {
    // Lint all TypeScript files in the `src` folder
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Your linting rules
      indent: ['error', 2],
      'brace-style': ['error', '1tbs'],
      semi: ['error', 'always'],
      quotes: ['error', 'double'],
      'comma-dangle': ['error', 'always-multiline'],
      'object-curly-spacing': ['error', 'always'],
    },
  },
];
