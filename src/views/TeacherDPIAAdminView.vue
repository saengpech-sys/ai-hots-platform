<template>
  <div class="max-w-6xl mx-auto p-4 sm:p-6">
    <h1 class="text-2xl font-bold mb-4">DPIA Records</h1>
    <div class="bg-white rounded-lg shadow p-4 mb-6">
      <h2 class="font-semibold mb-3">Create New Record</h2>
      <form @submit.prevent="create" class="space-y-3">
        <div>
          <label class="block text-sm font-medium mb-1">Project Name *</label>
          <input v-model.trim="projectName" class="input" required />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Risks (one per line)</label>
          <textarea v-model.trim="risksRaw" rows="3" class="input resize-none" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Mitigations (one per line)</label>
          <textarea v-model.trim="mitigationsRaw" rows="3" class="input resize-none" />
        </div>
        <div class="flex items-center gap-3 pt-2 flex-wrap">
          <button
            :disabled="loading"
            class="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm disabled:opacity-50"
          >
            {{ loading ? 'Saving...' : 'Save' }}
          </button>
          <div v-if="error" class="text-xs text-red-600">{{ error }}</div>
          <div v-if="saved" class="text-xs text-emerald-600">Saved</div>
        </div>
      </form>
    </div>

    <div class="bg-white rounded-lg shadow p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-semibold">My DPIA Records</h2>
        <div class="flex gap-2">
          <button
            @click="reload"
            class="px-3 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300"
          >
            Refresh
          </button>
        </div>
      </div>
      <div v-if="listLoading && !records.length" class="text-sm text-slate-500">Loading...</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-left border-b text-slate-600">
            <th class="py-2 pr-3">Project</th>
            <th class="py-2 pr-3">Risks</th>
            <th class="py-2 pr-3">Mitigations</th>
            <th class="py-2">Created</th>
            <th class="py-2">Updated</th>
            <th class="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in records" :key="r.id" class="border-b last:border-0 align-top">
            <td class="py-1.5 pr-3 font-medium">
              <div v-if="editingId === r.id" class="space-y-1">
                <input v-model="editProjectName" class="input !py-1 !px-2" />
              </div>
              <div v-else>{{ r.projectName }}</div>
            </td>
            <td class="py-1.5 pr-3 max-w-xs">
              <div v-if="editingId === r.id">
                <textarea v-model="editRisks" rows="2" class="input resize-none !py-1 !px-2" />
              </div>
              <div v-else class="truncate" :title="(r.risks || []).join('; ')">
                {{ (r.risks || []).join('; ') }}
              </div>
            </td>
            <td class="py-1.5 pr-3 max-w-xs">
              <div v-if="editingId === r.id">
                <textarea
                  v-model="editMitigations"
                  rows="2"
                  class="input resize-none !py-1 !px-2"
                />
              </div>
              <div v-else class="truncate" :title="(r.mitigations || []).join('; ')">
                {{ (r.mitigations || []).join('; ') }}
              </div>
            </td>
            <td class="py-1.5 text-xs text-slate-500 whitespace-nowrap">
              {{ formatTs(r.createdAt) }}
            </td>
            <td class="py-1.5 text-xs text-slate-500 whitespace-nowrap">
              <span v-if="r.updatedAt">{{ formatTs(r.updatedAt) }}</span>
              <span v-else class="text-slate-400">—</span>
            </td>
            <td class="py-1.5 text-xs whitespace-nowrap">
              <div v-if="editingId === r.id" class="flex gap-1">
                <button @click="saveEdit" class="px-2 py-1 bg-emerald-600 text-white rounded">
                  Save
                </button>
                <button @click="cancelEdit" class="px-2 py-1 bg-slate-400 text-white rounded">
                  Cancel
                </button>
              </div>
              <div v-else class="flex gap-1">
                <button @click="beginEdit(r)" class="px-2 py-1 bg-indigo-600 text-white rounded">
                  Edit
                </button>
                <button @click="deleteRec(r.id)" class="px-2 py-1 bg-rose-600 text-white rounded">
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="hasMore && !listLoading" class="pt-3">
        <button
          @click="loadRecords(false)"
          class="px-3 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300"
        >
          Load More
        </button>
      </div>
      <div v-if="listLoading && records.length" class="pt-2 text-xs text-slate-500">Loading…</div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import { getAuthInstance } from '@/firebase/config'
import { apiPost, apiPostAuth } from '@/services/apiClient'

const projectName = ref('')
const risksRaw = ref('')
const mitigationsRaw = ref('')
const loading = ref(false)
const error = ref('')
const saved = ref(false)
const listLoading = ref(false)
const records = ref([])
const nextCursor = ref(null)
const hasMore = ref(false)
const editingId = ref(null)
const editProjectName = ref('')
const editRisks = ref('')
const editMitigations = ref('')

function authHeader() {
  return auth.currentUser?.getIdToken().then((t) => ({ Authorization: `Bearer ${t}` }))
}
function formatTs(v) {
  try {
    return new Date(v?._seconds ? v._seconds * 1000 : v).toLocaleString('th-TH')
  } catch {
    return ''
  }
}

async function loadRecords(reset = true) {
  if (reset) {
    records.value = []
    nextCursor.value = null
  }
  listLoading.value = true
  try {
    const headers = await authHeader()
    const body = nextCursor.value ? { startAfter: nextCursor.value } : {}
    const auth = await getAuthInstance()
    if (!auth.currentUser) throw new Error('ต้องล็อกอิน')
    const js = await apiPostAuth('/api/dpia-list', headers, body)
    if (Array.isArray(js.records)) {
      records.value = records.value.concat(js.records.filter((r) => !r.deleted))
      nextCursor.value = js.nextCursor || null
      hasMore.value = !!js.hasMore
    }
  } catch (e) {
    console.warn('loadRecords failed', e)
  } finally {
    listLoading.value = false
  }
}

function reload() {
  loadRecords(true)
}

function beginEdit(rec) {
  editingId.value = rec.id
  editProjectName.value = rec.projectName
  editRisks.value = (rec.risks || []).join('\n')
  editMitigations.value = (rec.mitigations || []).join('\n')
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit() {
  if (!editingId.value) return
  const headers = await authHeader()
  headers['Content-Type'] = 'application/json'
  const risks = editRisks.value
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const mitigations = editMitigations.value
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  try {
    await apiPost('/api/dpia-update', headers, {
      id: editingId.value,
      projectName: editProjectName.value,
      risks,
      mitigations,
    })
  } catch (e) {
    error.value = e.message || 'Update failed'
    return
  }
  const idx = records.value.findIndex((x) => x.id === editingId.value)
  if (idx >= 0) {
    records.value[idx] = {
      ...records.value[idx],
      projectName: editProjectName.value,
      risks,
      mitigations,
      updatedAt: Date.now(),
    }
  }
  editingId.value = null
}

async function deleteRec(id) {
  if (!confirm('Delete this record?')) return
  const headers = await authHeader()
  headers['Content-Type'] = 'application/json'
  try {
    await apiPost('/api/dpia-delete', headers, { id })
  } catch (e) {
    error.value = e.message || 'Delete failed'
    return
  }
  records.value = records.value.filter((r) => r.id !== id)
}

async function create() {
  error.value = ''
  saved.value = false
  if (!projectName.value) return
  loading.value = true
  try {
    const headers = await authHeader()
    headers['Content-Type'] = 'application/json'
    const risks = risksRaw.value
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const mitigations = mitigationsRaw.value
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const js = await apiPost('/api/dpia', headers, {
      projectName: projectName.value,
      risks,
      mitigations,
    })
    if (!js || !js.id) throw new Error('Save failed')
    saved.value = true
    projectName.value = ''
    risksRaw.value = ''
    mitigationsRaw.value = ''
    loadRecords(true)
  } catch (e) {
    error.value = String(e.message || e)
  } finally {
    loading.value = false
  }
}

onMounted(() => loadRecords(true))
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
</style>
