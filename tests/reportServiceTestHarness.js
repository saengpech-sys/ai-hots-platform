// Harness exposing selected internal helpers for testing (mirrors logic in reportService)

function basicStats(numbers) {
  const arr = numbers.filter((n) => typeof n === 'number' && !isNaN(n))
  if (!arr.length) return { avg: null, median: null, stdDev: null, min: null, max: null }
  const sum = arr.reduce((a, b) => a + b, 0)
  const avg = sum / arr.length
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  const variance = arr.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / arr.length
  const stdDev = Math.sqrt(variance)
  return { avg, median, stdDev, min: sorted[0], max: sorted[sorted.length - 1] }
}

export const __test__ = { basicStats }
