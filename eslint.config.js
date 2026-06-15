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
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
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
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      eqeqeq: ['warn', 'smart'],
      'no-var': 'warn',
      'prefer-const': 'warn',
    },
  },
];
