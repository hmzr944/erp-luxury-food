// Construction du pont en un seul fichier JavaScript, partagée par
// package.mjs (paquet Node.js, ESM) et build-binaries.mjs (exécutables, CommonJS).
// FLOW_APP_URL (ou NEXT_PUBLIC_APP_URL) : adresse de la caisse, acceptée d'office.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export function appUrlFromEnv(env = process.env) {
  return (env.FLOW_APP_URL || env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
}

export function bridgeVersion() {
  return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version
}

// format « esm » : lancé par « node flow-bridge.mjs » ;
// format « cjs » : script principal d'un exécutable autonome (Node SEA n'accepte que CommonJS)
export async function bundleBridge({ format, appUrl = appUrlFromEnv(), version = bridgeVersion() }) {
  const standalone = format === 'cjs'
  const define = {
    'process.env.FLOW_BRIDGE_BUILD_ORIGINS': JSON.stringify(appUrl),
    'process.env.FLOW_BRIDGE_BUILD_VERSION': JSON.stringify(version),
    'process.env.FLOW_BRIDGE_BUILD_STANDALONE': JSON.stringify(standalone ? '1' : ''),
  }
  // import.meta n'existe pas en CommonJS : remplacé par l'adresse de l'exécutable
  if (standalone) define['import.meta.url'] = '__flowImportMetaUrl'
  const result = await build({
    entryPoints: [join(ROOT, 'src/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format,
    write: false,
    minify: false,
    legalComments: 'inline',
    // Accélérateurs natifs facultatifs de « ws » : absents, le pont s'en passe
    external: ['bufferutil', 'utf-8-validate'],
    define,
    banner: {
      js: standalone
        ? "const __flowImportMetaUrl = require('node:url').pathToFileURL(__filename).href;"
        : "import { createRequire as __flowRequire } from 'node:module'; const require = __flowRequire(import.meta.url);",
    },
    logLevel: 'error',
  })
  let code = result.outputFiles[0].text
  // Le script principal d'un exécutable est enveloppé comme un module CommonJS :
  // pas de ligne « #! » en tête
  if (standalone) code = code.replace(/^#![^\n]*\n/, '')
  return { code, appUrl, version }
}
