<template>
  <div class="border rounded p-4 bg-white h-full flex flex-col">
    <h3 class="font-semibold mb-2 text-sm">การกระจายคะแนน</h3>
    <div v-if="!data?.length" class="text-xs text-gray-500">ไม่มีข้อมูล</div>
    <div ref="el" class="flex-1 min-h-[180px]"></div>
  </div>
</template>
<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TooltipComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
echarts.use([BarChart, TooltipComponent, GridComponent, CanvasRenderer])
const props = defineProps({ data: { type: Array, default: () => [] } })
const el = ref(null)
let chart
function buildBins(values, bins = 12) {
  const arr = Array.from({ length: bins }).map(() => 0)
  for (const v of values) {
    if (typeof v !== 'number') continue
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v / 100) * bins)))
    arr[idx]++
  }
  return arr
}
function render() {
  if (!el.value) return
  if (!chart) chart = echarts.init(el.value)
  const bins = 12
  const counts = buildBins(props.data, bins)
  const labels = Array.from({ length: bins }).map((_, i) => {
    const step = 100 / bins
    const s = Math.round(i * step)
    const e = Math.round((i + 1) * step)
    return `${s}-${e}`
  })
  chart.setOption({
    tooltip: {},
    grid: { left: 40, right: 10, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10, rotate: 40 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
    series: [
      {
        type: 'bar',
        data: counts,
        itemStyle: { color: '#2563eb' },
        barMaxWidth: 20,
      },
    ],
  })
  chart.resize()
}
watch(
  () => props.data,
  () => render(),
  { deep: true },
)
onMounted(() => {
  render()
  window.addEventListener('resize', resize)
})
function resize() {
  chart && chart.resize()
}
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart && chart.dispose()
})
</script>
