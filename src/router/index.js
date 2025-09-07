// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { getAuthInstance } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { getStudentProfile } from '@/services/firestoreService'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'learning-loop',
      component: () => import('../views/LearningLoopView.vue'),
      meta: { requiresAuth: true, requiresStudent: true }, // สำหรับนักเรียนเท่านั้น
    },
    {
      path: '/privacy-portal',
      name: 'privacyPortal',
      component: () => import('@/views/PrivacyPortalView.vue'),
      meta: { requiresAuth: true, requiresStudent: true },
    },
    {
      path: '/parental-consent',
      name: 'parentalConsent',
      component: () => import('@/views/ParentalConsentView.vue'),
    },
    {
      path: '/teacher/dpia',
      name: 'teacherDPIA',
      component: () => import('@/views/TeacherDPIAAdminView.vue'),
      meta: { requiresAuth: true, requiresTeacher: true },
    },
    {
      path: '/admin',
      name: 'admin-dashboard',
      component: () => import('@/views/AdminDashboardView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/teacher/mini-lessons',
      name: 'teacher-mini-lessons',
      component: () => import('../views/TeacherMiniLessonsView.vue'),
      meta: { requiresAuth: true, requiresTeacher: true },
    },
    {
      path: '/teacher/strategy',
      name: 'teacher-strategy',
      component: () => import('../views/TeacherStrategyView.vue'),
      meta: { requiresAuth: true, requiresTeacher: true },
    },
    {
      path: '/teacher/research-report',
      name: 'teacher-research-report',
      component: () => import('../views/TeacherResearchReportView.vue'),
      meta: { requiresAuth: true, requiresTeacher: true },
    },
    {
      path: '/teacher/portfolio',
      name: 'teacher-portfolio',
      redirect: { name: 'profile', query: { tab: 'teacher' } },
      meta: { requiresAuth: true, requiresTeacher: true },
    },
    {
      path: '/portfolio',
      name: 'student-portfolio',
      redirect: { name: 'profile', query: { tab: 'portfolio' } },
      meta: { requiresAuth: true, requiresStudent: true },
    },
    {
      path: '/portfolio/:studentId',
      name: 'student-portfolio-view',
      component: () => import('../views/StudentPortfolioView.vue'),
      meta: { requiresAuth: true, requiresTeacher: true },
    },
    {
      path: '/teacher/courses/:courseId/analytics',
      name: 'teacher-course-analytics',
      component: () => import('../views/TeacherCourseAnalyticsView.vue'),
      meta: { requiresAuth: true, requiresTeacher: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileUnifiedView.vue'),
      meta: { requiresAuth: true }, // หน้านี้ก็ต้องล็อกอิน
    },
    {
      path: '/teacher/courses/new',
      name: 'teacher-course-create',
      component: () => import('../views/TeacherCourseCreateView.vue'),
      meta: { requiresAuth: true, requiresTeacher: true },
    },
    {
      path: '/teacher/my-courses',
      name: 'teacher-my-courses',
      component: () => import('../views/TeacherMyCoursesView.vue'),
      meta: { requiresAuth: true, requiresTeacher: true },
    },
    {
      path: '/teacher/courses/:courseId/submissions',
      name: 'teacher-course-submissions',
      component: () => import('../views/TeacherCourseSubmissionsView.vue'),
      meta: { requiresAuth: true, requiresTeacher: true },
    },
    {
      path: '/enroll',
      name: 'course-enroll',
      component: () => import('../views/EnrollCoursesView.vue'),
      meta: { requiresAuth: true, requiresStudent: true },
    },
    {
      path: '/my-courses',
      name: 'my-courses',
      component: () => import('../views/MyCoursesView.vue'),
      meta: { requiresAuth: true, requiresStudent: true },
    },
    {
      path: '/courses/:courseId',
      name: 'student-course-detail',
      component: () => import('../views/StudentCourseDetailView.vue'),
      meta: { requiresAuth: true, requiresStudent: true },
    },
  ],
})

// รอ Firebase Auth ให้พร้อมก่อนใช้ค่า currentUser (แก้ปัญหา refresh แล้วเด้งไปหน้า login)
let __authResolved = false
let auth
const authReady = (async () => {
  auth = await getAuthInstance()
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, () => {
      stop()
      __authResolved = true
      resolve()
    })
  })
})()

// Navigation Guard (ยามเฝ้าประตู)
router.beforeEach(async (to, from, next) => {
  if (!__authResolved) {
    try {
      await authReady
    } catch (_) {}
  }
  if (!auth) auth = await getAuthInstance()
  const user = auth.currentUser
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  const requiresTeacher = to.matched.some((record) => record.meta.requiresTeacher)
  const requiresStudent = to.matched.some((record) => record.meta.requiresStudent)
  const requiresAdmin = to.matched.some((record) => record.meta.requiresAdmin)

  // helper: ตรวจความครบถ้วนของข้อมูลระบุตัวตน (หน้า Portfolio ส่วนบน)
  const isIdentityComplete = (p) => {
    if (!p) return false
    const rawName = typeof p.name === 'string' ? p.name.trim() : ''
    const nameOk = rawName.length > 0 && !rawName.includes('@')
    const code = String(p.studentCode || '').trim()
    const codeOk = /^(\d){5}$/.test(code)
    const gradeOk = typeof p.gradeLevel === 'string' && p.gradeLevel.trim().length > 0
    const roomOk = typeof p.room === 'string' && p.room.trim().length > 0
    const numberOk = Number.isFinite(Number(p.number)) && Number(p.number) > 0
    return nameOk && codeOk && gradeOk && roomOk && numberOk
  }
  // helper: ตรวจความครบถ้วนของข้อมูลโปรไฟล์ทั่วไป (หน้า Profile)
  const isAboutComplete = (p) => {
    if (!p) return false
    const interOk = Array.isArray(p.interests) && p.interests.filter(Boolean).length > 0
    const styleOk = typeof p.learningStyle === 'string' && p.learningStyle.trim().length > 0
    const goalOk = typeof p.futureGoal === 'string' && p.futureGoal.trim().length > 0
    return interOk && styleOk && goalOk
  }

  if (requiresAuth && !user) {
    // ถ้าหน้าที่กำลังจะไป ต้องการล็อกอิน แต่ยังไม่ได้ล็อกอิน
    next('/login') // ให้ไปหน้า login
  } else if (requiresAdmin) {
    try {
      // Prefer custom claims (set by backend) to avoid forbidden reads to admins collection
      const token = await user.getIdTokenResult().catch(() => null)
      if (token?.claims?.admin === true) return next()
      // Fallback: teacher doc may carry isAdmin flag surfaced via profile fetch
      const profile = await getStudentProfile(user.uid).catch(() => null)
      if (profile?.isAdmin === true || profile?.role === 'admin') return next()
      return next('/')
    } catch (_) {
      return next('/')
    }
  } else if (requiresTeacher) {
    // ตรวจ role ครูจากโปรไฟล์ใน Firestore
    try {
      const profile = await getStudentProfile(user.uid)
      if (profile?.role === 'teacher') return next()
      return next('/my-courses')
    } catch (e) {
      return next('/my-courses')
    }
  } else if (requiresStudent) {
    try {
      const profile = await getStudentProfile(user.uid)
      if (profile?.role === 'teacher') return next('/teacher/my-courses')

      // บังคับให้นักเรียนกรอกข้อมูลให้ครบก่อนเข้าหน้าอื่น
      const identityDone = isIdentityComplete(profile)
      const aboutDone = isAboutComplete(profile)
      const onPortfolioTab = to.name === 'profile' && to.query.tab === 'portfolio'
      const onAboutTab = to.name === 'profile' && (to.query.tab === 'about' || !to.query.tab)
      if (!identityDone && !onPortfolioTab) {
        return next({ name: 'profile', query: { tab: 'portfolio' } })
      }
      if (identityDone && !aboutDone && !onAboutTab) {
        return next({ name: 'profile', query: { tab: 'about' } })
      }
      return next()
    } catch (e) {
      return next('/login')
    }
  } else if (requiresAuth) {
    // หน้าที่ล็อกอินไว้ แต่ไม่ได้ติดป้าย requiresStudent/Teacher เช่น หน้าโปรไฟล์
    try {
      const profile = await getStudentProfile(user.uid)
      if (profile?.role === 'teacher') return next()
      const identityDone = isIdentityComplete(profile)
      const aboutDone = isAboutComplete(profile)
      const onPortfolioTab = to.name === 'profile' && to.query.tab === 'portfolio'
      const onAboutTab = to.name === 'profile' && (to.query.tab === 'about' || !to.query.tab)
      if (!identityDone && !onPortfolioTab)
        return next({ name: 'profile', query: { tab: 'portfolio' } })
      if (identityDone && !aboutDone && !onAboutTab)
        return next({ name: 'profile', query: { tab: 'about' } })
      return next()
    } catch (e) {
      return next('/login')
    }
  } else if (!requiresAuth && user) {
    // ถ้าหน้าที่กำลังจะไป ไม่ต้องการล็อกอิน (เช่น หน้า login) แต่ล็อกอินแล้ว -> ส่งไปหน้า home ตาม role
    try {
      const profile = await getStudentProfile(user.uid)
      if (profile?.role === 'teacher') return next('/teacher/my-courses')
      // ถ้ายังไม่ครบถ้วน ให้พาไปกรอกก่อน
      const identityDone = isIdentityComplete(profile)
      const aboutDone = isAboutComplete(profile)
      if (!identityDone) return next({ name: 'profile', query: { tab: 'portfolio' } })
      if (!aboutDone) return next({ name: 'profile', query: { tab: 'about' } })
      return next('/my-courses')
    } catch (e) {
      return next('/my-courses')
    }
  } else if (to.name === 'learning-loop' && !to.query.courseId) {
    // กันกรณีเข้าหน้า Learning Loop ตรงๆ โดยไม่มี courseId
    return next('/my-courses')
  } else {
    // กรณีอื่นๆ ปล่อยให้ไปได้ตามปกติ
    next()
  }
})

export default router
