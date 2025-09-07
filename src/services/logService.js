import { db, auth } from '@/firebase/config'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'

/**
 * Write an application event log to Firestore (collection: app_logs)
 * @param {object} payload
 * @param {string} payload.event - Short event key, e.g., 'loop.start'
 * @param {('debug'|'info'|'warn'|'error')} [payload.level='info']
 * @param {string} [payload.message]
 * @param {object} [payload.data] - Arbitrary contextual data (small size)
 * @param {string} [payload.courseId]
 * @param {string} [payload.scenarioId]
 * @param {string} [payload.assessmentId]
 * @param {string} [payload.missionId]
 */
export async function logAppEvent(payload = {}) {
  try {
    const uid = auth.currentUser?.uid || null
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || null
    const docData = {
      event: payload.event || 'app.event',
      level: payload.level || 'info',
      message: payload.message || null,
      data: payload.data || null,
      courseId_ref: payload.courseId || null,
      scenarioId_ref: payload.scenarioId || null,
      assessmentId_ref: payload.assessmentId || null,
      missionId_ref: payload.missionId || null,
      uid,
      userAgent: ua,
      createdAt: serverTimestamp(),
    }
    await addDoc(collection(db, 'app_logs'), docData)
  } catch (_) {
    // Swallow logging errors to avoid breaking UX
  }
}

/**
 * Convenience wrapper for error logs
 */
export async function logError(event, message, data = {}) {
  return logAppEvent({ event, level: 'error', message, data })
}
