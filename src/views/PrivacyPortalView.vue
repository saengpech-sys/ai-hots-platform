<template>
  <div class="max-w-3xl mx-auto p-4 sm:p-6">
    <h1 class="text-2xl font-bold mb-4">ความเป็นส่วนตัว & สิทธิ์ข้อมูล</h1>
    <div class="space-y-6">
      <!-- Consent Summary -->
      <section class="bg-white rounded-lg shadow p-4">
        <h2 class="font-semibold mb-2">สถานะความยินยอม</h2>
        <div v-if="loadingPortal" class="text-sm text-slate-500">กำลังโหลด...</div>
        <div v-else class="text-sm">
          <p>
            เวอร์ชันที่ยอมรับล่าสุด:
            <span class="font-mono">{{ portal?.consentVersionAccepted || '—' }}</span>
          </p>
          <p>
            เปิดใช้งาน Gamification:
            <span :class="portal?.allowGamification ? 'text-emerald-600' : 'text-slate-500'">{{
              portal?.allowGamification ? 'เปิด' : 'ปิด'
            }}</span>
          </p>
        </div>
      </section>

      <!-- Data Export -->
      <section class="bg-white rounded-lg shadow p-4">
        <h2 class="font-semibold mb-2">ดาวน์โหลดข้อมูล</h2>
        <p class="text-sm text-slate-600 mb-3">
          คุณสามารถดาวน์โหลดสำเนาข้อมูลส่วนบุคคลของคุณ (โปรไฟล์ ผลงาน สถานการณ์) ได้
        </p>
        <button
          :disabled="exporting"
          @click="doExport"
          class="px-3 py-1.5 text-sm rounded-md border bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
        >
          {{ exporting ? 'กำลังสร้าง...' : 'สร้างไฟล์ JSON' }}
        </button>
        <div v-if="exportError" class="text-xs text-red-600 mt-2">{{ exportError }}</div>
        <div v-if="exportBlob" class="mt-3 text-xs">
          <a :href="exportBlobUrl" download="my-data-export.json" class="text-emerald-700 underline"
            >ดาวน์โหลดไฟล์ที่สร้างแล้ว</a
          >
          <span class="ml-2 text-slate-500">ขนาด ~{{ exportSizeKB }} KB</span>
        </div>
      </section>

      <!-- Delete Request -->
      <section class="bg-white rounded-lg shadow p-4">
        <h2 class="font-semibold mb-2">คำขอลบข้อมูล</h2>
        <template v-if="portal?.deleteRequest">
          <p class="text-sm">
            สถานะคำขอ: <span class="font-medium">{{ portal.deleteRequest.status }}</span>
          </p>
          <p v-if="portal.deleteRequest.hardDeleteAfter" class="text-xs text-slate-500">
            จะเริ่มลบอ่อนหลัง: {{ formatDate(portal.deleteRequest.hardDeleteAfter) }}
          </p>
        </template>
        <template v-else>
          <p class="text-sm mb-3">
            เมื่อส่งคำขอ ระบบจะทำเครื่องหมายและลบข้อมูลหลังช่วงผ่อนผัน ({{ graceDays }} วัน)
          </p>
          <button
            :disabled="deleting"
            @click="confirmDelete"
            class="px-3 py-1.5 text-sm rounded-md border bg-red-50 hover:bg-red-100 disabled:opacity-50"
          >
            {{ deleting ? 'กำลังส่ง...' : 'ส่งคำขอลบข้อมูล' }}
          </button>
        </template>
        <div v-if="deleteError" class="text-xs text-red-600 mt-2">{{ deleteError }}</div>
      </section>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, computed } from 'vue'
import { auth } from '@/firebase/config'
import { apiPost } from '@/services/apiClient'

const portal = ref(null)
const loadingPortal = ref(false)
const exporting = ref(false)
const exportBlob = ref(null)
const exportError = ref('')
const deleting = ref(false)
const deleteError = ref('')
const graceDays = 30 // mirror RETENTION constant (display only)

const exportBlobUrl = computed(() =>
  exportBlob.value ? URL.createObjectURL(exportBlob.value) : null,
)
const exportSizeKB = computed(() =>
  exportBlob.value ? Math.round(exportBlob.value.size / 1024) : 0,
)

function authHeader() {
  return auth.currentUser?.getIdToken().then((t) => ({ Authorization: `Bearer ${t}` }))
}
async function fetchPortal() {
  loadingPortal.value = true
  try {
    const headers = await authHeader()
    portal.value = await apiPost('/api/user-portal', headers, {})
  } catch (e) {
    console.warn(e)
  } finally {
    loadingPortal.value = false
  }
}
async function doExport() {
  exporting.value = true
  exportError.value = ''
  exportBlob.value = null
  try {
    const headers = await authHeader()
    let json
    try {
      json = await apiPost('/api/export-user-data', headers, {})
    } catch (e) {
      // Surface nicer message for rate limit
      if (/rate limited/i.test(String(e.message))) {
        throw new Error('ขอออกรายงานบ่อยเกินไป โปรดลองใหม่อีกครั้งภายหลัง (อย่างน้อย 1 ชั่วโมง).')
      }
      throw e
    }
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
    exportBlob.value = blob
  } catch (e) {
    exportError.value = String(e.message || e)
  } finally {
    exporting.value = false
  }
}
async function confirmDelete() {
  if (!confirm('ยืนยันการส่งคำขอลบข้อมูล?')) return
  deleting.value = true
  deleteError.value = ''
  try {
    const headers = await authHeader()
    headers['Content-Type'] = 'application/json'
    await apiPost('/api/request-delete', headers, {})
    await fetchPortal()
  } catch (e) {
    deleteError.value = String(e.message || e)
  } finally {
    deleting.value = false
  }
}
function formatDate(v) {
  if (!v) return ''
  try {
    return new Date(v._seconds ? v._seconds * 1000 : v).toLocaleString('th-TH')
  } catch {
    return ''
  }
}

onMounted(() => fetchPortal())
</script>
