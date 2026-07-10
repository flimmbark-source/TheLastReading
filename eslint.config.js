import js from '@eslint/js';
import globals from 'globals';

// The game is mid-migration from a global-`state` legacy style toward the
// reducer/store architecture, so many runtime-injected browser globals are used
// implicitly. The config therefore leans on correctness rules (recommended)
// while keeping `no-undef` off — chasing implicit globals here would be noise,
// not signal. The pure `src/{game,systems,data,multiplayer}` and `scripts/`
// trees are dependency-light and should stay lint-clean.
export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'scripts/cleanup-lint-warnings.mjs'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        // Cross-module runtime globals installed on `window` during boot.
        $: 'readonly',
        state: 'writable',
        persist: 'writable',
      },
    },
    rules: {
      'no-undef': 'off',
      // The legacy modules deliberately share a single `window`-level `state`
      // object and cache DOM nodes in module-scope globals, so redeclaring and
      // assigning those reads as intentional, not buggy, until that layer is
      // migrated onto the store.
      'no-redeclare': 'off',
      'no-global-assign': 'off',
      // Catch bindings are routinely omitted semantically in fallback paths; do
      // not require dozens of meaningless `catch (error)` names. Rest destructuring
      // is also used to intentionally strip fields before returning an object.
      'no-unused-vars': ['warn', {
        args: 'none',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
        varsIgnorePattern: '^_',
      }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      eqeqeq: ['warn', 'smart'],
      'no-var': 'warn',
      'prefer-const': 'warn',
    },
  },
];
