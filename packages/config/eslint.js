import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export const base = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
)

export const nestjs = tseslint.config(...base, {
  rules: {
    '@typescript-eslint/no-extraneous-class': 'off',
    // L'injection de dépendances Nest lit les types du constructeur à l'exécution :
    // un `import type` casserait silencieusement l'injection.
    '@typescript-eslint/consistent-type-imports': 'off',
  },
})
