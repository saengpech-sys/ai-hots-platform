<template>
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4">
    <div
      v-for="k in items"
      :key="k.label"
      class="p-3 rounded border bg-white shadow-sm flex flex-col"
    >
      <span class="text-xs font-medium uppercase tracking-wide text-gray-500">{{ k.label }}</span>
      <span class="text-xl font-semibold">{{ format(k.value) }}</span>
      <span v-if="k.sublabel" class="text-[10px] text-gray-400 mt-1">{{ k.sublabel }}</span>
    </div>
  </div>
</template>
<script setup>
defineProps({ items: { type: Array, default: () => [] } })
function format(v) {
  if (v == null || v === '') return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? v : v.toFixed(2)
  return v
}
</script>
