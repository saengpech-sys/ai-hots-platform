// Generic API client with fallback to direct Cloud Functions URL if hosting rewrite 404s.
// Usage: apiPost('/api/export-user-data', headers, {})

const REGION = 'asia-southeast1'
const PROJECT = 'ai-hots-platform'
const FALLBACK_ORIGIN = `https://${REGION}-${PROJECT}.cloudfunctions.net`
import { log } from '@/utils/logger'

// Map /api route -> exported function name (when different path segment)
const FUNCTION_NAME_MAP = {
  '/api/scenario': 'aiScenario',
  '/api/assessment': 'aiAssessment',
  '/api/evaluate': 'aiEvaluate',
  '/api/teaching-strategy': 'aiTeachingStrategy',
  '/api/analyze': 'analyzeSubmission',
  '/api/similarity': 'similarityCheck',
  '/api/leaderboard': 'courseLeaderboard',
  '/api/export-user-data': 'exportUserData',
  '/api/request-delete': 'requestDeleteAccount',
  '/api/user-portal': 'userPortalSummary',
  '/api/parental-consent': 'submitParentalConsent',
  '/api/dpia': 'createDPIARecord',
  '/api/dpia-list': 'listDPIARecords',
  '/api/dpia-update': 'updateDPIARecord',
  '/api/dpia-delete': 'deleteDPIARecord',
  '/api/dpia-all': 'listAllDPIARecords',
  '/api/admins': 'listAdmins',
  '/api/admins-add': 'addAdmin',
  '/api/admins-remove': 'removeAdmin',
  '/api/delete-requests': 'listDeleteRequests',
  '/api/delete-requests-act': 'actOnDeleteRequest',
  '/api/audit-logs': 'listAuditLogs',
  '/api/export-status': 'userExportsSummary',
}

async function parseMaybeJson(resp) {
  const ct = resp.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    try {
      return await resp.json()
    } catch {
      return null
    }
  }
  try {
    return await resp.text()
  } catch {
    return null
  }
}

export async function apiPost(path, headers = {}, bodyObj = {}) {
  const h = { ...headers, 'Content-Type': 'application/json' }
  // Primary attempt via hosting rewrite
  let resp = await fetch(path, { method: 'POST', headers: h, body: JSON.stringify(bodyObj) }).catch(
    (e) => ({ ok: false, status: 0, _err: e }),
  )
  // Detect 404 HTML or network failure: fallback
  const needFallback = !resp?.ok && (resp.status === 404 || resp.status === 0)
  if (needFallback) {
    const fn = FUNCTION_NAME_MAP[path] || path.replace(/^\/api\//, '')
    const fallbackUrl = `${FALLBACK_ORIGIN}/${fn}`
    log.warn('api.fallback', { path, fallbackUrl, status: resp.status })
    resp = await fetch(fallbackUrl, {
      method: 'POST',
      headers: h,
      body: JSON.stringify(bodyObj),
    }).catch((e) => ({ ok: false, status: 0, _err: e }))
  }
  const data = await parseMaybeJson(resp)
  if (!resp?.ok) {
    const msg = typeof data === 'object' && data && data.error ? data.error : `HTTP ${resp.status}`
    log.error(
      'api.error',
      { path, status: resp.status, msg, fallbackUsed: needFallback },
      resp._err,
    )
    throw new Error(msg)
  }
  log.info('api.success', { path, status: resp.status, fallback: needFallback })
  return data
}

// Helper to automatically attach Firebase ID token if available
import { getAuthInstance } from '@/firebase/config'
export async function apiPostAuth(path, body = {}, extraHeaders = {}) {
  const auth = await getAuthInstance()
  const user = auth.currentUser
  let headers = { ...extraHeaders }
  if (user) {
    try {
      const token = await user.getIdToken()
      headers.Authorization = `Bearer ${token}`
    } catch (_) {}
  }
  return apiPost(path, headers, body)
}
