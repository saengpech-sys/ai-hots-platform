import { apiPostAuth } from '@/services/apiClient'
import { buildScenarioPrompt, buildAssessmentPrompt } from '@/utils/aiPrompts'

// Direct OpenAI call in dev (via Vite proxy). In production we use Firebase Functions.
const OPENAI_BASE = import.meta.env.DEV ? '/openai/v1' : 'https://api.openai.com/v1'
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
if (!OPENAI_API_KEY && import.meta.env.DEV) {
  // eslint-disable-next-line no-alert
  alert('ไม่พบ VITE_OPENAI_API_KEY ใน .env.local')
}
async function openAIFetchJson(body) {
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 30000)
  try {
    const resp = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(OPENAI_API_KEY ? { Authorization: `Bearer ${OPENAI_API_KEY}` } : {}),
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    const data = await resp.json().catch(() => null)
    if (!resp.ok) {
      const err = new Error(data?.error?.message || `HTTP ${resp.status}`)
      err.response = { status: resp.status, data }
      throw err
    }
    return data
  } finally {
    clearTimeout(to)
  }
}

// Legacy axios path retained only for OpenAI direct dev usage; Functions calls now via apiPostAuth wrapper.

// Attach Firebase ID token for auth-protected Cloud Functions
// (Auth accessed indirectly through apiPostAuth; no direct import for lighter bundle)
import { getCourseById, getSubmissionsByCourse } from '@/services/firestoreService'
import { logError } from '@/services/logService'
import { log } from '@/utils/logger'
// (Removed serverApi auth interceptor; handled in apiPostAuth.)

// Prefer a model that guarantees well-formed JSON via response_format
const JSON_MODEL = 'gpt-4o-mini'

// Extract JSON from a string that may include extra text or code fences
function safeParseJson(text) {
  if (!text || typeof text !== 'string') return null
  // Try direct parse first
  try {
    return JSON.parse(text)
  } catch (_) {}
  // Strip Markdown fences if present
  const fenceMatch = text.match(/```(?:json)?\n([\s\S]*?)\n```/i)
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1])
    } catch (_) {}
  }
  // Fallback: best-effort to find first JSON object substring
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = text.slice(start, end + 1)
    try {
      return JSON.parse(candidate)
    } catch (_) {}
  }
  return null
}

function formatAxiosError(err) {
  const status = err?.response?.status
  const msg = err?.response?.data?.error?.message || err?.message || 'Unknown error'
  if (status === 401) return 'OpenAI: Unauthorized (ตรวจสอบ API Key)'
  if (status === 429) return 'OpenAI: Rate limit/Quota exceeded (เกินโควตาหรือมีการเรียกมากเกินไป)'
  if (status === 404) return 'OpenAI: Endpoint/Model not found'
  if (status === 400) return `OpenAI: Bad request - ${msg}`
  if (status === 402) return 'OpenAI: Payment required/Insufficient quota'
  return `OpenAI error${status ? ` (${status})` : ''}: ${msg}`
}

function shortText(s, max = 180) {
  const t = typeof s === 'string' ? s : JSON.stringify(s || '')
  return t.length > max ? `${t.slice(0, max)}…` : t
}

function buildFunctionsErrorMessage({ title = 'เรียกใช้เซิร์ฟเวอร์ไม่สำเร็จ', primary, fallback }) {
  const lines = []
  const mk = (err, tag) => {
    if (!err) return
    const status = err?.response?.status
    const url = err?.config?.url || err?.request?.responseURL || '—'
    const body = err?.response?.data
    const bodyStr =
      typeof body === 'string' ? body : body?.error || body?.message || JSON.stringify(body || '')
    lines.push(`- แหล่งที่มา (${tag}): ${url}`)
    if (status) lines.push(`- สถานะ HTTP: ${status}`)
    if (bodyStr) lines.push(`- ข้อความจากเซิร์ฟเวอร์: ${shortText(bodyStr)}`)
  }
  mk(primary, 'primary')
  if (fallback) mk(fallback, 'fallback')
  lines.push(
    '- คำแนะนำ: ตรวจการล็อกอินอีกครั้ง, รีเฟรชหน้า, และถ้าเกิดจาก 404 ให้รอ/ deploy Hosting rewrites หรือระบุ VITE_FUNCTIONS_BASE ให้ตรงโปรเจกต์',
  )
  return `${title}\n\n${lines.join('\n')}`
}

/**
 * ฟังก์ชันสำหรับเรียก AI เพื่อสร้างผลลัพธ์ที่เป็น JSON
 * @param {string} systemPrompt - System Prompt ที่เราออกแบบไว้
 * @returns {Promise<object>} - ผลลัพธ์ JSON ที่ AI สร้างขึ้น
 */
async function callJsonAI(systemPrompt) {
  // Small retry for transient 429/5xx
  const attempts = 2
  let lastErr = null
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await openAIFetchJson({
        model: JSON_MODEL,
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}\n\nข้อสำคัญ: ตอบกลับเป็น JSON เพียงอย่างเดียว ห้ามมีข้อความอื่นหรือโค้ดบล็อก Markdown`,
          },
          { role: 'user', content: 'โปรดส่งผลลัพธ์เป็น JSON เท่านั้น' },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      })

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('OpenAI API Full Response Data:', response)
      }

      const content = response?.choices?.[0]?.message?.content
      const parsed = safeParseJson(content)
      if (!parsed) throw new Error('Invalid JSON from OpenAI')
      return parsed
    } catch (error) {
      lastErr = error
      // If retryable, wait briefly and retry once
      const status = error?.response?.status
      if (i < attempts - 1 && (status === 429 || status >= 500)) {
        await new Promise((r) => setTimeout(r, 800))
        continue
      }
      break
    }
  }
  // eslint-disable-next-line no-console
  console.error('Error calling OpenAI:', lastErr?.response?.data || lastErr?.message)
  // eslint-disable-next-line no-alert
  alert(formatAxiosError(lastErr))
  return null
}

// (Removed manual candidate base discovery; fallback handled centrally.)

// Prefer direct Cloud Functions (env/derived) then fallback to /api/* rewrites
async function callServerJson(kind, systemPrompt, meta) {
  const pathMap = {
    scenario: '/api/scenario',
    assessment: '/api/assessment',
    evaluate: '/api/evaluate',
    teachingStrategy: '/api/teaching-strategy',
  }
  const path = pathMap[kind] || '/api/evaluate'
  try {
    const data = await apiPostAuth(path, { systemPrompt, meta })
    log.info('ai.call.success', { path, kind })
    return data
  } catch (error) {
    const msg = buildFunctionsErrorMessage({ primary: error })
    logError('functions.call.fail', msg, { kind })
    log.error('ai.call.error', { path, kind }, error)
    alert(msg)
    return null
  }
}

// --- ฟังก์ชันสำหรับแต่ละโมดูล (เหมือนเดิม) ---
export async function generateScenario(context) {
  const prompt = buildScenarioPrompt(context)
  return import.meta.env.DEV
    ? callJsonAI(prompt)
    : callServerJson('scenario', prompt, {
        courseId: context.courseId_ref || context.courseId || null,
      })
}

export async function generateAssessment(context) {
  const prompt = buildAssessmentPrompt(context)
  return import.meta.env.DEV ? callJsonAI(prompt) : callServerJson('assessment', prompt)
}

// Batch generate scenario + assessment in parallel (reduces total latency)
export async function generateScenarioAndAssessment(context) {
  const scenarioPromise = generateScenario(context)
  const assessmentPromise = generateAssessment(context)
  const [scenario, assessment] = await Promise.all([scenarioPromise, assessmentPromise])
  return { scenario, assessment }
}

export async function evaluateSubmission(context) {
  const prompt = `
    # บทบาท
    คุณคือ "AI โค้ชด้านการคิดเชิงวิพากษ์" (AI Critical Thinking Coach) ผู้เชี่ยวชาญในการให้ข้อมูลป้อนกลับที่ลึกซึ้งและชี้แนะแนวทางการพัฒนา ที่ยึดหลักการ Socratic Method (การตั้งคำถามชี้นำ) และ Growth Mindset เป้าหมายของคุณไม่ใช่การตัดสิน แต่คือการกระตุ้นให้นักเรียนมองเห็นจุดแข็งของตัวเองและช่องว่างในการพัฒนาได้อย่างชัดเจน คุณจะใช้ภาษาที่สร้างสรรค์ ให้กำลังใจ และชี้แนะแนวทางที่เป็นรูปธรรมเสมอ

    # บริบท
    นักเรียนได้ส่งคำตอบสำหรับภารกิจที่ได้รับมอบหมายแล้ว:
    - ภารกิจ: "${context.assessment_task}"
    - เกณฑ์การประเมิน (Rubric): ${JSON.stringify(context.evaluation_rubric_array)}
    - คำตอบของนักเรียน (เรียงความ/บทวิเคราะห์):
    """
    ${context.student_free_text_answer}
    """

    # หน้าที่
    จงประเมินคำตอบของนักเรียนอย่างละเอียดโดยเทียบกับ "เกณฑ์การประเมิน" แต่ละข้อ และให้ Feedback กลับไป
    1.  ให้คะแนนแต่ละเกณฑ์ใน Rubric เป็นระดับ: "ดีเยี่ยม", "ดี", "พอใช้", หรือ "ต้องปรับปรุง"
    2.  เขียน Feedback ภาพรวมที่ให้กำลังใจและสรุปจุดแข็งของคำตอบ
    3.  เขียน "ข้อเสนอแนะเพื่อการพัฒนา" โดยเจาะจงไปที่เกณฑ์ที่ได้คะแนน "พอใช้" หรือ "ต้องปรับปรุง" พร้อมยกตัวอย่างจากคำตอบของนักเรียนประกอบ
    4.  ตัดสินใจเลือก "Action" สำหรับบทเรียนถัดไป: "ADVANCE" (ทุกเกณฑ์ได้ 'ดี' ขึ้นไป), "REINFORCE" (มีบางเกณฑ์เป็น 'พอใช้' หรือ 'ต้องปรับปรุง')
    - ใช้ภาษาไทยล้วน อธิบายอย่างสุภาพ ชัดเจน และสร้างแรงเสริม
    - หลีกเลี่ยงการเผยเนื้อหาคำตอบที่เป็นข้อมูลอ่อนไหวเกินจำเป็น

  # รูปแบบผลลัพธ์
  จงตอบกลับเป็นออบเจ็กต์ JSON เพียงอย่างเดียว (ห้าม Markdown/backticks/ข้อความเกิน) โดยมีคีย์ดังต่อไปนี้:
  - "rubric_scores": (object) ออบเจ็กต์ที่คีย์คือชื่อเกณฑ์ และค่าคือระดับคะแนน (เช่น {"ความชัดเจนของจุดยืน": "ดี"})
  - "summary_feedback": (string) ข้อความสรุปเชิงบวก (ภาษาไทย)
  - "detailed_feedback": (array of objects) อาร์เรย์ของ Feedback สำหรับแต่ละเกณฑ์ โดยมีคีย์ "criteria" และ "feedback_text" (ภาษาไทย)
  - "next_action": (string) ต้องเป็น "ADVANCE" หรือ "REINFORCE"
  - "common_error_tag": (string) ป้ายข้อผิดพลาดที่พบบ่อยที่สุดของคำตอบนี้ เลือกเพียงหนึ่งค่าจากชุดต่อไปนี้:
    ["reasoning_gap", "insufficient_evidence", "misunderstanding_question", "logical_fallacy", "unclear_structure", "superficial_analysis", "incorrect_fact", "none"]
    `
  return import.meta.env.DEV ? callJsonAI(prompt) : callServerJson('evaluate', prompt)
}

// Server similarity check
export async function similarityCheck({ answer, courseId, scenarioId }) {
  try {
    return await apiPostAuth('/api/similarity', { answer, courseId, scenarioId })
  } catch (error) {
    const msg = buildFunctionsErrorMessage({
      primary: error,
      title: 'Similarity service unavailable',
    })
    logError('functions.similarity.fail', msg, { courseId, scenarioId })
    alert(msg)
    return null
  }
}

// Server analyzeSubmission (heuristic risk score)
export async function analyzeHeuristic({ answer, telemetry }) {
  try {
    return await apiPostAuth('/api/analyze', { answer, telemetry })
  } catch (error) {
    const msg = buildFunctionsErrorMessage({ primary: error, title: 'Analyze service unavailable' })
    logError('functions.analyze.fail', msg, {})
    alert(msg)
    return null
  }
}

// ---------- Teacher Strategy (AI) ----------
export async function buildTeachingStrategyPrompt({
  courseTitle,
  subject,
  standardList = [],
  indicators = [],
  learningGoals = [],
  studentWeaknessInsights = '',
  datasetSummary = '', // จากสถิติ submission/คะแนน หรือสรุปครูเอง
}) {
  const standardsText =
    Array.isArray(standardList) && standardList.length
      ? standardList.map((s, i) => `${i + 1}. ${s}`).join('\n    ')
      : null
  const indicatorsText =
    Array.isArray(indicators) && indicators.length
      ? indicators.map((s, i) => `${i + 1}. ${s}`).join('\n    ')
      : null
  const goalsText =
    Array.isArray(learningGoals) && learningGoals.length
      ? learningGoals.map((s, i) => `${i + 1}. ${s}`).join('\n    ')
      : null
  return `
คุณคือ "AI ผู้ช่วยวิเคราะห์กลยุทธ์การสอน" สำหรับครูวิชา ${subject}

# บริบท
- ชื่อรายวิชา/หน่วยเรียน: ${courseTitle}
${standardsText ? `- มาตรฐาน/ตัวชี้วัด: \n    ${standardsText}` : ''}
${indicatorsText ? `- ตัวชี้วัดย่อย: \n    ${indicatorsText}` : ''}
${goalsText ? `- เป้าหมายการเรียนรู้ (Learning Goals):\n    ${goalsText}` : ''}
- จุดอ่อน/ความเข้าใจผิดของผู้เรียน (จากการประเมิน/สังเกต): ${studentWeaknessInsights || '—'}
- สรุปข้อมูลผลลัพธ์ปัจจุบัน (เช่น ค่าเฉลี่ยคะแนน/สัดส่วนผ่านเกณฑ์/ข้อที่พลาดบ่อย): ${datasetSummary || '—'}

# งานที่ต้องทำ
โปรดสังเคราะห์เป็น JSON ภาษาไทยเท่านั้น (ห้าม markdown/backticks) ด้วยโครงสร้างดังนี้:
{
  "strategy_summary": string, // สรุปภาพรวมกลยุทธ์การสอน
  "key_misconceptions": [string, ...], // ความเข้าใจผิดสำคัญที่ควรแก้
  "lesson_sequence": [
    { "title": string, "objective": string, "activities": [string, ...], "materials": [string, ...] }
  ],
  "formative_checks": [string, ...], // เช็คระหว่างเรียน (exit ticket/ถาม-ตอบ/โจทย์สั้น)
  "remediation": [string, ...], // แนวทางซ่อมเสริมเฉพาะจุด
  "enrichment": [string, ...] // กิจกรรมเสริมสำหรับผู้เรียนที่ก้าวหน้า
}
`
}

export async function generateTeachingStrategy(input) {
  const systemPrompt = await buildTeachingStrategyPrompt(input)
  return callServerJson('teachingStrategy', systemPrompt)
}

// ---------- Teacher Strategy from real student feedback ----------
function levelToScore(level) {
  const map = { ดีเยี่ยม: 3, ดี: 2, พอใช้: 1, ต้องปรับปรุง: 0 }
  return map[level?.trim?.()] ?? null
}

function summarizeRubrics(submissions) {
  const agg = { byCriteria: {}, counts: { ADVANCE: 0, REINFORCE: 0 }, errorTag: {} }
  for (const s of submissions) {
    const fb = s?.feedback || {}
    if (fb.next_action === 'ADVANCE') agg.counts.ADVANCE += 1
    if (fb.next_action === 'REINFORCE') agg.counts.REINFORCE += 1
    if (typeof fb.common_error_tag === 'string' && fb.common_error_tag) {
      agg.errorTag[fb.common_error_tag] = (agg.errorTag[fb.common_error_tag] || 0) + 1
    }
    const rs = fb.rubric_scores || {}
    for (const [criteria, level] of Object.entries(rs)) {
      const score = levelToScore(level)
      if (score === null) continue
      if (!agg.byCriteria[criteria]) agg.byCriteria[criteria] = { sum: 0, n: 0, low: 0, levels: {} }
      agg.byCriteria[criteria].sum += score
      agg.byCriteria[criteria].n += 1
      agg.byCriteria[criteria].levels[level] = (agg.byCriteria[criteria].levels[level] || 0) + 1
      if (score <= 1) agg.byCriteria[criteria].low += 1 // พอใช้/ต้องปรับปรุง
    }
  }
  // derive summary lists
  const criteriaStats = Object.entries(agg.byCriteria).map(([name, v]) => ({
    criteria: name,
    avg: v.n ? v.sum / v.n : 0,
    n: v.n,
    lowCount: v.low,
    levels: v.levels,
  }))
  criteriaStats.sort((a, b) => a.avg - b.avg)
  const weakest = criteriaStats.filter((c) => c.n >= 3).slice(0, 5)
  // error tags sorted
  const errorTagsSorted = Object.entries(agg.errorTag)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
  return { counts: agg.counts, criteriaStats, weakest, errorTagsSorted }
}

export async function summarizeCourseFeedback(
  courseId,
  { limit = 300, weightRecent = false, halfLifeDays = 14, fromTs = null, toTs = null } = {},
) {
  const [course, submissionsAll] = await Promise.all([
    getCourseById(courseId),
    getSubmissionsByCourse(courseId),
  ])
  // Filter by time window if provided
  const toMillis = (ts) =>
    ts?.toMillis?.()
      ? ts.toMillis()
      : ts?._seconds
        ? ts._seconds * 1000
        : typeof ts === 'number'
          ? ts
          : 0
  let submissions = Array.isArray(submissionsAll) ? submissionsAll.slice(0) : []
  if (fromTs) submissions = submissions.filter((s) => toMillis(s?.submittedAt) >= fromTs)
  if (toTs) submissions = submissions.filter((s) => toMillis(s?.submittedAt) <= toTs)
  submissions = submissions.slice(0, limit)
  const total = submissions.length

  // Optional: exponential recency weighting
  const now = Date.now()
  const halfLifeMs = Math.max(1, Number(halfLifeDays) || 14) * 24 * 60 * 60 * 1000
  const getWeight = (s) => {
    if (!weightRecent) return 1
    const ts = s?.submittedAt?.toMillis?.()
      ? s.submittedAt.toMillis()
      : s?.submittedAt?._seconds
        ? s.submittedAt._seconds * 1000
        : 0
    const ageMs = Math.max(0, now - ts)
    const w = Math.pow(0.5, ageMs / halfLifeMs)
    return Math.max(0.1, Number.isFinite(w) ? w : 1)
  }

  // Weighted aggregation when enabled
  let stats
  if (weightRecent) {
    const agg = { byCriteria: {}, counts: { ADVANCE: 0, REINFORCE: 0 }, errorTag: {} }
    for (const s of submissions) {
      const fb = s?.feedback || {}
      const w = getWeight(s)
      if (fb.next_action === 'ADVANCE') agg.counts.ADVANCE += w
      if (fb.next_action === 'REINFORCE') agg.counts.REINFORCE += w
      if (typeof fb.common_error_tag === 'string' && fb.common_error_tag) {
        agg.errorTag[fb.common_error_tag] = (agg.errorTag[fb.common_error_tag] || 0) + w
      }
      const rs = fb.rubric_scores || {}
      for (const [criteria, level] of Object.entries(rs)) {
        const score = levelToScore(level)
        if (score === null) continue
        if (!agg.byCriteria[criteria])
          agg.byCriteria[criteria] = { sum: 0, n: 0, low: 0, levels: {} }
        agg.byCriteria[criteria].sum += score * w
        agg.byCriteria[criteria].n += w
        agg.byCriteria[criteria].levels[level] = (agg.byCriteria[criteria].levels[level] || 0) + w
        if (score <= 1) agg.byCriteria[criteria].low += w
      }
    }
    const criteriaStats = Object.entries(agg.byCriteria).map(([name, v]) => ({
      criteria: name,
      avg: v.n ? v.sum / v.n : 0,
      n: v.n,
      lowCount: v.low,
      levels: v.levels,
    }))
    criteriaStats.sort((a, b) => a.avg - b.avg)
    const weakest = criteriaStats.filter((c) => c.n >= 3).slice(0, 5)
    const errorTagsSorted = Object.entries(agg.errorTag)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
    stats = { counts: agg.counts, criteriaStats, weakest, errorTagsSorted }
  } else {
    stats = summarizeRubrics(submissions)
  }

  // --- Trend (weekly pass-rate) ---
  const bucketMap = new Map() // label -> { pass, total }
  const labelOf = (ms) => {
    const d = new Date(ms || Date.now())
    const year = d.getFullYear()
    // Week number (approx):
    const start = new Date(year, 0, 1)
    const dayMs = 24 * 60 * 60 * 1000
    const week = Math.floor(((d - start) / dayMs + start.getDay() + 1) / 7)
    return `${year}-W${String(week).padStart(2, '0')}`
  }
  for (const s of submissions) {
    const ms = toMillis(s?.submittedAt)
    const lbl = labelOf(ms)
    const w = 1 // trend uses unweighted count; keep simple for readability
    const b = bucketMap.get(lbl) || { pass: 0, total: 0 }
    const nextAction = s?.feedback?.next_action || s?.next_action || s?.decision || ''
    const isPass = String(nextAction).toUpperCase().includes('ADVANCE')
    b.total += w
    if (isPass) b.pass += w
    bucketMap.set(lbl, b)
  }
  const labels = Array.from(bucketMap.keys()).sort()
  const passRateSeries = labels.map((l) => {
    const b = bucketMap.get(l)
    return b && b.total ? Math.round((b.pass / b.total) * 100) : 0
  })

  const passLike = stats.counts.ADVANCE
  const reinforce = stats.counts.REINFORCE
  const denom = weightRecent ? passLike + reinforce : total
  const passRate = denom ? Math.round((passLike / denom) * 100) : 0
  // Translate error tags to Thai with a brief meaning
  const tagInfo = {
    superficial_analysis: {
      th: 'วิเคราะห์ตื้นเกินไป',
      desc: 'อธิบายผิวเผิน ไม่เชื่อมโยงเหตุผล/หลักฐานเชิงลึก',
    },
    insufficient_evidence: {
      th: 'หลักฐานไม่เพียงพอ',
      desc: 'ข้อสรุปไม่รองรับด้วยข้อมูลหรือหลักฐานที่พอเพียง',
    },
    unclear_structure: { th: 'โครงสร้างไม่ชัดเจน', desc: 'ลำดับความคิดไม่ชัด ทำให้อ่านยาก' },
    reasoning_gap: { th: 'ช่องว่างของเหตุผล', desc: 'มีการกระโดดเหตุผล ไม่ต่อเนื่อง' },
    incorrect_fact: { th: 'ข้อมูลผิด', desc: 'อ้างข้อเท็จจริงคลาดเคลื่อน' },
    misunderstanding_question: { th: 'ตีความโจทย์ผิด', desc: 'ตอบไม่ตรงคำถาม/ใจความ' },
    logical_fallacy: { th: 'ตรรกะผิดพลาด', desc: 'มีความคลาดเคลื่อนทางตรรกะ เช่น straw man' },
    none: { th: 'ไม่พบข้อผิดพลาดสำคัญ', desc: '' },
  }
  const topMis = stats.errorTagsSorted.slice(0, 5)
  const misText = topMis
    .map((m, i) => {
      const info = tagInfo[m.tag] || { th: m.tag, desc: '' }
      const tail = info.desc ? ` — ${info.desc}` : ''
      return `${i + 1}. ${info.th}${tail} (${Math.round(m.count)})`
    })
    .join('\n    ')
  const weakLines = stats.weakest
    .map(
      (w, i) =>
        `${i + 1}. ${w.criteria} (เฉลี่ย ${w.avg.toFixed(2)}, ต่ำ/ทั้งหมด ${Math.round(w.lowCount)}/${Math.round(w.n)})`,
    )
    .join('\n    ')
  const weightedNote = weightRecent
    ? ` (ถ่วงน้ำหนักงานล่าสุด, ค่า half-life ≈ ${halfLifeDays} วัน)`
    : ''
  const rangeNote =
    fromTs || toTs
      ? `ช่วงเวลา: ${new Date(fromTs || toMillis(submissions[0]?.submittedAt) || Date.now()).toLocaleDateString()} – ${new Date(toTs || Date.now()).toLocaleDateString()}`
      : ''
  const summaryText = `สรุปผลรวม${weightedNote}: พบชิ้นงาน ${total} รายการ, ระดับถัดไป (ADVANCE) คิดเป็น ${passRate}% ของน้ำหนักรวม\nความเข้าใจผิดที่พบบ่อย: \n    ${misText || '—'}\nเกณฑ์ที่อ่อน: \n    ${weakLines || '—'}\n${rangeNote}`
  const weaknessInsights = `ประเด็นที่ควรซ่อมเสริม: ${stats.weakest.map((w) => w.criteria).join(', ') || '—'}`
  return {
    course,
    total,
    stats,
    summaryText,
    weaknessInsights,
    series: { labels, passRate: passRateSeries },
  }
}

export async function generateTeachingStrategyFromCourse(courseId, opts = {}) {
  const { course, summaryText, weaknessInsights } = await summarizeCourseFeedback(courseId, opts)
  if (!course) throw new Error('ไม่พบรายวิชา')
  const systemPrompt = await buildTeachingStrategyPrompt({
    courseTitle: course.title || course.main_topic || '(ไม่ระบุชื่อรายวิชา)',
    subject: course.subject_area || 'ทั่วไป',
    standardList: Array.isArray(course.standards) ? course.standards : [],
    indicators: Array.isArray(course.indicators) ? course.indicators : [],
    learningGoals: Array.isArray(course.learning_goals) ? course.learning_goals : [],
    studentWeaknessInsights: weaknessInsights,
    datasetSummary: summaryText,
  })
  return callServerJson('teachingStrategy', systemPrompt)
}
