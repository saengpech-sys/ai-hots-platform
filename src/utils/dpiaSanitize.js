// Mirror of backend DPIA sanitize logic for risks & mitigations arrays.
export function sanitizeDPIAArray(input, { maxItems = 50, maxLen = 200 } = {}) {
  if (!Array.isArray(input)) return undefined
  const out = []
  const seen = new Set()
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const t = raw.trim().slice(0, maxLen)
    if (!t) continue
    if (seen.has(t)) continue
    out.push(t)
    seen.add(t)
    if (out.length >= maxItems) break
  }
  return out
}
