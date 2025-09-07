<template>
  <div class="max-w-6xl mx-auto p-4 sm:p-6">
    <h1 class="text-2xl font-semibold mb-2">Admin Dashboard</h1>
    <p class="text-slate-600 text-sm mb-6">จัดการบทบาท admin และคำขอลบข้อมูล (PDPA)</p>

    <div class="flex items-center gap-3 border-b mb-6 text-sm overflow-x-auto">
      <button
        v-for="t in tabs"
        :key="t.key"
        @click="activeTab = t.key"
        class="px-3 py-2 -mb-px border-b-2"
        :class="
          activeTab === t.key
            ? 'border-indigo-600 text-indigo-700 font-medium'
            : 'border-transparent text-slate-500 hover:text-slate-700'
        "
      >
        {{ t.label }}
      </button>
    </div>

    <!-- Tab: Admins -->
    <div v-if="activeTab === 'admins'" class="space-y-6">
      <form
        @submit.prevent="addAdmin"
        class="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-end"
      >
        <div class="flex-1 w-full">
          <label class="block text-xs font-semibold mb-1">เพิ่มผู้ใช้เป็น Admin (email)</label>
          <input
            v-model.trim="newAdminEmail"
            type="email"
            required
            class="input"
            placeholder="teacher@example.com"
          />
        </div>
        <button
          class="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
          :disabled="addingAdmin"
        >
          {{ addingAdmin ? 'Saving...' : 'Add' }}
        </button>
        <div v-if="adminError" class="text-xs text-rose-600">{{ adminError }}</div>
        <div v-if="adminSaved" class="text-xs text-emerald-600">Saved</div>
      </form>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h2 class="font-semibold">Admins ({{ filteredAdmins.length }})</h2>
          <div class="flex flex-wrap gap-2 items-center">
            <input
              v-model.trim="adminSearch"
              placeholder="ค้นหา email / uid"
              class="input !py-1 !px-2 w-44"
            />
            <button
              @click="loadAdmins"
              class="text-xs px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-300"
            >
              Refresh
            </button>
          </div>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left border-b text-slate-600">
              <th class="py-2 pr-3">Email</th>
              <th class="py-2 pr-3">UID</th>
              <th class="py-2 pr-3">Export</th>
              <th class="py-2 pr-3">Created</th>
              <th class="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in filteredAdmins" :key="a.id" class="border-b last:border-0">
              <td class="py-1.5 pr-3 font-medium">{{ a.email }}</td>
              <td class="py-1.5 pr-3 text-xs text-slate-500 truncate max-w-[140px]" :title="a.id">
                {{ a.id }}
              </td>
              <td class="py-1.5 pr-3 text-xs">
                <button
                  class="px-2 py-0.5 bg-slate-200 rounded hover:bg-slate-300"
                  @click="checkExport(a.id)"
                  :disabled="exportLoadingIds.has(a.id)"
                >
                  {{
                    exportStatuses[a.id]?.last
                      ? formatShortTs(exportStatuses[a.id].last.ts)
                      : exportLoadingIds.has(a.id)
                        ? '…'
                        : 'Check'
                  }}
                </button>
                <div
                  v-if="exportStatuses[a.id]?.last?.size"
                  class="text-[10px] text-slate-500 mt-0.5"
                >
                  {{ formatBytes(exportStatuses[a.id].last.size) }}
                </div>
              </td>
              <td class="py-1.5 pr-3 text-xs text-slate-500">{{ formatTs(a.createdAt) }}</td>
              <td class="py-1.5 text-xs">
                <button
                  class="px-2 py-1 bg-rose-600 text-white rounded hover:bg-rose-700 disabled:opacity-40"
                  @click="removeAdmin(a.id)"
                  :disabled="a.id === selfUid || removingIds.has(a.id)"
                >
                  {{ removingIds.has(a.id) ? '...' : a.id === selfUid ? 'You' : 'Remove' }}
                </button>
              </td>
            </tr>
            <tr v-if="!filteredAdmins.length && adminsLoading">
              <td colspan="4" class="py-3 text-center text-xs text-slate-500">Loading...</td>
            </tr>
            <tr v-if="!filteredAdmins.length && !adminsLoading">
              <td colspan="5" class="py-3 text-center text-xs text-slate-500">No admins</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab: Delete Requests -->
    <div v-if="activeTab === 'delete'" class="space-y-6">
      <div class="bg-white rounded-lg shadow p-4">
        <details
          class="mb-4 bg-slate-50 border border-slate-200 rounded-md p-3 text-[11px] leading-relaxed"
        >
          <summary class="cursor-pointer font-semibold text-slate-700 select-none">
            อธิบายขั้นตอนลบข้อมูล (PDPA)
          </summary>
          <div class="mt-2 space-y-1 text-slate-600">
            <p>1. ผู้ใช้ยื่นคำขอลบ -> สถานะ <strong>pending</strong></p>
            <p>
              2. แอดมินกด Approve -> ยังเป็น <strong>pending</strong> แต่มีเครื่องหมาย approved
              (แสดงเป็นป้าย pending-approved)
            </p>
            <p>
              3. ถึงกำหนด <em>Hard Delete After</em> (cron รายวัน) -> ระบบเปลี่ยนเป็น
              <strong>soft-deleted</strong> และปักธง softDeleted ในโปรไฟล์
            </p>
            <p>
              4. งานตามรอบ (cron รายสัปดาห์) -> ลบถาวร เปลี่ยนเป็น
              <strong>purged</strong> (ขั้นนี้ย้อนกลับไม่ได้)
            </p>
            <p>Reject = ปฏิเสธคำขอ และจบกระบวนการ</p>
          </div>
        </details>
        <div class="flex flex-wrap gap-4 mb-4 text-xs" v-if="deletionFunnel">
          <div class="px-3 py-2 bg-slate-100 rounded">
            <div class="font-semibold">Pending</div>
            <div>{{ deletionFunnel.pending || 0 }}</div>
            <div class="text-[10px] text-slate-500">
              Approved: {{ deletionFunnel.pending_approved || 0 }} / Unapproved:
              {{ deletionFunnel.pending_unapproved || 0 }}
            </div>
          </div>
          <div class="px-3 py-2 bg-indigo-50 rounded">
            <div class="font-semibold">Soft Deleted</div>
            <div>{{ deletionFunnel['soft-deleted'] || 0 }}</div>
          </div>
          <div class="px-3 py-2 bg-rose-50 rounded">
            <div class="font-semibold">Purged</div>
            <div>{{ deletionFunnel.purged || 0 }}</div>
          </div>
          <div class="px-3 py-2 bg-slate-200 rounded">
            <div class="font-semibold">Rejected</div>
            <div>{{ deletionFunnel.rejected || 0 }}</div>
          </div>
          <div class="self-end">
            <button
              @click="loadDeletionFunnel"
              class="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
            >
              Refresh Funnel
            </button>
          </div>
        </div>
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold">คำขอลบข้อมูล ({{ deleteRequests.length }})</h2>
          <div class="flex gap-2 items-center">
            <select v-model="deleteStatus" @change="loadDeleteRequests(true)" class="select">
              <option value="pending">รอดำเนินการ</option>
              <option value="soft-deleted">Soft Deleted</option>
              <option value="purged">Purged</option>
              <option value="rejected">Rejected</option>
            </select>
            <button
              @click="loadDeleteRequests(true)"
              class="text-xs px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-300"
            >
              Refresh
            </button>
          </div>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left border-b text-slate-600">
              <th class="py-2 pr-3">UID</th>
              <th class="py-2 pr-3">Name</th>
              <th class="py-2 pr-3">Requested At</th>
              <th class="py-2 pr-3">Hard Delete After</th>
              <th class="py-2 pr-3">Status</th>
              <th class="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in deleteRequests" :key="r.id" class="border-b last:border-0">
              <td class="py-1.5 pr-3 text-xs font-mono max-w-[140px] truncate" :title="r.id">
                {{ r.id }}
              </td>
              <td class="py-1.5 pr-3 text-xs max-w-[180px] truncate" :title="r.studentName || '—'">
                {{ r.studentName || '—' }}
              </td>
              <td class="py-1.5 pr-3 text-xs text-slate-500">{{ formatTs(r.requestedAt) }}</td>
              <td class="py-1.5 pr-3 text-xs text-slate-500">{{ formatTs(r.hardDeleteAfter) }}</td>
              <td class="py-1.5 pr-3 text-xs">
                <span :class="statusBadgeClass(r)">{{ softDeleteLabel(r) }}</span>
              </td>
              <td class="py-1.5 pr-3 text-xs">
                <div class="flex gap-1" v-if="r.status === 'pending'">
                  <button
                    class="px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40"
                    :disabled="actingIds.has(r.id)"
                    @click="actDelete(r.id, 'approve')"
                  >
                    Approve
                  </button>
                  <button
                    class="px-2 py-1 bg-rose-600 text-white rounded hover:bg-rose-700 disabled:opacity-40"
                    :disabled="actingIds.has(r.id)"
                    @click="actDelete(r.id, 'reject')"
                  >
                    Reject
                  </button>
                  <button
                    v-if="r.approvedBy"
                    class="px-2 py-1 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700 disabled:opacity-40"
                    :disabled="actingIds.has(r.id)"
                    title="Force immediate soft delete (override grace period)"
                    @click="confirmForce(r)"
                  >
                    Force Soft Delete
                  </button>
                </div>
                <div v-else class="text-slate-400">—</div>
              </td>
            </tr>
            <tr v-if="!deleteRequests.length && deleteLoading">
              <td colspan="6" class="py-3 text-center text-xs text-slate-500">Loading...</td>
            </tr>
            <tr v-if="!deleteRequests.length && !deleteLoading">
              <td colspan="6" class="py-3 text-center text-xs text-slate-500">No requests</td>
            </tr>
          </tbody>
        </table>
        <div v-if="deleteHasMore && !deleteLoading" class="pt-3">
          <button
            @click="loadDeleteRequests(false)"
            class="px-3 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300"
          >
            Load More
          </button>
        </div>
        <div v-if="deleteLoading && deleteRequests.length" class="pt-2 text-xs text-slate-500">
          Loading…
        </div>
      </div>
    </div>

    <!-- Tab: Audit Logs -->
    <div v-if="activeTab === 'audit'" class="space-y-6">
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
          <div>
            <label class="block text-xs font-semibold mb-1">ค้นหาด้วย Action (contains)</label>
            <input
              v-model.trim="auditAction"
              class="input !py-1 !px-2 w-56"
              placeholder="add_admin"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold mb-1">ตั้งแต่ (ms timestamp)</label>
            <input v-model.number="auditSince" type="number" class="input !py-1 !px-2 w-44" />
          </div>
          <div>
            <label class="block text-xs font-semibold mb-1">ถึง (ms timestamp)</label>
            <input v-model.number="auditUntil" type="number" class="input !py-1 !px-2 w-44" />
          </div>
          <div class="flex gap-2 items-center pt-5 sm:pt-0">
            <button
              @click="loadAudit(true)"
              class="px-3 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300"
            >
              Search
            </button>
            <button
              @click="resetAudit"
              class="px-3 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300"
            >
              Reset
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="text-left border-b text-slate-600">
                <th class="py-2 pr-3">Timestamp</th>
                <th class="py-2 pr-3">Actor</th>
                <th class="py-2 pr-3">Action</th>
                <th class="py-2 pr-3">Meta</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in auditLogs" :key="l.id" class="border-b last:border-0">
                <td class="py-1.5 pr-3 whitespace-nowrap">{{ formatTs(l.ts) }}</td>
                <td class="py-1.5 pr-3 font-mono">{{ l.actor || 'system' }}</td>
                <td class="py-1.5 pr-3">{{ l.action }}</td>
                <td class="py-1.5 pr-3 max-w-xs truncate" :title="metaPreview(l)">
                  {{ metaPreview(l) }}
                </td>
              </tr>
              <tr v-if="!auditLogs.length && auditLoading">
                <td colspan="4" class="py-3 text-center text-slate-500">Loading...</td>
              </tr>
              <tr v-if="!auditLogs.length && !auditLoading">
                <td colspan="4" class="py-3 text-center text-slate-500">No logs</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="auditHasMore && !auditLoading" class="pt-3">
          <button
            @click="loadAudit(false)"
            class="px-3 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300"
          >
            Load More
          </button>
        </div>
        <div v-if="auditLoading && auditLogs.length" class="pt-2 text-xs text-slate-500">
          Loading…
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, computed } from 'vue'
import { apiPostAuth } from '@/services/apiClient'
import { getAuthInstance } from '@/firebase/config'

const tabs = [
  { key: 'admins', label: 'Admins' },
  { key: 'delete', label: 'Delete Requests' },
  { key: 'audit', label: 'Audit Logs' },
]
const activeTab = ref('admins')

// Admin list state
const admins = ref([])
const adminsLoading = ref(false)
const newAdminEmail = ref('')
const addingAdmin = ref(false)
const adminError = ref('')
const adminSaved = ref(false)
const removingIds = ref(new Set())
const selfUid = ref('')
const adminSearch = ref('')
const exportStatuses = ref({})
const exportLoadingIds = ref(new Set())
function formatBytes(b) {
  if (!b && b !== 0) return ''
  const n = Number(b)
  if (isNaN(n)) return ''
  if (n < 1024) return n + ' B'
  const kb = n / 1024
  if (kb < 1024) return kb.toFixed(1) + ' KB'
  const mb = kb / 1024
  if (mb < 1024) return mb.toFixed(2) + ' MB'
  const gb = mb / 1024
  return gb.toFixed(2) + ' GB'
}
const filteredAdmins = computed(() => {
  if (!adminSearch.value) return admins.value
  const q = adminSearch.value.toLowerCase()
  return admins.value.filter((a) => a.email?.toLowerCase().includes(q) || a.id.includes(q))
})

// Delete requests state
const deleteRequests = ref([])
const deleteNextCursor = ref(null)
const deleteHasMore = ref(false)
const deleteLoading = ref(false)
const deleteStatus = ref('pending')
const actingIds = ref(new Set())
function softDeleteLabel(r) {
  if (r.status === 'pending' && r.approvedBy) return 'pending-approved'
  return r.status
}
function statusBadgeClass(r) {
  const base = 'inline-flex px-2 py-0.5 rounded-full text-xs'
  const st = softDeleteLabel(r)
  if (st === 'pending') return base + ' bg-amber-100 text-amber-700'
  if (st === 'pending-approved') return base + ' bg-indigo-100 text-indigo-700'
  if (st === 'soft-deleted') return base + ' bg-fuchsia-100 text-fuchsia-700'
  if (st === 'purged') return base + ' bg-rose-100 text-rose-700'
  if (st === 'rejected') return base + ' bg-slate-200 text-slate-700'
  return base + ' bg-slate-100 text-slate-600'
}

function formatTs(v) {
  try {
    if (v?.toMillis) return new Date(v.toMillis()).toLocaleString('th-TH')
    if (v?._seconds) return new Date(v._seconds * 1000).toLocaleString('th-TH')
    return new Date(v).toLocaleString('th-TH')
  } catch {
    return ''
  }
}

async function loadAdmins() {
  adminsLoading.value = true
  try {
    const js = await apiPostAuth('/api/admins', {})
    admins.value = Array.isArray(js?.admins) ? js.admins : []
  } catch (e) {
    console.warn('listAdmins failed', e)
  } finally {
    adminsLoading.value = false
  }
}

async function addAdmin() {
  adminError.value = ''
  adminSaved.value = false
  if (!newAdminEmail.value) return
  addingAdmin.value = true
  try {
    await apiPostAuth('/api/admins-add', { email: newAdminEmail.value })
    adminSaved.value = true
    newAdminEmail.value = ''
    loadAdmins()
    // broadcast claim refresh (other tabs)
    try {
      localStorage.setItem('adminClaimsRefresh', Date.now().toString())
    } catch {}
  } catch (e) {
    adminError.value = e.message || 'Add failed'
  } finally {
    addingAdmin.value = false
  }
}

async function removeAdmin(uid) {
  if (uid === selfUid.value) return
  if (!confirm('Remove this admin privilege?')) return
  removingIds.value.add(uid)
  try {
    await apiPostAuth('/api/admins-remove', { uid })
    admins.value = admins.value.filter((a) => a.id !== uid)
    try {
      localStorage.setItem('adminClaimsRefresh', Date.now().toString())
    } catch {}
  } catch (e) {
    alert(e.message || 'Remove failed')
  } finally {
    removingIds.value.delete(uid)
  }
}
async function checkExport(uid) {
  exportLoadingIds.value.add(uid)
  try {
    const js = await apiPostAuth('/api/export-status', { targetUid: uid })
    exportStatuses.value = { ...exportStatuses.value, [uid]: js }
  } catch (e) {
    console.warn('export status fail', e)
  } finally {
    exportLoadingIds.value.delete(uid)
  }
}
function formatShortTs(ts) {
  try {
    const d = ts?.toMillis
      ? new Date(ts.toMillis())
      : new Date(ts._seconds ? ts._seconds * 1000 : ts)
    return d.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })
  } catch {
    return '?'
  }
}

async function loadDeleteRequests(reset = true) {
  if (reset) {
    deleteRequests.value = []
    deleteNextCursor.value = null
  }
  deleteLoading.value = true
  try {
    const body = { status: deleteStatus.value }
    if (deleteNextCursor.value) body.startAfter = deleteNextCursor.value
    const js = await apiPostAuth('/api/delete-requests', body)
    if (Array.isArray(js?.requests)) {
      deleteRequests.value = deleteRequests.value.concat(js.requests)
      deleteNextCursor.value = js.nextCursor || null
      deleteHasMore.value = !!js.hasMore
    }
  } catch (e) {
    console.warn('listDeleteRequests failed', e)
  } finally {
    deleteLoading.value = false
  }
}

function confirmForce(r) {
  if (!confirm('Force immediate soft delete now? This bypasses grace period.')) return
  actDelete(r.id, 'force-soft-delete')
}
async function actDelete(uid, action) {
  actingIds.value.add(uid)
  try {
    await apiPostAuth('/api/delete-requests-act', { uid, action })
    const idx = deleteRequests.value.findIndex((r) => r.id === uid)
    if (idx >= 0) {
      const r = { ...deleteRequests.value[idx] }
      if (action === 'approve') {
        r.approvedBy = selfUid.value
        r.status = 'pending'
      } else if (action === 'reject') {
        r.status = 'rejected'
        r.rejectedBy = selfUid.value
      } else if (action === 'force-soft-delete') {
        r.status = 'soft-deleted'
        r.softDeletedAt = Date.now()
        r.forceSoftDeletedBy = selfUid.value
      }
      deleteRequests.value[idx] = r
    }
  } catch (e) {
    alert(e.message || 'Action failed')
  } finally {
    actingIds.value.delete(uid)
  }
}

// Audit logs state
const auditLogs = ref([])
const auditNextCursor = ref(null)
const auditHasMore = ref(false)
const auditLoading = ref(false)
const auditAction = ref('')
const auditSince = ref('')
const auditUntil = ref('')
function metaPreview(l) {
  const omit = ['ts', 'action', 'actor', 'id']
  const obj = { ...l }
  omit.forEach((k) => delete obj[k])
  const s = JSON.stringify(obj)
  return s.length > 90 ? s.slice(0, 90) + '…' : s
}
function resetAudit() {
  auditAction.value = ''
  auditSince.value = ''
  auditUntil.value = ''
  loadAudit(true)
}
async function loadAudit(reset = true) {
  if (reset) {
    auditLogs.value = []
    auditNextCursor.value = null
  }
  auditLoading.value = true
  try {
    const body = { actionContains: auditAction.value || undefined }
    if (auditSince.value) body.since = auditSince.value
    if (auditUntil.value) body.until = auditUntil.value
    if (auditNextCursor.value) body.startAfter = auditNextCursor.value
    const js = await apiPostAuth('/api/audit-logs', body)
    if (Array.isArray(js?.logs)) {
      auditLogs.value = auditLogs.value.concat(js.logs)
      auditNextCursor.value = js.nextCursor || null
      auditHasMore.value = !!js.hasMore
    }
  } catch (e) {
    console.warn('audit load fail', e)
  } finally {
    auditLoading.value = false
  }
}

onMounted(async () => {
  const auth = await getAuthInstance()
  selfUid.value = auth.currentUser?.uid || ''
  loadAdmins()
  loadDeleteRequests(true)
  loadAudit(true)
  loadDeletionFunnel()
})

// Deletion funnel aggregate summary
const deletionFunnel = ref(null)
const deletionLoading = ref(false)
async function loadDeletionFunnel() {
  deletionLoading.value = true
  try {
    const js = await apiPostAuth('/api/deletion-funnel', {})
    deletionFunnel.value = js?.counts || null
  } catch (e) {
    console.warn('funnel load fail', e)
  } finally {
    deletionLoading.value = false
  }
}
</script>
<style scoped>
.input {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
  background: #fff;
  outline: none;
}
.input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
}
.select {
  border: 1px solid #cbd5e1;
  background: #fff;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
}
</style>
