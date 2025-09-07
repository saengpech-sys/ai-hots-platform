// Simple client-side exporters (CSV / JSON / PDF)
// PDF now uses jsPDF + autotable (smaller than pdfmake). Loaded lazily.
let _pdfLibPromise = null
async function getJsPdf() {
  if (_pdfLibPromise) return _pdfLibPromise
  _pdfLibPromise = Promise.all([
    import('jspdf').then((m) => m.jsPDF || m.default),
    import('jspdf-autotable'),
  ])
  return _pdfLibPromise
}

export function exportReportToCSV(report) {
  if (!report) return
  const rows = []
  rows.push(['Course ID', report.courseId])
  rows.push(['Generated At', new Date(report.generatedAt).toISOString()])
  rows.push(['Days Window', report.days])
  rows.push([])
  rows.push(['Metric', 'Value'])
  rows.push(['Total Students', report.totalStudents])
  rows.push(['Total Submissions', report.totalSubmissions])
  rows.push(['Average Score', fmt(report.avgScore)])
  rows.push(['Median Score', fmt(report.medianScore)])
  rows.push(['Std Dev', fmt(report.stdDev)])
  rows.push(['Min Score', fmt(report.minScore)])
  rows.push(['Max Score', fmt(report.maxScore)])
  rows.push(['Progress Rate (%)', fmt(report.progressRate)])
  rows.push(['Participation Rate (%)', fmt(report.participationRate)])
  rows.push(['Activity Gap (avg days)', fmt(report.activityGap)])
  rows.push(['P10', fmt(report.p10)])
  rows.push(['P90', fmt(report.p90)])
  rows.push([])
  rows.push(['Students'])
  rows.push(['Student Code', 'Avg Score', 'Submissions', 'Last Active'])
  for (const s of report.students || []) {
    rows.push([
      s.studentCode,
      fmt(s.avgScore),
      s.submissions,
      s.lastActiveAt ? new Date(s.lastActiveAt).toISOString() : '',
    ])
  }
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n')
  triggerDownload(csv, `research-report-${report.courseId}.csv`, 'text/csv')
}

export function exportReportToJSON(report) {
  if (!report) return
  const json = JSON.stringify(report, null, 2)
  triggerDownload(json, `research-report-${report.courseId}.json`, 'application/json')
}

export async function exportReportToPDF(report) {
  if (!report) return
  const [jsPDF] = await getJsPdf()
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const line = (t, y, size = 12, bold = false) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(t, 40, y)
  }
  let y = 40
  line('Research Report', y, 18, true)
  y += 22
  line(`Course: ${report.courseId}`, y)
  y += 16
  line(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, y)
  y += 24
  line('Summary Metrics', y, 14, true)
  y += 8
  const metrics = [
    ['Total Students', report.totalStudents],
    ['Total Submissions', report.totalSubmissions],
    ['Average Score', fmt(report.avgScore)],
    ['Median Score', fmt(report.medianScore)],
    ['Std Dev', fmt(report.stdDev)],
    ['Min Score', fmt(report.minScore)],
    ['Max Score', fmt(report.maxScore)],
    ['Progress Rate (%)', fmt(report.progressRate)],
    ['Participation Rate (%)', fmt(report.participationRate)],
    ['Activity Gap (days)', fmt(report.activityGap)],
    ['P10', fmt(report.p10)],
    ['P90', fmt(report.p90)],
  ]
  // Using simple text columns first; autotable for students
  metrics.forEach((m) => {
    y += 14
    doc.text(m[0], 40, y)
    doc.text(String(m[1] ?? ''), 300, y)
  })
  y += 28
  line('Students (Anonymized)', y, 14, true)
  const tableRows = (report.students || []).map((s) => [
    s.studentCode,
    fmt(s.avgScore),
    s.submissions,
    s.lastActiveAt ? new Date(s.lastActiveAt).toISOString().slice(0, 10) : '',
  ])
  if (tableRows.length) {
    // eslint-disable-next-line no-undef
    doc.autoTable({
      head: [['Student Code', 'Avg', 'Subs', 'Last Active']],
      body: tableRows,
      startY: y + 12,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: 40, right: 40 },
    })
    y = doc.lastAutoTable.finalY
  } else {
    y += 16
    doc.text('(No students)', 40, y)
  }
  y += 20
  doc.setFontSize(8)
  doc.text('Note: Names may be anonymized for privacy.', 40, y)
  doc.save(`research-report-${report.courseId}.pdf`)
}

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  if (typeof n === 'number') return Number.isInteger(n) ? n : n.toFixed(2)
  return n
}

function triggerDownload(content, filename, type) {
  const blob = new Blob([content], { type: type || 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(a.href)
    a.remove()
  }, 1500)
}
