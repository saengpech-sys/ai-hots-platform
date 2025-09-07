// Teacher Research Report Service
// Aggregates student & submission data for analytics (client-side for now)
// NOTE: For large data sets consider moving heavy aggregation to a Cloud Function.

import {
  getTeacherCourses,
  getSubmissionsByCourse,
  getStudentsByEnrolledCourse,
  getStudentProfile,
} from '@/services/firestoreService'
import { getAuthInstance, getFirestoreInstance } from '@/firebase/config'
import {
  collection,
  query,
  where,
  orderBy,
  limit as qLimit,
  startAfter,
  getDocs,
} from 'firebase/firestore'
// Removed axios dependency; using native fetch for optional server aggregation.

// Derive numeric score from a submission record
function extractScore(sub) {
  if (typeof sub.score === 'number') return sub.score
  if (typeof sub.scoreSummary === 'number') return sub.scoreSummary
  if (sub.feedback?.rubric_scores) {
    const weight = {
      '\u0e14\u0e35\u0e40\u0e22\u0e35\u0e48\u0e22\u0e21': 4,
      '\u0e14\u0e35': 3,
      '\u0e1e\u0e2d\u0e43\u0e0a\u0e49': 2,
      '\u0e15\u0e49\u0e2d\u0e07\u0e1b\u0e23\u0e31\u0e1a\u0e1b\u0e23\u0e38\u0e07': 1,
    }
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
  const d = new Date(ts)
  return d.toISOString().slice(0, 10)
}

/**
 * Compute progress rate = percentage change between mean of recent window and previous window.
 * @param {Array<{ts:number, score:number}>} timeline sorted asc
 */
function computeProgressRate(points, windowDays = 3) {
  if (!points.length) return null
  const byDate = new Map()
  points.forEach((p) => {
    if (typeof p.score !== 'number') return
    const k = formatDate(p.ts)
    const prev = byDate.get(k) || []
    prev.push(p.score)
    byDate.set(k, prev)
  })
  const dates = Array.from(byDate.keys()).sort()
  if (dates.length < windowDays * 2) return null
  const tail = dates.slice(-windowDays)
  const prev = dates.slice(-(windowDays * 2), -windowDays)
  const mean = (ds) => {
    const all = ds.flatMap((d) => byDate.get(d) || [])
    if (!all.length) return null
    return all.reduce((a, b) => a + b, 0) / all.length
  }
  const recentMean = mean(tail)
  const prevMean = mean(prev)
  if (recentMean == null || prevMean == null || prevMean === 0) return null
  return ((recentMean - prevMean) / prevMean) * 100
}

/**
 * Fetch list of courses for current teacher
 */
export async function listTeacherCourses() {
  const auth = await getAuthInstance()
  if (!auth.currentUser) throw new Error('ต้องล็อกอิน')
  return await getTeacherCourses(auth.currentUser.uid)
}

// -------------------- Client-side cache (TTL 60s per key) --------------------
const _cache = new Map()
const CACHE_MS = 60_000
function getCache(key) {
  const hit = _cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.t > CACHE_MS) {
    _cache.delete(key)
    return null
  }
  return hit.v
}
function setCache(key, value) {
  _cache.set(key, { v: value, t: Date.now() })
}

// -------------------- Optional server aggregation (future) --------------------
async function tryServerAggregation(courseId, days, opts = {}) {
  if (!opts.useServer) return null
  try {
    const auth = await getAuthInstance()
    const token = await auth.currentUser?.getIdToken?.()
    if (!token) return null
    const url = `${import.meta.env.VITE_API_BASE || ''}/researchReportAgg`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ courseId, days }),
    })
    if (!resp.ok) return null
    const data = await resp.json().catch(() => null)
    if (data && typeof data === 'object') return data
  } catch (_) {
    // Silent fallback to client aggregation
  }
  return null
}

/**
 * Fetch aggregated analytics for a teacher.
 * @param {object} filters
 *  - courseId: string (required currently)
 *  - days: number (limit timeframe; 0 = all)
 */
export async function fetchTeacherResearchReport(filters = {}) {
  const {
    courseId,
    days = 30,
    useServer = false,
    showRealNames = false,
    progressive = true,
    pageSize = 400,
    onProgress = () => {},
  } = filters
  if (!courseId) throw new Error('ต้องเลือกวิชา (courseId)')

  // Enforce admin-only reveal of real names (teachers may still see codes)
  let allowNames = false
  const auth = await getAuthInstance()
  if (auth.currentUser) {
    try {
      const tokenRes = await auth.currentUser.getIdTokenResult()
      allowNames = !!tokenRes.claims?.admin
    } catch (_) {
      allowNames = false
    }
  }
  const effectiveShowRealNames = showRealNames && allowNames

  const cacheKey = JSON.stringify({ v: 3, courseId, days, showRealNames: effectiveShowRealNames })
  const cached = getCache(cacheKey)
  if (cached) return cached

  // Try server aggregation first (if enabled) else fallback to client
  const serverData = await tryServerAggregation(courseId, days, { useServer })
  if (serverData) {
    // Server should enforce anonymization; double check before caching
    if (!effectiveShowRealNames) {
      // Ensure no accidental names leaked
      if (Array.isArray(serverData.students)) {
        serverData.students = serverData.students.map((s) => ({
          ...s,
          studentCode: maskIfNeeded(s.studentCode),
        }))
      }
    }
    setCache(cacheKey, serverData)
    return serverData
  }
  const students = await getStudentsByEnrolledCourse(courseId)
  let subs = []
  if (progressive) {
    subs = await progressiveFetchSubmissions(courseId, { pageSize, onProgress, days })
  } else {
    subs = await getSubmissionsByCourse(courseId)
    onProgress({ loaded: subs.length, complete: true })
  }

  const cutoffMs = days > 0 ? Date.now() - days * 86400000 : 0
  const scopedSubs = subs.filter((s) => {
    const ts = s.submittedAt?.toMillis?.() || s.updatedAt?.toMillis?.() || 0
    return !cutoffMs || ts >= cutoffMs
  })

  const points = []
  const distribution = []
  const byStudent = new Map()
  for (const s of scopedSubs) {
    const ts = s.submittedAt?.toMillis?.() || s.updatedAt?.toMillis?.() || 0
    const score = extractScore(s)
    if (score != null) {
      points.push({ ts, score, uid: s.studentId_ref || s.studentId })
      distribution.push(score)
    }
    const uid = s.studentId_ref || s.studentId
    if (!uid) continue
    const rec = byStudent.get(uid) || {
      studentId: uid,
      scores: [],
      submissions: 0,
      lastActiveAt: 0,
      timestamps: [],
    }
    rec.submissions += 1
    rec.timestamps.push(ts)
    if (score != null) rec.scores.push(score)
    if (ts > rec.lastActiveAt) rec.lastActiveAt = ts
    byStudent.set(uid, rec)
  }

  // Metrics
  const stat = basicStats(distribution)
  const progressRate = computeProgressRate(points)
  const participationNumerator = Array.from(byStudent.values()).filter(
    (r) => r.submissions > 0,
  ).length
  const participationRate = students.length
    ? (participationNumerator / students.length) * 100
    : null
  // Activity gap (average days between submissions per student, then mean)
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

  // Deciles
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

  // Student summaries
  const studentSummaries = []
  for (const stu of students) {
    const rec = byStudent.get(stu.id) || {
      scores: [],
      submissions: 0,
      lastActiveAt: 0,
      timestamps: [],
    }
    const sStat = basicStats(rec.scores)
    studentSummaries.push({
      studentId: stu.id,
      studentCode:
        effectiveShowRealNames && stu.name ? stu.name : stu.studentCode || maskId(stu.id),
      avgScore: sStat.avg,
      submissions: rec.submissions,
      lastActiveAt: rec.lastActiveAt || null,
    })
  }
  studentSummaries.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1))

  const trendMap = new Map()
  points.forEach((p) => {
    const d = formatDate(p.ts)
    const prev = trendMap.get(d) || []
    prev.push(p.score)
    trendMap.set(d, prev)
  })
  const trend = Array.from(trendMap.entries())
    .map(([date, list]) => ({ date, avgScore: list.reduce((a, b) => a + b, 0) / list.length }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const result = {
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
    students: studentSummaries,
    generatedAt: Date.now(),
  }
  setCache(cacheKey, result)
  return result
}

function maskId(id) {
  if (!id) return 'NA'
  return id.slice(0, 4) + '***'
}

/**
 * Enrich a single student's detailed profile & timeline (optional expansion API)
 */
export async function fetchStudentDetail(studentId, courseId, days = 30) {
  const profile = await getStudentProfile(studentId).catch(() => null)
  const allSubs = await getSubmissionsByCourse(courseId)
  const cutoffMs = days > 0 ? Date.now() - days * 86400000 : 0
  const subs = allSubs.filter((s) => {
    if ((s.studentId_ref || s.studentId) !== studentId) return false
    const ts = s.submittedAt?.toMillis?.() || s.updatedAt?.toMillis?.() || 0
    return !cutoffMs || ts >= cutoffMs
  })
  const series = subs
    .map((s) => {
      const ts = s.submittedAt?.toMillis?.() || s.updatedAt?.toMillis?.() || 0
      return { ts, score: extractScore(s) }
    })
    .filter((p) => p.score != null)
    .sort((a, b) => a.ts - b.ts)
  const stat = basicStats(series.map((p) => p.score))
  return { profile, stat, series }
}

// ---------------- Progressive Firestore pagination ----------------
async function progressiveFetchSubmissions(
  courseId,
  { pageSize = 400, onProgress = () => {}, days },
) {
  const db = await getFirestoreInstance()
  const cutoffMs = days > 0 ? Date.now() - days * 86400000 : 0
  const items = []
  let lastDoc = null
  let page = 0
  let consecutiveErrors = 0
  while (true) {
    let q = query(
      collection(db, 'submissions'),
      where('courseId_ref', '==', courseId),
      orderBy('submittedAt', 'desc'),
      qLimit(pageSize),
    )
    if (lastDoc) q = query(q, startAfter(lastDoc))
    let snap
    try {
      snap = await getDocs(q)
      consecutiveErrors = 0
    } catch (e) {
      consecutiveErrors++
      if (consecutiveErrors <= 2) {
        // brief backoff
        await new Promise((r) => setTimeout(r, 200 * consecutiveErrors))
        continue // retry same page
      } else {
        onProgress({ loaded: items.length, page, complete: true, error: e.message, partial: true })
        return items // return partial
      }
    }
    if (snap.empty) break
    const pageItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    for (const it of pageItems) {
      const ts = it.submittedAt?.toMillis?.() || it.updatedAt?.toMillis?.() || 0
      if (!cutoffMs || ts >= cutoffMs) items.push(it)
      else {
        // Because ordered desc by submittedAt: once we hit below cutoff we can stop entire loop
        onProgress({ loaded: items.length, page, complete: true })
        return items
      }
    }
    lastDoc = snap.docs[snap.docs.length - 1]
    page++
    onProgress({ loaded: items.length, page, complete: false })
    if (pageItems.length < pageSize) break // no more
    // Safety cap to avoid runaway loop
    if (page > 50) break
  }
  onProgress({ loaded: items.length, page, complete: true })
  return items
}

function maskIfNeeded(val) {
  if (!val) return val
  // if already masked or looks like code keep unchanged
  if (val.includes('***')) return val
  if (/^[A-Za-z0-9_-]{4,}$/.test(val)) return val
  return '****'
}
