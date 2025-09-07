<template>
  <div class="bg-slate-50 min-h-screen p-8">
    <div class="max-w-6xl mx-auto">
      <header class="mb-6 sm:mb-8">
        <h1 class="text-3xl md:text-4xl font-extrabold text-slate-900">ลงทะเบียนรายวิชา</h1>
        <p class="text-slate-600 mt-1 sm:mt-2">
          เลือกวิชาที่สนใจ แล้วเริ่มวงจรการเรียนรู้แบบภารกิจ
        </p>
      </header>

      <div v-if="courses.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <article
          v-for="course in courses"
          :key="course.id"
          class="group bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition flex flex-col relative overflow-hidden"
          v-reveal
        >
          <!-- Accent bar -->
          <div
            class="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 opacity-80"
          ></div>

          <h2 class="text-lg font-semibold text-slate-900 mb-1 line-clamp-2">{{ course.title }}</h2>
          <p class="text-slate-500 text-xs mb-3">สอนโดย: {{ teacherDisplay(course) }}</p>
          <p class="text-slate-700 text-sm mb-4 line-clamp-5">{{ course.description }}</p>
          <!-- Emphasized category near bottom -->
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
          <div class="mt-auto grid grid-cols-1 gap-2">
            <button
              v-if="!isEnrolled(course.id)"
              :disabled="loading"
              @click="enroll(course.id)"
              class="w-full inline-flex items-center justify-center gap-2 px-6 py-2 font-semibold rounded-lg shadow-sm border bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
            >
              ลงทะเบียนเรียน
            </button>
            <div v-else class="flex flex-col sm:flex-row gap-2">
              <button
                class="flex-1 inline-flex items-center justify-center gap-2 px-6 py-2 font-semibold rounded-lg border bg-slate-100 text-slate-700 hover:bg-slate-200"
                disabled
              >
                ลงทะเบียนแล้ว
              </button>
              <button
                :disabled="loading"
                @click="confirmUnenroll(course)"
                class="flex-1 inline-flex items-center justify-center gap-2 px-6 py-2 font-semibold rounded-lg border bg-white text-rose-700 hover:bg-rose-50 border-rose-300"
              >
                ยกเลิกรายวิชา
              </button>
            </div>
          </div>
        </article>
      </div>
      <div v-else class="text-center text-slate-600">ยังไม่มีวิชาให้ลงทะเบียน</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '@/firebase/config'
import { toast } from '@/utils/toast'
import {
  getAllCourses,
  enrollInCourse,
  getStudentProfile,
  getTeacherProfile,
  unenrollFromCourse,
} from '@/services/firestoreService'

const courses = ref([])
const enrolledIds = ref([])
const loading = ref(false)
const teacherNames = ref({}) // { [teacherId]: displayName }
const router = useRouter()

onMounted(async () => {
  courses.value = await getAllCourses()
  // fetch teacher display names in parallel
  const ids = [...new Set(courses.value.map((c) => c.teacherId).filter(Boolean))]
  if (ids.length) {
    const results = await Promise.all(
      ids.map((id) =>
        getTeacherProfile(id)
          .then((p) => ({ id, name: p?.displayName || p?.name || '' }))
          .catch(() => ({ id, name: '' })),
      ),
    )
    const map = {}
    for (const { id, name } of results) map[id] = name
    teacherNames.value = map
  }
  if (auth.currentUser) {
    const profile = await getStudentProfile(auth.currentUser.uid)
    enrolledIds.value = profile?.enrolledCourses || []
  }
})

const enroll = async (courseId) => {
  try {
    if (!auth.currentUser) {
      toast.warning('กรุณาเข้าสู่ระบบ')
      return
    }
    if (enrolledIds.value.includes(courseId)) {
      toast.info('คุณลงทะเบียนวิชานี้แล้ว')
      return
    }
    loading.value = true
    await enrollInCourse(courseId)
    enrolledIds.value.push(courseId)
    toast.success('ลงทะเบียนสำเร็จ — ไปยังรายวิชาของฉัน')
    router.push('/my-courses')
  } catch (error) {
    toast.error(error.message || 'ลงทะเบียนไม่สำเร็จ')
  } finally {
    loading.value = false
  }
}

const isEnrolled = (id) => enrolledIds.value.includes(id)

function teacherDisplay(course) {
  const name = teacherNames.value[course.teacherId]
  if (name) return name
  const tn = course.teacherName
  // If teacherName is not an email, keep it; else show generic label
  if (tn && !String(tn).includes('@')) return tn
  return 'ครูผู้สอน'
}

async function confirmUnenroll(course) {
  if (!auth.currentUser) {
    toast.warning('กรุณาเข้าสู่ระบบ')
    return
  }
  const ok = confirm(`ยกเลิกรายวิชา “${course.title}” ?`)
  if (!ok) return
  try {
    loading.value = true
    // optimistic update
    enrolledIds.value = enrolledIds.value.filter((id) => id !== course.id)
    await unenrollFromCourse(course.id)
  } catch (e) {
    toast.error(e?.message || 'ไม่สามารถยกเลิกได้')
    // revert on error
    if (!enrolledIds.value.includes(course.id)) enrolledIds.value.push(course.id)
  } finally {
    loading.value = false
  }
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
.line-clamp-5 {
  display: -webkit-box;
  line-clamp: 5;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
