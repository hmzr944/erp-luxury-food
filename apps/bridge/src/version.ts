import { readFileSync } from 'node:fs'

// Version lue dans package.json (dist/ et src/ sont au même niveau)
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export const VERSION = readVersion()
export const NAME = 'FLŌW-Bridge'
