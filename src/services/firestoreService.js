import { getFirestoreInstance, getAuthInstance, getStorageInstance } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  updateDoc,
  increment,
  arrayUnion,
  deleteDoc,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore'
import { ref as sRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'

// Lazy singleton holders so legacy code using global "auth" / "db" keeps working after async init.
let db // Firestore instance populated lazily
let auth // Auth instance populated lazily

async function ensureCore() {
  if (!auth) auth = await getAuthInstance()
  if (!db) db = await getFirestoreInstance()
  return { auth, db }
}

// Kick off (non-blocking) early init to reduce first-op latency (ignore failure; will retry on demand)
ensureCore().catch(() => {})

// Wait for Firebase Auth to be ready (used before privileged operations)
async function ensureAuthReady(timeoutMs = 4000) {
  await ensureCore()
  if (auth.currentUser) return auth.currentUser
  return new Promise((resolve) => {
    const t = setTimeout(
      () => {
        off && off()
        resolve(auth.currentUser || null)
      },
      Math.max(500, timeoutMs),
    )
    const off = onAuthStateChanged(auth, (u) => {
      clearTimeout(t)
      off && off()
      resolve(u || null)
    })
  })
}

// ------------------ Lightweight client-side caches (TTL) ------------------
const _docCache = new Map()
const CACHE_TTL_MS = 30 * 1000 // 30s

function cacheGet(key) {
  const hit = _docCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.t > (hit.ttl ?? CACHE_TTL_MS)) {
    _docCache.delete(key)
    return null
  }
  return hit.v
}
function cacheSet(key, value, ttl = CACHE_TTL_MS) {
  _docCache.set(key, { v: value, t: Date.now(), ttl })
}

/**
 * บันทึกสถานการณ์ใหม่ลงในคลัง
 * @param {object} scenarioData - ข้อมูลสถานการณ์ที่ได้จาก AI
 * @returns {Promise<string>} - ID ของเอกสารที่สร้างขึ้นใหม่
 */
export async function saveScenario(scenarioData) {
  // Avoid writes when unauthenticated to prevent 400/permission noise; caller treats as best-effort
  await ensureAuthReady().catch(() => null)
  if (!auth.currentUser) throw new Error('Missing or insufficient permissions')
  const scenarioRef = await addDoc(collection(db, 'scenarios'), {
    studentId_ref: auth.currentUser?.uid || null,
    ...scenarioData,
    createdAt: serverTimestamp(),
  })
  return scenarioRef.id
}

/**
 * บันทึกภารกิจและเกณฑ์การประเมิน
 * @param {object} assessmentData - ข้อมูลภารกิจที่ได้จาก AI
 * @param {string} scenarioId - ID ของสถานการณ์ที่เกี่ยวข้อง
 * @returns {Promise<string>} - ID ของเอกสารที่สร้างขึ้นใหม่
 */
export async function saveAssessment(assessmentData, scenarioId) {
  await ensureAuthReady().catch(() => null)
  if (!auth.currentUser) throw new Error('Missing or insufficient permissions')
  const assessmentRef = await addDoc(collection(db, 'assessments'), {
    scenarioId_ref: scenarioId,
    ...assessmentData,
    createdAt: serverTimestamp(),
  })
  return assessmentRef.id
}

/**
 * ดึงภารกิจ (assessment) จาก scenarioId
 * @param {string} scenarioId
 * @returns {Promise<object|null>}
 */
export async function getAssessmentByScenarioId(scenarioId) {
  const ck = `assessByScenario:${scenarioId}`
  const cached = cacheGet(ck)
  if (cached) return cached
  let snap
  try {
    snap = await getDocs(
      query(
        collection(db, 'assessments'),
        where('scenarioId_ref', '==', scenarioId),
        orderBy('createdAt', 'desc'),
        limit(1),
      ),
    )
  } catch (_) {
    snap = await getDocs(
      query(collection(db, 'assessments'), where('scenarioId_ref', '==', scenarioId)),
    )
  }
  if (snap.empty) return null
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  // sort by createdAt desc client-side (fallback)
  items.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0
    const tb = b.createdAt?.toMillis?.() ?? 0
    return tb - ta
  })
  const res = items[0]
  if (res) cacheSet(ck, res)
  return res
}

/**
 * ดึง scenario ตาม id
 */
export async function getScenarioById(id) {
  try {
    const sref = doc(db, 'scenarios', id)
    const snap = await getDoc(sref)
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() }
  } catch (_) {
    return null
  }
}

/**
 * ดึง assessment ตาม id
 */
export async function getAssessmentById(id) {
  const ck = `assessment:${id}`
  const cached = cacheGet(ck)
  if (cached) return cached
  try {
    const aref = doc(db, 'assessments', id)
    const snap = await getDoc(aref)
    if (!snap.exists()) return null
    const res = { id: snap.id, ...snap.data() }
    cacheSet(ck, res)
    return res
  } catch (_) {
    return null
  }
}

/**
 * สร้างและบันทึกผลงาน (Submission) ของนักเรียน
 * @param {object} submissionData - ข้อมูลผลงานทั้งหมด
 * @returns {Promise<string>} - ID ของเอกสารที่สร้างขึ้นใหม่
 */

export async function createSubmission(submissionData) {
  await ensureAuthReady().catch(() => null)
  if (!auth.currentUser) throw new Error('Missing or insufficient permissions')
  // Tiny jitter to avoid bursty channel errors on flaky networks
  await new Promise((r) => setTimeout(r, 10))
  const submissionRef = await addDoc(collection(db, 'submissions'), {
    studentId_ref: auth.currentUser.uid,
    ...submissionData,
    submittedAt: serverTimestamp(),
  })
  return submissionRef.id
}

/**
 * ดึงข้อมูลโปรไฟล์ของนักเรียน
 * @param {string} studentId - ID ของนักเรียน
 * @returns {Promise<object|null>} - ข้อมูลโปรไฟล์ หรือ null ถ้าไม่มี
 */
export async function getStudentProfile(studentId) {
  const ck = `student:${studentId}`
  const cached = cacheGet(ck)
  if (cached) return cached
  await ensureAuthReady().catch(() => null)
  const docRef = doc(db, 'students', studentId)
  const docSnap = await getDoc(docRef)
  if (docSnap.exists()) {
    const data = docSnap.data()
    // Ensure xp exists even for older profiles
    const res = {
      role: 'student',
      enrolledCourses: [],
      xp: 0,
      level: 1,
      consentVersionAccepted: data.consentVersionAccepted || null,
      consentAcceptedAt: data.consentAcceptedAt || null,
      allowGamification: data.allowGamification !== false, // default true
      interests: [],
      learningStyle: '',
      futureGoal: '',
      ...data,
    }
    cacheSet(ck, res)
    return res
  } else {
    // ถ้ายังไม่มีโปรไฟล์ ให้สร้างโปรไฟล์เริ่มต้น
    const newProfile = {
      name: auth.currentUser.displayName || '',
      role: 'student',
      enrolledCourses: [],
      xp: 0,
      level: 1,
      consentVersionAccepted: null,
      consentAcceptedAt: null,
      allowGamification: true,
      interests: [],
      learningStyle: '',
      futureGoal: '',
      skill_profile: {
        การวิเคราะห์: 5,
        การประเมินค่า: 5,
        การสร้างสรรค์: 5,
      },
    }
    await setDoc(doc(db, 'students', studentId), newProfile)
    cacheSet(ck, newProfile)
    return newProfile
  }
}

/**
 * อัปเดตโปรไฟล์ทักษะของนักเรียน
 * @param {string} studentId - ID ของนักเรียน
 * @param {object} newSkillProfile - ออบเจ็กต์โปรไฟล์ทักษะใหม่
 */
export async function updateStudentProfile(studentId, updatedFields) {
  const studentRef = doc(db, 'students', studentId)
  // Merge arbitrary fields from the profile (e.g., name, interests, learningStyle, futureGoal, skill_profile, xp)
  await setDoc(studentRef, updatedFields, { merge: true })
  // Invalidate cache
  _docCache.delete(`student:${studentId}`)
}

// Subscribe to student profile changes (returns unsubscribe)
export function onStudentProfileSnapshot(studentId, callback) {
  const studentRef = doc(db, 'students', studentId)
  // Attach with error handler to avoid uncaught permission-denied logs
  return onSnapshot(
    studentRef,
    (snap) => {
      if (!snap.exists()) return callback(null)
      callback({ id: snap.id, ...snap.data() })
    },
    (err) => {
      const msg = String(err?.message || err || '')
      if (!msg.includes('Missing or insufficient permissions')) {
        console.warn('onStudentProfileSnapshot error:', msg)
      }
      // Best-effort: try a one-time get (may be allowed for owner-only)
      getDoc(studentRef)
        .then((s) => (s?.exists?.() ? callback({ id: s.id, ...s.data() }) : callback(null)))
        .catch(() => callback(null))
    },
  )
}

// Update student identity-specific fields
export async function updateStudentIdentity(studentId, fields) {
  const studentRef = doc(db, 'students', studentId)
  await setDoc(studentRef, { ...fields, updatedAt: serverTimestamp() }, { merge: true })
}

// Update consent (version + toggle gamification)
export async function updateStudentConsent(studentId, { version, allowGamification }) {
  const studentRef = doc(db, 'students', studentId)
  const patch = {}
  if (version) {
    patch.consentVersionAccepted = version
    patch.consentAcceptedAt = serverTimestamp()
  }
  if (typeof allowGamification === 'boolean') {
    patch.allowGamification = allowGamification
  }
  if (Object.keys(patch).length === 0) return
  await setDoc(studentRef, patch, { merge: true })
  _docCache.delete(`student:${studentId}`)
}

// Teacher profile CRUD
export async function getTeacherProfile(teacherId) {
  const tRef = doc(db, 'teachers', teacherId)
  const snap = await getDoc(tRef)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function upsertTeacherProfile(teacherId, fields) {
  const tRef = doc(db, 'teachers', teacherId)
  await setDoc(
    tRef,
    { ...fields, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true },
  )
}

// Upload file to Firebase Storage and return public URL
export async function uploadUserImage(userId, file, folder = 'avatars', onProgress) {
  if (!auth.currentUser) throw new Error('ต้องล็อกอินก่อน')
  if (!file) throw new Error('No file')
  const safeName = file.name?.replace?.(/[^a-zA-Z0-9._-]/g, '_') || 'avatar.jpg'
  const path = `${folder}/${userId}/${Date.now()}_${safeName}`
  const storage = await getStorageInstance()
  const fileRef = sRef(storage, path)
  const metadata = file?.type
    ? { contentType: file.type, cacheControl: 'public,max-age=31536000,immutable' }
    : { cacheControl: 'public,max-age=31536000,immutable' }
  const task = uploadBytesResumable(fileRef, file, metadata)
  await new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        if (typeof onProgress === 'function') {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
          onProgress(pct, snap)
        }
      },
      (err) => reject(err),
      () => resolve(null),
    )
  })
  return await getDownloadURL(fileRef)
}

/**
 * เพิ่ม XP ให้กับนักเรียนแบบอะตอมมิก
 * @param {string} studentId
 * @param {number} amount - จำนวน XP ที่จะเพิ่ม (สามารถเป็นค่าลบเพื่อหักได้)
 */
export async function addXP(studentId, amount) {
  await ensureAuthReady().catch(() => null)
  if (!auth.currentUser) throw new Error('Missing or insufficient permissions')
  const studentRef = doc(db, 'students', studentId)
  await updateDoc(studentRef, { xp: increment(amount), updatedAt: serverTimestamp() })
}

// ------------------ Course System ------------------

/**
 * สร้างรายวิชาใหม่
 * @param {object} course - {title, description, subject_area, main_topic, prerequisite_knowledge}
 * @returns {Promise<string>} - courseId
 */
export async function createCourse(course) {
  if (!auth.currentUser) throw new Error('ต้องล็อกอินก่อน')
  const docRef = await addDoc(collection(db, 'courses'), {
    ...course,
    teacherId: auth.currentUser.uid,
    teacherName: auth.currentUser.displayName || auth.currentUser.email,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

/**
 * ดึงรายวิชาทั้งหมด
 * @returns {Promise<Array<{id:string} & any>>}
 */
export async function getAllCourses() {
  const q = query(collection(db, 'courses'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * ลงทะเบียนรายวิชาให้กับผู้ใช้ปัจจุบัน
 * @param {string} courseId
 */
export async function enrollInCourse(courseId) {
  if (!auth.currentUser) throw new Error('ต้องล็อกอินก่อน')
  const studentId = auth.currentUser.uid
  await ensureAuthReady().catch(() => null)
  const studentRef = doc(db, 'students', studentId)
  const snap = await getDoc(studentRef)
  if (!snap.exists()) {
    // Create base profile if missing
    await setDoc(studentRef, {
      name: auth.currentUser.displayName || '',
      role: 'student',
      enrolledCourses: [courseId],
      xp: 0,
      level: 1,
      interests: [],
      learningStyle: '',
      futureGoal: '',
      createdAt: serverTimestamp(),
    })
    return [courseId]
  }
  const data = snap.data() || {}
  const list = Array.isArray(data.enrolledCourses) ? data.enrolledCourses : []
  if (list.includes(courseId)) return list
  await setDoc(studentRef, { enrolledCourses: arrayUnion(courseId) }, { merge: true })
  return [...list, courseId]
}

/**
 * ยกเลิกรายวิชาที่ลงทะเบียนไว้สำหรับผู้ใช้ปัจจุบัน
 * @param {string} courseId
 */
export async function unenrollFromCourse(courseId) {
  if (!auth.currentUser) throw new Error('ต้องล็อกอินก่อน')
  const studentId = auth.currentUser.uid
  const studentRef = doc(db, 'students', studentId)
  const snap = await getDoc(studentRef)
  if (!snap.exists()) return []
  const data = snap.data() || {}
  const list = Array.isArray(data.enrolledCourses) ? data.enrolledCourses : []
  if (!list.includes(courseId)) return list
  const next = list.filter((id) => id !== courseId)
  await setDoc(studentRef, { enrolledCourses: next, updatedAt: serverTimestamp() }, { merge: true })
  return next
}

/**
 * ดึงรายวิชาตามรหัส
 * @param {string} courseId
 */
export async function getCourseById(courseId) {
  const ck = `course:${courseId}`
  const cached = cacheGet(ck)
  if (cached) return cached
  const refDoc = doc(db, 'courses', courseId)
  const snap = await getDoc(refDoc)
  if (!snap.exists()) return null
  const res = { id: snap.id, ...snap.data() }
  cacheSet(ck, res)
  return res
}

/**
 * ดึงรายวิชาที่นักเรียนลงทะเบียน
 * @param {string} studentId
 */
export async function getEnrolledCourses(studentId) {
  const profile = await getStudentProfile(studentId)
  await ensureAuthReady().catch(() => null)
  if (!profile?.enrolledCourses?.length) return []
  const ids = profile.enrolledCourses
  // Simple N queries; for scale, change to batched fetch with where in chunks of 10
  const results = []
  for (const id of ids) {
    const c = await getCourseById(id)
    if (c) results.push(c)
  }
  return results
}

/**
 * ดึงรายวิชาที่ครูสร้าง
 */
export async function getTeacherCourses(teacherId) {
  const q = query(collection(db, 'courses'), where('teacherId', '==', teacherId))
  const snap = await getDocs(q)
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  // Sort client-side by createdAt desc to avoid composite index requirement
  return items.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0
    const tb = b.createdAt?.toMillis?.() ?? 0
    return tb - ta
  })
}

// -------- Leaderboard helpers --------
/**
 * Compute leaderboard for a course within an optional time window.
 * Returns sorted array [{ uid, bestScore, latestAt }]
 */
export async function computeLeaderboardForCourse(courseId, options = {}) {
  const days = Number(options.days || 0)
  const sinceMs = days > 0 ? Date.now() - days * 24 * 60 * 60 * 1000 : 0
  const subs = (await getSubmissionsByCourse(courseId)) || []
  const byUser = new Map()
  for (const s of subs) {
    const uid = s.studentId_ref || s.studentId || null
    if (!uid) continue
    const ts = s.submittedAt?.toMillis?.() || s.updatedAt?.toMillis?.() || 0
    if (sinceMs && ts < sinceMs) continue
    let score = null
    if (typeof s.score === 'number') score = s.score
    else if (typeof s.scoreSummary === 'number') score = s.scoreSummary
    else if (s.feedback?.rubric_scores) {
      const weight = { ดีเยี่ยม: 4, ดี: 3, พอใช้: 2, ต้องปรับปรุง: 1 }
      const vals = Object.values(s.feedback.rubric_scores || {})
      if (vals.length) {
        const sum = vals.reduce((a, l) => a + (weight[l] || 0), 0)
        score = Math.round((sum / (vals.length * 4)) * 100)
      }
    }
    if (score == null) continue
    const prev = byUser.get(uid)
    if (!prev || score > prev.bestScore || (score === prev.bestScore && ts > prev.latestAt)) {
      byUser.set(uid, { uid, bestScore: score, latestAt: ts })
    }
  }
  const arr = Array.from(byUser.values())
  arr.sort((a, b) => b.bestScore - a.bestScore || b.latestAt - a.latestAt)
  return arr
}

/**
 * Return personal best score for a student in a course.
 */
export async function computePersonalBestForStudent(courseId, uid, options = {}) {
  const days = Number(options.days || 0)
  const sinceMs = days > 0 ? Date.now() - days * 24 * 60 * 60 * 1000 : 0
  const subs = (await getSubmissionsByCourse(courseId)) || []
  let best = null
  let bestAt = 0
  for (const s of subs) {
    const su = s.studentId_ref || s.studentId || null
    if (su !== uid) continue
    const ts = s.submittedAt?.toMillis?.() || s.updatedAt?.toMillis?.() || 0
    if (sinceMs && ts < sinceMs) continue
    let score = null
    if (typeof s.score === 'number') score = s.score
    else if (typeof s.scoreSummary === 'number') score = s.scoreSummary
    else if (s.feedback?.rubric_scores) {
      const weight = { ดีเยี่ยม: 4, ดี: 3, พอใช้: 2, ต้องปรับปรุง: 1 }
      const vals = Object.values(s.feedback.rubric_scores || {})
      if (vals.length) {
        const sum = vals.reduce((a, l) => a + (weight[l] || 0), 0)
        score = Math.round((sum / (vals.length * 4)) * 100)
      }
    }
    if (score == null) continue
    if (best == null || score > best || (score === best && ts > bestAt)) {
      best = score
      bestAt = ts
    }
  }
  return { bestScore: best, at: bestAt }
}

/**
 * อัปเดตรายวิชา
 */
export async function updateCourse(courseId, fields) {
  const refDoc = doc(db, 'courses', courseId)
  await updateDoc(refDoc, { ...fields, updatedAt: serverTimestamp() })
  _docCache.delete(`course:${courseId}`)
}

/**
 * ลบรายวิชา
 */
export async function deleteCourse(courseId) {
  const refDoc = doc(db, 'courses', courseId)
  await deleteDoc(refDoc)
}

/**
 * ดึงประวัติ submissions ต่อรายวิชา
 */
export async function getSubmissionsByCourse(courseId) {
  // Primary: submissions explicitly tagged with this course
  const q = query(collection(db, 'submissions'), where('courseId_ref', '==', courseId))
  const snap = await getDocs(q)
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  // Legacy fallback: submissions without courseId_ref, infer via missions/scenarios
  // Only do extra reads if we got too few results (to reduce cost)
  if (!items.length) {
    try {
      // 1) Pull missions for this course, then fetch submissions by missionId_ref in chunks
      const missions = await listMissionsByCourse(courseId)
      const missionIds = Array.from(new Set(missions.map((m) => m.id)))
      const byMission = []
      for (let i = 0; i < missionIds.length; i += 10) {
        const chunk = missionIds.slice(i, i + 10)
        if (!chunk.length) continue
        const qSub = query(collection(db, 'submissions'), where('missionId_ref', 'in', chunk))
        const subSnap = await getDocs(qSub)
        byMission.push(...subSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }
      // 2) Also pull scenarios of this course, then fetch submissions by scenarioId_ref in chunks
      const qSc = query(collection(db, 'scenarios'), where('courseId_ref', '==', courseId))
      const scSnap = await getDocs(qSc)
      const scIds = scSnap.docs.map((d) => d.id)
      const byScenario = []
      for (let i = 0; i < scIds.length; i += 10) {
        const chunk = scIds.slice(i, i + 10)
        if (!chunk.length) continue
        const qSub = query(collection(db, 'submissions'), where('scenarioId_ref', 'in', chunk))
        const subSnap = await getDocs(qSub)
        byScenario.push(...subSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }
      const map = new Map()
      for (const s of [...byMission, ...byScenario]) map.set(s.id, s)
      items = Array.from(map.values())
      // Filter to course using joins where available
      const missionById = new Map(missions.map((m) => [m.id, m]))
      const scById = new Map(scSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))
      items = items.filter((s) => {
        if (s.courseId_ref === courseId) return true
        const m = s.missionId_ref ? missionById.get(s.missionId_ref) : null
        if (m?.courseId_ref === courseId) return true
        const sc = s.scenarioId_ref ? scById.get(s.scenarioId_ref) : null
        return sc?.courseId_ref === courseId
      })
    } catch (e) {
      const msg = String(e?.message || e || '')
      if (!msg.includes('Missing or insufficient permissions')) {
        console.warn('Legacy fallback getSubmissionsByCourse failed:', msg)
      }
    }
  }

  // Sort client-side by submittedAt desc
  return items.sort((a, b) => {
    const ta = a.submittedAt?.toMillis?.() ?? 0
    const tb = b.submittedAt?.toMillis?.() ?? 0
    return tb - ta
  })
}

/**
 * ดึงประวัติ submissions ของนักเรียนตาม studentId (เลือกกรองตามรายวิชาได้)
 * @param {string} studentId
 * @param {string|null} courseId
 */
export async function getSubmissionsByStudent(studentId, courseId = null) {
  let qSub
  await ensureAuthReady().catch(() => null)
  if (courseId) {
    qSub = query(
      collection(db, 'submissions'),
      where('studentId_ref', '==', studentId),
      where('courseId_ref', '==', courseId),
    )
  } else {
    qSub = query(collection(db, 'submissions'), where('studentId_ref', '==', studentId))
  }
  const snap = await getDocs(qSub)
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  // Legacy fallback when filtering by course: fetch by missions/scenarios if needed
  if (courseId && !items.length) {
    try {
      const allMissionsInCourse = await listMissionsByCourse(courseId)
      const missionsForStudent = allMissionsInCourse.filter((m) => m.studentId_ref === studentId)
      const missionIds = missionsForStudent.map((m) => m.id)
      const byMission = []
      for (let i = 0; i < missionIds.length; i += 10) {
        const chunk = missionIds.slice(i, i + 10)
        if (!chunk.length) continue
        const q1 = query(collection(db, 'submissions'), where('missionId_ref', 'in', chunk))
        const s1 = await getDocs(q1)
        byMission.push(...s1.docs.map((d) => ({ id: d.id, ...d.data() })))
      }
      const qSc = query(collection(db, 'scenarios'), where('courseId_ref', '==', courseId))
      const scSnap = await getDocs(qSc)
      const scIds = scSnap.docs.map((d) => d.id)
      const byScenario = []
      for (let i = 0; i < scIds.length; i += 10) {
        const chunk = scIds.slice(i, i + 10)
        if (!chunk.length) continue
        const q2 = query(collection(db, 'submissions'), where('scenarioId_ref', 'in', chunk))
        const s2 = await getDocs(q2)
        byScenario.push(...s2.docs.map((d) => ({ id: d.id, ...d.data() })))
      }
      const map = new Map()
      for (const s of [...byMission, ...byScenario]) {
        if (s.studentId_ref === studentId) map.set(s.id, s)
      }
      items = Array.from(map.values())
    } catch (e) {
      const msg = String(e?.message || e || '')
      if (!msg.includes('Missing or insufficient permissions')) {
        console.warn('Legacy fallback getSubmissionsByStudent failed:', msg)
      }
    }
  }

  return items.sort((a, b) => {
    const ta = a.submittedAt?.toMillis?.() ?? 0
    const tb = b.submittedAt?.toMillis?.() ?? 0
    return tb - ta
  })
}

/**
 * อัปเดต submission รายการเดียว (เช่น ปักหมุด/บันทึกสะท้อนคิด)
 */
export async function updateSubmission(submissionId, fields) {
  await ensureAuthReady().catch(() => null)
  if (!auth.currentUser) throw new Error('Missing or insufficient permissions')
  const refDoc = doc(db, 'submissions', submissionId)
  await updateDoc(refDoc, { ...fields, updatedAt: serverTimestamp() })
}

/**
 * ค้นหาสถานการณ์ที่ผู้ใช้ปัจจุบันยังไม่เคยตอบ (สำหรับรายวิชาเฉพาะ)
 * คืน { scenario, assessment } หรือ null ถ้าไม่พบ
 */
export async function findUnansweredScenarioForCourse(courseId) {
  await ensureAuthReady().catch(() => null)
  if (!auth.currentUser) return null
  // 1) ดึงสถานการณ์ของคอร์สนี้ทั้งหมด (เพื่อให้สามารถนำโจทย์ที่คนอื่นเคยสร้างมาใช้ซ้ำได้)
  let scSnap
  try {
    scSnap = await getDocs(
      query(
        collection(db, 'scenarios'),
        where('courseId_ref', '==', courseId),
        orderBy('createdAt', 'desc'),
      ),
    )
  } catch (_) {
    scSnap = await getDocs(
      query(collection(db, 'scenarios'), where('courseId_ref', '==', courseId)),
    )
  }
  const scenarios = scSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  scenarios.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0
    const tb = b.createdAt?.toMillis?.() ?? 0
    return tb - ta
  })
  if (!scenarios.length) return null

  // 2) ดึง submissions ของผู้ใช้ทั้งหมด แล้วเช็คว่าเคยตอบ scenario ไหนบ้าง
  const qSub = query(
    collection(db, 'submissions'),
    where('studentId_ref', '==', auth.currentUser.uid),
  )
  const subSnap = await getDocs(qSub)
  const answered = new Set(subSnap.docs.map((d) => d.data().scenarioId_ref).filter(Boolean))

  // Batch fetch assessments to avoid N+1 lookups
  const ids = scenarios.map((s) => s.id)
  const assessMap = new Map()
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10)
    try {
      const qs = await getDocs(
        query(collection(db, 'assessments'), where('scenarioId_ref', 'in', chunk)),
      )
      const list = qs.docs.map((d) => ({ id: d.id, ...d.data() }))
      const perSc = new Map()
      for (const a of list) {
        const k = a.scenarioId_ref
        const prev = perSc.get(k)
        const ta = a.createdAt?.toMillis?.() ?? 0
        const tp = prev?.createdAt?.toMillis?.() ?? 0
        if (!prev || ta > tp) perSc.set(k, a)
      }
      perSc.forEach((v, k) => assessMap.set(k, v))
    } catch (_) {}
  }

  let fallback = null
  for (const s of scenarios) {
    if (!answered.has(s.id)) {
      const assessment = assessMap.get(s.id) || (await getAssessmentByScenarioId(s.id))
      if (assessment) return { scenario: s, assessment }
      if (!fallback) fallback = { scenario: s, assessment: null }
    }
  }
  return fallback
}

/**
 * ค้นหาสถานการณ์ทั่วไป (ไม่ผูกคอร์ส) ที่ผู้ใช้ยังไม่เคยตอบ
 * คืน { scenario, assessment } หรือ null ถ้าไม่พบ
 */
export async function findUnansweredScenarioGeneral() {
  await ensureAuthReady().catch(() => null)
  if (!auth.currentUser) return null
  // รวม 2 ชุด: (1) ของนักเรียนเองที่ไม่ผูกคอร์ส (2) legacy ที่ไม่ผูกคอร์สและไม่มี studentId_ref
  const qMine = query(
    collection(db, 'scenarios'),
    where('studentId_ref', '==', auth.currentUser.uid),
  )
  const [mineSnap, legacySnap] = await Promise.all([
    getDocs(qMine),
    (async () => {
      try {
        return await getDocs(
          query(
            collection(db, 'scenarios'),
            where('courseId_ref', '==', null),
            orderBy('createdAt', 'desc'),
          ),
        )
      } catch (_) {
        return await getDocs(query(collection(db, 'scenarios'), where('courseId_ref', '==', null)))
      }
    })(),
  ])
  const mine = mineSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => s.courseId_ref == null)
  const legacy = legacySnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => !s.studentId_ref) // ไม่มีเจ้าของ -> legacy
  const scenarios = [...mine, ...legacy]
  scenarios.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0
    const tb = b.createdAt?.toMillis?.() ?? 0
    return tb - ta
  })
  if (!scenarios.length) return null

  const qSub = query(
    collection(db, 'submissions'),
    where('studentId_ref', '==', auth.currentUser.uid),
  )
  const subSnap = await getDocs(qSub)
  const answered = new Set(subSnap.docs.map((d) => d.data().scenarioId_ref).filter(Boolean))

  // Batch assessment lookups
  const ids = scenarios.map((s) => s.id)
  const assessMap = new Map()
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10)
    try {
      const qs = await getDocs(
        query(collection(db, 'assessments'), where('scenarioId_ref', 'in', chunk)),
      )
      const list = qs.docs.map((d) => ({ id: d.id, ...d.data() }))
      const perSc = new Map()
      for (const a of list) {
        const k = a.scenarioId_ref
        const prev = perSc.get(k)
        const ta = a.createdAt?.toMillis?.() ?? 0
        const tp = prev?.createdAt?.toMillis?.() ?? 0
        if (!prev || ta > tp) perSc.set(k, a)
      }
      perSc.forEach((v, k) => assessMap.set(k, v))
    } catch (_) {}
  }

  let fallback = null
  for (const s of scenarios) {
    if (!answered.has(s.id)) {
      const assessment = assessMap.get(s.id) || (await getAssessmentByScenarioId(s.id))
      if (assessment) return { scenario: s, assessment }
      if (!fallback) fallback = { scenario: s, assessment: null }
    }
  }
  return fallback
}

/**
 * ดึงรายการนักเรียนที่ลงวิชา courseId
 */
export async function getStudentsByEnrolledCourse(courseId) {
  try {
    await ensureAuthReady().catch(() => null)
    const qSt = query(
      collection(db, 'students'),
      where('enrolledCourses', 'array-contains', courseId),
    )
    const snap = await getDocs(qSt)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (_) {
    return []
  }
}

/**
 * ดึง scenarios ตามรายการ id (ดึงแบบวนลูปเพื่อหลีกเลี่ยงข้อจำกัด IN 10 รายการ)
 * @param {string[]} ids
 */
export async function getScenariosByIds(ids) {
  const results = []
  for (const id of ids) {
    try {
      const sref = doc(db, 'scenarios', id)
      const snap = await getDoc(sref)
      if (snap.exists()) results.push({ id: snap.id, ...snap.data() })
    } catch (e) {
      // Permission-denied or not-found can occur under restricted rules; ignore
      if (!String(e?.message || e).includes('Missing or insufficient permissions')) {
        console.warn('getScenariosByIds failed for', id, e?.message || e)
      }
    }
  }
  return results
}

/**
 * ค้นหา scenario ซ้ำในรายวิชาตาม content_hash (กรองฝั่ง client หลังดึงตาม courseId)
 * @param {string} courseId
 * @param {string} contentHash - SHA-256 hex string
 * @returns {Promise<object|null>}
 */
export async function findScenarioByHashInCourse(courseId, contentHash) {
  if (!courseId || !contentHash) return null
  const qSc = query(collection(db, 'scenarios'), where('courseId_ref', '==', courseId))
  const snap = await getDocs(qSc)
  for (const d of snap.docs) {
    const data = d.data() || {}
    if (data.content_hash && data.content_hash === contentHash) {
      return { id: d.id, ...data }
    }
  }
  return null
}

// ------------------ Missions (Multi-task per course per student) ------------------

/**
 * สร้างภารกิจใหม่ เชื่อม scenario+assessment
 */
export async function createMission({
  courseId,
  studentId,
  scenarioId,
  assessmentId,
  skill_targeted,
  difficulty = 'normal',
  meta = {},
}) {
  await ensureAuthReady().catch(() => null)
  if (!auth.currentUser) throw new Error('Missing or insufficient permissions')
  const ref = await addDoc(collection(db, 'missions'), {
    courseId_ref: courseId,
    studentId_ref: studentId,
    scenarioId_ref: scenarioId,
    assessmentId_ref: assessmentId,
    skill_targeted,
    difficulty,
    status: 'assigned',
    active: true,
    source: meta,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * ดึงภารกิจที่ยัง active เก่าสุดของนักเรียนในรายวิชา (เวอร์ชันไม่ต้องใช้ composite index: กรองฝั่ง client)
 */
export async function getOldestActiveMissionForCourse(studentId, courseId) {
  const qMis = query(collection(db, 'missions'), where('studentId_ref', '==', studentId))
  const snap = await getDocs(qMis)
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const filtered = all.filter((m) => m.courseId_ref === courseId && m.active === true)
  filtered.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0
    const tb = b.createdAt?.toMillis?.() ?? 0
    return ta - tb // oldest first
  })
  return filtered[0] || null
}

/**
 * รายการภารกิจที่ยัง active ในรายวิชา
 */
export async function listActiveMissionsForCourse(studentId, courseId) {
  const qMis = query(collection(db, 'missions'), where('studentId_ref', '==', studentId))
  const snap = await getDocs(qMis)
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  return list
    .filter((m) => m.courseId_ref === courseId && m.active === true)
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0
      const tb = b.createdAt?.toMillis?.() ?? 0
      return ta - tb
    })
}

/**
 * ประวัติภารกิจที่เสร็จแล้วในรายวิชา
 */
export async function listCompletedMissionsForCourse(studentId, courseId, take = 20) {
  const qMis = query(collection(db, 'missions'), where('studentId_ref', '==', studentId))
  const snap = await getDocs(qMis)
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  return items
    .filter((m) => m.courseId_ref === courseId && m.status === 'completed')
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0
      const tb = b.createdAt?.toMillis?.() ?? 0
      return tb - ta
    })
    .slice(0, take)
}

/**
 * ปิดภารกิจ (completed) และเก็บฟิลด์เพิ่ม เช่น submissionId_ref
 */
export async function completeMission(missionId, fields = {}) {
  const mref = doc(db, 'missions', missionId)
  await updateDoc(mref, {
    status: 'completed',
    active: false,
    updatedAt: serverTimestamp(),
    ...fields,
  })
}

/**
 * ดึงภารกิจตาม id
 */
export async function getMissionById(missionId) {
  try {
    const mref = doc(db, 'missions', missionId)
    const snap = await getDoc(mref)
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() }
  } catch (_) {
    return null
  }
}

/**
 * ดึง submission จาก missionId (ตัวล่าสุด ถ้ามีหลายรายการ)
 */
export async function getSubmissionByMissionId(missionId) {
  const qSub = query(collection(db, 'submissions'), where('missionId_ref', '==', missionId))
  const snap = await getDocs(qSub)
  if (snap.empty) return null
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  items.sort((a, b) => {
    const ta = a.submittedAt?.toMillis?.() ?? 0
    const tb = b.submittedAt?.toMillis?.() ?? 0
    return tb - ta
  })
  return items[0]
}

/**
 * รายการ submission ทั้งหมดของ missionId (ล่าสุดก่อน)
 */
export async function listSubmissionsByMissionId(missionId) {
  const qSub = query(collection(db, 'submissions'), where('missionId_ref', '==', missionId))
  const snap = await getDocs(qSub)
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  items.sort((a, b) => {
    const ta = a.submittedAt?.toMillis?.() ?? 0
    const tb = b.submittedAt?.toMillis?.() ?? 0
    return tb - ta
  })
  return items
}

// ------------- Batched course-level fetches for performance -------------
/**
 * ดึง missions ทั้งหมดของรายวิชาเดียว (กรองสถานะฝั่ง client เพื่อลดการต้องใช้ composite index)
 * @param {string} courseId
 * @returns {Promise<Array<object>>}
 */
export async function listMissionsByCourse(courseId) {
  const qMis = query(collection(db, 'missions'), where('courseId_ref', '==', courseId))
  const snap = await getDocs(qMis)
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  // sort newest first
  return items.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0
    const tb = b.createdAt?.toMillis?.() ?? 0
    return tb - ta
  })
}

/**
 * เลือกสถานการณ์ที่ "พร้อมนำกลับมาใช้" แบบหลีกเลี่ยงการทำพร้อมกัน
 * เงื่อนไข:
 *  - อยู่ในรายวิชา courseId
 *  - ผู้ใช้ปัจจุบัน (studentId) ยังไม่เคยตอบ
 *  - ไม่มี mission ที่ยัง active สำหรับสถานการณ์นั้น (ของเพื่อนคนอื่น) ณ ตอนนี้
 *  - มี submission ของใครก็ได้อย่างน้อย 1 รายการ และเวลาผ่านไปแล้ว >= minAgeMs
 * คืน { scenario, assessment } หรือ null
 */
export async function findReusableScenarioAntiCollusion(
  courseId,
  studentId,
  minAgeMs = 5 * 60 * 1000,
) {
  // 1) ดึงสถานการณ์ทั้งหมดของรายวิชา (ใหม่ก่อน)
  const qSc = query(collection(db, 'scenarios'), where('courseId_ref', '==', courseId))
  const scSnap = await getDocs(qSc)
  const scenarios = scSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  scenarios.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0
    const tb = b.createdAt?.toMillis?.() ?? 0
    return tb - ta
  })
  if (!scenarios.length) return null

  // 2) สถานการณ์ที่นักเรียนคนนี้เคยตอบแล้ว
  const qSubMine = query(collection(db, 'submissions'), where('studentId_ref', '==', studentId))
  const subMineSnap = await getDocs(qSubMine)
  const answered = new Set(subMineSnap.docs.map((d) => d.data().scenarioId_ref).filter(Boolean))

  // 3) ดึง missions ทั้งหมดของรายวิชา เพื่อหา scenario ที่กำลัง active อยู่ (ของใครก็ได้)
  const missions = await listMissionsByCourse(courseId)
  const activeScenarioIds = new Set(
    missions
      .filter((m) => m?.active === true || m?.status === 'assigned')
      .map((m) => m.scenarioId_ref)
      .filter(Boolean),
  )

  // 4) ดึง submissions ทั้งหมดของรายวิชาเพื่อคำนวณเวลาส่งล่าสุดต่อ scenario
  // นักเรียนบางครั้งอาจไม่มีสิทธิ์อ่าน submission ของทั้งคอร์สทั้งหมด (กฎถูกจำกัด)
  // ให้จับ error แล้วใช้ fallback แบบ per-scenario แทน
  const lastSubmittedAtByScenario = new Map()
  try {
    const allSubs = await getSubmissionsByCourse(courseId)
    for (const s of allSubs) {
      if (!s.scenarioId_ref) continue
      const ts = s.submittedAt?.toMillis?.() ?? 0
      const prev = lastSubmittedAtByScenario.get(s.scenarioId_ref) || 0
      if (ts > prev) lastSubmittedAtByScenario.set(s.scenarioId_ref, ts)
    }
  } catch (e) {
    const msg = String(e?.message || e || '')
    if (!msg.includes('Missing or insufficient permissions')) {
      console.warn('findReusableScenarioAntiCollusion: fallback without course submissions:', msg)
    }
    // Fallback: we'll probe per-scenario when needed below
  }

  // 5) เลือกสถานการณ์แรกที่ผ่านเงื่อนไขทั้งหมด
  const now = Date.now()
  for (const sc of scenarios) {
    if (answered.has(sc.id)) continue
    if (activeScenarioIds.has(sc.id)) continue
    let lastTs = lastSubmittedAtByScenario.get(sc.id) || 0
    // ถ้าไม่มีค่า (เพราะอ่านทั้งคอร์สไม่ได้) ลองดึง submissions ของ scenario นั้น ๆ แบบย่อยแทน
    if (!lastTs) {
      try {
        const qSub = query(collection(db, 'submissions'), where('scenarioId_ref', '==', sc.id))
        const snap = await getDocs(qSub)
        const times = snap.docs.map((d) => d.data()?.submittedAt?.toMillis?.() ?? 0)
        lastTs = times.length ? Math.max(...times) : 0
      } catch (_) {
        lastTs = 0
      }
    }
    if (!lastTs || now - lastTs < minAgeMs) continue
    const assessment = await getAssessmentByScenarioId(sc.id)
    if (assessment) return { scenario: sc, assessment }
  }
  return null
}

// ------------------ Mini-lessons (teacher reusable toolkits) ------------------

/**
 * รายการ mini_lessons ของครูผู้สอน (ใหม่สุดก่อน)
 * @param {string} teacherId
 * @param {string|null} courseId - ถ้าระบุจะกรองตามรายวิชา
 */
export async function listMiniLessonsForTeacher(teacherId, courseId = null) {
  const col = collection(db, 'mini_lessons')
  const qMini = query(col, where('teacherId_ref', '==', teacherId))
  const snap = await getDocs(qMini)
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  if (courseId) items = items.filter((it) => it.courseId_ref === courseId)
  // sort newest first
  return items.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0
    const tb = b.createdAt?.toMillis?.() ?? 0
    return tb - ta
  })
}

/**
 * ลบ mini_lesson ตาม id (ต้องเป็นเจ้าของที่ client ตรวจแล้ว)
 */
export async function deleteMiniLesson(lessonId) {
  const refDoc = doc(db, 'mini_lessons', lessonId)
  await deleteDoc(refDoc)
}
