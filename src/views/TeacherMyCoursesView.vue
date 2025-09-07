<template>
  <div class="bg-slate-50 min-h-screen p-8">
    <div class="max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold text-slate-800">รายวิชาที่ฉันสอน</h1>
        <RouterLink
          to="/teacher/courses/new"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
        >
          + สร้างรายวิชาใหม่
        </RouterLink>
      </div>

      <div v-if="courses.length" class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <article
          v-for="c in courses"
          :key="c.id"
          v-reveal
          class="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition"
        >
          <div class="flex items-start gap-4">
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <h2
                    class="text-lg font-semibold tracking-tight text-slate-800 line-clamp-2 break-words"
                  >
                    {{ c.title }}
                  </h2>
                  <p v-if="c.description" class="text-slate-600 text-sm mt-1 line-clamp-3">
                    {{ c.description }}
                  </p>
                </div>
                <div class="flex items-start gap-2">
                  <RouterLink
                    :to="{ name: 'teacher-course-analytics', params: { courseId: c.id } }"
                    class="hidden sm:inline-flex items-center gap-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-xs font-medium shadow-sm"
                    >ดูสถิติ</RouterLink
                  >
                  <details class="relative">
                    <summary
                      class="list-none inline-flex items-center justify-center h-9 w-9 rounded-md border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 cursor-pointer"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        class="w-5 h-5"
                      >
                        <path
                          d="M12 6.75a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm0 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm0 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
                        />
                      </svg>
                    </summary>
                    <div
                      class="absolute right-0 mt-2 w-44 rounded-lg border border-slate-200 bg-white shadow-lg p-1 z-10"
                    >
                      <button
                        @click="openEdit(c)"
                        class="w-full flex items-center gap-2 px-3 py-2 rounded-md text-slate-700 hover:bg-slate-100 text-sm"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          class="w-4 h-4"
                        >
                          <path
                            d="M21.731 2.269a2.625 2.625 0 0 0-3.713 0l-1.218 1.218 3.713 3.713 1.218-1.218a2.625 2.625 0 0 0 0-3.713ZM3 21a.75.75 0 0 0 .75.75h3.9a.75.75 0 0 0 .53-.22l10.67-10.67-3.713-3.713L4.467 17.817a.75.75 0 0 0-.22.53v3.9Z"
                          />
                        </svg>
                        แก้ไข
                      </button>
                      <button
                        @click="duplicateCourse(c)"
                        class="w-full flex items-center gap-2 px-3 py-2 rounded-md text-slate-700 hover:bg-slate-100 text-sm"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          class="w-4 h-4"
                        >
                          <path
                            d="M7 7.75A2.75 2.75 0 0 1 9.75 5h7.5A2.75 2.75 0 0 1 20 7.75v7.5A2.75 2.75 0 0 1 17.25 18h-7.5A2.75 2.75 0 0 1 7 15.25v-7.5Z"
                          />
                          <path
                            d="M3.5 8.75A2.75 2.75 0 0 1 6.25 6h.5a.75.75 0 0 1 0 1.5h-.5A1.25 1.25 0 0 0 5 8.75v7.5A1.25 1.25 0 0 0 6.25 17.5h7.5A1.25 1.25 0 0 0 15 16.25v-.5a.75.75 0 0 1 1.5 0v.5A2.75 2.75 0 0 1 13.75 19H6.25A2.75 2.75 0 0 1 3.5 16.25v-7.5Z"
                          />
                        </svg>
                        คัดลอกวิชา
                      </button>
                      <RouterLink
                        :to="{ name: 'teacher-course-submissions', params: { courseId: c.id } }"
                        class="block px-3 py-2 rounded-md text-slate-700 hover:bg-slate-100 text-sm"
                      >
                        <span class="inline-flex items-center gap-2">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            class="w-4 h-4"
                          >
                            <path
                              d="M12 6.75a.75.75 0 0 1 .75.75v3.75H16.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75V7.5a.75.75 0 0 1 .75-.75Z"
                            />
                            <path
                              d="M3.75 12a8.25 8.25 0 1 1 16.5 0 8.25 8.25 0 0 1-16.5 0Zm8.25-6.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5Z"
                            />
                          </svg>
                          ประวัติ
                        </span>
                      </RouterLink>
                      <button
                        @click="confirmDelete(c.id)"
                        class="w-full flex items-center gap-2 px-3 py-2 rounded-md text-rose-600 hover:bg-rose-50 text-sm"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          class="w-4 h-4"
                        >
                          <path
                            d="M9 3.75A1.5 1.5 0 0 1 10.5 2.25h3A1.5 1.5 0 0 1 15 3.75V4.5h4.5a.75.75 0 0 1 0 1.5H4.5a.75.75 0 0 1 0-1.5H9V3.75Z"
                          />
                          <path
                            d="M6.75 7.5h10.5l-.74 11.1a2.25 2.25 0 0 1-2.246 2.1H9.736a2.25 2.25 0 0 1-2.246-2.1L6.75 7.5Z"
                          />
                        </svg>
                        ลบ
                      </button>
                    </div>
                  </details>
                </div>
              </div>

              <!-- Badges (simplified) -->
              <div class="mt-3 flex flex-wrap items-center gap-2 text-[11px] leading-4">
                <span class="course-badge">หมวดหมู่: {{ c.subject_area || '-' }}</span>
                <span class="course-badge">หัวข้อ: {{ c.main_topic || '-' }}</span>
                <span v-if="c.standards?.length" class="course-badge"
                  >มาตรฐาน {{ c.standards.length }}</span
                >
                <span v-if="c.indicators?.length" class="course-badge"
                  >ตัวชี้วัด {{ c.indicators.length }}</span
                >
                <span class="course-badge">กลยุทธ์: {{ c.skill_strategy || 'weakest' }}</span>
                <span class="course-badge"
                  >ปุ่มสุ่ม: {{ c.enable_random_button ? 'เปิด' : 'ปิด' }}</span
                >
                <span v-if="c.target_skills?.length" class="course-badge"
                  >ทักษะ {{ c.target_skills.length }}</span
                >
              </div>

              <!-- Stats + progress bar -->
              <div v-if="courseStats[c.id]" class="mt-3 space-y-2">
                <div class="flex flex-wrap gap-4 text-[11px] font-medium text-slate-600">
                  <div>{{ courseStats[c.id].enrolled }} ผู้เรียน</div>
                  <div :title="completionTooltip(c.id)">
                    {{ courseStats[c.id].completion }}% เสร็จสิ้น
                  </div>
                  <div>{{ courseStats[c.id].miniLessons }} mini-lessons</div>
                </div>
                <div
                  class="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"
                  v-if="courseStats[c.id]"
                >
                  <div
                    class="h-full bg-indigo-500 transition-all"
                    :style="{ width: (courseStats[c.id].completion || 0) + '%' }"
                  ></div>
                </div>
              </div>

              <!-- Actions -->
              <div class="mt-4 flex items-center gap-2">
                <RouterLink
                  :to="{ name: 'teacher-course-analytics', params: { courseId: c.id } }"
                  class="sm:hidden inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium shadow-sm hover:bg-indigo-700"
                  >ดูสถิติ</RouterLink
                >
              </div>
            </div>
          </div>
        </article>
      </div>
      <div v-else class="text-center text-slate-600">ยังไม่มีรายวิชาที่สร้าง</div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editing" class="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
      <div class="bg-white w-full max-w-2xl p-6 rounded-xl shadow max-h-[85vh] overflow-y-auto">
        <h3 class="text-xl font-semibold mb-4">แก้ไขรายวิชา</h3>
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="md:col-span-2">
              <label class="block text-sm text-slate-600 mb-1">ชื่อรายวิชา</label>
              <input v-model="form.title" placeholder="ชื่อรายวิชา" class="w-full input-style" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm text-slate-600 mb-1">คำอธิบายรายวิชา</label>
              <textarea
                v-model="form.description"
                placeholder="คำอธิบาย"
                rows="3"
                class="w-full input-style"
              ></textarea>
            </div>
            <div>
              <label class="block text-sm text-slate-600 mb-1">หมวดหมู่วิชา</label>
              <input
                v-model="form.subject_area"
                placeholder="หมวดหมู่"
                class="w-full input-style"
              />
            </div>
            <div>
              <label class="block text-sm text-slate-600 mb-1">หัวข้อหลักของวิชา</label>
              <input
                v-model="form.main_topic"
                placeholder="หัวข้อหลัก"
                class="w-full input-style"
              />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm text-slate-600 mb-1">ความรู้พื้นฐานที่ควรมี</label>
              <textarea
                v-model="form.prerequisite_knowledge"
                rows="2"
                class="w-full input-style"
              ></textarea>
            </div>
            <div>
              <label class="block text-sm text-slate-600 mb-1">กลยุทธ์เลือกทักษะ</label>
              <select v-model="form.skill_strategy" class="w-full input-style">
                <option value="weakest">weakest (ค่าเริ่มต้น)</option>
                <option value="random">random</option>
              </select>
            </div>
            <div class="flex items-center gap-2 mt-2 md:mt-6">
              <input id="editEnableRandomBtn" type="checkbox" v-model="form.enable_random_button" />
              <label for="editEnableRandomBtn" class="text-sm text-slate-700"
                >แสดงปุ่ม “สุ่มสถานการณ์ใหม่”</label
              >
            </div>
          </div>
          <details class="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <summary class="cursor-pointer font-medium text-slate-800 select-none">
              ตัวเลือกขั้นสูง
            </summary>
            <div class="mt-3 space-y-4">
              <div>
                <label class="block text-sm text-slate-600 mb-1"
                  >ทักษะที่อนุญาต (คั่นด้วยคอมม่า)</label
                >
                <input
                  v-model="form.target_skills_text"
                  placeholder="Analyzing, Evaluating, Creating"
                  class="w-full input-style"
                />
                <p class="text-xs text-slate-500 mt-1">ปล่อยว่าง = อนุญาตทุกทักษะ</p>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm text-slate-600 mb-1">มาตรฐานการเรียนรู้</label>
                  <textarea
                    v-model="form.standards_text"
                    rows="4"
                    class="w-full input-style"
                    placeholder="พิมพ์ทีละบรรทัด หรือคั่นด้วยคอมม่า"
                  ></textarea>
                  <p class="text-xs text-slate-500 mt-1">จะถูกบันทึกเป็น Array</p>
                </div>
                <div>
                  <label class="block text-sm text-slate-600 mb-1">ตัวชี้วัด</label>
                  <textarea
                    v-model="form.indicators_text"
                    rows="4"
                    class="w-full input-style"
                    placeholder="พิมพ์ทีละบรรทัด หรือคั่นด้วยคอมม่า"
                  ></textarea>
                  <p class="text-xs text-slate-500 mt-1">จะถูกบันทึกเป็น Array</p>
                </div>
              </div>
            </div>
          </details>
          <!-- Policy Section -->
          <details class="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <summary class="cursor-pointer font-medium text-slate-800 select-none">
              นโยบายความซื่อสัตย์ (ตัวเลือก)
            </summary>
            <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <label class="flex items-center gap-2">
                <input type="checkbox" v-model="form.block_paste" />
                <span class="text-sm text-slate-700">บล็อกการวาง (Paste) ในหน้าทำภารกิจ</span>
              </label>
              <label class="flex items-center gap-2">
                <input type="checkbox" v-model="form.require_stepwise" />
                <span class="text-sm text-slate-700">แนะนำให้ตอบแบบเป็นขั้นตอน</span>
              </label>
              <div>
                <label class="block text-sm text-slate-600 mb-1">เวลาขั้นต่ำก่อนส่ง (วินาที)</label>
                <input
                  type="number"
                  min="0"
                  class="w-full input-style"
                  v-model.number="form.min_time_sec"
                />
                <p class="text-xs text-slate-500 mt-1">ปล่อยว่างหรือ 0 = ไม่บังคับ</p>
              </div>
              <div>
                <label class="block text-sm text-slate-600 mb-1">ความยาวขั้นต่ำ (ตัวอักษร)</label>
                <input
                  type="number"
                  min="0"
                  class="w-full input-style"
                  v-model.number="form.min_length_chars"
                />
                <p class="text-xs text-slate-500 mt-1">ปล่อยว่างหรือ 0 = ไม่บังคับ</p>
              </div>
              <div>
                <label class="block text-sm text-slate-600 mb-1"
                  >สัดส่วนการพิมพ์ขั้นต่ำ (0–1)</label
                >
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  class="w-full input-style"
                  v-model.number="form.min_typing_ratio"
                />
                <p class="text-xs text-slate-500 mt-1">
                  เช่น 0.6 หมายถึง อย่างน้อย 60% ต้องพิมพ์เอง
                </p>
              </div>
            </div>
          </details>
          <div class="flex justify-end gap-2 pt-2">
            <button @click="editing = false" class="px-4 py-2 rounded-md border">ยกเลิก</button>
            <button @click="saveEdit" class="px-4 py-2 rounded-md bg-indigo-600 text-white">
              บันทึก
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { getAuthInstance } from '@/firebase/config'
import {
  getTeacherCourses,
  updateCourse,
  deleteCourse,
  createCourse,
  getStudentsByEnrolledCourse,
  listMiniLessonsForTeacher,
  listMissionsByCourse,
} from '@/services/firestoreService'

const courses = ref([])
const courseStats = ref({}) // { [courseId]: { enrolled, miniLessons, completion, missionsCompleted, missionsTotal, studentsWithMissions } }
const progressCircumference = 2 * Math.PI * 18
let cacheSaveTimer = null
const STATS_CACHE_TTL_MS = 3 * 60 * 1000

function statsCacheKey(uid) {
  return `teacherCourseStats_v1_${uid}`
}

function restoreStatsFromCache(uid) {
  try {
    const raw = localStorage.getItem(statsCacheKey(uid))
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return
    if (Date.now() - (parsed.ts || 0) > STATS_CACHE_TTL_MS) return
    const data = parsed.data || {}
    // Only restore for currently loaded courses
    const map = {}
    for (const c of courses.value) if (data[c.id]) map[c.id] = data[c.id]
    courseStats.value = { ...courseStats.value, ...map }
  } catch {}
}

function scheduleSaveCache(uid) {
  if (cacheSaveTimer) clearTimeout(cacheSaveTimer)
  cacheSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(
        statsCacheKey(uid),
        JSON.stringify({ ts: Date.now(), data: courseStats.value }),
      )
    } catch {}
  }, 300)
}
const editing = ref(false)
const editingId = ref(null)
const router = useRouter()
const form = ref({
  title: '',
  description: '',
  subject_area: '',
  main_topic: '',
  prerequisite_knowledge: '',
  skill_strategy: 'weakest',
  enable_random_button: true,
  target_skills_text: '',
  standards_text: '',
  indicators_text: '',
  // policy
  block_paste: true,
  require_stepwise: false,
  min_time_sec: 0,
  min_length_chars: 0,
  min_typing_ratio: 0,
})

// Dynamic gradient based on strategy to create visual diversity
function strategyGradient(strategy) {
  switch (strategy) {
    case 'random':
      return 'from-fuchsia-500 via-pink-500 to-rose-500'
    case 'weakest':
    default:
      return 'from-indigo-500 via-violet-500 to-sky-500'
  }
}

// Seeded gradient palette for visual variety
const gradientPalette = [
  'from-indigo-500 via-violet-500 to-sky-500',
  'from-emerald-500 via-teal-500 to-cyan-500',
  'from-fuchsia-500 via-pink-500 to-rose-500',
  'from-amber-500 via-orange-500 to-rose-500',
  'from-blue-500 via-cyan-500 to-teal-500',
  'from-purple-500 via-indigo-500 to-blue-500',
  'from-sky-500 via-indigo-500 to-fuchsia-500',
]
function seededGradient(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return gradientPalette[h % gradientPalette.length]
}

function progressDashOffset(percent) {
  if (percent == null) return progressCircumference
  const p = Math.max(0, Math.min(100, percent)) / 100
  return progressCircumference * (1 - p)
}

async function loadStatsForCourse(authUid, course) {
  try {
    const [students, miniLessons, missions] = await Promise.all([
      getStudentsByEnrolledCourse(course.id).catch(() => []),
      listMiniLessonsForTeacher(authUid, course.id).catch(() => []),
      listMissionsByCourse(course.id).catch(() => []),
    ])
    const totalMissions = missions.length
    const completed = missions.filter((m) => m.status === 'completed').length
    // Per-student average completion: avg( completed_i / total_i )
    const byStudent = new Map()
    for (const m of missions) {
      const uid = m.studentId_ref
      if (!uid) continue
      let rec = byStudent.get(uid)
      if (!rec) {
        rec = { total: 0, completed: 0 }
        byStudent.set(uid, rec)
      }
      rec.total++
      if (m.status === 'completed') rec.completed++
    }
    let avgCompletion = 0
    if (byStudent.size) {
      let sum = 0
      let count = 0
      for (const rec of byStudent.values()) {
        if (rec.total > 0) {
          sum += rec.completed / rec.total
          count++
        }
      }
      avgCompletion = count ? Math.round((sum / count) * 100) : 0
    } else {
      // Fallback: overall ratio (legacy no per-student missions)
      avgCompletion = totalMissions ? Math.round((completed / totalMissions) * 100) : 0
    }
    courseStats.value = {
      ...courseStats.value,
      [course.id]: {
        enrolled: students.length,
        miniLessons: miniLessons.length,
        completion: avgCompletion,
        missionsCompleted: completed,
        missionsTotal: totalMissions,
        studentsWithMissions: byStudent.size,
      },
    }
    scheduleSaveCache(authUid)
  } catch (e) {
    // silent fail; stats optional
  }
}

async function loadAllStatsLimited(uid, list, concurrency = 3) {
  const queue = [...list]
  let active = 0
  return new Promise((resolve) => {
    const next = () => {
      if (!queue.length && active === 0) return resolve()
      while (active < concurrency && queue.length) {
        const course = queue.shift()
        active++
        loadStatsForCourse(uid, course).finally(() => {
          active--
          next()
        })
      }
    }
    next()
  })
}

function completionTooltip(cid) {
  const st = courseStats.value[cid]
  if (!st) return 'กำลังโหลด...'
  return `${st.missionsCompleted || 0} / ${st.missionsTotal || 0} missions | ${st.studentsWithMissions || 0} students`
}

onMounted(async () => {
  const tryLoad = async () => {
    const auth = await getAuthInstance()
    if (auth.currentUser) {
      const uid = auth.currentUser.uid
      courses.value = await getTeacherCourses(uid)
      restoreStatsFromCache(uid)
      loadAllStatsLimited(uid, courses.value, 3)
    } else {
      // wait a tick and retry (auth may not be ready yet)
      setTimeout(tryLoad, 200)
    }
  }
  tryLoad()
})

function openEdit(course) {
  editingId.value = course.id
  form.value = {
    title: course.title,
    description: course.description,
    subject_area: course.subject_area,
    main_topic: course.main_topic,
    prerequisite_knowledge: course.prerequisite_knowledge || '',
    skill_strategy: course.skill_strategy || 'weakest',
    enable_random_button: course.enable_random_button ?? true,
    target_skills_text: Array.isArray(course.target_skills) ? course.target_skills.join(', ') : '',
    standards_text: Array.isArray(course.standards) ? course.standards.join('\n') : '',
    indicators_text: Array.isArray(course.indicators) ? course.indicators.join('\n') : '',
    // policy
    block_paste: course.block_paste ?? true,
    require_stepwise: course.require_stepwise ?? false,
    min_time_sec: typeof course.min_time_sec === 'number' ? course.min_time_sec : 0,
    min_length_chars: typeof course.min_length_chars === 'number' ? course.min_length_chars : 0,
    min_typing_ratio: typeof course.min_typing_ratio === 'number' ? course.min_typing_ratio : 0,
  }
  editing.value = true
}

async function saveEdit() {
  const payload = { ...form.value }
  if (typeof payload.target_skills_text === 'string') {
    const parsed = payload.target_skills_text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    payload.target_skills = parsed
    delete payload.target_skills_text
  }
  if (typeof payload.standards_text === 'string') {
    const arr = payload.standards_text
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
    payload.standards = arr
    delete payload.standards_text
  }
  if (typeof payload.indicators_text === 'string') {
    const arr = payload.indicators_text
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
    payload.indicators = arr
    delete payload.indicators_text
  }
  await updateCourse(editingId.value, payload)
  const idx = courses.value.findIndex((c) => c.id === editingId.value)
  if (idx !== -1) courses.value[idx] = { ...courses.value[idx], ...payload }
  editing.value = false
}

async function confirmDelete(courseId) {
  if (!confirm('ยืนยันการลบรายวิชานี้?')) return
  await deleteCourse(courseId)
  courses.value = courses.value.filter((c) => c.id !== courseId)
}

async function duplicateCourse(c) {
  if (!confirm('คัดลอกรายวิชานี้เป็นวิชาใหม่?')) return
  const payload = {
    title: (c.title || 'วิชาไม่มีชื่อ') + ' (สำเนา)',
    description: c.description || '',
    subject_area: c.subject_area || '',
    main_topic: c.main_topic || '',
    prerequisite_knowledge: c.prerequisite_knowledge || '',
    skill_strategy: c.skill_strategy || 'weakest',
    enable_random_button: c.enable_random_button ?? true,
    // arrays
    target_skills: Array.isArray(c.target_skills) ? [...c.target_skills] : undefined,
    standards: Array.isArray(c.standards) ? [...c.standards] : undefined,
    indicators: Array.isArray(c.indicators) ? [...c.indicators] : undefined,
    // policy
    block_paste: c.block_paste ?? true,
    require_stepwise: c.require_stepwise ?? false,
    min_time_sec: typeof c.min_time_sec === 'number' ? c.min_time_sec : 0,
    min_length_chars: typeof c.min_length_chars === 'number' ? c.min_length_chars : 0,
    min_typing_ratio: typeof c.min_typing_ratio === 'number' ? c.min_typing_ratio : 0,
  }
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k])
  const newId = await createCourse(payload)
  router.push({ name: 'teacher-course-analytics', params: { courseId: newId } })
}
</script>

<style scoped>
/* simple text clamp utilities without tailwind plugin */
.line-clamp-2 {
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-3 {
  display: -webkit-box;
  line-clamp: 3;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.course-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-weight: 500;
  line-height: 1.1;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}

/* small fade / slide animation utility (lightweight) */
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-in.fade-in.slide-in-from-top-1 {
  animation: fadeSlideIn 0.25s ease-out;
}

/* hide default marker of details summary */
summary::-webkit-details-marker {
  display: none;
}
/* Firefox */
summary::marker {
  content: '';
}
</style>
