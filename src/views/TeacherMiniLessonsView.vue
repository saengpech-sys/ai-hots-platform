<template>
  <div class="mx-auto max-w-6xl px-4 py-6">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-semibold text-gray-900">Mini-lessons</h1>
      <div class="flex items-center gap-2">
        <select v-model="selectedCourseId" class="border rounded px-2 py-1 text-sm">
          <option value="">ทุกวิชา</option>
          <option v-for="c in teacherCourses" :key="c.id" :value="c.id">
            {{ c.title || c.main_topic || c.id }}
          </option>
        </select>
        <button class="px-3 py-1.5 text-sm rounded bg-gray-100" @click="refresh">รีเฟรช</button>
      </div>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">กำลังโหลด…</div>
    <div v-else-if="!miniLessons.length" class="text-sm text-gray-500">ยังไม่มี mini-lesson</div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="m in miniLessons"
        :key="m.id"
        class="rounded-lg border border-slate-200 p-4 bg-white shadow-sm"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm text-slate-500">
              {{ courseTitle(m.courseId_ref) }}
            </div>
            <div class="text-xs text-slate-400">
              {{ ts(m.createdAt) }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="px-2 py-1 text-xs rounded bg-emerald-600 text-white"
              @click="openStrategy(m)"
            >
              เปิดกลยุทธ์
            </button>
            <button
              class="px-2 py-1 text-xs rounded bg-indigo-600 text-white"
              @click="openExamples(m)"
            >
              ดูตัวอย่าง
            </button>
            <button class="px-2 py-1 text-xs rounded bg-red-600 text-white" @click="remove(m)">
              ลบ
            </button>
          </div>
        </div>

        <div class="mt-3">
          <div class="text-[13px] text-slate-700 font-semibold">หัวข้อที่ควรเสริม</div>
          <ul class="mt-1 list-disc list-inside text-sm text-slate-700">
            <li v-for="w in (m.stats_snapshot?.weakest || []).slice(0, 3)" :key="w.criteria">
              {{ w.criteria }} <span class="text-slate-400">(ต่ำ {{ w.lowCount || 0 }})</span>
            </li>
          </ul>
        </div>

        <div v-if="m.plan?.lesson_sequence?.length" class="mt-3">
          <div class="text-[13px] text-slate-700 font-semibold">ลำดับกิจกรรมย่อ</div>
          <ol class="mt-1 list-decimal list-inside text-sm text-slate-700">
            <li v-for="(s, idx) in m.plan.lesson_sequence.slice(0, 3)" :key="idx">
              {{ s.title || s.activity || 'กิจกรรม' }}
            </li>
          </ol>
        </div>

        <div v-if="m.toolkit?.playlist?.length" class="mt-3">
          <div class="text-[13px] text-slate-700 font-semibold">Micro‑playlist</div>
          <div class="mt-1 flex flex-wrap gap-1">
            <span
              v-for="(p, idx) in m.toolkit.playlist.slice(0, 4)"
              :key="idx"
              class="inline-flex px-2 py-0.5 rounded bg-slate-100 text-[12px]"
            >
              {{ p.topic || p.title || p }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getAuthInstance } from '@/firebase/config'
import {
  getTeacherCourses,
  listMiniLessonsForTeacher,
  deleteMiniLesson,
} from '@/services/firestoreService'

const router = useRouter()
const loading = ref(false)
const teacherCourses = ref([])
const selectedCourseId = ref('')
const miniLessons = ref([])

onMounted(async () => {
  const auth = await getAuthInstance()
  if (!auth.currentUser) return
  loading.value = true
  try {
    teacherCourses.value = await getTeacherCourses(auth.currentUser.uid)
    await refresh()
  } finally {
    loading.value = false
  }
})

async function refresh() {
  const auth = await getAuthInstance()
  if (!auth.currentUser) return
  loading.value = true
  try {
    miniLessons.value = await listMiniLessonsForTeacher(
      auth.currentUser.uid,
      selectedCourseId.value || null,
    )
  } finally {
    loading.value = false
  }
}

function courseTitle(id) {
  const c = teacherCourses.value.find((x) => x.id === id)
  return c?.title || c?.main_topic || id || '—'
}

function ts(fireTs) {
  try {
    const ms = fireTs?.toMillis?.() ?? null
    return ms ? new Date(ms).toLocaleString() : '—'
  } catch (_) {
    return '—'
  }
}

function openStrategy(m) {
  // Navigate to strategy view with course and miniLessonId so the view can load saved plan
  router.push({
    name: 'teacher-strategy',
    query: { courseId: m.courseId_ref || '', miniLessonId: m.id },
  })
}

function openExamples(m) {
  const criteria = m.stats_snapshot?.weakest?.[0]?.criteria || ''
  router.push({
    name: 'teacher-course-submissions',
    params: { courseId: m.courseId_ref },
    query: criteria ? { criteria } : {},
  })
}

async function remove(m) {
  if (!confirm('ลบ mini-lesson นี้หรือไม่?')) return
  const auth = await getAuthInstance()
  if (!auth.currentUser) return
  try {
    await deleteMiniLesson(m.id)
    await refresh()
  } catch (_) {}
}
</script>

<style scoped></style>
