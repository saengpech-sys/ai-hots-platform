<template>
  <div class="bg-slate-50 min-h-screen">
    <div class="mx-auto max-w-7xl p-4 sm:p-6">
      <h1 class="text-2xl sm:text-3xl font-bold text-slate-800 mb-4">บัญชีและโปรไฟล์</h1>

      <!-- Shared header: avatar, name, role, XP (student) -->
      <section
        class="relative overflow-hidden rounded-2xl mb-6 shadow bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600"
      >
        <!-- Decorative backdrop shapes -->
        <div class="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay">
          <div class="absolute -top-10 -left-10 w-52 h-52 rounded-full bg-white/30 blur-3xl"></div>
          <div
            class="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-violet-400/30 blur-3xl"
          ></div>
        </div>
        <div
          class="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 p-5 sm:p-7 text-white"
        >
          <img
            :src="avatarUrl || placeholder"
            alt="avatar"
            class="h-20 w-20 rounded-full object-cover ring-4 ring-white/30 shadow-lg bg-slate-200"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <div class="text-xl sm:text-2xl font-bold tracking-tight truncate drop-shadow">
                {{ fullName }}
              </div>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/20 backdrop-blur text-white shadow-inner"
                >{{ isTeacher ? 'ครูผู้สอน' : 'นักเรียน' }}</span
              >
            </div>
            <!-- Student XP bar (hidden if gamification opt-out) -->
            <div v-if="!isTeacher && allowGamification" class="mt-3 w-full max-w-sm">
              <div
                class="flex items-center justify-between text-[11px] uppercase tracking-wide text-white/80 mb-1"
              >
                <span class="font-medium">Level {{ level }}</span>
                <span class="tabular-nums">{{ progressXp }}/{{ xpToNext }} XP</span>
              </div>
              <div class="h-2 rounded-full bg-white/25 overflow-hidden backdrop-blur-sm">
                <div
                  class="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 shadow-[0_0_0_1px_rgba(255,255,255,0.4)] transition-all duration-500"
                  :style="{ width: progressPct + '%' }"
                ></div>
              </div>
            </div>
          </div>
          <!-- Header actions -->
          <div class="sm:ml-auto w-full sm:w-auto pt-2 sm:pt-0">
            <!-- Desktop actions -->
            <div class="hidden sm:flex items-center gap-2">
              <button
                v-if="!isTeacher && allowGamification"
                @click="onExportClick('csv')"
                class="px-3 py-1.5 text-xs font-medium rounded-md bg-white/15 hover:bg-white/25 backdrop-blur border border-white/30 shadow text-white transition"
              >
                ส่งออก CSV
              </button>
              <button
                v-if="!isTeacher && allowGamification"
                @click="onExportClick('png')"
                class="px-3 py-1.5 text-xs font-medium rounded-md bg-white/15 hover:bg-white/25 backdrop-blur border border-white/30 shadow text-white transition"
              >
                บันทึกเป็นภาพ
              </button>
              <button
                v-if="!isTeacher && allowGamification"
                @click="onPrintClick"
                class="px-3 py-1.5 text-xs font-medium rounded-md bg-white/15 hover:bg-white/25 backdrop-blur border border-white/30 shadow text-white transition"
              >
                พิมพ์ PDF
              </button>
            </div>
            <!-- Mobile actions dropdown -->
            <div class="relative sm:hidden actions-root">
              <button
                v-if="!isTeacher && allowGamification"
                @click="actionsOpen = !actionsOpen"
                class="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium rounded-md bg-white/15 hover:bg-white/25 backdrop-blur border border-white/30 text-white shadow"
                aria-haspopup="true"
                :aria-expanded="actionsOpen ? 'true' : 'false'"
              >
                เมนูการส่งออก
                <svg class="ml-1 w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                  />
                </svg>
              </button>
              <div
                v-if="actionsOpen && allowGamification"
                class="absolute right-0 mt-1 w-44 bg-white/90 backdrop-blur border border-white/40 rounded-md shadow-lg z-10 text-slate-700"
                role="menu"
              >
                <button
                  @click="onExportClick('csv')"
                  class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                  role="menuitem"
                >
                  ส่งออก CSV
                </button>
                <button
                  @click="onExportClick('png')"
                  class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                  role="menuitem"
                >
                  บันทึกเป็นภาพ
                </button>
                <button
                  @click="onPrintClick"
                  class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                  role="menuitem"
                >
                  พิมพ์ PDF
                </button>
              </div>
            </div>
          </div>
        </div>
        <!-- Completeness notices (overlay style) -->
        <div
          v-if="!isTeacher && (!identityDone || !aboutDone)"
          class="mx-5 mb-4 -mt-2 px-3 py-2 rounded-lg bg-amber-400/15 border border-amber-300/40 text-amber-100 text-[11px] backdrop-blur"
        >
          <span v-if="!identityDone">ข้อมูลระบุตัวตนยังไม่ครบ • </span>
          <span v-if="!aboutDone">ข้อมูลโปรไฟล์ยังไม่ครบ</span>
        </div>
      </section>

      <!-- Tabs -->
      <div
        class="flex items-center gap-2 border-b border-slate-200 mb-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        <button
          v-for="t in tabs"
          :key="t.key"
          @click="goTab(t.key)"
          class="px-3 py-2 text-sm rounded-t-md whitespace-nowrap"
          :class="
            tab === t.key
              ? 'bg-white border-x border-t border-slate-200 text-slate-900'
              : 'text-slate-600 hover:text-slate-900'
          "
        >
          {{ t.label }}
        </button>
      </div>

      <!-- Content -->
      <div class="bg-white rounded-xl shadow p-0 sm:p-2">
        <!-- Quick privacy actions (student) -->
        <div
          v-if="!isTeacher"
          class="border-b border-slate-100 p-4 flex flex-wrap gap-3 text-xs bg-slate-50/40"
        >
          <div class="font-medium text-slate-700">ความเป็นส่วนตัว:</div>
          <router-link
            to="/privacy-portal"
            class="inline-flex items-center px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100"
            >เปิดพอร์ทัลสิทธิ์ข้อมูล</router-link
          >
          <button
            v-if="profile?.allowGamification === false"
            disabled
            class="inline-flex items-center px-2 py-1 rounded-md bg-slate-200 text-slate-600 cursor-not-allowed"
          >
            Gamification ปิดอยู่
          </button>
        </div>
        <!-- Student: portfolio tab -->
        <div v-if="!isTeacher && tab === 'portfolio'">
          <!-- Embed existing student portfolio view -->
          <StudentPortfolioView ref="studentPortfolioRef" />
        </div>

        <!-- Student: about tab -->
        <div v-else-if="!isTeacher && tab === 'about'" class="p-4 sm:p-6">
          <ProfileView />
        </div>

        <!-- Teacher: profile tab -->
        <div v-else-if="isTeacher && tab === 'teacher'" class="p-4 sm:p-6">
          <TeacherPortfolioView />
        </div>

        <!-- Teacher: courses inline tab -->
        <div v-else-if="isTeacher && tab === 'courses'">
          <TeacherCoursesTab />
        </div>

        <!-- Fallback -->
        <div v-else class="p-6 text-slate-500">กำลังโหลด...</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch, onBeforeUnmount, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAuthInstance, auth } from '@/firebase/config'
import {
  getStudentProfile,
  getTeacherProfile,
  onStudentProfileSnapshot,
} from '@/services/firestoreService'
import { onAuthStateChanged } from 'firebase/auth'
import StudentPortfolioView from '@/views/StudentPortfolioView.vue'
import ProfileView from '@/views/ProfileView.vue'
import TeacherPortfolioView from '@/views/TeacherPortfolioView.vue'
import TeacherCoursesTab from '@/views/TeacherCoursesTab.vue'
import PrivacyConsentModal from '@/components/PrivacyConsentModal.vue'
import { CURRENT_CONSENT_VERSION } from '@/config/privacy'

const route = useRoute()
const router = useRouter()

const profile = ref(null)
const isTeacher = computed(() => profile.value?.role === 'teacher')
const tab = ref(String(route.query.tab || 'about'))
const teacher = ref(null)
const placeholder = '/avatar.svg'
const studentPortfolioRef = ref(null)
const actionsOpen = ref(false)
let unsubProfile = null
const showConsent = ref(false)
const allowGamification = computed(() => profile.value?.allowGamification !== false)

// Display fields (full name). For now we treat single stored name as full name.
// Future enhancement: if schema gains firstName/lastName fields, concatenate them here.
const fullName = computed(() => {
  try {
    if (isTeacher.value)
      return teacher.value?.displayName || auth?.currentUser?.displayName || 'ครู'
    const raw = profile.value?.name || auth?.currentUser?.displayName || ''
    if (!raw || raw.includes('@')) return 'นักเรียน'
    return raw
  } catch {
    return 'ผู้ใช้'
  }
})
const avatarUrl = computed(() => {
  if (isTeacher.value) return teacher.value?.photoURL || auth.currentUser?.photoURL || ''
  return profile.value?.photoURL || ''
})

// XP metrics (students)
const xp = computed(() =>
  isTeacher.value || !allowGamification.value ? 0 : (profile.value?.xp ?? 0),
)
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

const tabs = computed(() => {
  if (isTeacher.value) {
    return [
      { key: 'teacher', label: 'โปรไฟล์ครู' },
      { key: 'courses', label: 'จัดการวิชา' },
    ]
  }
  return [
    { key: 'about', label: 'โปรไฟล์' },
    { key: 'portfolio', label: 'แฟ้มสะสมผลงาน' },
  ]
})

function goTab(key) {
  router.replace({ name: 'profile', query: { tab: key } })
}

watch(
  () => route.query.tab,
  (v) => {
    if (typeof v === 'string') tab.value = v
  },
)

// Initialize for a given signed-in user and start realtime subscription
async function initForUser(u) {
  try {
    profile.value = await getStudentProfile(u.uid)
    if (profile.value?.role === 'teacher') {
      try {
        teacher.value = await getTeacherProfile(u.uid)
      } catch {}
    } else {
      teacher.value = null
    }
    // Default tab per role if not specified
    if (!route.query.tab) {
      const def = isTeacher.value ? 'teacher' : 'about'
      router.replace({ name: 'profile', query: { tab: def } })
    }
    if (!isTeacher.value) {
      const ver = profile.value?.consentVersionAccepted || null
      if (ver !== CURRENT_CONSENT_VERSION) {
        // open consent modal defer a tick
        setTimeout(() => (showConsent.value = true), 50)
      }
    }
    // Realtime updates for student profile (XP, avatar, etc.)
    if (unsubProfile) {
      try {
        unsubProfile()
      } catch {}
      unsubProfile = null
    }
    unsubProfile = onStudentProfileSnapshot(u.uid, (data) => {
      if (!data) return
      profile.value = { xp: 0, level: 1, ...data }
    })
  } catch (e) {
    // ignore errors in profile load
  }
}

// Mount: handle current auth state and subscribe to changes
onMounted(async () => {
  const a = await getAuthInstance()
  const u = a.currentUser
  if (u) await initForUser(u)
  onAuthStateChanged(a, async (user) => {
    // Cleanup previous listener
    if (unsubProfile) {
      try {
        unsubProfile()
      } catch {}
      unsubProfile = null
    }
    if (user) await initForUser(user)
    else {
      profile.value = null
      teacher.value = null
    }
  })

  // close dropdown on outside click
  const onDocClick = (e) => {
    const el = e.target?.closest?.('.actions-root')
    if (!el) actionsOpen.value = false
  }
  document.addEventListener('click', onDocClick)
  onUnmounted(() => document.removeEventListener('click', onDocClick))
})

// Completion checks (reuse minimal logic)
const identityDone = computed(() => {
  const p = profile.value || {}
  const name = (p.name || '').trim()
  const codeOk = /^\d{5}$/.test(String(p.studentCode || '').trim())
  const gradeOk = !!(p.gradeLevel || '').trim?.()
  const roomOk = !!(p.room || '').trim?.()
  const numOk = Number.isFinite(Number(p.number)) && Number(p.number) > 0
  return !!name && !name.includes('@') && codeOk && gradeOk && roomOk && numOk
})
const aboutDone = computed(() => {
  const p = profile.value || {}
  const interOk = Array.isArray(p.interests) && p.interests.filter(Boolean).length > 0
  const styleOk = typeof p.learningStyle === 'string' && p.learningStyle.trim().length > 0
  const goalOk = typeof p.futureGoal === 'string' && p.futureGoal.trim().length > 0
  return interOk && styleOk && goalOk
})

function emitExport(kind) {
  const c = studentPortfolioRef.value
  if (!c) return
  if (kind === 'csv') c.exportCSV?.()
  else if (kind === 'png') c.exportPNG?.()
}

function printPDF() {
  // Use browser print; styles below hide chrome and keep only content
  window.print()
}

function onExportClick(kind) {
  emitExport(kind)
  actionsOpen.value = false
}
function onPrintClick() {
  printPDF()
  actionsOpen.value = false
}
</script>

<!-- Consent Modal Portal (stays outside flow but within single template) -->
<PrivacyConsentModal
  :open="showConsent"
  :current-version="profile?.consentVersionAccepted"
  :allow-gamification="profile?.allowGamification !== false"
  @close="showConsent = false"
  @saved="
    (p) => {
      profile.value.consentVersionAccepted = p.version
      profile.value.allowGamification = p.allowGamification
    }
  "
/>

<style scoped>
@media print {
  /* Hide nav and chrome likely outside this component via app styles; at least ensure buttons disappear */
  button {
    display: none !important;
  }
  a {
    text-decoration: none;
    color: black;
  }
  /* Make backgrounds white for clean print */
  .bg-white,
  .bg-slate-50 {
    background: #fff !important;
  }
  /* Expand to full width */
  .max-w-7xl,
  .max-w-6xl,
  .max-w-4xl {
    max-width: 100% !important;
  }
  /* Avoid page cut inside cards */
  .card,
  section {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
</style>
