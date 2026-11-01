// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  prettierRecommended,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'supabase/functions/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Требование ТЗ: никакого any.
      '@typescript-eslint/no-explicit-any': 'error',
      // Требование ТЗ: не оставлять catch пустым.
      'no-empty': ['error', { allowEmptyCatch: false }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'react-hooks/exhaustive-deps': 'error',
    },
  },
]);
