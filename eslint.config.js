import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  // Ignore build output, deps, and the standalone gateway/edge code.
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'supabase/functions/**',
      '.claude/**',
      '*.config.js',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        __APP_VERSION__: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // New JSX transform: React import not required, prop-types not enforced.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Allow intentional unused vars prefixed with _.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Test files: add Vitest globals.
  {
    files: ['**/*.test.{js,jsx}', 'src/test/**'],
    languageOptions: {
      globals: { ...globals.node, vi: 'readonly' },
    },
  },
]
