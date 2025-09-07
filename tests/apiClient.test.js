import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiPost } from '@/services/apiClient'
import { describe, it, expect, vi, beforeEach } from 'vitest'
// Extend with specific governance related tests (sanitization / rate limit UX simulation)

// Mock global fetch
const originalFetch = global.fetch

function mockFetchSequence(responses) {
  let i = 0
  global.fetch = vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)]
    i++
    if (r instanceof Error) throw r
    return {
      ok: r.ok && r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: (k) => (k === 'content-type' ? r.contentType || 'application/json' : null) },
      json: async () => r.json,
      text: async () => (typeof r.json === 'string' ? r.json : JSON.stringify(r.json)),
    }
  })
}

beforeEach(() => {
  global.fetch = originalFetch
})

describe('apiPost fallback', () => {
  it('falls back when first 404 then succeeds', async () => {
    mockFetchSequence([
      { ok: false, status: 404, json: { error: 'Not deployed' } },
      { ok: true, status: 200, json: { success: true } },
    ])
    const data = await apiPost('/api/export-user-data', {}, { test: 1 })
    expect(data.success).toBe(true)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('throws on both failures', async () => {
    mockFetchSequence([
      { ok: false, status: 404, json: { error: 'Not deployed' } },
      { ok: false, status: 500, json: { error: 'Boom' } },
    ])
    await expect(apiPost('/api/export-user-data', {}, {})).rejects.toThrow(/Boom|500/)
  })
  it('propagates export rate limit error message', async () => {
    mockFetchSequence([
      { ok: false, status: 404, json: { error: 'missing' } },
      { ok: false, status: 429, json: { error: 'Export recently generated. Try later.' } },
    ])
    await expect(apiPost('/api/export-user-data', {}, {})).rejects.toThrow(/Export recently/)
  })
})
