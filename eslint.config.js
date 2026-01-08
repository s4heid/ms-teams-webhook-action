import eslint from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import jestPlugin from 'eslint-plugin-jest'

export default [
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts', '__tests__/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['__tests__/**/*.ts'],
    plugins: {
      jest: jestPlugin,
    },
    languageOptions: {
      globals: {
        ...jestPlugin.environments.globals.globals,
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
    rules: {
      ...jestPlugin.configs.recommended.rules,
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'coverage/',
      '__fixtures__/',
      '*.config.js',
    ],
  },
]
