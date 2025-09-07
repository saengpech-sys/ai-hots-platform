<template>
  <div class="border rounded p-4 bg-white h-full flex flex-col">
    <h3 class="font-semibold mb-2 text-sm">{{ title }}</h3>
    <div v-if="!data?.length" class="text-xs text-gray-500">{{ noData }}</div>
    <div ref="root" class="flex-1 min-h-[180px]"></div>
  </div>
</template>
<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
const props = defineProps({
  data: { type: Array, default: () => [] },
  title: String,
  noData: String,
})
const root = ref(null)
let chart
function build() {
  if (!root.value) return
  const dates = props.data.map((d) => d.date)
  const scores = props.data.map((d) => d.avgScore ?? null)
  const x = dates.map((d) => Date.parse(d) / 1000)
  const y = scores
  const opts = {
    width: root.value.clientWidth || 300,
    height: 180,
    series: [
      {},
      { label: 'Avg', stroke: '#2563eb', fill: 'rgba(37,99,235,0.10)', points: { show: false } },
    ],
    axes: [
      { values: (u, vals) => vals.map((v) => new Date(v * 1000).toLocaleDateString().slice(0, 6)) },
      { min: 0, max: 100 },
    ],
    scales: { x: { time: true }, y: { auto: true } },
  }
  chart = new uPlot(opts, [x, y], root.value)
}
function rebuild() {
  if (chart) {
    chart.destroy()
    chart = null
  }
  if (props.data?.length) build()
}
watch(
  () => props.data,
  () => rebuild(),
  { deep: true },
)
onMounted(() => {
  rebuild()
  window.addEventListener('resize', rebuild)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', rebuild)
  chart && chart.destroy()
})
</script>
