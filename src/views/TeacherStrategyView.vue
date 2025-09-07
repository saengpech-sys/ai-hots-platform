<template>
  <div class="min-h-screen bg-gradient-to-b from-slate-50 to-white">
    <!-- Hero/Header -->
    <div class="no-print bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-600">
      <div class="max-w-7xl mx-auto px-6 py-8 text-white">
        <h1 class="text-2xl md:text-3xl font-semibold tracking-tight">กลยุทธ์การสอนด้วย AI</h1>
        <p class="opacity-90 mt-1 text-sm md:text-base">
          ใช้ข้อมูลจริงจากรายวิชาเพื่อสรุป Feedback ของนักเรียน และให้ AI
          ออกแบบแผนการสอนถัดไปอย่างมืออาชีพ
        </p>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-6 py-6">
      <!-- Controls + Action -->
      <div class="bg-white/80 backdrop-blur rounded-2xl shadow ring-1 ring-slate-200 p-5 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label class="block text-sm text-slate-600 mb-1">เลือกรายวิชา</label>
            <select v-model="selectedCourseId" class="w-full p-2.5 border rounded-lg">
              <option value="">— เลือก —</option>
              <option v-for="c in teacherCourses" :key="c.id" :value="c.id">
                {{ c.title || c.main_topic || c.id }}
              </option>
            </select>
          </div>

          <!-- Time window -->
          <div>
            <label class="block text-sm text-slate-600 mb-1">ช่วงเวลา</label>
            <div class="flex flex-wrap items-center gap-2">
              <select v-model="rangePreset" class="p-2.5 border rounded-lg">
                <option value="7d">7 วันล่าสุด</option>
                <option value="14d">14 วันล่าสุด</option>
                <option value="30d">30 วันล่าสุด</option>
                <option value="90d">90 วันล่าสุด</option>
                <option value="custom">กำหนดเอง</option>
              </select>
              <input
                v-if="rangePreset === 'custom'"
                type="date"
                v-model="fromDate"
                class="p-2 border rounded-lg"
              />
              <span v-if="rangePreset === 'custom'" class="text-slate-500">ถึง</span>
              <input
                v-if="rangePreset === 'custom'"
                type="date"
                v-model="toDate"
                class="p-2 border rounded-lg"
              />
            </div>
          </div>

          <div class="flex md:justify-end gap-2">
            <button
              :disabled="loading || !selectedCourseId"
              @click="runFromCourse(false)"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-60 shadow hover:bg-emerald-700 transition"
            >
              <span
                v-if="loading"
                class="inline-block h-4 w-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin"
              ></span>
              {{ loading ? 'กำลังสรุป Feedback...' : 'สร้างกลยุทธ์จาก Feedback นักเรียน' }}
            </button>
            <button
              :disabled="loading || !selectedCourseId"
              @click="runFromCourse(true)"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 transition"
              title="รีเฟรชและข้ามแคช"
            >
              รีเฟรช
            </button>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-4 items-center">
          <!-- Switch -->
          <label class="inline-flex items-center gap-2 text-sm text-slate-700 select-none">
            <button
              type="button"
              class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
              :class="weightRecent ? 'bg-emerald-600' : 'bg-slate-300'"
              @click="weightRecent = !weightRecent"
            >
              <span
                aria-hidden="true"
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                :class="weightRecent ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
            ถ่วงน้ำหนักงานล่าสุด
          </label>
          <label v-if="weightRecent" class="text-sm text-slate-600">
            Half-life (วัน):
            <input
              type="number"
              min="1"
              v-model.number="halfLifeDays"
              class="w-24 p-2 border rounded-lg ml-1"
            />
          </label>
        </div>

        <!-- Stats + Trend -->
        <div v-if="stats || preview" class="mt-5">
          <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div
              class="rounded-xl ring-1 ring-slate-200 p-4 bg-gradient-to-br from-white to-slate-50"
            >
              <div class="text-xs text-slate-500">ชิ้นงานทั้งหมด</div>
              <div class="mt-1 text-2xl font-semibold text-slate-800">{{ total || 0 }}</div>
            </div>
            <div
              class="rounded-xl ring-1 ring-slate-200 p-4 bg-gradient-to-br from-white to-slate-50"
            >
              <div class="text-xs text-slate-500">อัตรา ADVANCE</div>
              <div class="mt-1 text-2xl font-semibold text-emerald-700">{{ passRate }}%</div>
            </div>
            <div
              class="rounded-xl ring-1 ring-slate-200 p-4 bg-gradient-to-br from-white to-slate-50"
            >
              <div class="text-xs text-slate-500">ข้อผิดพลาดที่พบบ่อย</div>
              <div class="mt-1 text-sm font-medium text-slate-800 truncate">
                {{ topErrorTag || '—' }}
              </div>
            </div>
            <div
              class="rounded-xl ring-1 ring-slate-200 p-4 bg-gradient-to-br from-white to-slate-50"
            >
              <div class="text-xs text-slate-500">เกณฑ์ที่ควรเสริม (Top 3)</div>
              <ul class="mt-1 text-sm text-slate-800 space-y-0.5">
                <li v-for="(w, i) in (stats?.weakest || []).slice(0, 3)" :key="i" class="truncate">
                  •
                  <RouterLink
                    v-if="selectedCourseId && w?.criteria"
                    :to="{
                      name: 'teacher-course-submissions',
                      params: { courseId: selectedCourseId },
                      query: { criteria: w.criteria },
                    }"
                    class="text-indigo-700 hover:underline"
                  >
                    {{ w.criteria }}
                  </RouterLink>
                  <template v-else>{{ w.criteria }}</template>
                </li>
                <li v-if="!(stats?.weakest || []).length" class="text-slate-400">—</li>
              </ul>
            </div>
            <div
              class="rounded-xl ring-1 ring-slate-200 p-4 bg-gradient-to-br from-white to-slate-50"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs text-slate-500">แนวโน้ม Pass Rate</div>
                  <div class="text-[10px] text-slate-500">{{ trendLabels.join(' · ') }}</div>
                </div>
                <div class="w-28 h-10">
                  <svg v-if="passRateSeries.length" :viewBox="'0 0 100 30'">
                    <polyline
                      :points="sparkPoints(passRateSeries, 100, 30)"
                      fill="none"
                      stroke="#10b981"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <div v-else class="text-xs text-slate-400 text-right">—</div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="preview" class="mt-4 grid md:grid-cols-3 gap-4">
            <div
              class="md:col-span-2 text-xs whitespace-pre-wrap text-slate-700 bg-slate-50 p-4 rounded-xl ring-1 ring-slate-200"
            >
              {{ preview }}
            </div>
            <div class="text-xs bg-slate-50 p-4 rounded-xl ring-1 ring-slate-200">
              <div class="font-medium text-slate-700 mb-2">คำอธิบายป้ายข้อผิดพลาด (แปลไทย)</div>
              <ul class="space-y-1 text-slate-700">
                <li>
                  <span class="font-semibold">superficial_analysis</span> — วิเคราะห์ตื้นเกินไป:
                  อธิบายผิวเผิน ไม่เชื่อมโยงเหตุผล/หลักฐานเชิงลึก
                </li>
                <li>
                  <span class="font-semibold">insufficient_evidence</span> — หลักฐานไม่เพียงพอ:
                  ข้อสรุปไม่รองรับด้วยข้อมูลหรือหลักฐานที่พอเพียง
                </li>
                <li>
                  <span class="font-semibold">unclear_structure</span> — โครงสร้างไม่ชัดเจน:
                  ลำดับความคิดไม่ชัด ทำให้อ่านยาก
                </li>
                <li>
                  <span class="font-semibold">reasoning_gap</span> — ช่องว่างของเหตุผล:
                  มีการกระโดดเหตุผล ไม่ต่อเนื่อง
                </li>
                <li>
                  <span class="font-semibold">incorrect_fact</span> — ข้อมูลผิด:
                  อ้างข้อเท็จจริงคลาดเคลื่อน
                </li>
                <li>
                  <span class="font-semibold">misunderstanding_question</span> — ตีความโจทย์ผิด:
                  ตอบไม่ตรงคำถาม/ใจความ
                </li>
                <li>
                  <span class="font-semibold">logical_fallacy</span> — ตรรกะผิดพลาด:
                  มีความคลาดเคลื่อนทางตรรกะ
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Result -->
      <div class="mt-6 bg-white rounded-2xl shadow ring-1 ring-slate-200 p-5 md:p-6 relative">
        <div class="no-print absolute right-5 top-5">
          <button
            v-if="result"
            @click="exportPdf"
            class="px-3 py-1.5 text-sm rounded-lg bg-slate-800 text-white shadow hover:bg-slate-900"
          >
            Export PDF
          </button>
        </div>
        <h2 class="text-lg font-semibold text-slate-800 mb-3">ผลลัพธ์ AI</h2>
        <div v-if="!result" class="text-slate-500">ยังไม่มีผลลัพธ์</div>

        <div v-else class="space-y-6">
          <div
            class="rounded-xl bg-gradient-to-br from-indigo-50 to-emerald-50 p-4 ring-1 ring-slate-200"
          >
            <div class="text-sm text-slate-600">สรุปภาพรวม</div>
            <p class="mt-1 font-medium text-slate-900">{{ result.strategy_summary }}</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="rounded-xl ring-1 ring-slate-200 p-4">
              <div class="text-sm text-slate-500 mb-2">ความเข้าใจผิดสำคัญ</div>
              <ul class="grid grid-cols-1 gap-2">
                <li
                  v-for="(m, i) in result.key_misconceptions"
                  :key="i"
                  class="px-3 py-2 rounded-lg bg-slate-50 text-slate-800"
                >
                  • {{ m }}
                </li>
              </ul>
            </div>

            <div class="rounded-xl ring-1 ring-slate-200 p-4">
              <div class="text-sm text-slate-500 mb-2">Formative Check</div>
              <ul class="grid grid-cols-1 gap-2">
                <li
                  v-for="(f, i) in result.formative_checks"
                  :key="i"
                  class="px-3 py-2 rounded-lg bg-slate-50 text-slate-800"
                >
                  • {{ f }}
                </li>
              </ul>
            </div>
          </div>

          <div class="rounded-xl ring-1 ring-slate-200 p-4">
            <div class="text-sm text-slate-500 mb-2">ลำดับแผนการสอน</div>
            <ol class="relative ml-4 border-l-2 border-slate-200">
              <li v-for="(l, i) in result.lesson_sequence" :key="i" class="mb-5 ml-4">
                <span
                  class="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 ring-4 ring-white"
                ></span>
                <div class="font-medium text-slate-900">{{ l.title }}</div>
                <div class="text-sm text-slate-600">วัตถุประสงค์: {{ l.objective }}</div>
                <div class="text-sm text-slate-600">
                  กิจกรรม: {{ (l.activities || []).join(', ') }}
                </div>
                <div class="text-sm text-slate-600">
                  สื่อ/อุปกรณ์: {{ (l.materials || []).join(', ') }}
                </div>
              </li>
            </ol>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="rounded-xl ring-1 ring-slate-200 p-4">
              <div class="text-sm text-slate-500 mb-2">ซ่อมเสริม (Remediation)</div>
              <ul class="grid grid-cols-1 gap-2">
                <li
                  v-for="(r, i) in result.remediation"
                  :key="i"
                  class="px-3 py-2 rounded-lg bg-slate-50 text-slate-800"
                >
                  • {{ r }}
                </li>
              </ul>
            </div>
            <div class="rounded-xl ring-1 ring-slate-200 p-4">
              <div class="text-sm text-slate-500 mb-2">เสริมศักยภาพ (Enrichment)</div>
              <ul class="grid grid-cols-1 gap-2">
                <li
                  v-for="(e, i) in result.enrichment"
                  :key="i"
                  class="px-3 py-2 rounded-lg bg-slate-50 text-slate-800"
                >
                  • {{ e }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Coach Toolkit: Micro-playlist & Checklists -->
      <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-2xl shadow ring-1 ring-slate-200 p-5 md:p-6">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-base font-semibold text-slate-800">
              Micro‑playlist แนะนำ (20–30 นาที)
            </h3>
            <button
              @click="copyText(recommendedPlaylist.join('\n'))"
              class="no-print text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
            >
              คัดลอก
            </button>
          </div>
          <ul class="list-disc pl-5 text-slate-800 space-y-1">
            <li v-for="(item, i) in recommendedPlaylist" :key="i" class="leading-relaxed">
              {{ item }}
            </li>
            <li v-if="!recommendedPlaylist.length" class="text-slate-400">—</li>
          </ul>
        </div>

        <div class="bg-white rounded-2xl shadow ring-1 ring-slate-200 p-5 md:p-6">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-base font-semibold text-slate-800">เช็กลิสต์สั้นสำหรับนักเรียน</h3>
            <div class="no-print flex gap-2">
              <button
                @click="copyText(checklistCER.join('\n'))"
                class="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
              >
                คัดลอก CER
              </button>
              <button
                @click="copyText(checklistStructure.join('\n'))"
                class="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
              >
                คัดลอกโครงสร้าง
              </button>
              <button
                @click="copyText(checklistBridge.join('\n'))"
                class="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
              >
                คัดลอกสะพานเหตุผล
              </button>
            </div>
          </div>
          <div class="grid sm:grid-cols-3 gap-4 text-sm text-slate-800">
            <div>
              <div class="font-medium mb-1">CER (Claim‑Evidence‑Reasoning)</div>
              <ul class="list-disc pl-5 space-y-1">
                <li v-for="(c, i) in checklistCER" :key="'cer-' + i">{{ c }}</li>
              </ul>
            </div>
            <div>
              <div class="font-medium mb-1">โครงสร้าง</div>
              <ul class="list-disc pl-5 space-y-1">
                <li v-for="(c, i) in checklistStructure" :key="'st-' + i">{{ c }}</li>
              </ul>
            </div>
            <div>
              <div class="font-medium mb-1">สะพานเหตุผล</div>
              <ul class="list-disc pl-5 space-y-1">
                <li v-for="(c, i) in checklistBridge" :key="'br-' + i">{{ c }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer actions: CSV & Save Mini-Lesson -->
      <div
        class="no-print mt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3"
      >
        <div class="text-xs text-slate-500">
          ข้อมูลจะใช้ตัวกรองช่วงเวลาและถ่วงน้ำหนักตามตัวเลือกด้านบน
        </div>
        <div class="flex gap-2 justify-end">
          <button
            @click="exportCsv"
            class="px-3 py-1.5 text-sm rounded bg-slate-100 hover:bg-slate-200"
          >
            Export CSV (analytics)
          </button>
          <button
            :disabled="!selectedCourseId || !result"
            @click="saveMiniLesson"
            class="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white disabled:opacity-60 hover:bg-emerald-700"
          >
            บันทึกเป็น Mini-lesson
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { doc, getDoc } from 'firebase/firestore'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { getAuthInstance, getFirestoreInstance } from '@/firebase/config'
import { generateTeachingStrategyFromCourse, summarizeCourseFeedback } from '@/services/aiService'
import { toast } from '@/utils/toast'
import { getTeacherCourses } from '@/services/firestoreService'

const loading = ref(false)
const result = ref(null)
const teacherCourses = ref([])
const selectedCourseId = ref('')

const preview = ref('')
const weightRecent = ref(false)
const halfLifeDays = ref(14)

const total = ref(0)
const stats = ref(null)
const passRate = ref(0)
const topErrorTag = ref('')
const weakestCriteria = ref('')

// time window
const rangePreset = ref('14d')
const fromDate = ref('')
const toDate = ref('')

const passRateSeries = ref([])
const trendLabels = ref([])
const router = useRouter()

function computeRangeTs() {
  const now = new Date()
  let start, end
  if (rangePreset.value === 'custom') {
    if (!fromDate.value || !toDate.value) return { fromTs: null, toTs: null }
    start = new Date(fromDate.value + 'T00:00:00')
    end = new Date(toDate.value + 'T23:59:59')
  } else {
    const days = Number(rangePreset.value.replace('d', ''))
    end = now
    start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  }
  return { fromTs: start.getTime(), toTs: end.getTime() }
}

// sparkline helper
function sparkPoints(series, w, h) {
  if (!series.length) return ''
  const max = Math.max(...series, 100)
  const min = Math.min(...series, 0)
  const span = max - min || 1
  return series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * (w - 2) + 1
      const y = h - 1 - ((v - min) / span) * (h - 2)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

async function runFromCourse(forceRefresh = false) {
  try {
    if (!selectedCourseId.value) {
      toast.warning('กรุณาเลือกรายวิชา')
      return
    }
    const { fromTs, toTs } = computeRangeTs()
    if (!fromTs || !toTs) {
      toast.warning('โปรดระบุช่วงเวลาให้ครบ')
      return
    }

    loading.value = true
    result.value = null
    preview.value = ''

    // cache key
    const cacheKey = [
      'teach-strategy',
      selectedCourseId.value,
      fromTs,
      toTs,
      weightRecent.value ? 1 : 0,
      halfLifeDays.value,
    ].join(':')

    if (!forceRefresh) {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const obj = JSON.parse(cached)
        // 6 ชม. TTL
        if (Date.now() - obj.savedAt < 6 * 60 * 60 * 1000) {
          preview.value = obj.preview
          stats.value = obj.stats
          total.value = obj.total
          passRate.value = obj.passRate
          topErrorTag.value = obj.topErrorTag
          weakestCriteria.value = obj.weakestCriteria
          passRateSeries.value = obj.passRateSeries || []
          trendLabels.value = obj.trendLabels || []
          result.value = obj.result
          return
        }
      }
    }

    const opts = {
      weightRecent: weightRecent.value,
      halfLifeDays: halfLifeDays.value,
      fromTs,
      toTs,
    }

    // 1) summarize (preview + trend)
    const agg = await summarizeCourseFeedback(selectedCourseId.value, opts)
    preview.value = agg.summaryText
    stats.value = agg.stats
    total.value = agg.total

    const pass = Number(agg.stats?.counts?.ADVANCE || 0)
    const reinf = Number(agg.stats?.counts?.REINFORCE || 0)
    const denom = weightRecent.value ? pass + reinf : agg.total || 0
    passRate.value = denom ? Math.round((pass / denom) * 100) : 0
    topErrorTag.value = agg.stats?.errorTagsSorted?.[0]?.tag || ''
    weakestCriteria.value = agg.stats?.weakest?.[0]?.criteria || ''

    passRateSeries.value = agg.series?.passRate || []
    trendLabels.value = agg.series?.labels || []

    // 2) generate strategy
    const resp = await generateTeachingStrategyFromCourse(selectedCourseId.value, opts)
    if (!resp) {
      toast.error('AI ไม่สามารถสร้างกลยุทธ์ได้ ลองใหม่อีกครั้ง')
      return
    }
    result.value = resp

    // save cache
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        savedAt: Date.now(),
        preview: preview.value,
        stats: stats.value,
        total: total.value,
        passRate: passRate.value,
        topErrorTag: topErrorTag.value,
        weakestCriteria: weakestCriteria.value,
        passRateSeries: passRateSeries.value,
        trendLabels: trendLabels.value,
        result: result.value,
      }),
    )
  } catch (e) {
    toast.error(`เกิดข้อผิดพลาด: ${e?.message || 'ไม่ทราบสาเหตุ'}`)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const auth = await getAuthInstance()
    const db = await getFirestoreInstance()
    const uid = auth.currentUser?.uid
    if (!uid) return
    teacherCourses.value = await getTeacherCourses(uid)
    const q = router.currentRoute.value.query || {}
    if (q.courseId && typeof q.courseId === 'string') selectedCourseId.value = q.courseId
    if (q.miniLessonId && typeof q.miniLessonId === 'string') {
      try {
        const ref = doc(db, 'mini_lessons', q.miniLessonId)
        const snap = await getDoc(ref)
        if (snap.exists()) {
          const data = snap.data() || {}
          result.value = data.plan || null
          const f = data.filters || {}
          rangePreset.value = f.rangePreset || rangePreset.value
          fromDate.value = f.fromDate || fromDate.value
          toDate.value = f.toDate || toDate.value
          weightRecent.value = !!f.weightRecent
          halfLifeDays.value = Number(f.halfLifeDays || halfLifeDays.value)
          stats.value = data.stats_snapshot || stats.value
        }
      } catch {}
    }
  } catch {}
})

function exportPdf() {
  window.print()
}

// ---------- Coach Toolkit logic ----------
const tagToPlaylist = {
  superficial_analysis: [
    'Mini‑lesson: 3 ชั้นความลึก (ข้อเท็จจริง → เหตุผล → ผลกระทบ/ข้อโต้แย้ง)',
    'แบบฝึก: เติมเหตุผลและข้อโต้แย้งให้คำตอบสั้นเดิม 1 ประเด็น',
  ],
  insufficient_evidence: [
    'Evidence bank: เลือกหลักฐานอย่างน้อย 2 ชิ้นรองรับข้อสรุป',
    'CER drill: เขียน Claim‑Evidence‑Reasoning แบบย่อ 2 รอบ',
  ],
  unclear_structure: [
    'โครงร่าง 4 ส่วน: สรุป → เหตุผลหลัก → หลักฐาน → สรุป/ข้อจำกัด',
    'การ์ดคิว: เรียงประโยค 5–7 ประโยคให้เป็นลำดับที่สมเหตุผล',
  ],
  reasoning_gap: [
    'สะพานเหตุผล 3 ระยะ: ข้อเท็จจริง → อนุมานกลาง → ข้อสรุป (เติมอนุมานกลาง)',
    'โจทย์ย้อนศร: ให้ข้อสรุปมา แล้วหาอนุมานกลาง 2 แบบ',
  ],
}

const recommendedPlaylist = computed(() => {
  const items = []
  const tags = (stats.value?.errorTagsSorted || []).slice(0, 2).map((t) => t.tag)
  for (const tag of tags) {
    const acts = tagToPlaylist[tag]
    if (acts) items.push(...acts)
  }
  // reinforce by weakest criteria keywords
  const wk = (stats.value?.weakest || []).slice(0, 2).map((w) => String(w.criteria || ''))
  for (const c of wk) {
    const t = c.toLowerCase()
    if (t.includes('หลักฐาน') || t.includes('evidence'))
      items.push('ตรวจทานหลักฐาน: ครอบคลุมทั้งสองด้านและเชื่อมโยงกับข้อสรุป')
    if (t.includes('โครง') || t.includes('structure'))
      items.push('ใช้โครงร่าง 4 ส่วน แล้วเขียนย่อหน้าอย่างมีวรรคตอน')
    if (t.includes('เหตุผล') || t.includes('reason'))
      items.push('เติมสะพานเหตุผลให้ครบทุกช่วง (ไม่มีช่องว่าง)')
  }
  return Array.from(new Set(items)).slice(0, 6)
})

const checklistCER = [
  'ฉันระบุ Claim (ข้อสรุปหลัก) ชัดเจน',
  'ฉันเลือก Evidence อย่างน้อย 2 ชิ้นรองรับ Claim',
  'ฉันอธิบาย Reasoning ว่าทำไม Evidence จึงสนับสนุน Claim',
]

const checklistStructure = [
  'ย่อหน้าเปิด: สรุปประเด็นหลักสั้นๆ',
  'แกนกลาง: เหตุผลหลัก + หลักฐานประกอบ',
  'ย่อหน้าปิด: สรุป/ข้อจำกัด/ข้อเสนอแนะ',
]

const checklistBridge = [
  'ไม่มีการกระโดดเหตุผล: มีอนุมานกลางครบทุกช่วง',
  'ตรวจว่าแต่ละข้อยึดโยงกับหลักฐานที่เลือก',
  'มีข้อโต้แย้ง/มุมมองตรงข้ามสั้นๆ (ถ้าจำเป็น)',
]

function copyText(text) {
  try {
    navigator.clipboard.writeText(text)
    // optional toast
  } catch (_) {}
}

// CSV helpers: include metadata header rows for course/time-range/weighting
function csvMetaRows() {
  const rows = []
  const course = teacherCourses.value.find((c) => c.id === selectedCourseId.value) || {}
  const { fromTs, toTs } = computeRangeTs()
  const range =
    fromTs && toTs
      ? `${new Date(fromTs).toLocaleDateString()} – ${new Date(toTs).toLocaleDateString()}`
      : '—'
  rows.push(['Course ID', selectedCourseId.value || '—'])
  rows.push(['Course Title', course.title || course.main_topic || '—'])
  rows.push(['Time Range', range])
  rows.push(['Weight Recent', weightRecent.value ? 'yes' : 'no'])
  if (weightRecent.value) rows.push(['Half-life (days)', String(halfLifeDays.value)])
  rows.push([])
  return rows
}

function exportCsv() {
  const rows = []
  rows.push(...csvMetaRows())
  rows.push(['Metric', 'Value'])
  rows.push(['Total Submissions', total.value])
  rows.push(['Pass Rate (%)', passRate.value])
  rows.push([])
  rows.push(['Error Tag', 'Score'])
  for (const e of stats.value?.errorTagsSorted || []) rows.push([e.tag, e.count ?? e.score ?? ''])
  rows.push([])
  rows.push(['Weak Criteria', 'Avg/Score', 'N/Weight', 'Low Count'])
  for (const w of stats.value?.weakest || [])
    rows.push([w.criteria, w.avg ?? w.score ?? '', w.n ?? '', w.lowCount ?? ''])
  rows.push([])
  rows.push(['Week', 'Pass Rate (%)'])
  for (let i = 0; i < trendLabels.value.length; i += 1)
    rows.push([trendLabels.value[i], passRateSeries.value[i] ?? ''])

  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/\"/g, '""')}"`).join(','))
    .join('\n')
  // Prepend BOM for Thai characters in Excel
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `course-insights-${selectedCourseId.value || 'unknown'}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// Persist current plan + toolkit as a reusable mini-lesson
async function saveMiniLesson() {
  const auth = await getAuthInstance()
  const db = await getFirestoreInstance()
  if (!auth.currentUser) {
    toast.error('ยังไม่ได้เข้าสู่ระบบ')
    return
  }
  try {
    const payload = {
      courseId_ref: selectedCourseId.value,
      teacherId_ref: auth.currentUser.uid,
      plan: result.value,
      toolkit: {
        playlist: recommendedPlaylist.value,
        checklistCER,
        checklistStructure,
        checklistBridge,
      },
      filters: {
        rangePreset: rangePreset.value,
        fromDate: fromDate.value,
        toDate: toDate.value,
        weightRecent: weightRecent.value,
        halfLifeDays: halfLifeDays.value,
      },
      stats_snapshot: {
        total: total.value,
        passRate: passRate.value,
        topErrorTag: topErrorTag.value,
        weakest: (stats.value?.weakest || []).slice(0, 5),
      },
      createdAt: serverTimestamp(),
    }
    const docRef = await addDoc(collection(db, 'mini_lessons'), payload)
    const lessonId = docRef.id
    // Show actionable toast: navigate directly to filtered examples
    const firstWeak = payload.stats_snapshot.weakest?.[0]?.criteria || ''
    toast.success('บันทึก Mini‑lesson แล้ว', {
      actionLabel: 'ดูตัวอย่าง',
      onClick: () => {
        router.push({
          name: 'teacher-course-submissions',
          params: { courseId: selectedCourseId.value },
          query: firstWeak ? { criteria: firstWeak } : {},
        })
      },
    })
  } catch (e) {
    toast.error('บันทึกไม่สำเร็จ')
  }
}
</script>

<style scoped>
/* Print: hide interactive controls and background */
@media print {
  .no-print {
    display: none !important;
  }
  .bg-gradient-to-b,
  .bg-gradient-to-r {
    background: none !important;
  }
  .ring-slate-200 {
    box-shadow: none !important;
    border-color: #e2e8f0 !important;
  }
}
</style>
