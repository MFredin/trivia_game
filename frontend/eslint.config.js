import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

// Two jobs. ESLint's recommended rules catch plain mistakes (an unused variable, an undefined name). The React hooks
// rules catch the mistakes React does not announce: a hook called conditionally, an effect that reads a value it does
// not list as a dependency (a stale closure, the usual cause of "it shows the old one"). Formatting is not enforced.
//
// eslint-plugin-react is not used: it does not yet support ESLint 10. Its one job here, telling the linter that
// `<Foo />` uses `Foo`, is covered by ignoring capitalised names in no-unused-vars.
export default [
  { ignores: ['node_modules/**', 'dist/**', '.vite/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      // __BUILD_COMMIT__ is defined at build time by vite.config.js.
      globals: { ...globals.browser, __BUILD_COMMIT__: 'readonly' },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Only the two long-standing rules. The plugin's newer "React Compiler" rules (set-state-in-effect, refs, …)
      // are opinions about how to structure state that this codebase deliberately does not follow, such as resetting
      // a form's draft in an effect when its screen opens; adopt them separately if the app moves to the compiler.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z]', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    // Node scripts and the browser tests.
    files: ['scripts/**/*.mjs', 'e2e/**/*.mjs', 'vite.config.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true, caughtErrors: 'none' }] },
  },
];
