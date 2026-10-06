import js from '@eslint/js';
import globals from 'globals';

// The backend is plain ES modules on Node: ESLint's recommended rules catch real mistakes (an unused variable, an
// undefined name, an unreachable branch) and nothing here is a matter of taste. Formatting is not enforced.
export default [
  { ignores: ['node_modules/**', 'src/data/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: {
      // `_name` marks an argument that has to be there but is not used (Express error handlers need all four).
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
