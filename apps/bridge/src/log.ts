// Journal structuré minimal : une ligne par événement, lisible dans un
// terminal comme dans journalctl ou un fichier de service Windows.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogFields = Record<string, string | number | boolean | null | undefined>

export interface Logger {
  debug(msg: string, fields?: LogFields): void
  info(msg: string, fields?: LogFields): void
  warn(msg: string, fields?: LogFields): void
  error(msg: string, fields?: LogFields): void
  // Texte affiché tel quel (code d'appairage) : doit sauter aux yeux
  banner(lines: string[]): void
}

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const LABEL: Record<LogLevel, string> = { debug: 'DEBUG', info: 'INFO ', warn: 'ALERTE', error: 'ERREUR' }

function format(fields?: LogFields): string {
  if (!fields) return ''
  const parts: string[] = []
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue
    const s = String(v)
    parts.push(`${k}=${/\s/.test(s) ? JSON.stringify(s) : s}`)
  }
  return parts.length ? ' ' + parts.join(' ') : ''
}

export function createLogger(level: LogLevel | 'silent' = 'info'): Logger {
  const silent = level === 'silent'
  const min = silent ? Infinity : ORDER[level]
  const write = (lvl: LogLevel, msg: string, fields?: LogFields) => {
    if (ORDER[lvl] < min) return
    const line = `${new Date().toISOString()} ${LABEL[lvl]} ${msg}${format(fields)}`
    if (lvl === 'error' || lvl === 'warn') console.error(line)
    else console.log(line)
  }
  return {
    debug: (m, f) => write('debug', m, f),
    info: (m, f) => write('info', m, f),
    warn: (m, f) => write('warn', m, f),
    error: (m, f) => write('error', m, f),
    banner: (lines) => {
      if (silent) return
      const width = Math.max(...lines.map((l) => l.length)) + 4
      const bar = '='.repeat(width)
      console.log(['', bar, ...lines.map((l) => `  ${l}`), bar, ''].join('\n'))
    },
  }
}

export function levelFromEnv(value: string | undefined): LogLevel | 'silent' {
  const v = (value ?? '').toLowerCase()
  if (v === 'debug' || v === 'info' || v === 'warn' || v === 'error' || v === 'silent') return v
  return 'info'
}
