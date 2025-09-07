<template>
  <nav
    class="w-full bg-white/90 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-50"
  >
    <div class="mx-auto max-w-7xl px-3 sm:px-4 py-3 flex items-center justify-between">
      <!-- Brand -->
      <RouterLink :to="homeHref" class="flex items-center gap-2">
        <span
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold"
          >A</span
        >
        <h1 class="text-lg font-semibold text-gray-900 dark:text-white">AI HoTS</h1>
      </RouterLink>

      <!-- Right side actions -->
      <div class="flex items-center gap-3">
        <!-- Level / XP with progress when logged in -->
        <div
          v-if="user && profile?.allowGamification !== false"
          class="hidden sm:flex items-center gap-3"
        >
          <div class="w-32">
            <div class="text-[10px] text-slate-500 mb-0.5">
              Lv {{ level }} • {{ Math.max(0, xpToNext - progressXp) }} XP to next
            </div>
            <div class="h-2 bg-slate-200 rounded">
              <div class="h-2 bg-emerald-500 rounded" :style="{ width: progressPct + '%' }"></div>
            </div>
          </div>
          <span
            class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800"
          >
            {{ xp }} XP
          </span>
        </div>

        <!-- Mobile: show compact XP chip (no max), avoid layout shift with monospaced digits -->
        <div v-if="user && profile?.allowGamification !== false" class="sm:hidden">
          <span
            class="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-100 text-indigo-800 font-mono leading-none"
            style="min-width: 72px; justify-content: center"
          >
            Lv {{ level }} · {{ xp }}
          </span>
        </div>

        <!-- Desktop links -->
        <div class="hidden sm:flex items-center gap-3">
          <RouterLink :to="homeHref" class="text-gray-700 dark:text-gray-200 hover:text-emerald-600"
            >หน้าหลัก</RouterLink
          >
          <RouterLink
            v-if="user && isTeacher"
            to="/teacher/strategy"
            class="text-gray-700 dark:text-gray-200 hover:text-emerald-600"
            >กลยุทธ์การสอน (AI)</RouterLink
          >
          <RouterLink
            v-if="user && isAdmin"
            to="/admin"
            class="text-gray-700 dark:text-gray-200 hover:text-emerald-600"
            >Admin</RouterLink
          >
          <RouterLink
            v-if="user && isTeacher"
            to="/teacher/mini-lessons"
            class="text-gray-700 dark:text-gray-200 hover:text-emerald-600"
            >Mini-lessons</RouterLink
          >
          <RouterLink
            v-if="user && !isTeacher"
            to="/my-courses"
            class="text-gray-700 dark:text-gray-200 hover:text-emerald-600"
            >รายวิชาของฉัน</RouterLink
          >
          <RouterLink
            v-if="user && !isTeacher"
            to="/enroll"
            class="text-gray-700 dark:text-gray-200 hover:text-emerald-600"
            >ลงทะเบียน</RouterLink
          >

          <RouterLink
            v-if="user"
            :to="
              isTeacher
                ? { name: 'profile', query: { tab: 'teacher' } }
                : { name: 'profile', query: { tab: 'about' } }
            "
            class="text-gray-700 dark:text-gray-200 hover:text-emerald-600"
            >โปรไฟล์</RouterLink
          >
          <RouterLink
            v-if="!isTeacher"
            to="/parental-consent"
            class="text-gray-700 dark:text-gray-200 hover:text-emerald-600"
            >ยืนยันผู้ปกครอง</RouterLink
          >
          <RouterLink
            v-if="isTeacher"
            to="/teacher/dpia"
            class="text-gray-700 dark:text-gray-200 hover:text-emerald-600"
            >DPIA</RouterLink
          >
          <RouterLink
            v-if="user && !isTeacher"
            to="/privacy-portal"
            class="text-gray-700 dark:text-gray-200 hover:text-emerald-600"
            >ความเป็นส่วนตัว</RouterLink
          >

          <button
            v-if="user"
            @click="handleLogout"
            class="ml-2 px-3 py-1.5 text-sm font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Logout
          </button>
          <RouterLink
            v-else
            to="/login"
            class="ml-2 px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
            >Login</RouterLink
          >
        </div>

        <!-- Mobile menu toggle -->
        <button
          class="sm:hidden inline-flex items-center justify-center h-9 w-9 rounded-md border border-slate-300 text-slate-700"
          @click="menuOpen = !menuOpen"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          aria-label="Toggle menu"
        >
          <svg
            v-if="!menuOpen"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="w-5 h-5"
          >
            <path d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="w-5 h-5"
          >
            <path
              d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3 1.42 1.42Z"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile dropdown menu -->
    <transition name="slide-fade">
      <div
        v-if="menuOpen"
        class="sm:hidden border-t border-slate-200 bg-white/95 backdrop-blur px-3 py-2 rounded-b-xl shadow-lg ring-1 ring-black/5"
      >
        <div class="flex flex-col gap-2 text-sm">
          <RouterLink :to="homeHref" class="py-1" @click="menuOpen = false">หน้าหลัก</RouterLink>
          <RouterLink
            v-if="user && isTeacher"
            to="/teacher/strategy"
            class="py-1"
            @click="menuOpen = false"
            >กลยุทธ์การสอน (AI)</RouterLink
          >
          <RouterLink v-if="user && isAdmin" to="/admin" class="py-1" @click="menuOpen = false"
            >Admin</RouterLink
          >
          <RouterLink
            v-if="user && isTeacher"
            to="/teacher/mini-lessons"
            class="py-1"
            @click="menuOpen = false"
            >Mini-lessons</RouterLink
          >
          <RouterLink
            v-if="user && !isTeacher"
            to="/my-courses"
            class="py-1"
            @click="menuOpen = false"
            >รายวิชาของฉัน</RouterLink
          >
          <RouterLink v-if="user && !isTeacher" to="/enroll" class="py-1" @click="menuOpen = false"
            >ลงทะเบียน</RouterLink
          >

          <RouterLink
            v-if="user"
            :to="
              isTeacher
                ? { name: 'profile', query: { tab: 'teacher' } }
                : { name: 'profile', query: { tab: 'about' } }
            "
            class="py-1"
            @click="menuOpen = false"
            >โปรไฟล์</RouterLink
          >
          <RouterLink
            v-if="user && !isTeacher"
            to="/parental-consent"
            class="py-1"
            @click="menuOpen = false"
            >ยืนยันผู้ปกครอง</RouterLink
          >
          <RouterLink
            v-if="user && isTeacher"
            to="/teacher/dpia"
            class="py-1"
            @click="menuOpen = false"
            >DPIA</RouterLink
          >
          <RouterLink
            v-if="user && !isTeacher"
            to="/privacy-portal"
            class="py-1"
            @click="menuOpen = false"
            >ความเป็นส่วนตัว</RouterLink
          >

          <button
            v-if="user"
            @click="
              () => {
                menuOpen = false
                handleLogout()
              }
            "
            class="mt-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md bg-gray-900 text-white"
          >
            Logout
          </button>
          <RouterLink
            v-else
            to="/login"
            class="mt-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white"
            @click="menuOpen = false"
            >Login</RouterLink
          >
        </div>
      </div>
    </transition>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { getAuthInstance } from '@/firebase/config'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { getStudentProfile, onStudentProfileSnapshot } from '@/services/firestoreService'

const router = useRouter()
const user = ref(null)
const profile = ref(null)
const menuOpen = ref(false)
let unsubProfile = null
const isTeacher = computed(() => profile.value?.role === 'teacher')
const isAdmin = ref(false)
const homeHref = computed(() => (isTeacher.value ? '/teacher/my-courses' : '/my-courses'))

const xp = computed(() => profile.value?.xp ?? 0)
// New level curve: total XP needed for level n is 50*n*(n-1)
const level = computed(() => {
  const x = xp.value
  let n = Math.floor((1 + Math.sqrt(1 + x / 25)) / 2)
  while (50 * n * (n - 1) > x) n--
  while (50 * (n + 1) * n <= x) n++
  return Math.max(1, n)
})
const xpBase = computed(() => 50 * level.value * (level.value - 1))
const xpNext = computed(() => 50 * (level.value + 1) * level.value)
const progressXp = computed(() => xp.value - xpBase.value)
const xpToNext = computed(() => Math.max(1, xpNext.value - xpBase.value))
const progressPct = computed(() =>
  Math.min(100, Math.max(0, (progressXp.value / xpToNext.value) * 100)),
)

async function loadProfile() {
  try {
    if (!user.value) return
    const data = await getStudentProfile(user.value.uid)
    // Provide safe defaults if xp/level absent in Firestore
    profile.value = { xp: 0, level: 1, ...data }
  } catch (e) {
    console.error('Failed to load profile:', e)
  }
}

async function handleLogout() {
  const auth = await getAuthInstance()
  signOut(auth)
    .then(() => router.push('/login'))
    .catch((e) => console.error('Logout failed:', e))
}

onMounted(async () => {
  const auth = await getAuthInstance()
  // Initial state
  user.value = auth.currentUser
  if (user.value) {
    // ensure profile exists and then subscribe
    loadProfile()
    if (unsubProfile)
      try {
        unsubProfile()
      } catch {}
    unsubProfile = onStudentProfileSnapshot(user.value.uid, (data) => {
      if (!data) return // loadProfile will create if needed
      profile.value = { xp: 0, level: 1, ...data }
    })
    // Determine admin via custom claims
    try {
      const token = await user.value.getIdTokenResult()
      isAdmin.value = token.claims?.admin === true
    } catch {
      isAdmin.value = false
    }
  }
  // React to auth changes
  onAuthStateChanged(auth, (u) => {
    user.value = u
    // clean up previous listener
    if (unsubProfile) {
      try {
        unsubProfile()
      } catch {}
      unsubProfile = null
    }
    if (u) {
      loadProfile()
      unsubProfile = onStudentProfileSnapshot(u.uid, (data) => {
        if (!data) return
        profile.value = { xp: 0, level: 1, ...data }
      })
      ;(async () => {
        try {
          const token = await u.getIdTokenResult(true)
          isAdmin.value = token.claims?.admin === true
        } catch {
          isAdmin.value = false
        }
      })()
    } else {
      profile.value = null
      isAdmin.value = false
    }
  })
})

// Listen for localStorage flag to force refresh claims after admin changes (other tabs)
window.addEventListener('storage', (e) => {
  if (e.key === 'adminClaimsRefresh' && e.newValue) {
    ;(async () => {
      const auth = await getAuthInstance()
      if (auth.currentUser) {
        try {
          const tok = await auth.currentUser.getIdTokenResult(true)
          isAdmin.value = tok.claims?.admin === true
        } catch {}
      }
    })()
  }
})

onUnmounted(() => {
  if (unsubProfile) {
    try {
      unsubProfile()
    } catch {}
    unsubProfile = null
  }
})
</script>

<style scoped>
.slide-fade-enter-active {
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}
.slide-fade-leave-active {
  transition:
    transform 140ms ease,
    opacity 140ms ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.slide-fade-enter-to,
.slide-fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
