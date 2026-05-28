import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Disabled: react-hooks 7 flags fetch-on-mount as a cascading-render
      // anti-pattern, but for our typical "loading → fetch → set data"
      // pages the perf cost is negligible and the refactor hurts readability
      // more than it helps. Revisit when migrating to react-query.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
