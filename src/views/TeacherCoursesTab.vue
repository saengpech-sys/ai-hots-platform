<template>
  <section class="p-4 sm:p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold">จัดการรายวิชา (ย่อ)</h2>
      <div class="flex items-center gap-2">
        <RouterLink
          to="/teacher/courses/new"
          class="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
          >สร้างรายวิชา</RouterLink
        >
        <RouterLink to="/teacher/my-courses" class="text-indigo-600 hover:underline text-sm"
          >ไปหน้าจัดการวิชาเต็มรูปแบบ</RouterLink
        >
      </div>
    </div>

    <div v-if="loading" class="text-slate-500 text-sm">กำลังโหลดรายวิชา...</div>
    <div v-else>
      <div v-if="!courses.length" class="text-slate-500 text-sm">ยังไม่มีรายวิชา</div>
      <ul v-else class="divide-y divide-slate-200">
        <li v-for="c in courses" :key="c.id" class="py-3 flex items-center justify-between">
          <div class="min-w-0">
            <div class="font-medium text-slate-900 truncate">
              {{ c.title || 'ไม่ระบุชื่อวิชา' }}
            </div>
            <div class="text-xs text-slate-500">
              {{ c.subject_area || 'ทั่วไป' }} • สร้างเมื่อ:
              {{ toDate(c.createdAt) || '-' }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <RouterLink
              :to="{ name: 'teacher-course-analytics', params: { courseId: c.id } }"
              class="text-xs px-2 py-1 rounded border"
              >สถิติ</RouterLink
            >
            <RouterLink
              :to="{ name: 'teacher-course-submissions', params: { courseId: c.id } }"
              class="text-xs px-2 py-1 rounded border"
              >งานส่ง</RouterLink
            >
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { getAuthInstance } from '@/firebase/config'
import { getTeacherCourses } from '@/services/firestoreService'

const loading = ref(true)
const courses = ref([])

onMounted(async () => {
  const auth = await getAuthInstance()
  const uid = auth.currentUser?.uid
  if (!uid) {
    loading.value = false
    return
  }
  try {
    courses.value = await getTeacherCourses(uid)
  } finally {
    loading.value = false
  }
})

function toDate(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null
    return d ? d.toLocaleDateString() : null
  } catch {
    return null
  }
}
</script>

<style scoped></style>
