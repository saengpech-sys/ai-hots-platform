<template>
  <div class="p-4 md:p-6 space-y-6">
    <header class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">{{ L.title }}</h1>
        <p class="text-sm text-gray-500">{{ L.subtitle }}</p>
      </div>
      <ReportFilters :courses="courses" v-model="filters" @refresh="load">
        <template #extra>
          <button
            class="border rounded px-3 py-1 text-sm hover:bg-gray-50"
            :disabled="loading || !report"
            @click="exportCSV"
          >
            {{ L.exportCSV }}
          </button>
          <button
            class="border rounded px-3 py-1 text-sm hover:bg-gray-50"
            :disabled="loading || !report"
            @click="exportJSON"
          >
            {{ L.exportJSON }}
          </button>
          <button
            class="border rounded px-3 py-1 text-sm hover:bg-gray-50"
            :disabled="loading || !report"
            @click="exportPDF"
          >
            {{ L.exportPDF }}
          </button>
          <label
            class="flex items-center gap-1 text-xs select-none cursor-pointer ml-2"
            :class="{ 'opacity-50 cursor-not-allowed': !isAdmin }"
            title=""
          >
            <input
              type="checkbox"
              :disabled="!isAdmin"
              v-model="showRealNames"
              @change="refreshNames"
            />
            {{ L.showRealNames }}
          </label>
          <div class="flex items-center gap-1 ml-2">
            <select
              class="border rounded px-1 py-1 text-xs"
              :disabled="switching"
              :value="locale"
              @change="changeLocale"
            >
              <option value="th">TH</option>
              <option value="en">EN</option>
            </select>
            <span v-if="switching" class="text-gray-400 text-xs animate-pulse">…</span>
          </div>
        </template>
      </ReportFilters>
    </header>

    <div v-if="loadError" class="text-red-600 text-sm">{{ loadError }}</div>
    <div v-if="partialNotice" class="text-amber-600 text-xs flex items-center gap-2">
      <span>{{ partialNotice }}</span>
      <button class="underline" @click="load">{{ L.retry || 'Retry' }}</button>
    </div>
    <div v-if="loading" class="text-sm text-gray-500 flex items-center gap-2">
      <span>{{ L.loading || 'Loading...' }}</span>
      <span v-if="progress.total">({{ progress.loaded }} / ~{{ progress.total }} submissions)</span>
      <span v-else-if="progress.loaded">({{ progress.loaded }} loaded)</span>
      <span v-if="progress.loaded && !progress.complete" class="animate-pulse">…</span>
      <div v-if="progress.loaded" class="w-32 h-1 bg-gray-200 rounded overflow-hidden">
        <div class="h-full bg-blue-500 transition-all" :style="{ width: progressBar }"></div>
      </div>
    </div>

    <div v-if="noCourses && !loading" class="text-sm text-gray-500">
      {{ L.noCourses || 'ยังไม่มีรายวิชา' }}
    </div>
    <div v-else-if="!report && !loading" class="text-xs text-gray-400">
      <div>
        Debug: courses={{ courses.length }} courseId={{ filters.courseId || 'NONE' }} loading={{
          loading
        }}
      </div>
    </div>
    <div v-if="report && !loading" class="space-y-6">
      <KPIGroup :items="kpis" />
      <div class="grid md:grid-cols-2 gap-6">
        <TrendChartPlaceholder
          :data="report.trend"
          title="แนวโน้มคะแนนรายวัน"
          noData="ไม่มีข้อมูล"
        />
        <ScoreDistributionPlaceholder
          :data="report.distribution"
          title="การกระจายคะแนน"
          noData="ไม่มีข้อมูล"
        />
      </div>

      <section class="bg-white border rounded p-4">
        <h3 class="font-semibold mb-3 text-sm">{{ L.studentSummary }}</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full text-xs">
            <thead>
              <tr class="bg-gray-50 text-gray-600">
                <th class="text-left px-2 py-1 font-medium">{{ L.studentCode }}</th>
                <th class="text-left px-2 py-1 font-medium">{{ L.avg }}</th>
                <th class="text-left px-2 py-1 font-medium">{{ L.submissions }}</th>
                <th class="text-left px-2 py-1 font-medium">{{ L.lastActive }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="stu in report.students" :key="stu.studentId" class="border-t">
                <td class="px-2 py-1">{{ stu.studentCode }}</td>
                <td class="px-2 py-1">{{ format(stu.avgScore) }}</td>
                <td class="px-2 py-1">{{ stu.submissions }}</td>
                <td class="px-2 py-1">
                  {{ stu.lastActiveAt ? formatDate(stu.lastActiveAt) : '—' }}
                </td>
              </tr>
              <tr v-if="!report.students.length">
                <td colspan="4" class="text-center py-3 text-gray-500">{{ L.noData }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-[10px] text-gray-400 mt-2">
          {{ L.anonymizedNote }}
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, watchEffect, defineAsyncComponent } from 'vue'
import ReportFilters from '@/components/reports/ReportFilters.vue'
import KPIGroup from '@/components/reports/KPIGroup.vue'
// Lazy-load uPlot-based components (lighter than ECharts)
const TrendChartPlaceholder = defineAsyncComponent(
  () => import('@/components/reports/TrendChartUplot.vue'),
)
const ScoreDistributionPlaceholder = defineAsyncComponent(
  () => import('@/components/reports/ScoreDistributionUplot.vue'),
)
import { listTeacherCourses, fetchTeacherResearchReport } from '@/services/reportService'
import { exportReportToCSV, exportReportToJSON, exportReportToPDF } from '@/utils/exporter'
import { ensureInitialLocale, setLocale, useL } from '@/stores/localeStore'
import { getAuthInstance } from '@/firebase/config'

const courses = ref([])
const filters = reactive({ courseId: '', days: 30 })
const loading = ref(false)
const loadError = ref('')
const partialNotice = ref('')
const progress = reactive({ loaded: 0, page: 0, complete: false, total: 0 })
const report = ref(null)
const showRealNames = ref(false)
const isAdmin = ref(false)
const { locale, messages } = useL()
ensureInitialLocale().catch((e) => console.warn('locale init failed', e))
// Expose flat object for template property access without .value
const L = reactive({})
watchEffect(() => {
  Object.assign(L, messages[locale.value]?.researchReport || {})
})
const switching = ref(false)
async function changeLocale(e) {
  const code = e.target.value
  if (code === locale.value) return
  switching.value = true
  await setLocale(code)
  switching.value = false
  // Update partial notice language if present
  if (partialNotice.value) {
    partialNotice.value = L.partialData || partialNotice.value
  }
}

const noCourses = ref(false)
async function initCourses() {
  try {
    courses.value = await listTeacherCourses()
    console.log(
      '[ResearchReport] courses loaded',
      courses.value.map((c) => c.id),
    )
    if (courses.value.length && !filters.courseId) {
      filters.courseId = courses.value[0].id
      console.log('[ResearchReport] set initial courseId', filters.courseId)
    } else if (!courses.value.length) {
      noCourses.value = true
    }
  } catch (e) {
    loadError.value = e.message || 'โหลดรายวิชาล้มเหลว'
    console.error('[ResearchReport] listTeacherCourses error', e)
  }
}

async function load() {
  if (!filters.courseId) {
    console.warn('[ResearchReport] load() skipped no courseId')
    return
  }
  loading.value = true
  loadError.value = ''
  partialNotice.value = ''
  try {
    console.log('[ResearchReport] loading report for', filters.courseId)
    progress.loaded = 0
    progress.page = 0
    progress.complete = false
    report.value = await fetchTeacherResearchReport({
      ...filters,
      showRealNames: showRealNames.value,
      progressive: true,
      onProgress: (p) => {
        progress.loaded = p.loaded
        progress.page = p.page
        progress.complete = !!p.complete
        if (p.partial && !partialNotice.value) {
          partialNotice.value = L.partialData || 'Loaded partial data (retry for more).'
        }
      },
    })
    console.log('[ResearchReport] report loaded', !!report.value)
  } catch (e) {
    loadError.value = e.message || 'เกิดข้อผิดพลาด'
    console.error('[ResearchReport] fetchTeacherResearchReport error', e)
  } finally {
    loading.value = false
  }
}

watch(
  () => ({ ...filters }),
  () => {
    load()
  },
)

onMounted(async () => {
  await initCourses()
  try {
    const auth = await getAuthInstance()
    if (auth.currentUser) {
      const tokenRes = await auth.currentUser.getIdTokenResult()
      isAdmin.value = !!tokenRes.claims?.admin
    }
  } catch (_) {}
  if (!isAdmin.value) showRealNames.value = false
  if (filters.courseId) await load()
})

const progressBar = computed(() => {
  if (!progress.loaded) return '0%'
  if (!progress.complete) {
    const denom = 20000 // heuristic upper bound
    return Math.min(100, (progress.loaded / denom) * 100).toFixed(1) + '%'
  }
  return '100%'
})
const kpis = computed(() => {
  if (!report.value) return []
  const r = report.value
  const map = L.kpis || {}
  return [
    { label: map.totalStudents, value: r.totalStudents },
    { label: map.totalSubmissions, value: r.totalSubmissions },
    { label: map.avgScore, value: r.avgScore },
    { label: map.medianScore, value: r.medianScore },
    { label: map.stdDev, value: r.stdDev },
    { label: map.minScore, value: r.minScore },
    { label: map.maxScore, value: r.maxScore },
    { label: map.progressRate, value: r.progressRate },
    { label: map.participationRate, value: r.participationRate },
    { label: map.activityGap, value: r.activityGap },
    { label: map.p10, value: r.p10 },
    { label: map.p90, value: r.p90 },
  ]
})

function format(n) {
  if (n == null || isNaN(n)) return '—'
  return typeof n === 'number' && !Number.isInteger(n) ? n.toFixed(2) : n
}
function formatDate(ts) {
  const d = new Date(ts)
  const loc = locale.value === 'en' ? 'en-US' : 'th-TH'
  return d.toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric' })
}

function exportCSV() {
  if (report.value) exportReportToCSV(report.value)
}
function exportJSON() {
  if (report.value) exportReportToJSON(report.value)
}
async function exportPDF() {
  if (report.value) await exportReportToPDF(report.value)
}

async function refreshNames() {
  await load()
}
</script>

<style scoped>
/* additional minimal styling if needed */
</style>
