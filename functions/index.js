// Set server timezone
process.env.TZ = 'Asia/Bangkok'
import * as functions from 'firebase-functions'
import { defineSecret } from 'firebase-functions/params'
import admin from 'firebase-admin'
import fetch from 'node-fetch'
import crypto from 'crypto'

admin.initializeApp()

// --- Seed Admin / Teacher Accounts (bootstrap from ENV) ---
// Set env var: ADMIN_EMAILS="a@example.com,b@example.com" before deploy
const SEED_ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

async function ensureSeedAdmins() {
  if (!Array.isArray(SEED_ADMIN_EMAILS) || SEED_ADMIN_EMAILS.length === 0) return
  const db = admin.firestore()
  for (const email of SEED_ADMIN_EMAILS) {
    try {
      const user = await admin.auth().getUserByEmail(email)
      const uid = user.uid
      const tRef = db.collection('teachers').doc(uid)
      const aRef = db.collection('admins').doc(uid)
      const [tSnap, aSnap] = await Promise.all([tRef.get(), aRef.get()])
      const batch = db.batch()
      if (!tSnap.exists) {
        batch.set(tRef, {
          email,
          seeded: true,
          isAdmin: true, // ensure backward compatibility with legacy admin checks
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      } else if (tSnap.exists && tSnap.data()?.isAdmin !== true) {
        batch.set(
          tRef,
          { isAdmin: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true },
        )
      }
      if (!aSnap.exists) {
        batch.set(aRef, {
          email,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      }
      if (!tSnap.exists || !aSnap.exists) await batch.commit()
      // Merge existing custom claims (preserve others)
      const claims = user.customClaims || {}
      if (!claims.admin || !claims.teacher) {
        await admin.auth().setCustomUserClaims(uid, { ...claims, admin: true, teacher: true })
      }
      functions.logger.info('seedAdmin.ok', { email, uid })
    } catch (e) {
      functions.logger.error('seedAdmin.fail', { email, error: e?.message || String(e) })
    }
  }
}
// Fire & forget (does not block cold start)
ensureSeedAdmins().catch((e) => functions.logger.warn('seedAdmin.unhandled', e?.message))

// Secret: OPENAI_API_KEY (set via: firebase functions:secrets:set OPENAI_API_KEY)
const OPENAI_SECRET = defineSecret('OPENAI_API_KEY')

// --- Configurable thresholds via environment variables ---
const CFG = {
  thaiRatioMin: Number(process.env.THAI_RATIO_MIN) || 0.4,
  semanticDupThreshold: Number(process.env.SEMANTIC_DUP_THRESHOLD) || 0.85,
  simCheckMedium: Number(process.env.SIMILARITY_MEDIUM) || 0.75,
  simCheckHigh: Number(process.env.SIMILARITY_HIGH) || 0.9,
}

// --- Data retention & governance (Sprint 2/3 constants) ---
const RETENTION = {
  HARD_DELETE_GRACE_DAYS: Number(process.env.HARD_DELETE_GRACE_DAYS) || 30, // days after request before soft delete mark
  EXPORT_RATE_LIMIT_MINUTES: Number(process.env.EXPORT_RATE_LIMIT_MINUTES) || 60, // min interval between exports per user
  AUDIT_LOG_RETENTION_DAYS: Number(process.env.AUDIT_LOG_RETENTION_DAYS) || 365, // purge window (future)
}

// Audit log helper
async function logAudit(db, entry) {
  try {
    const col = db.collection('audit_logs')
    await col.add({
      ts: admin.firestore.FieldValue.serverTimestamp(),
      ...entry,
    })
  } catch (e) {
    functions.logger.warn('audit_log.write_failed', { error: String(e?.message || e) })
  }
}

// --- Auth helper: Verify Firebase ID token from Authorization: Bearer <token>
async function verifyAuth(req, opts = {}) {
  const { requireRole } = opts // 'teacher' | 'student' | undefined
  try {
    const authHeader = req.get('Authorization') || ''
    const match = authHeader.match(/^Bearer\s+(.*)$/i)
    if (!match) throw new Error('Missing bearer token')
    const idToken = match[1]
    const decoded = await admin.auth().verifyIdToken(idToken)
    const uid = decoded.uid

    // Resolve role from Firestore
    const db = admin.firestore()
    let role = 'student'
    try {
      const tDoc = await db.collection('teachers').doc(uid).get()
      if (tDoc.exists) role = 'teacher'
      else {
        const sDoc = await db.collection('students').doc(uid).get()
        const r = sDoc.exists ? sDoc.data()?.role : null
        if (r === 'teacher') role = 'teacher'
      }
    } catch (_) {}

    if (requireRole && role !== requireRole) {
      throw new functions.https.HttpsError('permission-denied', 'Insufficient role')
    }
    return { uid, role }
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e
    throw new functions.https.HttpsError('unauthenticated', e?.message || 'Unauthenticated')
  }
}

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

// Redact any API-like tokens in error strings to prevent leakage
function redactSecrets(s) {
  const str = String(s || '')
  return (
    str
      // OpenAI keys
      .replace(/sk-proj-[A-Za-z0-9_-]{10,}/g, 'sk-proj-***redacted***')
      .replace(/sk-[A-Za-z0-9_-]{10,}/g, 'sk-***redacted***')
      // Bearer tokens
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***redacted***')
  )
}

async function callOpenAIJson(systemPrompt, apiKey) {
  // Basic PII scrubbing (student codes 5 digits, emails). Keep structure.
  const scrub = (txt) =>
    String(txt || '')
      .replace(/\b\d{5}\b/g, '[ID]')
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
      .slice(0, 8000) // guard runaway
  const safePrompt = scrub(systemPrompt)
  // Add a 90s timeout to avoid hanging requests
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 90_000)
  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: `${safePrompt}\n\nข้อกำหนด: ต้องตอบเป็น JSON ออบเจ็กต์เพียงอย่างเดียว ห้ามมี Markdown/backticks/ข้อความเกิน และคีย์ต้องตรงตามสคีมาที่ระบุ`,
        },
      ],
      response_format: { type: 'json_object' },
    }),
    signal: controller.signal,
  })
  clearTimeout(t)
  if (!res.ok) {
    const text = await res.text()
    throw new functions.https.HttpsError('internal', `OpenAI error: ${redactSecrets(text)}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  try {
    return JSON.parse(content)
  } catch (e) {
    throw new functions.https.HttpsError('internal', 'Invalid JSON from OpenAI')
  }
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex')
}

// --- Text helpers for semantic dedupe ---
function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&amp;|&quot;|&#39;|&lt;|&gt;/g, ' ')
}
function normText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
function thaiRatio(s) {
  const text = String(s || '')
  const th = (text.match(/[\u0E00-\u0E7F]/g) || []).length
  const all = (text.match(/[A-Za-z\u0E00-\u0E7F\d]/g) || []).length
  return all === 0 ? 0 : th / all
}
function ngrams(s, n) {
  const arr = []
  for (let i = 0; i <= s.length - n; i++) arr.push(s.slice(i, i + n))
  return arr
}
function jaccard(a, b) {
  const sa = new Set(a)
  const sb = new Set(b)
  const inter = [...sa].filter((x) => sb.has(x)).length
  const uni = sa.size + sb.size - inter
  return uni === 0 ? 0 : inter / uni
}
function levenshtein(a, b) {
  const m = a.length,
    n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}
function levSim(a, b) {
  const dist = levenshtein(a, b)
  const maxLen = Math.max(a.length, b.length) || 1
  return 1 - dist / maxLen
}

function setCors(req, res) {
  const origin = req.get('Origin') || ''
  // Reflect origin to support local dev and preview channels
  if (origin) res.set('Access-Control-Allow-Origin', origin)
  else res.set('Access-Control-Allow-Origin', '*')
  res.set('Vary', 'Origin')
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Credentials', 'true')
  res.set('Access-Control-Max-Age', '86400')
}

// Map Firebase HttpsError codes to HTTP status and respond with JSON
function sendHttpsError(res, err) {
  const map = {
    'invalid-argument': 400,
    'failed-precondition': 412,
    'out-of-range': 400,
    unauthenticated: 401,
    'permission-denied': 403,
    'not-found': 404,
    aborted: 409,
    'already-exists': 409,
    'resource-exhausted': 429,
    cancelled: 499,
    'data-loss': 500,
    internal: 500,
    unknown: 500,
    unavailable: 503,
    'deadline-exceeded': 504,
  }
  const status = map[err.code] || 500
  try {
    res.status(status).json({ error: err.message, code: err.code })
  } catch (_) {
    // fallback if headers already sent
  }
}

// --- Admin guard helper (checks custom claims, admins collection, or teacher doc isAdmin flag) ---
async function assertIsAdmin(uid) {
  const authUser = await admin
    .auth()
    .getUser(uid)
    .catch(() => null)
  if (authUser?.customClaims?.admin) return true
  const db = admin.firestore()
  // Check admins/{uid}
  const aDoc = await db
    .collection('admins')
    .doc(uid)
    .get()
    .catch(() => null)
  if (aDoc?.exists) return true
  const tDoc = await db
    .collection('teachers')
    .doc(uid)
    .get()
    .catch(() => null)
  if (tDoc?.exists && tDoc.data()?.isAdmin === true) return true
  throw new functions.https.HttpsError('permission-denied', 'Admin only')
}

// --- Helper: course membership and profile lookups (admin) ---
async function isTeacherOfCourse(db, uid, courseId) {
  try {
    const snap = await db.collection('courses').doc(courseId).get()
    return snap.exists && snap.data()?.teacherId === uid
  } catch (_) {
    return false
  }
}

async function isStudentEnrolledInCourse(db, uid, courseId) {
  try {
    const s = await db.collection('students').doc(uid).get()
    const arr = s.exists && Array.isArray(s.data()?.enrolledCourses) ? s.data().enrolledCourses : []
    return arr.includes(courseId)
  } catch (_) {
    return false
  }
}

async function getStudentProfileLite(db, uid) {
  try {
    const s = await db.collection('students').doc(uid).get()
    if (!s.exists) return { uid }
    const d = s.data() || {}
    return {
      uid,
      name: typeof d.name === 'string' ? d.name : undefined,
      photoURL: typeof d.photoURL === 'string' ? d.photoURL : undefined,
      gradeLevel: d.gradeLevel || undefined,
      room: d.room != null ? String(d.room) : undefined,
      xp: typeof d.xp === 'number' ? d.xp : 0,
    }
  } catch (_) {
    return { uid, xp: 0 }
  }
}

function anonymizeName(name) {
  if (!name || typeof name !== 'string') return 'เพื่อนในคอร์ส'
  const t = name.trim()
  if (!t) return 'เพื่อนในคอร์ส'
  // First name only or initial
  const parts = t.split(/\s+/)
  const first = parts[0]
  if (!first) return 'เพื่อนในคอร์ส'
  // Keep first name up to 8 chars
  return first.length > 8 ? `${first.slice(0, 8)}…` : first
}

export const courseLeaderboard = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    try {
      const { uid } = await verifyAuth(req)
      const {
        courseId,
        timeframe = 'week',
        limit = 10,
        filter = {},
        sortBy = 'level',
      } = req.body || {}
      // Firestore reference (was missing causing 'db is not defined')
      const db = admin.firestore()
      if (!courseId || typeof courseId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Missing courseId')
      }
      const teacher = await isTeacherOfCourse(db, uid, courseId)
      const enrolled = await isStudentEnrolledInCourse(db, uid, courseId)
      if (!teacher && !enrolled) {
        throw new functions.https.HttpsError('permission-denied', 'Not in this course')
      }

      const days = timeframe === 'week' ? 7 : timeframe === 'all' ? 0 : Number(timeframe) || 0
      const sinceMs = days > 0 ? Date.now() - days * 24 * 60 * 60 * 1000 : 0

      // Pull submissions for this course
      const qs = await db.collection('submissions').where('courseId_ref', '==', courseId).get()

      const byUser = new Map() // uid -> { bestScore, latestAt, sum, count }
      const needsMeta = new Set()
      for (const d of qs.docs) {
        const s = d.data() || {}
        const suid = s.studentId_ref || s.studentId || null
        if (!suid) continue
        const t = (s.submittedAt?.toMillis?.() || s.updatedAt?.toMillis?.()) ?? 0
        if (sinceMs && t < sinceMs) continue
        // Compute score
        let score = null
        if (typeof s.score === 'number') score = s.score
        else if (typeof s.scoreSummary === 'number') score = s.scoreSummary
        else if (s.feedback && s.feedback.rubric_scores) {
          const weight = { ดีเยี่ยม: 4, ดี: 3, พอใช้: 2, ต้องปรับปรุง: 1 }
          const vals = Object.values(s.feedback.rubric_scores || {})
          if (vals.length) {
            const sum = vals.reduce((a, l) => a + (weight[l] || 0), 0)
            score = Math.round((sum / (vals.length * 4)) * 100)
          }
        }
        if (score == null) continue
        // Tentatively collect; meta filter applied later
        const prev = byUser.get(suid)
        if (!prev) {
          byUser.set(suid, { bestScore: score, latestAt: t, sum: score, count: 1 })
        } else {
          prev.sum += score
          prev.count += 1
          if (score > prev.bestScore || (score === prev.bestScore && t > prev.latestAt)) {
            prev.bestScore = score
            prev.latestAt = t
          }
        }
        needsMeta.add(suid)
      }

      // Apply cohort filters (gradeLevel/room) by fetching meta
      const gradeLevel = filter?.gradeLevel ? String(filter.gradeLevel) : ''
      const room = filter?.room ? String(filter.room) : ''
      const metaMap = new Map()
      if (gradeLevel || room) {
        for (const suid of needsMeta) {
          const prof = await getStudentProfileLite(db, suid)
          metaMap.set(suid, prof)
        }
        for (const [suid, rec] of Array.from(byUser.entries())) {
          const meta = metaMap.get(suid) || {}
          if (gradeLevel && String(meta.gradeLevel || '') !== gradeLevel) {
            byUser.delete(suid)
            continue
          }
          if (room && String(meta.room || '') !== room) {
            byUser.delete(suid)
            continue
          }
        }
      }

      // Fetch XP for all participants (batch) to compute level and support level-based sorting
      const xpCache = new Map()
      const profCache = new Map()
      async function getLite(uid2) {
        if (profCache.has(uid2)) return profCache.get(uid2)
        const p = await getStudentProfileLite(db, uid2)
        profCache.set(uid2, p)
        return p
      }
      const entries = Array.from(byUser.entries())
      for (const [suid] of entries) {
        const prof = await getLite(suid)
        xpCache.set(suid, typeof prof.xp === 'number' ? prof.xp : 0)
      }
      // Filter out participants who disabled gamification
      const disabledGamification = []
      for (const [suid] of entries) {
        const prof = await getLite(suid)
        if (prof && prof.allowGamification === false) {
          byUser.delete(suid)
          disabledGamification.push(suid)
        }
      }
      function levelFromXp(xp) {
        let n = Math.floor((1 + Math.sqrt(1 + xp / 25)) / 2)
        while (50 * n * (n - 1) > xp) n--
        while (50 * (n + 1) * n <= xp) n++
        return Math.max(1, n)
      }
      // Build with level
      const arr = entries
        .map(([suid, v]) => {
          if (!byUser.has(suid)) return null // filtered out
          const xp = xpCache.get(suid) || 0
          const level = levelFromXp(xp)
          const avgScore = v.count ? Math.round(v.sum / v.count) : 0
          return {
            uid: suid,
            bestScore: v.bestScore,
            latestAt: v.latestAt,
            avgScore,
            xp,
            level,
          }
        })
        .filter(Boolean)
        .sort((a, b) => {
          if (sortBy === 'best') {
            return (
              b.bestScore - a.bestScore ||
              b.level - a.level ||
              b.avgScore - a.avgScore ||
              b.latestAt - a.latestAt
            )
          }
          if (sortBy === 'avg') {
            return (
              b.avgScore - a.avgScore ||
              b.level - a.level ||
              b.bestScore - a.bestScore ||
              b.latestAt - a.latestAt
            )
          }
          // default level
          return (
            b.level - a.level ||
            b.bestScore - a.bestScore ||
            b.avgScore - a.avgScore ||
            b.latestAt - a.latestAt
          )
        })

      const total = arr.length
      const meIdx = arr.findIndex((x) => x.uid === uid)
      const myRank = meIdx >= 0 ? meIdx + 1 : null
      const myBest = meIdx >= 0 ? arr[meIdx].bestScore : null
      const myAvg = meIdx >= 0 ? arr[meIdx].avgScore : null
      const myLevel = meIdx >= 0 ? arr[meIdx].level : null
      const myXp = meIdx >= 0 ? arr[meIdx].xp : null

      const n = Math.max(1, Math.min(50, Number(limit) || 10))
      const top = arr.slice(0, n)

      // Attach identity; teachers see actual name/photo, students see anonymized names
      const outTop = []
      for (let i = 0; i < top.length; i++) {
        const it = top[i]
        let name = 'เพื่อนในคอร์ส'
        let photoURL = ''
        if (teacher) {
          const prof = metaMap.get(it.uid) || (await getLite(it.uid))
          name = prof?.name || 'Student'
          photoURL = prof?.photoURL || ''
        } else if (it.uid === uid) {
          // always show caller's own name if available
          const me = await getLite(uid)
          name = me?.name || 'ฉัน'
          photoURL = me?.photoURL || ''
        } else {
          const prof = metaMap.get(it.uid) || (await getLite(it.uid))
          name = anonymizeName(prof?.name)
          photoURL = ''
        }
        outTop.push({
          rank: i + 1,
          bestScore: it.bestScore,
          latestAt: it.latestAt,
          level: it.level,
          avgScore: it.avgScore,
          xp: it.xp,
          name,
          photoURL,
          // include uid only for self (client uses myRank anyway)
          uid: it.uid === uid ? uid : null,
        })
      }

      return res.json({
        courseId,
        timeframe: days ? 'week' : 'all',
        total,
        myRank,
        myBest,
        myAvg,
        myLevel,
        myXp,
        sortBy,
        top: outTop,
      })
    } catch (err) {
      const e =
        err instanceof functions.https.HttpsError
          ? err
          : new functions.https.HttpsError('internal', err?.message || 'Internal error')
      return sendHttpsError(res, e)
    }
  })

export const aiScenario = functions
  .region('asia-southeast1')
  .runWith({ secrets: [OPENAI_SECRET], timeoutSeconds: 120, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST')
      return res.status(405).json({ error: 'Method Not Allowed. Use POST.' })
    try {
      const auth = await verifyAuth(req)
      const { systemPrompt, meta } = req.body || {}
      if (!systemPrompt) throw new functions.https.HttpsError('invalid-argument', 'Missing prompt')
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) throw new functions.https.HttpsError('failed-precondition', 'Missing API key')
      let prompt = systemPrompt
      const t0 = Date.now()
      let json = await callOpenAIJson(prompt, apiKey)
      functions.logger.info('aiScenario.openai_call_done', { elapsed_ms: Date.now() - t0 })
      // Basic JSON schema validation for scenario
      const ok =
        json &&
        typeof json.scenario_title === 'string' &&
        typeof json.scenario_html === 'string' &&
        typeof json.core_question === 'string' &&
        typeof json.skill_targeted === 'string'
      if (!ok) {
        functions.logger.warn('aiScenario.schema_validation_failed', {
          uid: auth?.uid || null,
          courseId: meta?.courseId || meta?.courseId_ref || null,
        })
        throw new functions.https.HttpsError('internal', 'Schema validation failed')
      }
      // Enforce title length <= 60
      if (json.scenario_title && json.scenario_title.length > 60) {
        json.scenario_title = json.scenario_title.slice(0, 60).trim()
      }
      // Optional: language enforcement if Thai ratio too low
      const thaiTextSample = `${json.scenario_title || ''} ${stripHtml(json.scenario_html || '')} ${
        json.core_question || ''
      }`
      const thaiR = thaiRatio(thaiTextSample)
      if (thaiR < CFG.thaiRatioMin) {
        functions.logger.info('aiScenario.lang_retry', {
          uid: auth?.uid || null,
          courseId: meta?.courseId || meta?.courseId_ref || null,
          thaiRatio: thaiR,
          thaiRatioMin: CFG.thaiRatioMin,
        })
        const langHint = `\nข้อกำหนดเพิ่มเติม: ใช้ภาษาไทยล้วนเท่านั้น ห้ามใช้ภาษาอื่น`
        const t1 = Date.now()
        const retryLang = await callOpenAIJson(`${prompt}\n${langHint}`, apiKey)
        functions.logger.info('aiScenario.openai_call_done_retry_language', {
          elapsed_ms: Date.now() - t1,
        })
        if (
          retryLang &&
          typeof retryLang.scenario_title === 'string' &&
          typeof retryLang.scenario_html === 'string' &&
          typeof retryLang.core_question === 'string'
        ) {
          json = retryLang
          if (json.scenario_title.length > 60)
            json.scenario_title = json.scenario_title.slice(0, 60)
        }
      }

      // Optional: dedupe by content_hash and semantic similarity within a course if meta.courseId provided
      const courseId = meta?.courseId || meta?.courseId_ref || null
      if (courseId) {
        const db = admin.firestore()
        try {
          let qs
          try {
            qs = await db
              .collection('scenarios')
              .where('courseId_ref', '==', courseId)
              .orderBy('createdAt', 'desc')
              .limit(300)
              .get()
          } catch (_) {
            // Fallback without orderBy if index missing
            qs = await db.collection('scenarios').where('courseId_ref', '==', courseId).get()
          }
          const existing = []
          qs.forEach((d) => existing.push({ id: d.id, ...d.data() }))
          // Bound pool size if fallback returned too many
          existing.splice(300)
          const canonical = `${json.scenario_title || ''}\n${json.core_question || ''}`
          const hex = sha256Hex(canonical)

          // Hash dedupe
          let hashDup = existing.find((e) => e.content_hash && e.content_hash === hex)

          // Semantic dedupe (title + core_question + plain html)
          const A = normText(
            `${json.scenario_title || ''} ${json.core_question || ''} ${stripHtml(
              json.scenario_html || '',
            )}`,
          )
          const grams3A = ngrams(A, 3)
          const grams5A = ngrams(A, 5)
          const sims = existing.map((e) => {
            const B = normText(
              `${e.scenario_title || ''} ${e.core_question || ''} ${stripHtml(
                e.scenario_html || '',
              )}`,
            )
            if (!B) return { id: e.id, title: e.scenario_title || '', score: 0 }
            const sJ3 = jaccard(grams3A, ngrams(B, 3))
            const sJ5 = jaccard(ngrams(A, 5), ngrams(B, 5))
            const sLev = levSim(A, B)
            return { id: e.id, title: e.scenario_title || '', score: Math.max(sJ3, sJ5, sLev) }
          })
          sims.sort((a, b) => b.score - a.score)
          const top = sims[0] || { score: 0 }
          const isSemanticDup = top.score >= CFG.semanticDupThreshold

          if (hashDup || isSemanticDup) {
            functions.logger.info('aiScenario.dedupe_hit', {
              uid: auth?.uid || null,
              courseId,
              reason: hashDup ? 'hash' : 'semantic',
              topScore: top?.score || 0,
              topTitle: top?.title || null,
              threshold: CFG.semanticDupThreshold,
            })
            const avoidLines = sims
              .slice(0, 3)
              .map((s, i) => `${i + 1}. ${s.title || '—'}`)
              .join('\n    ')
            const avoidBlock = avoidLines
              ? `\n  - หลีกเลี่ยงการซ้ำหัวข้อ/สถานการณ์ต่อไปนี้:\n    ${avoidLines}`
              : `\n  - หลีกเลี่ยงการซ้ำหัวข้อ/สถานการณ์ที่สร้างไปแล้วในรายวิชา`
            const augmented = `${prompt}\n${avoidBlock}`
            const t2 = Date.now()
            const retry = await callOpenAIJson(augmented, apiKey)
            functions.logger.info('aiScenario.openai_call_done_retry_dedupe', {
              elapsed_ms: Date.now() - t2,
            })
            const ok2 =
              retry &&
              typeof retry.scenario_title === 'string' &&
              typeof retry.scenario_html === 'string' &&
              typeof retry.core_question === 'string' &&
              typeof retry.skill_targeted === 'string'
            if (ok2) {
              if (retry.scenario_title.length > 60) {
                retry.scenario_title = retry.scenario_title.slice(0, 60).trim()
              }
              const canon2 = `${retry.scenario_title || ''}\n${retry.core_question || ''}`
              const hex2 = sha256Hex(canon2)
              const hashDup2 = existing.find((e) => e.content_hash && e.content_hash === hex2)
              // Recompute similarity against existing pool using the retried content
              const A2 = normText(
                `${retry.scenario_title || ''} ${retry.core_question || ''} ${stripHtml(
                  retry.scenario_html || '',
                )}`,
              )
              const grams3A2 = ngrams(A2, 3)
              const grams5A2 = ngrams(A2, 5)
              const sims2 = existing.map((e) => {
                const B = normText(
                  `${e.scenario_title || ''} ${e.core_question || ''} ${stripHtml(
                    e.scenario_html || '',
                  )}`,
                )
                if (!B) return 0
                const sJ3 = jaccard(grams3A2, ngrams(B, 3))
                const sJ5 = jaccard(ngrams(A2, 5), ngrams(B, 5))
                const sLev = levSim(A2, B)
                return Math.max(sJ3, sJ5, sLev)
              })
              const maxSim2 = sims2.length ? Math.max(...sims2) : 0
              const isDup2 = maxSim2 >= CFG.semanticDupThreshold
              if (!hashDup2 && !isDup2) {
                functions.logger.info('aiScenario.dedupe_retry_success', {
                  uid: auth?.uid || null,
                  courseId,
                })
                json = retry
              } else {
                functions.logger.info('aiScenario.dedupe_retry_still_dup', {
                  uid: auth?.uid || null,
                  courseId,
                  hashDup2: Boolean(hashDup2),
                })
              }
            }
          }
        } catch (_) {
          // ignore dedupe failure
        }
      }
      functions.logger.info('aiScenario.success', {
        uid: auth?.uid || null,
        courseId: meta?.courseId || meta?.courseId_ref || null,
        titleLen: json?.scenario_title ? json.scenario_title.length : 0,
      })
      res.json(json)
    } catch (e) {
      if (e instanceof functions.https.HttpsError) {
        return sendHttpsError(res, e)
      }
      functions.logger.error('aiScenario.error', {
        uid: null,
        error: String(e?.message || e),
      })
      res.status(500).json({ error: String(e?.message || e) })
    }
  })

export const aiAssessment = functions
  .region('asia-southeast1')
  .runWith({ secrets: [OPENAI_SECRET], timeoutSeconds: 120, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST')
      return res.status(405).json({ error: 'Method Not Allowed. Use POST.' })
    try {
      await verifyAuth(req)
      const { systemPrompt } = req.body || {}
      if (!systemPrompt) throw new functions.https.HttpsError('invalid-argument', 'Missing prompt')
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) throw new functions.https.HttpsError('failed-precondition', 'Missing API key')
      const t0 = Date.now()
      const json = await callOpenAIJson(systemPrompt, apiKey)
      functions.logger.info('aiAssessment.openai_call_done', { elapsed_ms: Date.now() - t0 })
      // Basic JSON schema validation for assessment
      const ok =
        json &&
        typeof json.assessment_task === 'string' &&
        Array.isArray(json.evaluation_rubric) &&
        json.evaluation_rubric.every((x) => typeof x === 'string' && x.trim().length > 0)
      if (!ok) {
        functions.logger.warn('aiAssessment.schema_validation_failed', {})
        throw new functions.https.HttpsError('internal', 'Schema validation failed')
      }
      functions.logger.info('aiAssessment.success', {})
      res.json(json)
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      res.status(500).json({ error: String(e?.message || e) })
    }
  })

export const aiEvaluate = functions
  .region('asia-southeast1')
  .runWith({ secrets: [OPENAI_SECRET], timeoutSeconds: 120, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST')
      return res.status(405).json({ error: 'Method Not Allowed. Use POST.' })
    try {
      await verifyAuth(req)
      const { systemPrompt } = req.body || {}
      if (!systemPrompt) throw new functions.https.HttpsError('invalid-argument', 'Missing prompt')
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) throw new functions.https.HttpsError('failed-precondition', 'Missing API key')
      const t0 = Date.now()
      const json = await callOpenAIJson(systemPrompt, apiKey)
      functions.logger.info('aiEvaluate.openai_call_done', { elapsed_ms: Date.now() - t0 })
      // Basic JSON schema validation for evaluation
      const ok =
        json &&
        typeof json.summary_feedback === 'string' &&
        typeof json.next_action === 'string' &&
        (json.next_action === 'ADVANCE' || json.next_action === 'REINFORCE') &&
        typeof json.common_error_tag === 'string' &&
        json.detailed_feedback &&
        Array.isArray(json.detailed_feedback) &&
        json.detailed_feedback.every(
          (o) => o && typeof o.criteria === 'string' && typeof o.feedback_text === 'string',
        ) &&
        json.rubric_scores &&
        typeof json.rubric_scores === 'object'
      if (!ok) {
        functions.logger.warn('aiEvaluate.schema_validation_failed', {})
        throw new functions.https.HttpsError('internal', 'Schema validation failed')
      }
      functions.logger.info('aiEvaluate.success', {})
      res.json(json)
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      res.status(500).json({ error: String(e?.message || e) })
    }
  })

// --- Lightweight LLM-likeness heuristic scoring ---
export const analyzeSubmission = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST')
      return res.status(405).json({ error: 'Method Not Allowed. Use POST.' })
    try {
      await verifyAuth(req) // students and teachers can call
      const { answer, telemetry } = req.body || {}
      if (typeof answer !== 'string' || !answer.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing answer text')
      }
      const text = answer.trim()
      const len = text.length
      const sentences = (text.match(/[.!?\u0E2E\u0E2F]/g) || []).length // rough
      const comma = (text.match(/,/g) || []).length
      const therefore = (text.match(/ดังนั้น|เพราะฉะนั้น|สรุปได้ว่า|จากเหตุผลข้างต้น/g) || [])
        .length
      const structuredMarkers = (text.match(/ข้อที่\s*\d+|\(\d+\)|\-\s|•/g) || []).length
      const formalPhrases = (text.match(/อย่างไรก็ตาม|ในขณะเดียวกัน|ประการที่|จากมุมมอง/g) || [])
        .length
      const jsonLike = /\{[^}]{10,}\}|\[[^\]]{10,}\]/.test(text) ? 1 : 0

      // Heuristic score 0..1
      let score = 0
      score += Math.min(0.2, (sentences / Math.max(1, len)) * 10)
      score += Math.min(0.2, (comma / Math.max(1, len)) * 8)
      score += Math.min(0.2, therefore * 0.08)
      score += Math.min(0.15, structuredMarkers * 0.05)
      score += Math.min(0.15, formalPhrases * 0.06)
      score += jsonLike * 0.1

      // Telemetry influence
      const typed = Number(telemetry?.typed || 0)
      const pasted = Number(telemetry?.pasted || 0)
      const total = typed + pasted
      const ratio = total > 0 ? typed / total : null
      const timeSec = Number(telemetry?.time_sec || 0)
      // If pasted dominates and time is very short for long answers, bump risk
      if (len > 400 && ratio !== null && ratio < 0.2 && timeSec < 60) score += 0.25

      score = Math.max(0, Math.min(1, score))
      let flag = 'low'
      if (score >= CFG.simCheckHigh) flag = 'high'
      else if (score >= CFG.simCheckMedium) flag = 'medium'

      res.json({
        score,
        flag,
        features: { len, sentences, comma, therefore, structuredMarkers, formalPhrases, jsonLike },
      })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      res.status(500).json({ error: String(e?.message || e) })
    }
  })

// --- Similarity check against peers in the same course ---
export const similarityCheck = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST')
      return res.status(405).json({ error: 'Method Not Allowed. Use POST.' })
    try {
      await verifyAuth(req) // allow any authenticated user
      const { answer, courseId, scenarioId, limit = 200 } = req.body || {}
      if (!courseId) throw new functions.https.HttpsError('invalid-argument', 'Missing courseId')
      if (typeof answer !== 'string' || !answer.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing answer text')
      }
      const text = String(answer || '').trim()

      // Fetch recent submissions in the same course (ordered and limited)
      const db = admin.firestore()
      const safeLimit = Math.max(10, Math.min(500, Number(limit) || 200))
      let peers = []
      try {
        const qs = await db
          .collection('submissions')
          .where('courseId_ref', '==', courseId)
          .orderBy('submittedAt', 'desc')
          .limit(safeLimit)
          .get()
        qs.forEach((d) => peers.push({ id: d.id, ...d.data() }))
      } catch (err) {
        // Fallback without orderBy if index missing
        const snap = await db.collection('submissions').where('courseId_ref', '==', courseId).get()
        const all = []
        snap.forEach((d) => all.push({ id: d.id, ...d.data() }))
        all.sort((a, b) => {
          const ta = a.submittedAt?._seconds ? a.submittedAt._seconds : 0
          const tb = b.submittedAt?._seconds ? b.submittedAt._seconds : 0
          return tb - ta
        })
        peers = all.slice(0, safeLimit)
      }
      // Build normalized text for student and peers
      const norm = (s) =>
        String(s || '')
          .toLowerCase()
          .replace(/[\u200B-\u200D\uFEFF]/g, '')
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      const A = norm(text)

      function ngrams(s, n) {
        const arr = []
        for (let i = 0; i <= s.length - n; i++) arr.push(s.slice(i, i + n))
        return arr
      }
      function jaccard(a, b) {
        const sa = new Set(a)
        const sb = new Set(b)
        const inter = [...sa].filter((x) => sb.has(x)).length
        const uni = sa.size + sb.size - inter
        return uni === 0 ? 0 : inter / uni
      }
      function levenshtein(a, b) {
        const m = a.length,
          n = b.length
        if (m === 0) return n
        if (n === 0) return m
        const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
        for (let i = 0; i <= m; i++) dp[i][0] = i
        for (let j = 0; j <= n; j++) dp[0][j] = j
        for (let i = 1; i <= m; i++) {
          for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
          }
        }
        return dp[m][n]
      }
      function levSim(a, b) {
        const dist = levenshtein(a, b)
        const maxLen = Math.max(a.length, b.length) || 1
        return 1 - dist / maxLen
      }

      const grams3A = ngrams(A, 3)
      const grams5A = ngrams(A, 5)
      const results = []
      for (const p of peers) {
        const txt = p.studentAnswer || p.answer || ''
        if (!txt) continue
        // skip comparing to exact same scenario if desired? keep to find collusion too
        const B = norm(txt)
        if (!B) continue
        const scoreJ3 = jaccard(grams3A, ngrams(B, 3))
        const scoreJ5 = jaccard(grams5A, ngrams(B, 5))
        const scoreLev = levSim(A, B)
        const score = Math.max(scoreJ3, scoreJ5, scoreLev)
        results.push({
          submissionId: p.id,
          studentId: p.studentId_ref || null,
          scenarioId: p.scenarioId_ref || null,
          missionId: p.missionId_ref || null,
          score,
          parts: { j3: scoreJ3, j5: scoreJ5, lev: scoreLev },
        })
      }
      results.sort((a, b) => b.score - a.score)
      const top = results.slice(0, 5)
      const maxScore = results.length ? results[0].score : 0
      let flag = 'low'
      if (maxScore >= CFG.simCheckHigh) flag = 'high'
      else if (maxScore >= CFG.simCheckMedium) flag = 'medium'
      functions.logger.info('similarityCheck.done', {
        courseId,
        topMax: maxScore,
        flag,
        totalPeers: peers.length,
      })
      res.json({ flag, max: maxScore, top })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      res.status(500).json({ error: String(e?.message || e) })
    }
  })

// --- AI: Teaching Strategy generator for teachers ---
export const aiTeachingStrategy = functions
  .region('asia-southeast1')
  .runWith({ secrets: [OPENAI_SECRET], timeoutSeconds: 120, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST')
      return res.status(405).json({ error: 'Method Not Allowed. Use POST.' })
    try {
      await verifyAuth(req, { requireRole: 'teacher' })
      const { systemPrompt } = req.body || {}
      if (!systemPrompt) throw new functions.https.HttpsError('invalid-argument', 'Missing prompt')
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) throw new functions.https.HttpsError('failed-precondition', 'Missing API key')
      const t0 = Date.now()
      const json = await callOpenAIJson(systemPrompt, apiKey)
      functions.logger.info('aiTeachingStrategy.openai_call_done', {
        elapsed_ms: Date.now() - t0,
      })
      const ok =
        json &&
        typeof json.strategy_summary === 'string' &&
        Array.isArray(json.key_misconceptions) &&
        Array.isArray(json.lesson_sequence) &&
        Array.isArray(json.formative_checks) &&
        Array.isArray(json.remediation) &&
        Array.isArray(json.enrichment)
      if (!ok) {
        functions.logger.warn('aiTeachingStrategy.schema_validation_failed', {})
        throw new functions.https.HttpsError('internal', 'Schema validation failed')
      }
      res.json(json)
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      res.status(500).json({ error: String(e?.message || e) })
    }
  })

// =============== Sprint 2: Data Export & Deletion Requests ==================

// Helper to collect user-owned documents safely (student scope)
async function collectStudentData(db, uid) {
  const out = { profile: null, submissions: [], scenarios: [], assessments: [] }
  try {
    const prof = await db.collection('students').doc(uid).get()
    out.profile = prof.exists ? { id: prof.id, ...prof.data() } : null
  } catch {}
  // Submissions
  try {
    const subs = await db
      .collection('submissions')
      .where('studentId_ref', '==', uid)
      .limit(2000)
      .get()
    subs.forEach((d) => out.submissions.push({ id: d.id, ...d.data() }))
  } catch {}
  // Scenarios created by this user
  try {
    const sc = await db.collection('scenarios').where('studentId_ref', '==', uid).limit(1000).get()
    sc.forEach((d) => out.scenarios.push({ id: d.id, ...d.data() }))
  } catch {}
  // Assessments (indirect ownership if created from their scenario)
  try {
    if (out.scenarios.length) {
      const ids = new Set(out.scenarios.map((s) => s.id))
      const as = await db
        .collection('assessments')
        .where('scenarioId_ref', 'in', Array.from(ids).slice(0, 10))
        .get()
        .catch(() => null)
      as?.forEach?.((d) => out.assessments.push({ id: d.id, ...d.data() }))
    }
  } catch {}
  return out
}

export const exportUserData = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    try {
      const authn = await verifyAuth(req)
      const db = admin.firestore()
      // Rate limit via latest audit log entry of type export
      const recent = await db
        .collection('audit_logs')
        .where('actor', '==', authn.uid)
        .where('action', '==', 'export_user_data')
        .orderBy('ts', 'desc')
        .limit(1)
        .get()
        .catch(() => null)
      if (recent && !recent.empty) {
        const doc = recent.docs[0]
        const ts = doc.data().ts?.toMillis?.() || 0
        if (Date.now() - ts < RETENTION.EXPORT_RATE_LIMIT_MINUTES * 60 * 1000) {
          throw new functions.https.HttpsError('resource-exhausted', 'Export rate limited')
        }
      }
      const data = await collectStudentData(db, authn.uid)
      await logAudit(db, {
        actor: authn.uid,
        action: 'export_user_data',
        size: JSON.stringify(data).length,
      })
      res.json({ generatedAt: Date.now(), data })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      return res.status(500).json({ error: String(e?.message || e) })
    }
  })

export const requestDeleteAccount = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    try {
      const authn = await verifyAuth(req)
      const db = admin.firestore()
      const ref = db.collection('delete_requests').doc(authn.uid)
      const now = Date.now()
      const graceMs = RETENTION.HARD_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000
      await ref.set(
        {
          uid: authn.uid,
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
          hardDeleteAfter: new Date(now + graceMs),
          status: 'pending', // pending -> soft-deleted -> purged
        },
        { merge: true },
      )
      await logAudit(db, {
        actor: authn.uid,
        action: 'request_delete',
        graceDays: RETENTION.HARD_DELETE_GRACE_DAYS,
      })
      res.json({ ok: true })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      res.status(500).json({ error: String(e?.message || e) })
    }
  })

// Scheduled soft delete processor (runs daily)
export const scheduledSoftDelete = functions
  .region('asia-southeast1')
  .pubsub.schedule('0 20 * * *') // 20:00 UTC daily (~03:00 ICT)
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore()
    const now = Date.now()
    const batch = db.batch()
    const qs = await db.collection('delete_requests').where('status', '==', 'pending').get()
    let processed = 0
    for (const d of qs.docs) {
      const hardAfter = d.data().hardDeleteAfter?.toMillis?.() || 0
      if (hardAfter && hardAfter <= now) {
        // Mark student docs with softDeleted=true
        const uid = d.id
        batch.update(db.collection('delete_requests').doc(uid), {
          status: 'soft-deleted',
          softDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        batch.set(
          db.collection('students').doc(uid),
          { softDeleted: true, softDeletedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true },
        )
        processed++
      }
    }
    if (processed) await batch.commit()
    await logAudit(db, { actor: 'system', action: 'scheduled_soft_delete', processed })
    return null
  })

// Scheduled hard purge (weekly)
export const scheduledHardPurge = functions
  .region('asia-southeast1')
  .pubsub.schedule('0 21 * * 0') // Sunday
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore()
    const qs = await db.collection('delete_requests').where('status', '==', 'soft-deleted').get()
    let purged = 0
    for (const d of qs.docs) {
      const uid = d.id
      try {
        // Delete student data (example: students doc + delete_requests doc). Extend as needed.
        await db
          .collection('students')
          .doc(uid)
          .delete()
          .catch(() => null)
        await db.collection('delete_requests').doc(uid).update({
          status: 'purged',
          purgedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        purged++
      } catch (e) {
        console.error('Purge failed for', uid, e)
      }
    }
    if (purged) await logAudit(db, { actor: 'system', action: 'scheduled_hard_purge', purged })
    return null
  })

export const createDPIARecord = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    try {
      const authn = await verifyAuth(req, { requireRole: 'teacher' })
      const { projectName, risks, mitigations } = req.body || {}
      if (!projectName)
        throw new functions.https.HttpsError('invalid-argument', 'Missing projectName')
      // --- Sanitize arrays: enforce element length + trim + dedupe ---
      const MAX_ITEMS = 50
      const MAX_LEN = 200
      function cleanArr(arr) {
        if (!Array.isArray(arr)) return []
        const out = []
        const seen = new Set()
        for (const raw of arr) {
          if (typeof raw !== 'string') continue
          const t = raw.trim().slice(0, MAX_LEN)
          if (!t) continue
          if (seen.has(t)) continue
          out.push(t)
          seen.add(t)
          if (out.length >= MAX_ITEMS) break
        }
        return out
      }
      const safeRisks = cleanArr(risks)
      const safeMitigations = cleanArr(mitigations)
      const db = admin.firestore()
      const rec = await db.collection('dpia_records').add({
        projectName: String(projectName).slice(0, 120),
        risks: safeRisks,
        mitigations: safeMitigations,
        createdBy: authn.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      await logAudit(db, { actor: authn.uid, action: 'create_dpia', recordId: rec.id })
      res.json({ id: rec.id })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      res.status(500).json({ error: String(e?.message || e) })
    }
  })

// List DPIA records created by the authenticated teacher (own scope only)
export const listDPIARecords = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    try {
      const authn = await verifyAuth(req, { requireRole: 'teacher' })
      const db = admin.firestore()
      const { pageSize = 50, startAfter } = req.body || {}
      const size = Math.max(1, Math.min(100, Number(pageSize) || 50))
      let col = db
        .collection('dpia_records')
        .where('createdBy', '==', authn.uid)
        .orderBy('createdAt', 'desc')
        .limit(size + 1) // fetch one extra to signal more
      let cursorDoc = null
      if (startAfter) {
        try {
          cursorDoc = await db.collection('dpia_records').doc(String(startAfter)).get()
          if (cursorDoc.exists && cursorDoc.data()?.createdBy === authn.uid) {
            col = col.startAfter(cursorDoc)
          }
        } catch (_) {}
      }
      let qs
      try {
        qs = await col.get()
      } catch (e) {
        // fallback without orderBy (no pagination possible)
        qs = await db
          .collection('dpia_records')
          .where('createdBy', '==', authn.uid)
          .limit(size + 1)
          .get()
      }
      const docs = qs.docs
      const hasMore = docs.length > size
      const slice = hasMore ? docs.slice(0, size) : docs
      const records = slice.map((d) => ({ id: d.id, ...d.data() }))
      const nextCursor = hasMore ? slice[slice.length - 1].id : null
      res.json({ records, nextCursor, hasMore })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      res.status(500).json({ error: String(e?.message || e) })
    }
  })

// Update a DPIA record (only owner teacher)
export const updateDPIARecord = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    try {
      const authn = await verifyAuth(req, { requireRole: 'teacher' })
      const { id, projectName, risks, mitigations } = req.body || {}
      if (!id) throw new functions.https.HttpsError('invalid-argument', 'Missing id')
      const db = admin.firestore()
      const ref = db.collection('dpia_records').doc(String(id))
      const snap = await ref.get()
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Record not found')
      if (snap.data()?.createdBy !== authn.uid)
        throw new functions.https.HttpsError('permission-denied', 'Not owner')
      const patch = {}
      if (projectName) patch.projectName = String(projectName).slice(0, 120)
      const MAX_ITEMS = 50
      const MAX_LEN = 200
      function cleanArr(arr) {
        if (!Array.isArray(arr)) return undefined
        const out = []
        const seen = new Set()
        for (const raw of arr) {
          if (typeof raw !== 'string') continue
          const t = raw.trim().slice(0, MAX_LEN)
          if (!t) continue
          if (seen.has(t)) continue
          out.push(t)
          seen.add(t)
          if (out.length >= MAX_ITEMS) break
        }
        return out
      }
      if (Array.isArray(risks)) patch.risks = cleanArr(risks)
      if (Array.isArray(mitigations)) patch.mitigations = cleanArr(mitigations)
      if (!Object.keys(patch).length)
        throw new functions.https.HttpsError('invalid-argument', 'Nothing to update')
      patch.updatedAt = admin.firestore.FieldValue.serverTimestamp()
      await ref.update(patch)
      await logAudit(db, { actor: authn.uid, action: 'update_dpia', recordId: id })
      res.json({ ok: true })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      res.status(500).json({ error: String(e?.message || e) })
    }
  })

// Delete a DPIA record (soft delete by flag to preserve audit trail)
export const deleteDPIARecord = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    try {
      const authn = await verifyAuth(req, { requireRole: 'teacher' })
      const { id } = req.body || {}
      if (!id) throw new functions.https.HttpsError('invalid-argument', 'Missing id')
      const db = admin.firestore()
      const ref = db.collection('dpia_records').doc(String(id))
      const snap = await ref.get()
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Record not found')
      if (snap.data()?.createdBy !== authn.uid)
        throw new functions.https.HttpsError('permission-denied', 'Not owner')
      await ref.update({ deleted: true, deletedAt: admin.firestore.FieldValue.serverTimestamp() })
      await logAudit(db, { actor: authn.uid, action: 'delete_dpia', recordId: id })
      res.json({ ok: true })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      res.status(500).json({ error: String(e?.message || e) })
    }
  })

// Admin listing: list ALL DPIA records (requires teacher with isAdmin=true in teachers/{uid})
export const listAllDPIARecords = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    try {
      const authn = await verifyAuth(req, { requireRole: 'teacher' })
      const db = admin.firestore()
      const tDoc = await db
        .collection('teachers')
        .doc(authn.uid)
        .get()
        .catch(() => null)
      if (!tDoc?.exists || tDoc.data()?.isAdmin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Not admin')
      }
      const { pageSize = 100, startAfter } = req.body || {}
      const size = Math.max(1, Math.min(200, Number(pageSize) || 100))
      let col = db
        .collection('dpia_records')
        .orderBy('createdAt', 'desc')
        .limit(size + 1)
      if (startAfter) {
        try {
          const cur = await db.collection('dpia_records').doc(String(startAfter)).get()
          if (cur.exists) col = col.startAfter(cur)
        } catch (_) {}
      }
      const qs = await col.get()
      const docs = qs.docs
      const hasMore = docs.length > size
      const slice = hasMore ? docs.slice(0, size) : docs
      const records = slice.map((d) => ({ id: d.id, ...d.data() }))
      const nextCursor = hasMore ? slice[slice.length - 1].id : null
      res.json({ records, nextCursor, hasMore })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      res.status(500).json({ error: String(e?.message || e) })
    }
  })

// =============== Sprint 4: Self-service portal + Monitoring ==================

export const userPortalSummary = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    try {
      const authn = await verifyAuth(req)
      const db = admin.firestore()
      const profile = await db.collection('students').doc(authn.uid).get()
      const delReq = await db.collection('delete_requests').doc(authn.uid).get()
      res.json({
        consentVersionAccepted: profile.data()?.consentVersionAccepted || null,
        allowGamification: profile.data()?.allowGamification !== false,
        deleteRequest: delReq.exists ? delReq.data() : null,
      })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      res.status(500).json({ error: String(e?.message || e) })
    }
  })

// Simple anomaly scanner for sudden XP spikes (hourly)
export const monitorAnomalies = functions
  .region('asia-southeast1')
  .pubsub.schedule('0 * * * *') // hourly
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore()
    const since = Date.now() - 60 * 60 * 1000
    // naive: check submissions updated within last hour and aggregate count per user
    const snap = await db
      .collection('submissions')
      .where('submittedAt', '>=', new Date(since))
      .limit(500)
      .get()
      .catch(() => null)
    if (!snap) return null
    const countMap = new Map()
    snap.forEach((d) => {
      const s = d.data() || {}
      const u = s.studentId_ref || 'unknown'
      countMap.set(u, (countMap.get(u) || 0) + 1)
    })
    const suspicious = Array.from(countMap.entries()).filter(([_, c]) => c > 50) // >50 submissions/hour
    if (suspicious.length) {
      await logAudit(db, { actor: 'system', action: 'anomaly_detected', suspicious })
    }
    return null
  })

// Scheduled purge of old audit logs (runs daily at 22:00 UTC)
export const purgeOldAuditLogs = functions
  .region('asia-southeast1')
  .pubsub.schedule('0 22 * * *')
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore()
    const cutoff = Date.now() - RETENTION.AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
    const snap = await db
      .collection('audit_logs')
      .where('ts', '<', new Date(cutoff))
      .limit(500)
      .get()
      .catch(() => null)
    if (!snap || snap.empty) return null
    let deleted = 0
    for (const d of snap.docs) {
      await d.ref.delete().catch(() => null)
      deleted++
    }
    await logAudit(db, { actor: 'system', action: 'purge_audit_logs', deleted })
    return null
  })

// ================= Admin Management Endpoints =================

// List current admins (limited to 200)
export const listAdmins = functions.region('asia-southeast1').https.onRequest(async (req, res) => {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
  try {
    const { uid } = await verifyAuth(req)
    await assertIsAdmin(uid)
    const db = admin.firestore()
    const snap = await db.collection('admins').limit(200).get()
    const admins = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    res.json({ admins })
  } catch (e) {
    if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
    return sendHttpsError(res, new functions.https.HttpsError('internal', e?.message || 'err'))
  }
})

// Add a new admin by email (idempotent). Requires existing user account.
export const addAdmin = functions.region('asia-southeast1').https.onRequest(async (req, res) => {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
  try {
    const actor = await verifyAuth(req)
    await assertIsAdmin(actor.uid)
    const { email } = req.body || {}
    if (!email || typeof email !== 'string')
      throw new functions.https.HttpsError('invalid-argument', 'Missing email')
    const norm = email.trim().toLowerCase()
    const user = await admin.auth().getUserByEmail(norm)
    const uid = user.uid
    const db = admin.firestore()
    const aRef = db.collection('admins').doc(uid)
    const tRef = db.collection('teachers').doc(uid)
    const snap = await aRef.get()
    if (!snap.exists) {
      await aRef.set({ email: norm, createdAt: admin.firestore.FieldValue.serverTimestamp() })
    }
    await tRef.set(
      { email: norm, isAdmin: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    )
    const claims = user.customClaims || {}
    if (!claims.admin) {
      await admin.auth().setCustomUserClaims(uid, { ...claims, admin: true })
    }
    await logAudit(db, { actor: actor.uid, action: 'add_admin', targetUid: uid })
    res.json({ ok: true, uid })
  } catch (e) {
    if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
    return sendHttpsError(res, new functions.https.HttpsError('internal', e?.message || 'err'))
  }
})

// Remove admin (retains teacher role if any). Cannot remove self safeguard.
export const removeAdmin = functions.region('asia-southeast1').https.onRequest(async (req, res) => {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
  try {
    const actor = await verifyAuth(req)
    await assertIsAdmin(actor.uid)
    const { uid } = req.body || {}
    if (!uid || typeof uid !== 'string')
      throw new functions.https.HttpsError('invalid-argument', 'Missing uid')
    if (uid === actor.uid)
      throw new functions.https.HttpsError('failed-precondition', 'Cannot remove self')
    const db = admin.firestore()
    await db
      .collection('admins')
      .doc(uid)
      .delete()
      .catch(() => null)
    // Keep teacher doc but flip isAdmin flag
    await db
      .collection('teachers')
      .doc(uid)
      .set(
        { isAdmin: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      )
    // Remove custom claim (merge other claims)
    const user = await admin
      .auth()
      .getUser(uid)
      .catch(() => null)
    if (user) {
      const claims = user.customClaims || {}
      if (claims.admin) {
        delete claims.admin
        await admin.auth().setCustomUserClaims(uid, { ...claims })
      }
    }
    await logAudit(db, { actor: actor.uid, action: 'remove_admin', targetUid: uid })
    res.json({ ok: true })
  } catch (e) {
    if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
    return sendHttpsError(res, new functions.https.HttpsError('internal', e?.message || 'err'))
  }
})

// List deletion requests for review
export const listDeleteRequests = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    try {
      const { uid } = await verifyAuth(req)
      await assertIsAdmin(uid)
      const db = admin.firestore()
      const { status = 'pending', pageSize = 50, startAfter } = req.body || {}
      const size = Math.max(1, Math.min(100, Number(pageSize) || 50))
      let col = db
        .collection('delete_requests')
        .where('status', '==', status)
        .orderBy('requestedAt', 'desc')
        .limit(size + 1)
      if (startAfter) {
        try {
          const cur = await db.collection('delete_requests').doc(String(startAfter)).get()
          if (cur.exists) col = col.startAfter(cur)
        } catch (_) {}
      }
      let qs
      try {
        qs = await col.get()
      } catch (e) {
        // Fallback without orderBy
        qs = await db
          .collection('delete_requests')
          .where('status', '==', status)
          .limit(size + 1)
          .get()
      }
      const docs = qs.docs
      const hasMore = docs.length > size
      const slice = hasMore ? docs.slice(0, size) : docs
      const requests = slice.map((d) => ({ id: d.id, ...d.data() }))
      // Best-effort enrichment with student name
      try {
        const snaps = await Promise.all(
          requests.map((r) =>
            db
              .collection('students')
              .doc(r.id)
              .get()
              .catch(() => null),
          ),
        )
        snaps.forEach((s, i) => {
          if (!s?.exists) return
          const sd = s.data() || {}
          const first = sd.firstName || sd.firstname || ''
          const last = sd.lastName || sd.lastname || ''
          const composite = sd.name || [first, last].filter(Boolean).join(' ').trim()
          if (composite) {
            requests[i].studentName = composite
            requests[i].firstName = first
            requests[i].lastName = last
          }
        })
      } catch (_) {}
      const nextCursor = hasMore ? slice[slice.length - 1].id : null
      res.json({ requests, nextCursor, hasMore })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      return sendHttpsError(res, new functions.https.HttpsError('internal', e?.message || 'err'))
    }
  })

// Approve or reject delete request (transition status)
export const actOnDeleteRequest = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    try {
      const actor = await verifyAuth(req)
      await assertIsAdmin(actor.uid)
      const { uid, action } = req.body || {}
      if (!uid || !action)
        throw new functions.https.HttpsError('invalid-argument', 'Missing parameters')
      if (!['approve', 'reject', 'force-soft-delete'].includes(action))
        throw new functions.https.HttpsError('invalid-argument', 'Invalid action')
      const db = admin.firestore()
      const ref = db.collection('delete_requests').doc(uid)
      const snap = await ref.get()
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Request not found')
      const cur = snap.data().status
      if (action === 'force-soft-delete') {
        if (cur !== 'pending')
          throw new functions.https.HttpsError('failed-precondition', 'Not pending')
        // Immediate soft delete (admin override) — bypass grace period
        await ref.update({
          status: 'soft-deleted',
          softDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
          forceSoftDeletedBy: actor.uid,
          forceSoftDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        // Mark student profile
        try {
          await db
            .collection('students')
            .doc(uid)
            .set(
              { softDeleted: true, softDeletedAt: admin.firestore.FieldValue.serverTimestamp() },
              { merge: true },
            )
        } catch (_) {}
      } else {
        if (cur !== 'pending')
          throw new functions.https.HttpsError('failed-precondition', 'Already acted')
        if (action === 'approve') {
          // PDPA Workflow (Explanation):
          // 1. เมื่อผู้ใช้กดขอลบ -> status = pending (ยังใช้งานได้)
          // 2. แอดมินกด Approve -> ยืนยันสิทธิ์ จะยังคง status = pending แต่มี approvedBy / approvedAt
          //    (ช่วง Grace Period ให้ผู้ใช้ยกเลิกได้หรือใช้เพื่อระบุประวัติการยืนยัน)
          // 3. ถึงกำหนด hardDeleteAfter (cron scheduledSoftDelete) ระบบจะเปลี่ยนเป็น soft-deleted และปักธง softDeleted=true ใน students
          // 4. Cron อีกตัว (scheduledHardPurge) จะลบถาวร (purged) ภายหลัง (เช่น รายสัปดาห์)
          // เพื่อความชัดเจนแสดง approvedBy แต่ยังไม่ soft delete ทันที (กลับไปใช้กระบวนการตามระเบียบ)
          await ref.update({
            status: 'pending',
            approvedBy: actor.uid,
            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        } else if (action === 'reject') {
          await ref.update({
            status: 'rejected',
            rejectedBy: actor.uid,
            rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        }
      }
      await logAudit(db, { actor: actor.uid, action: `delete_request_${action}`, targetUid: uid })
      res.json({ ok: true })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      return sendHttpsError(res, new functions.https.HttpsError('internal', e?.message || 'err'))
    }
  })

// List audit logs (admin). Supports filtering by action prefix and date range.
export const listAuditLogs = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    try {
      const { uid } = await verifyAuth(req)
      await assertIsAdmin(uid)
      const { actionContains = '', since, until, pageSize = 100, startAfter } = req.body || {}
      const size = Math.max(1, Math.min(300, Number(pageSize) || 100))
      const db = admin.firestore()
      let col = db.collection('audit_logs')
      const sinceDate = since ? new Date(Number(since)) : null
      const untilDate = until ? new Date(Number(until)) : null
      if (sinceDate) col = col.where('ts', '>=', sinceDate)
      if (untilDate) col = col.where('ts', '<=', untilDate)
      col = col.orderBy('ts', 'desc').limit(size + 1)
      if (startAfter) {
        try {
          const cur = await db.collection('audit_logs').doc(String(startAfter)).get()
          if (cur.exists) col = col.startAfter(cur)
        } catch (_) {}
      }
      const qs = await col.get()
      const out = []
      for (const d of qs.docs) {
        const data = d.data() || {}
        if (actionContains && !(data.action || '').includes(actionContains)) continue
        out.push({ id: d.id, ...data })
        if (out.length === size) break
      }
      const hasMore = qs.docs.length > out.length
      const nextCursor = hasMore && out.length ? out[out.length - 1].id : null
      res.json({ logs: out, hasMore, nextCursor })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      return sendHttpsError(res, new functions.https.HttpsError('internal', e?.message || 'err'))
    }
  })

// Per-user export status summary (admin view) - lightweight aggregate
export const userExportsSummary = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    try {
      const { uid } = await verifyAuth(req)
      await assertIsAdmin(uid)
      const { targetUid } = req.body || {}
      if (!targetUid || typeof targetUid !== 'string')
        throw new functions.https.HttpsError('invalid-argument', 'Missing targetUid')
      const db = admin.firestore()
      const qs = await db
        .collection('audit_logs')
        .where('actor', '==', targetUid)
        .where('action', '==', 'export_user_data')
        .orderBy('ts', 'desc')
        .limit(5)
        .get()
        .catch(() => null)
      const exports = []
      qs?.docs?.forEach((d) => exports.push({ id: d.id, ts: d.data().ts, size: d.data().size }))
      const last = exports[0] || null
      res.json({ last, recent: exports })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      return sendHttpsError(res, new functions.https.HttpsError('internal', e?.message || 'err'))
    }
  })

// Deletion funnel aggregate counts by status (admin)
export const deletionFunnelSummary = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    try {
      const { uid } = await verifyAuth(req)
      await assertIsAdmin(uid)
      const db = admin.firestore()
      const statuses = ['pending', 'soft-deleted', 'purged', 'rejected']
      const counts = {}
      await Promise.all(
        statuses.map(async (s) => {
          try {
            const snap = await db
              .collection('delete_requests')
              .where('status', '==', s)
              .limit(1000)
              .get()
            counts[s] = snap.size
            if (s === 'pending') {
              let approved = 0
              snap.forEach((d) => {
                if (d.data()?.approvedBy) approved++
              })
              counts.pending_approved = approved
              counts.pending_unapproved = snap.size - approved
            }
          } catch (_) {
            counts[s] = 0
          }
        }),
      )
      res.json({ counts })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      return sendHttpsError(res, new functions.https.HttpsError('internal', e?.message || 'err'))
    }
  })

// Teacher Research Report Aggregation (server-side) to reduce client reads
export const researchReportAgg = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
    try {
      const { uid, role } = await verifyAuth(req, { requireRole: 'teacher' })
      const { courseId, days = 30, showRealNames = false } = req.body || {}
      if (!courseId || typeof courseId !== 'string')
        throw new functions.https.HttpsError('invalid-argument', 'Missing courseId')
      const db = admin.firestore()
      // Verify teacher owns the course
      const cSnap = await db.collection('courses').doc(courseId).get()
      if (!cSnap.exists || cSnap.data().teacherId !== uid)
        throw new functions.https.HttpsError('permission-denied', 'Not course owner')

      const cutoffMs = days > 0 ? Date.now() - days * 86400000 : 0

      // Progressive fetch: submissions collection may grow large; we page by 500
      const subsCol = db.collection('submissions').where('courseId_ref', '==', courseId)
      const submissions = []
      let last = null
      let loops = 0
      while (true) {
        let q = subsCol.orderBy('submittedAt', 'desc').limit(500)
        if (last) q = q.startAfter(last)
        const snap = await q.get()
        if (snap.empty) break
        for (const d of snap.docs) submissions.push(d.data())
        last = snap.docs[snap.docs.length - 1]
        loops++
        if (snap.size < 500 || loops > 20) break // Hard stop ~10k to cap cost
      }

      // Student roster
      const studentsSnap = await db
        .collection('students')
        .where('enrolledCourses', 'array-contains', courseId)
        .get()
      const students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

      // Aggregation logic (mirrors client version + extra metrics)
      function extractScore(sub) {
        if (typeof sub.score === 'number') return sub.score
        if (typeof sub.scoreSummary === 'number') return sub.scoreSummary
        if (sub.feedback?.rubric_scores) {
          const weight = { ดีเยี่ยม: 4, ดี: 3, พอใช้: 2, ต้องปรับปรุง: 1 }
          const vals = Object.values(sub.feedback.rubric_scores || {})
          if (vals.length) {
            const sum = vals.reduce((a, v) => a + (weight[v] || 0), 0)
            return Math.round((sum / (vals.length * 4)) * 100)
          }
        }
        return null
      }
      function basicStats(numbers) {
        const arr = numbers.filter((n) => typeof n === 'number' && !isNaN(n))
        if (!arr.length) return { avg: null, median: null, stdDev: null, min: null, max: null }
        const sum = arr.reduce((a, b) => a + b, 0)
        const avg = sum / arr.length
        const sorted = [...arr].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
        const variance = arr.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / arr.length
        const stdDev = Math.sqrt(variance)
        return { avg, median, stdDev, min: sorted[0], max: sorted[sorted.length - 1] }
      }
      function formatDate(ts) {
        return new Date(ts).toISOString().slice(0, 10)
      }
      function computeProgressRate(points, windowDays = 3) {
        if (!points.length) return null
        const byDate = new Map()
        points.forEach((p) => {
          if (typeof p.score !== 'number') return
          const k = formatDate(p.ts)
          ;(byDate.get(k) || byDate.set(k, []).get(k)).push(p.score)
        })
        const dates = Array.from(byDate.keys()).sort()
        if (dates.length < windowDays * 2) return null
        const tail = dates.slice(-windowDays)
        const prev = dates.slice(-(windowDays * 2), -windowDays)
        const mean = (ds) => {
          const all = ds.flatMap((d) => byDate.get(d) || [])
          return all.length ? all.reduce((a, b) => a + b, 0) / all.length : null
        }
        const recentMean = mean(tail)
        const prevMean = mean(prev)
        if (recentMean == null || prevMean == null || prevMean === 0) return null
        return ((recentMean - prevMean) / prevMean) * 100
      }

      const scopedSubs = submissions.filter((s) => {
        const ts = s.submittedAt?.toMillis?.() || s.updatedAt?.toMillis?.() || 0
        return !cutoffMs || ts >= cutoffMs
      })
      const points = []
      const distribution = []
      const byStudent = new Map()
      for (const s of scopedSubs) {
        const ts = s.submittedAt?.toMillis?.() || s.updatedAt?.toMillis?.() || 0
        const score = extractScore(s)
        const uidStu = s.studentId_ref || s.studentId
        if (score != null) {
          points.push({ ts, score, uid: uidStu })
          distribution.push(score)
        }
        if (!uidStu) continue
        const rec = byStudent.get(uidStu) || {
          submissions: 0,
          scores: [],
          lastActiveAt: 0,
          timestamps: [],
        }
        rec.submissions++
        rec.timestamps.push(ts)
        if (score != null) rec.scores.push(score)
        if (ts > rec.lastActiveAt) rec.lastActiveAt = ts
        byStudent.set(uidStu, rec)
      }

      const stat = basicStats(distribution)
      const progressRate = computeProgressRate(points)
      const participationNumerator = Array.from(byStudent.values()).filter(
        (r) => r.submissions > 0,
      ).length
      const participationRate = students.length
        ? (participationNumerator / students.length) * 100
        : null
      const gaps = []
      for (const rec of byStudent.values()) {
        const tsList = rec.timestamps.sort((a, b) => a - b)
        if (tsList.length < 2) continue
        let sumGap = 0
        let cnt = 0
        for (let i = 1; i < tsList.length; i++) {
          const d = (tsList[i] - tsList[i - 1]) / 86400000
          if (d >= 0) {
            sumGap += d
            cnt++
          }
        }
        if (cnt) gaps.push(sumGap / cnt)
      }
      const activityGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null
      const sortedScores = [...distribution].sort((a, b) => a - b)
      function percentile(p) {
        if (!sortedScores.length) return null
        const idx = (p / 100) * (sortedScores.length - 1)
        const lo = Math.floor(idx)
        const hi = Math.ceil(idx)
        if (lo === hi) return sortedScores[lo]
        const ratio = idx - lo
        return sortedScores[lo] * (1 - ratio) + sortedScores[hi] * ratio
      }
      const p10 = percentile(10)
      const p90 = percentile(90)
      const trendMap = new Map()
      points.forEach((p) => {
        const d = formatDate(p.ts)
        const list = trendMap.get(d) || []
        list.push(p.score)
        trendMap.set(d, list)
      })
      const trend = Array.from(trendMap.entries())
        .map(([date, list]) => ({ date, avgScore: list.reduce((a, b) => a + b, 0) / list.length }))
        .sort((a, b) => (a.date < b.date ? -1 : 1))

      const outStudents = []
      // Only admins may reveal real names regardless of inbound flag
      let allowNames = false
      try {
        await assertIsAdmin(uid)
        allowNames = true
      } catch (_) {
        allowNames = false
      }
      for (const stu of students) {
        const rec = byStudent.get(stu.id) || { scores: [], submissions: 0, lastActiveAt: 0 }
        const sStat = basicStats(rec.scores)
        outStudents.push({
          studentId: stu.id,
          studentCode:
            allowNames && showRealNames && stu.name
              ? stu.name
              : stu.studentCode || (stu.id || '').slice(0, 4) + '***',
          avgScore: sStat.avg,
          submissions: rec.submissions,
          lastActiveAt: rec.lastActiveAt || null,
        })
      }
      outStudents.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1))
      res.json({
        courseId,
        days,
        totalStudents: students.length,
        totalSubmissions: scopedSubs.length,
        avgScore: stat.avg,
        medianScore: stat.median,
        stdDev: stat.stdDev,
        minScore: stat.min,
        maxScore: stat.max,
        progressRate,
        participationRate,
        activityGap,
        p10,
        p90,
        distribution,
        trend,
        students: outStudents,
        generatedAt: Date.now(),
        source: 'server',
      })
    } catch (e) {
      if (e instanceof functions.https.HttpsError) return sendHttpsError(res, e)
      return sendHttpsError(res, new functions.https.HttpsError('internal', e?.message || 'err'))
    }
  })
