// Minimal structured logger with leveled output and correlation id support.
// Usage: import { log } from '@/utils/logger'; log.info('event.code', { detail: 123 })

function ts() {
  return new Date().toISOString()
}

const LEVEL_ORDER = { error: 0, warn: 1, info: 2 }
const runtimeLevel = (() => {
  const raw = import.meta.env?.VITE_LOG_LEVEL || 'info'
  return ['error', 'warn', 'info'].includes(raw) ? raw : 'info'
})()

function base(level, code, payload, err) {
  if (LEVEL_ORDER[level] > LEVEL_ORDER[runtimeLevel]) return
  const entry = {
    t: ts(),
    lvl: level,
    code,
    ...payload,
  }
  if (err) {
    entry.error = {
      message: err.message,
      name: err.name,
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    }
  }
  // Output as single line JSON for potential log harvesting.
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    '[app]',
    JSON.stringify(entry),
  )
}

export const log = {
  info: (code, payload = {}) => base('info', code, payload),
  warn: (code, payload = {}) => base('warn', code, payload),
  error: (code, payload = {}, err) => base('error', code, payload, err),
}
