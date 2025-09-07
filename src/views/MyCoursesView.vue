<template>
  <div class="bg-slate-50 min-h-screen p-4 sm:p-8">
    <div class="max-w-5xl mx-auto">
      <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3 sm:mb-6">รายวิชาของฉัน</h1>
      <div v-if="courses.length" class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        <article
          v-for="course in courses"
          :key="course.id"
          class="group bg-white border border-slate-200 p-4 sm:p-6 rounded-2xl shadow-sm hover:shadow-md transition flex flex-col"
        >
          <h2 class="text-base sm:text-lg font-semibold text-slate-900 mb-1 line-clamp-2">
            {{ course.title }}
          </h2>
          <p
            class="text-slate-600 mb-2 text-sm sm:text-[15px]"
            :class="expanded.has(course.id) ? '' : 'line-clamp-3 sm:line-clamp-4'"
          >
            {{ course.description }}
          </p>
          <button
            v-if="shouldShowReadMore(course.description)"
            @click="toggleExpand(course.id)"
            class="text-xs text-indigo-600 hover:underline self-start mb-2"
          >
            {{ expanded.has(course.id) ? 'ซ่อน' : 'อ่านต่อ' }}
          </button>
          <!-- Emphasized category at bottom -->
          <div v-if="course.subject_area || course.main_topic" class="mb-4">
            <div class="flex flex-wrap gap-2">
              <span
                v-if="course.subject_area"
                class="px-3 py-1.5 text-xs font-medium rounded-full text-white shadow-sm bg-gradient-to-r from-indigo-600 to-sky-500"
                >หมวดหมู่: {{ course.subject_area }}</span
              >
              <span
                v-if="course.main_topic"
                class="px-2.5 py-1 text-xs rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                >หัวข้อ: {{ course.main_topic }}</span
              >
            </div>
          </div>
          <div class="mt-auto flex flex-col sm:flex-row gap-2 sm:gap-3">
            <RouterLink
              :to="{ name: 'student-course-detail', params: { courseId: course.id } }"
              class="inline-flex items-center justify-center px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              ภารกิจของฉัน
            </RouterLink>
            <RouterLink
              :to="{ name: 'learning-loop', query: { courseId: course.id } }"
              class="inline-flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm"
            >
              เริ่มวงจรการเรียนรู้
            </RouterLink>
          </div>
        </article>
      </div>
      <div v-else class="text-center text-slate-600">
        ยังไม่มีรายวิชาที่ลงทะเบียน
        <div class="mt-4">
          <RouterLink to="/enroll" class="px-4 py-2 bg-indigo-600 text-white rounded-lg"
            >ไปหน้าลงทะเบียน</RouterLink
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { auth } from '@/firebase/config'
import { getEnrolledCourses } from '@/services/firestoreService'
import { RouterLink } from 'vue-router'

const courses = ref([])
const expanded = ref(new Set())

onMounted(async () => {
  if (auth.currentUser) {
    courses.value = await getEnrolledCourses(auth.currentUser.uid)
  }
})

function toggleExpand(id) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function shouldShowReadMore(text) {
  return typeof text === 'string' && text.length > 140
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-4 {
  display: -webkit-box;
  line-clamp: 4;
  -webkit-line-clamp: 4;
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
</style>
