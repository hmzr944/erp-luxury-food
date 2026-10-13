import { base } from '@erp/config/eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['.next/**', 'next-env.d.ts'] },
  ...base,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
]
