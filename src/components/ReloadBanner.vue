<template>
  <div
    v-if="show"
    class="fixed bottom-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-5 py-3 rounded shadow flex items-center gap-3 z-50"
  >
    <span>มีเวอร์ชันใหม่ พร้อมใช้งาน</span>
    <button @click="reloadNow" class="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm">
      Reload
    </button>
    <button @click="dismiss" class="text-xs opacity-70 hover:opacity-100">x</button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useVersionWatcher } from '@/composables/useVersionWatcher'
const STORAGE_KEY = 'app.reload.dismissed'
const { needsReload, reloadNow } = useVersionWatcher(60000)
const dismissed = ref(false)
try {
  dismissed.value = localStorage.getItem(STORAGE_KEY) === '1'
} catch {}
const show = computed(() => needsReload.value && !dismissed.value)
function dismiss() {
  dismissed.value = true
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {}
}
</script>
