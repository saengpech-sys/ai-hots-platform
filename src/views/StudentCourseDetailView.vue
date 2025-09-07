<template>
  <div class="bg-slate-50 min-h-screen p-6">
    <div class="max-w-5xl mx-auto">
      <!-- Header / Hero -->
      <div class="flex items-start justify-between mb-6 gap-3">
        <div class="flex items-center gap-3">
          <RouterLink
            to="/my-courses"
            class="inline-flex items-center text-indigo-600 hover:text-indigo-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="w-5 h-5 mr-1"
            >
              <path d="M10.5 19.5 3 12l7.5-7.5 1.06 1.06L5.62 11H21v2H5.62l5.94 5.94-1.06 1.06Z" />
            </svg>
            กลับ
          </RouterLink>
        </div>
        <button
          class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200 shadow-sm"
          @click="startForceNew"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="w-4 h-4"
          >
            <path d="M12 6V3l-4 4 4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6Z" />
          </svg>
          สุ่มสถานการณ์ใหม่
        </button>
      </div>

      <header class="mb-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm" v-reveal>
        <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900">
          {{ course?.title || 'รายวิชา' }}
        </h1>
        <p class="text-slate-600 mt-2 line-clamp-4">{{ course?.description }}</p>
        <!-- Keep standards/indicators chips -->
        <div class="mt-4 flex flex-wrap gap-2">
          <span
            v-if="course?.standards?.length"
            class="px-2 py-1 text-xs rounded-full bg-emerald-50 text-emerald-700"
            >มาตรฐาน {{ course.standards.length }}</span
          >
          <span
            v-if="course?.indicators?.length"
            class="px-2 py-1 text-xs rounded-full bg-sky-50 text-sky-700"
            >ตัวชี้วัด {{ course.indicators.length }}</span
          >
        </div>
        <!-- Emphasized category at bottom of header -->
        <div v-if="course?.subject_area || course?.main_topic" class="mt-3">
          <div class="flex flex-wrap gap-2">
            <span
              v-if="course?.subject_area"
              class="px-3 py-1.5 text-xs font-medium rounded-full text-white shadow-sm bg-gradient-to-r from-indigo-600 to-sky-500"
              >หมวดหมู่: {{ course.subject_area }}</span
            >
            <span
              v-if="course?.main_topic"
              class="px-2.5 py-1 text-xs rounded-full bg-slate-100 text-slate-700 border border-slate-200"
              >หัวข้อ: {{ course.main_topic }}</span
            >
          </div>
        </div>
      </header>

      <!-- Leaderboard -->
      <section class="mb-10">
        <h2 class="text-lg md:text-xl font-semibold text-slate-800 mb-3">กระดานผู้นำ</h2>
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm" v-reveal>
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <span class="text-sm text-slate-600">ช่วงเวลา</span>
            <div class="inline-flex rounded-lg overflow-hidden border border-slate-200">
              <button
                class="px-3 py-1 text-sm"
                :class="
                  timeframe === 'week' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'
                "
                @click="setTimeframe('week')"
              >
                สัปดาห์นี้
              </button>
              <button
                class="px-3 py-1 text-sm"
                :class="
                  timeframe === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'
                "
                @click="setTimeframe('all')"
              >
                ทั้งหมด
              </button>
            </div>
            <div
              class="inline-flex rounded-lg overflow-hidden border border-slate-200 ml-2"
              title="โหมดเรียง: Level=เลเวลสูงสุดก่อน • Best=คะแนนสูงสุด • Avg=ค่าเฉลี่ยคะแนน"
            >
              <button
                class="px-3 py-1 text-sm"
                :class="
                  sortMode === 'level' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'
                "
                @click="sortMode = 'level'"
              >
                Level
              </button>
              <button
                class="px-3 py-1 text-sm"
                :class="
                  sortMode === 'best' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'
                "
                @click="sortMode = 'best'"
              >
                Best
              </button>
              <button
                class="px-3 py-1 text-sm"
                :class="sortMode === 'avg' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'"
                @click="sortMode = 'avg'"
              >
                Avg
              </button>
            </div>
            <div class="inline-flex items-center ml-2 gap-1 text-sm text-slate-600">
              <span>Top</span>
              <select v-model.number="topLimit" class="input-style text-sm w-20">
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
              </select>
            </div>
            <div class="ml-auto flex gap-2">
              <select v-model="filterClass" class="input-style text-sm min-w-[120px]">
                <option value="">ทุกชั้น</option>
                <option v-for="g in gradeLevelsOpts" :key="g" :value="g">ชั้น {{ g }}</option>
              </select>
              <select v-model="filterRoom" class="input-style text-sm min-w-[100px]">
                <option value="">ทุกห้อง</option>
                <option v-for="n in 20" :key="n" :value="String(n)">ห้อง {{ n }}</option>
              </select>
            </div>
          </div>
          <div class="flex items-center justify-between mb-2">
            <div v-if="myRank" class="text-sm text-slate-600">
              อันดับของฉัน: <span class="font-semibold text-indigo-700">#{{ myRank }}</span>
              <span
                v-if="myLevel"
                class="ml-2 text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200"
                >Lv {{ myLevel }}</span
              >
              <span v-if="myAvg != null" class="ml-2 text-xs text-slate-500">Avg {{ myAvg }}%</span>
              <span v-if="myXp != null" class="ml-2 text-xs text-slate-500">XP {{ myXp }}</span>
            </div>
            <div class="text-xs text-slate-500" v-if="allowGamification">
              Top {{ leaderboard.length }}
            </div>
          </div>
          <ul v-if="leaderboard.length && allowGamification" class="divide-y divide-slate-100">
            <li v-for="(p, idx) in leaderboard" :key="p.uid" class="flex items-center gap-3 py-2">
              <div class="w-6 text-slate-500 font-semibold">#{{ idx + 1 }}</div>
              <img
                :src="p.photoURL || '/avatar.svg'"
                alt="avatar"
                class="h-8 w-8 rounded-full object-cover bg-slate-200"
              />
              <div class="flex-1 min-w-0">
                <div class="truncate text-sm text-slate-800 flex items-center gap-2">
                  <span>{{ p.name || 'Student' }}</span>
                  <span
                    v-if="p.level"
                    class="px-1.5 py-0.5 text-[10px] rounded bg-indigo-50 text-indigo-600 border border-indigo-200"
                    >Lv {{ p.level }}</span
                  >
                </div>
                <div class="text-xs text-slate-500 flex items-center gap-2">
                  <span>คะแนนสูงสุดล่าสุด</span>
                  <span v-if="p.avgScore != null" class="text-[10px] text-slate-400"
                    >Avg {{ p.avgScore }}%</span
                  >
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span
                  v-if="p.bestScore != null"
                  class="px-2 py-0.5 rounded-full text-[11px] border hidden sm:inline"
                  :class="medalBadgeClass(p.bestScore)"
                >
                  {{ medalLabel(p.bestScore) }}
                </span>
                <div class="flex flex-col items-end w-24">
                  <div
                    class="text-sm font-semibold"
                    :class="
                      idx === 0
                        ? 'text-emerald-600'
                        : idx === 1
                          ? 'text-blue-600'
                          : idx === 2
                            ? 'text-amber-600'
                            : 'text-slate-700'
                    "
                  >
                    {{ p.bestScore }}%
                  </div>
                  <div class="h-1.5 bg-slate-200 rounded w-full mt-1 overflow-hidden">
                    <div
                      class="h-1.5 bg-indigo-500"
                      :style="{
                        width:
                          Math.min(100, Math.round(((p.xp || 0) / (myXp || p.xp || 1)) * 100)) +
                          '%',
                      }"
                      title="สัดส่วน XP เทียบกับของฉัน"
                    ></div>
                  </div>
                </div>
              </div>
            </li>
          </ul>
          <div v-else class="text-sm text-slate-500">ยังไม่มีข้อมูลสำหรับตัวกรองนี้</div>
        </div>
      </section>

      <!-- Active Missions -->
      <section class="mb-10">
        <h2 class="text-lg md:text-xl font-semibold text-slate-800 mb-3">
          ภารกิจของฉัน (ยังไม่ได้ทำ)
        </h2>
        <div v-if="activeMissions.length" class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <article
            v-for="m in activeMissions"
            :key="m.id"
            class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:shadow-md transition"
            v-reveal
          >
            <div class="min-w-0 flex-1">
              <!-- Scenario title -->
              <div class="text-slate-900 font-medium text-sm sm:text-base line-clamp-2">
                {{ m._scenarioTitle || 'สถานการณ์' }}
              </div>
              <!-- Chips -->
              <div class="mt-1 flex flex-wrap items-center gap-2">
                <span
                  class="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full bg-violet-50 text-violet-700"
                >
                  ทักษะ
                </span>
                <span class="text-slate-700 text-xs">{{ m.skill_targeted || '-' }}</span>
                <span
                  class="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full"
                  :class="difficultyBadgeClass(m.difficulty)"
                >
                  {{ difficultyLabel(m.difficulty) }}
                </span>
              </div>
              <div class="text-slate-500 text-xs mt-1">สร้างเมื่อ: {{ toDate(m.createdAt) }}</div>
            </div>
            <div class="w-full sm:w-auto">
              <button
                class="w-full sm:w-auto px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                @click="startMission(m.id)"
              >
                เริ่ม/ต่อ
              </button>
            </div>
          </article>
        </div>
        <div
          v-else
          class="bg-white rounded-xl border border-slate-200 p-6 text-slate-600 shadow-sm"
          v-reveal
        >
          <div class="flex items-center justify-between">
            <div>ยังไม่มีภารกิจที่สร้างไว้</div>
            <button
              class="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              @click="startForceNew"
            >
              เริ่มวงจรการเรียนรู้
            </button>
          </div>
        </div>
      </section>

      <!-- History -->
      <section class="mb-10">
        <h2 class="text-lg md:text-xl font-semibold text-slate-800 mb-3">ประวัติภารกิจ</h2>
        <div v-if="history.length" class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <article
            v-for="m in history"
            :key="m.id"
            class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition"
            v-reveal
          >
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="text-slate-900 font-medium text-sm sm:text-base line-clamp-2">
                  {{ m._scenarioTitle || 'สถานการณ์' }}
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    class="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full bg-violet-50 text-violet-700"
                    >ทักษะ</span
                  >
                  <span class="text-slate-700 text-xs">{{ m.skill_targeted || '-' }}</span>
                  <span
                    v-if="m._score != null"
                    class="px-2 py-0.5 rounded-full text-[11px] border"
                    :class="medalBadgeClass(m._score)"
                  >
                    {{ medalLabel(m._score) }}
                  </span>
                </div>
                <div class="text-slate-500 text-xs mt-1">
                  ทำสำเร็จเมื่อ: {{ toDate(m.updatedAt) }}
                </div>
              </div>
              <div class="sm:text-right">
                <div class="text-xs text-slate-500">คะแนนที่ได้รับ</div>
                <div
                  class="mt-0.5 inline-flex items-center px-2 py-1 rounded-md text-sm font-semibold"
                  :class="badgeColor(m._score)"
                >
                  {{ displayScore(m._score) }}
                </div>
                <div
                  v-if="m._rankChange != null"
                  class="mt-1 inline-flex items-center text-xs"
                  :class="
                    m._rankChange > 0
                      ? 'text-emerald-600'
                      : m._rankChange < 0
                        ? 'text-rose-600'
                        : 'text-slate-500'
                  "
                >
                  <svg
                    v-if="m._rankChange > 0"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="w-4 h-4 mr-1"
                  >
                    <path d="M12 5l6 6h-4v8h-4v-8H6z" />
                  </svg>
                  <svg
                    v-else-if="m._rankChange < 0"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="w-4 h-4 mr-1 rotate-180"
                  >
                    <path d="M12 5l6 6h-4v8h-4v-8H6z" />
                  </svg>
                  <span>{{ m._rankChange > 0 ? '+' + m._rankChange : m._rankChange }}</span>
                </div>
                <div class="mt-2">
                  <button
                    :class="evalButtonClass(m._score)"
                    :aria-label="scoreViewButtonText(m._score)"
                    @click="openResult(m)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      class="w-4 h-4"
                    >
                      <path
                        d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
                      />
                    </svg>
                    {{ scoreViewButtonText(m._score) }}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
        <div v-else class="text-slate-500" v-reveal>ยังไม่มีประวัติ</div>
      </section>

      <!-- Result Modal -->
      <div
        v-if="resultOpen"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      >
        <div class="absolute inset-0 bg-black/40" @click="closeResult"></div>
        <div
          class="relative w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 sm:p-6 max-h-[85vh] overflow-y-auto"
        >
          <div class="flex items-start justify-between gap-2">
            <h3 class="text-lg font-semibold text-slate-900">ผลการประเมิน</h3>
            <button class="p-2 rounded-md hover:bg-slate-100" @click="closeResult">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="w-5 h-5"
              >
                <path
                  d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z"
                />
              </svg>
            </button>
          </div>
          <div v-if="resultData">
            <div class="mt-2 text-slate-900 font-medium">
              {{ resultData._scenarioTitle || 'สถานการณ์' }}
            </div>
            <div class="mt-1 text-xs text-slate-500">
              ทักษะ: {{ resultData.skill_targeted || '-' }}
            </div>
            <div class="mt-4">
              <div class="text-xs text-slate-500">คะแนนรวม</div>
              <div
                class="mt-1 inline-flex items-center px-2 py-1 rounded-md text-sm font-semibold"
                :class="badgeColor(resultData._score)"
              >
                {{ displayScore(resultData._score) }}
              </div>
            </div>
            <div v-if="resultData._feedback?.summary_feedback" class="mt-4">
              <div class="text-sm font-medium text-slate-800">สรุปผล</div>
              <p class="mt-1 text-slate-700">{{ resultData._feedback.summary_feedback }}</p>
            </div>
            <div v-if="resultData._feedback?.rubric_scores" class="mt-4">
              <div class="text-sm font-medium text-slate-800">Rubric</div>
              <div class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="(label, key) in resultData._feedback.rubric_scores"
                  :key="key"
                  class="inline-flex items-center px-2 py-1 rounded-md text-xs border"
                  :class="rubricBadge(label)"
                  >{{ key }}: {{ label }}</span
                >
              </div>
            </div>
            <div v-if="(resultData._feedback?.detailed_feedback || []).length" class="mt-4">
              <div class="text-sm font-medium text-slate-800">รายละเอียดรายเกณฑ์</div>
              <ul class="mt-2 space-y-2">
                <li
                  v-for="(d, idx) in resultData._feedback.detailed_feedback"
                  :key="idx"
                  class="text-sm text-slate-700"
                >
                  <span class="font-medium">• {{ d.criteria }}:</span> {{ d.feedback_text }}
                </li>
              </ul>
            </div>
            <!-- Modal footer -->
            <div class="mt-6 flex justify-end">
              <button
                :class="evalButtonClass(resultData?._score)"
                :aria-label="scoreButtonText(resultData?._score)"
                @click="closeResult"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  class="w-4 h-4"
                >
                  <path
                    d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
                  />
                </svg>
                {{ scoreButtonText(resultData?._score) }}
              </button>
            </div>
          </div>
          <div v-else class="py-8 text-center text-slate-500">กำลังโหลด...</div>
        </div>
      </div>
    </div>
    <!-- Toast -->
    <div
      v-if="toast.visible"
      class="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
      role="status"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="w-5 h-5"
      >
        <path
          d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Zm-1 15-5-5 1.41-1.41L11 14.17l5.59-5.59L18 10Z"
        />
      </svg>
      <span class="text-sm font-medium">{{ toast.text }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch, reactive } from 'vue'
import { useRoute, RouterLink, useRouter } from 'vue-router'
import { auth } from '@/firebase/config'
import {
  getCourseById,
  listActiveMissionsForCourse,
  listCompletedMissionsForCourse,
  getSubmissionByMissionId,
  getScenariosByIds,
  getMissionById,
  getScenarioById,
  getSubmissionsByCourse,
  getStudentProfile,
} from '@/services/firestoreService'
import { useLearningLoopStore } from '@/stores/learningLoopStore'

const route = useRoute()
const router = useRouter()
const courseId = String(route.params.courseId)
const course = ref(null)
const activeMissions = ref([])
const history = ref([])
const store = useLearningLoopStore()
const resultOpen = ref(false)
const resultData = ref(null)

// --- Leaderboard state ---
const leaderboard = ref([]) // [{ uid, name, photoURL, bestScore, latestAt, level }]
const myRank = ref(null)
const myLevel = ref(null)
const myAvg = ref(null)
const myXp = ref(null)
const allowGamification = ref(true)
const sortMode = ref('level') // 'level' | 'best' | 'avg'
const topLimit = ref(10)
const showXpBars = ref(true)
try {
  const sv = localStorage.getItem('lb:showXpBars')
  if (sv === '0') showXpBars.value = false
} catch {}
const celebrating = ref(false)
let confettiTimer = null

// --- Toast ---
const toast = reactive({ visible: false, text: '' })
let toastTimer = null
function showToast(text, ms = 2500) {
  toast.text = text
  toast.visible = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.visible = false
    toast.text = ''
    toastTimer = null
  }, ms)
}

// Filters
const timeframe = ref('week') // 'week' | 'all'
const filterClass = ref('')
const filterRoom = ref('')
// Levels: ม.1 - ม.6 as requested
const gradeLevelsOpts = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6']
// Internal map to store student meta for filtering
const studentMeta = new Map() // uid -> { gradeLevel, room }

onMounted(async () => {
  // Determine gamification preference first
  try {
    if (auth.currentUser) {
      const prof = await getStudentProfile(auth.currentUser.uid)
      allowGamification.value = prof?.allowGamification !== false
    }
  } catch {}
  course.value = await getCourseById(courseId)
  if (auth.currentUser) {
    activeMissions.value = await listActiveMissionsForCourse(auth.currentUser.uid, courseId)
    // Attach scenario titles for clarity
    try {
      const ids = Array.from(
        new Set(activeMissions.value.map((m) => m.scenarioId_ref).filter(Boolean)),
      )
      if (ids.length) {
        const scenarios = await getScenariosByIds(ids)
        const titleMap = new Map(scenarios.map((s) => [s.id, s.scenario_title || s.title || '']))
        activeMissions.value = activeMissions.value.map((m) => ({
          ...m,
          _scenarioTitle: titleMap.get(m.scenarioId_ref) || '',
        }))
      }
    } catch {}
    const rawHistory = await listCompletedMissionsForCourse(auth.currentUser.uid, courseId, 50)
    // Prefetch scenario titles for history cards
    try {
      const hidSet = Array.from(new Set(rawHistory.map((m) => m.scenarioId_ref).filter(Boolean)))
      if (hidSet.length) {
        const scenarios = await getScenariosByIds(hidSet)
        const titleMap = new Map(scenarios.map((s) => [s.id, s.scenario_title || s.title || '']))
        for (const m of rawHistory) {
          if (!m._scenarioTitle) m._scenarioTitle = titleMap.get(m.scenarioId_ref) || ''
        }
      }
    } catch {}
    // attach score from mission.scoreSummary or compute from submission if needed
    for (const m of rawHistory) {
      let score = m.scoreSummary ?? null
      if (score == null && m.submissionId_ref) {
        const sub = await getSubmissionByMissionId(m.id)
        const rub = sub?.feedback?.rubric_scores
        if (rub) score = computeScoreFromRubric(rub)
      }
      m._score = score
    }
    // Cohort-based rank-change per mission within this course and optional grade/room filters
    try {
      const allCourseSubs = await getSubmissionsByCourse(courseId)
      // build student profile map for filters
      const profileCache = new Map()
      async function getMeta(uid) {
        if (profileCache.has(uid)) return profileCache.get(uid)
        try {
          const p = await getStudentProfile(uid)
          const meta = { gradeLevel: p?.gradeLevel || '', room: String(p?.room || '') }
          profileCache.set(uid, meta)
          return meta
        } catch {
          const meta = { gradeLevel: '', room: '' }
          profileCache.set(uid, meta)
          return meta
        }
      }
      // for each mission completion, compute rank among cohort submissions up to that time
      const out = []
      const histChrono = rawHistory
        .slice()
        .sort((a, b) => (a.updatedAt?.toMillis?.() || 0) - (b.updatedAt?.toMillis?.() || 0))
      for (const item of histChrono) {
        const tNow = item.updatedAt?.toMillis?.() || 0
        // cohort: all submissions in same course up to time tNow
        const cohort = []
        for (const s of allCourseSubs) {
          const t = s.submittedAt?.toMillis?.() || s.updatedAt?.toMillis?.() || 0
          if (t > tNow) continue
          const uid = s.studentId_ref || s.studentId
          if (!uid) continue
          // apply grade/room filter if selected
          if (filterClass.value || filterRoom.value) {
            const meta = await getMeta(uid)
            if (filterClass.value && String(meta.gradeLevel) !== String(filterClass.value)) continue
            if (filterRoom.value && String(meta.room) !== String(filterRoom.value)) continue
          }
          const n =
            typeof s.score === 'number'
              ? s.score
              : typeof s.scoreSummary === 'number'
                ? s.scoreSummary
                : s.feedback?.rubric_scores
                  ? computeScoreFromRubric(s.feedback.rubric_scores)
                  : null
          if (n == null) continue
          cohort.push({ uid, score: n })
        }
        // reduce to best per student to avoid duplicates advantage
        const bestBy = new Map()
        for (const c of cohort) {
          const prev = bestBy.get(c.uid)
          if (!prev || c.score > prev) bestBy.set(c.uid, c.score)
        }
        const ranks = Array.from(bestBy.values()).sort((a, b) => b - a)
        const myScore = item._score
        if (myScore == null || !ranks.length) {
          item._rankChange = null
          out.push(item)
          continue
        }
        const myIdxNow = ranks.findIndex((v) => v <= myScore)
        const nowRank = myIdxNow === -1 ? ranks.length : myIdxNow + 1
        // previous moment excludes this mission; recompute up to just before
        const ranksPrev = ranks.filter((v) => v !== myScore) // approximate; small diff acceptable
        const myIdxPrev = ranksPrev.findIndex((v) => v <= myScore)
        const prevRank = myIdxPrev === -1 ? ranksPrev.length + 1 : myIdxPrev + 1
        item._rankChange = prevRank - nowRank
        out.push(item)
      }
      history.value = rawHistory.map((m) => out.find((x) => x.id === m.id) || m)
    } catch {
      history.value = rawHistory
    }
  }
  // Load leaderboard after initial renders
  await nextTick()
  loadLeaderboard()
})

onBeforeUnmount(() => {
  if (confettiTimer) {
    clearTimeout(confettiTimer)
    confettiTimer = null
  }
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
})

function toDate(ts) {
  try {
    const ms = ts?.toMillis?.() ?? null
    return ms ? new Date(ms).toLocaleString() : '-'
  } catch {
    return '-'
  }
}

function startMission(missionId) {
  store.startLoopWithMission(missionId)
  router.push({ name: 'learning-loop', query: { courseId } })
}

function startForceNew() {
  router.push({ name: 'learning-loop', query: { courseId, forceNew: '1' } })
}

// ---------------- Leaderboard ----------------
function computeScoreFromRubric(rubricScores) {
  const weight = { ดีเยี่ยม: 4, ดี: 3, พอใช้: 2, ต้องปรับปรุง: 1 }
  const vals = Object.values(rubricScores || {})
  if (!vals.length) return null
  const sum = vals.reduce((a, l) => a + (weight[l] || 0), 0)
  return Math.round((sum / (vals.length * 4)) * 100)
}

import { fetchCourseLeaderboard } from '@/services/leaderboardService'

async function loadLeaderboard() {
  try {
    if (!allowGamification.value) {
      leaderboard.value = []
      myRank.value = null
      return
    }
    const resp = await fetchCourseLeaderboard({
      courseId,
      timeframe: timeframe.value,
      limit: topLimit.value,
      filter: {
        gradeLevel: filterClass.value || undefined,
        room: filterRoom.value || undefined,
      },
      sortBy: sortMode.value,
    })
    // Attach straight from response
    leaderboard.value = (resp?.top || []).map((t) => ({
      uid: t.uid || null,
      name: t.name || 'Student',
      photoURL: t.photoURL || '',
      bestScore: t.bestScore,
      latestAt: t.latestAt,
      level: t.level,
      avgScore: t.avgScore,
      xp: t.xp,
    }))
    myRank.value = resp?.myRank || null
    myLevel.value = resp?.myLevel || null
    myAvg.value = resp?.myAvg || null
    myXp.value = resp?.myXp || null

    if (myRank.value && myRank.value <= 3) {
      fireConfetti()
    }

    // PB toast
    const meBest = resp?.myBest ?? null
    const pbKey = `pb:${courseId}:${timeframe.value}`
    if (meBest != null) {
      const prev = Number(localStorage.getItem(pbKey) || '')
      if (!Number.isFinite(prev) || meBest > prev) {
        showToast(`ทำลายสถิติส่วนตัว! ${meBest}%`)
        localStorage.setItem(pbKey, String(meBest))
      }
    }
  } catch (e) {
    console.warn('loadLeaderboard error:', e?.message || e)
    leaderboard.value = []
    myRank.value = null
  }
}

function fireConfetti(duration = 1500) {
  if (celebrating.value) return
  celebrating.value = true
  const el = document.createElement('div')
  el.style.position = 'fixed'
  el.style.inset = '0'
  el.style.pointerEvents = 'none'
  el.style.zIndex = '60'
  document.body.appendChild(el)

  const particles = 120
  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7']
  const frags = []
  for (let i = 0; i < particles; i++) {
    const d = document.createElement('div')
    d.style.position = 'absolute'
    d.style.width = '8px'
    d.style.height = '8px'
    d.style.borderRadius = '2px'
    d.style.background = colors[Math.floor(Math.random() * colors.length)]
    d.style.left = Math.random() * 100 + '%'
    d.style.top = '-10px'
    d.style.opacity = '0.9'
    el.appendChild(d)
    frags.push({
      node: d,
      x: Math.random() * window.innerWidth,
      y: -10,
      vy: 2 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 3,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 10,
    })
  }
  let running = true
  function step() {
    for (const f of frags) {
      f.x += f.vx
      f.y += f.vy
      f.vy += 0.05
      f.rot += f.vr
      const n = f.node
      n.style.transform = `translate(${f.x}px, ${f.y}px) rotate(${f.rot}deg)`
    }
    if (running) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
  confettiTimer = setTimeout(() => {
    running = false
    document.body.removeChild(el)
    celebrating.value = false
    confettiTimer = null
  }, duration)
}

function setTimeframe(tf) {
  if (tf !== 'week' && tf !== 'all') return
  if (timeframe.value === tf) return
  timeframe.value = tf
  loadLeaderboard()
}

// Recompute on class/section change
watch(
  () => [filterClass.value, filterRoom.value],
  () => {
    loadLeaderboard()
  },
)

watch(sortMode, () => {
  loadLeaderboard()
})

watch(topLimit, () => {
  loadLeaderboard()
})

watch(
  () => showXpBars.value,
  (v) => {
    try {
      localStorage.setItem('lb:showXpBars', v ? '1' : '0')
    } catch {}
  },
)

const leaderXp = computed(() => {
  if (!leaderboard.value.length) return 0
  return Math.max(...leaderboard.value.map((p) => p.xp || 0))
})

function xpPercent(p) {
  const lx = leaderXp.value
  if (!lx) return 0
  return Math.min(100, Math.round(((p.xp || 0) / lx) * 100))
}

function difficultyLabel(d) {
  if (d === 'easy') return 'ง่าย'
  if (d === 'hard') return 'ยาก'
  return 'ปานกลาง'
}

function difficultyBadgeClass(d) {
  if (d === 'easy') return 'bg-emerald-50 text-emerald-700'
  if (d === 'hard') return 'bg-rose-50 text-rose-700'
  return 'bg-amber-50 text-amber-700'
}

function scoreColor(score) {
  if (score == null) return 'text-slate-400'
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-blue-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-rose-600'
}

function displayScore(score) {
  return score == null ? '-' : `${score} / 100`
}

function badgeColor(score) {
  if (score == null) return 'bg-slate-100 text-slate-600'
  if (score >= 80) return 'bg-green-50 text-green-700'
  if (score >= 60) return 'bg-blue-50 text-blue-700'
  if (score >= 40) return 'bg-amber-50 text-amber-700'
  return 'bg-rose-50 text-rose-700'
}

function evalButtonClass(score) {
  const base =
    'w-full sm:w-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold shadow-sm text-white focus:outline-none focus:ring-2'
  if (score == null)
    return (
      base +
      ' bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 focus:ring-slate-300/60'
    )
  if (score >= 80)
    return (
      base +
      ' bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 focus:ring-emerald-300/60'
    )
  if (score >= 60)
    return (
      base +
      ' bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 focus:ring-indigo-300/60'
    )
  if (score >= 40)
    return (
      base +
      ' bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 focus:ring-amber-300/60'
    )
  return (
    base +
    ' bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 focus:ring-rose-300/60'
  )
}

function scoreLabel(score) {
  if (score == null) return 'ยังไม่มีคะแนน'
  if (score >= 80) return 'ยอดเยี่ยม'
  if (score >= 60) return 'ดี'
  if (score >= 40) return 'พอใช้'
  return 'ต้องปรับปรุง'
}

// Medal helpers for badges
function medalLabel(score) {
  if (score == null) return ''
  if (score >= 80) return 'เหรียญทอง'
  if (score >= 60) return 'เหรียญเงิน'
  if (score >= 40) return 'เหรียญทองแดง'
  return 'กำลังพัฒนา'
}
function medalBadgeClass(score) {
  if (score == null) return 'bg-slate-50 text-slate-700 border-slate-200'
  if (score >= 80) return 'bg-yellow-50 text-yellow-800 border-yellow-200'
  if (score >= 60) return 'bg-slate-50 text-slate-700 border-slate-200'
  if (score >= 40) return 'bg-amber-50 text-amber-800 border-amber-200'
  return 'bg-rose-50 text-rose-700 border-rose-200'
}

function scoreButtonText(score) {
  const label = scoreLabel(score)
  if (score == null) return `ปิด ( ${label} )`
  return `${label} · ปิด`
}

function scoreViewButtonText(score) {
  const label = scoreLabel(score)
  if (score == null) return 'ดูผลการประเมิน'
  return `ดูผลการประเมิน · ${label}`
}

function rubricBadge(label) {
  const m = {
    ดีเยี่ยม: 'bg-green-50 text-green-700 border-green-200',
    ดี: 'bg-blue-50 text-blue-700 border-blue-200',
    พอใช้: 'bg-amber-50 text-amber-700 border-amber-200',
    ต้องปรับปรุง: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  return m[label] || 'bg-slate-50 text-slate-700 border-slate-200'
}

async function openResult(m) {
  resultOpen.value = true
  resultData.value = null
  try {
    // Ensure we have scenario title
    let scenarioTitle = m._scenarioTitle || ''
    if (!scenarioTitle && m.scenarioId_ref) {
      try {
        const s = await getScenarioById(m.scenarioId_ref)
        scenarioTitle = s?.scenario_title || s?.title || ''
      } catch {}
    }
    let submission = null
    if (m.submissionId_ref) {
      submission = await getSubmissionByMissionId(m.id)
    } else {
      // fallback try latest submission by missionId
      submission = await getSubmissionByMissionId(m.id)
    }
    const fb = submission?.feedback
    let parsed = null
    try {
      parsed = typeof fb === 'string' ? JSON.parse(fb) : fb
    } catch {
      parsed = null
    }
    resultData.value = {
      ...m,
      _scenarioTitle: scenarioTitle,
      _feedback: parsed || null,
    }
  } catch (e) {
    resultData.value = { ...m, _scenarioTitle: m._scenarioTitle || '', _feedback: null }
  }
}

function closeResult() {
  resultOpen.value = false
  resultData.value = null
}
</script>

<style scoped>
/* clamp helpers */
.line-clamp-4 {
  display: -webkit-box;
  line-clamp: 4;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-2 {
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
