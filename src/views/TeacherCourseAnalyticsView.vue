<template>
  <div class="bg-slate-50 min-h-screen p-6 md:p-8">
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-slate-800">สถิติโดยรวมรายวิชา</h1>
        <RouterLink :to="{ name: 'teacher-my-courses' }" class="text-indigo-600">← กลับ</RouterLink>
      </div>

      <div v-if="course" class="bg-white rounded-xl shadow p-5">
        <div class="flex items-start justify-between gap-4">
          <h2
            class="text-xl sm:text-2xl font-semibold text-slate-800 leading-snug min-w-0 flex-1 break-words"
          >
            {{ course.title }}
          </h2>
          <div class="text-slate-500 text-sm shrink-0 max-w-[40%] hidden sm:block text-right">
            <div class="truncate">หมวดหมู่: {{ course.subject_area || '-' }}</div>
            <div class="truncate">หัวข้อ: {{ course.main_topic || '-' }}</div>
          </div>
        </div>
      </div>

      <!-- ตัวกรองนักเรียน: ชั้น / ห้อง -->
      <div class="bg-white rounded-xl shadow p-5">
        <h2 class="text-lg font-semibold mb-3">ตัวกรองนักเรียน</h2>
        <div class="flex flex-col sm:flex-row gap-3">
          <div class="w-full sm:w-64">
            <label class="block text-sm text-slate-600 mb-1">ชั้น</label>
            <select class="w-full input-style" v-model="selectedGrade">
              <option :value="''">ทั้งหมด</option>
              <option v-for="g in availableGrades" :key="g" :value="g">{{ g }}</option>
            </select>
          </div>
          <div class="w-full sm:w-64">
            <label class="block text-sm text-slate-600 mb-1">ห้อง</label>
            <select class="w-full input-style" v-model="selectedRoom">
              <option :value="''">ทั้งหมด</option>
              <option v-for="r in availableRooms" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
          <label class="inline-flex items-center gap-2 mt-2 sm:mt-6">
            <input type="checkbox" v-model="selectedRiskOnly" />
            <span class="text-sm text-slate-700">แสดงเฉพาะ “เสี่ยงสูง”</span>
          </label>
          <button
            class="ml-auto sm:mt-6 text-sm text-indigo-600 hover:underline"
            type="button"
            @click="clearFilters"
          >
            ล้างตัวกรอง
          </button>
        </div>
      </div>

      <div class="grid md:grid-cols-4 gap-4">
        <div class="p-4 bg-white rounded-xl shadow">
          <div class="text-sm text-slate-500">นักเรียนที่ลงทะเบียน</div>
          <div class="text-2xl font-bold">{{ studentsFiltered.length }}</div>
        </div>
        <div class="p-4 bg-white rounded-xl shadow">
          <div class="text-sm text-slate-500">ภารกิจทั้งหมด (เสร็จ/ทั้งหมด)</div>
          <div class="text-2xl font-bold">
            {{ totalMissionsCompleted }} / {{ totalMissionsTotal }}
          </div>
        </div>
        <div class="p-4 bg-white rounded-xl shadow">
          <div class="text-sm text-slate-500">เลเวลเฉลี่ย</div>
          <div class="text-2xl font-bold">{{ avgLevel.toFixed(1) }}</div>
        </div>
        <div class="p-4 bg-white rounded-xl shadow">
          <div class="text-sm text-slate-500">คะแนนเฉลี่ยห้องเรียน</div>
          <div class="text-2xl font-bold">{{ classAvgScoreDisplay }}</div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow p-5">
        <h2 class="text-lg font-semibold mb-3">ภาพรวมทักษะของห้องเรียน</h2>
        <div class="grid md:grid-cols-3 gap-3">
          <div v-for="k in skillKeys" :key="k" class="p-3 rounded border">
            <div class="text-sm text-slate-600 mb-1">{{ k }}</div>
            <div class="h-2 bg-slate-200 rounded">
              <div
                class="h-2 bg-emerald-500 rounded"
                :style="{ width: (classSkillAvg[k] || 0) + '%' }"
              ></div>
            </div>
            <div class="text-right text-xs text-slate-500 mt-1">
              {{ Math.round(classSkillAvg[k] || 0) }}%
            </div>
          </div>
        </div>
        <div class="mt-3 text-xs text-slate-500">
          อธิบาย: คะแนนทักษะเริ่มจาก
          <b>5</b> ต่อคนเป็นค่าเริ่มต้นและปรับขึ้น/ลงตามผลภารกิจของแต่ละคน
          ระบบแปลงเป็นค่าเฉลี่ยรวมของห้องและแสดงเป็นเปอร์เซ็นต์เพื่อให้เห็นภาพรวมทักษะเด่น/ด้อยของชั้นเรียน
        </div>
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl shadow p-5">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold">เป้าหมายรายสัปดาห์</h2>
            <div class="text-slate-500 text-sm">รวมสัปดาห์นี้: {{ thisWeekTotal }}</div>
          </div>
          <div class="flex items-center gap-3">
            <label class="text-slate-600">ต่อคน/สัปดาห์</label>
            <input type="number" min="0" class="w-24 input-style" v-model.number="weeklyTarget" />
            <button
              class="px-3 py-1.5 bg-indigo-600 text-white rounded-md"
              :disabled="savingGoal"
              @click="saveWeeklyTarget"
            >
              บันทึก
            </button>
          </div>
          <div class="mt-4">
            <div class="text-slate-700 font-medium mb-2">ยังต่ำกว่าเป้าหมาย</div>
            <div v-if="studentsBelowGoal.length" class="space-y-1">
              <div v-for="s in studentsBelowGoal" :key="s.id" class="text-sm text-slate-700">
                • {{ s.name || s.id }} ({{ metrics[s.id]?.weeklyCount || 0 }}/{{ weeklyTarget }})
              </div>
            </div>
            <div v-else class="text-slate-500 text-sm">ทุกคนถึงเป้าหมายแล้ว</div>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow p-5">
          <h2 class="text-lg font-semibold mb-3">แนวโน้มคะแนน 7 วัน</h2>
          <div class="flex items-end gap-2 h-24">
            <div v-for="p in trend7.points" :key="p.key" class="flex flex-col items-center">
              <div
                class="w-6 bg-emerald-500 rounded"
                :style="{ height: barHeight(p.value, trend7.max) }"
              ></div>
              <div class="text-[10px] text-slate-500 mt-1">{{ p.key.slice(5) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Off-tab & Confidence (cohort) -->
      <div class="bg-white rounded-xl shadow p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold">สัญญาณออกนอกแท็บและความเชื่อมั่น (ตามตัวกรอง)</h2>
          <button
            class="px-3 py-1.5 bg-slate-800 text-white rounded-md hover:bg-slate-900"
            type="button"
            @click="exportSignalsCSV"
          >
            ส่งออก CSV (สัญญาณ)
          </button>
        </div>
        <div class="grid md:grid-cols-4 gap-3 mb-4">
          <div class="p-3 rounded border">
            <div class="text-sm text-slate-500">อัตรา Out-of-tab ถูกธง</div>
            <div class="text-2xl font-bold">{{ cohortOfftab.ratePct }}%</div>
            <div class="text-xs text-slate-500">
              {{ cohortOfftab.flagged }} / {{ cohortOfftab.total }} รายการ
            </div>
          </div>
          <div class="p-3 rounded border">
            <div class="text-sm text-slate-500">เฉลี่ยออกแท็บ (ครั้ง/งาน)</div>
            <div class="text-2xl font-bold">{{ cohortOfftab.avgCount }}</div>
          </div>
          <div class="p-3 rounded border">
            <div class="text-sm text-slate-500">เฉลี่ยออกแท็บ (วินาที/งาน)</div>
            <div class="text-2xl font-bold">{{ cohortOfftab.avgSec }}</div>
          </div>
          <div class="p-3 rounded border">
            <div class="text-sm text-slate-500">ความเชื่อมั่นเฉลี่ย</div>
            <div class="text-2xl font-bold">{{ cohortConfidence.avgPct }}%</div>
            <div class="text-xs text-slate-500">ต่ำ (<60%): {{ cohortConfidence.lowPct }}%</div>
          </div>
        </div>

        <!-- Optional: mini distributions -->
        <div class="grid md:grid-cols-2 gap-4">
          <div class="p-3 rounded border">
            <div class="text-sm text-slate-600 mb-2">กระจายค่า ความเชื่อมั่น (0–1)</div>
            <div class="flex items-end gap-1 h-20">
              <div
                v-for="(h, i) in confHist.points"
                :key="'ch-' + i"
                class="w-6 bg-slate-300 rounded"
                :style="{
                  height: barHeight(h, confHist.max),
                  backgroundColor: i <= 2 ? '#ef4444' : '#60a5fa',
                }"
                :title="confHist.labels[i] + ': ' + h"
              ></div>
            </div>
            <div class="text-[10px] text-slate-500 mt-1 flex justify-between">
              <span v-for="(lab, i) in confHist.labels" :key="'chl-' + i">{{ lab }}</span>
            </div>
            <div class="mt-2 flex items-center gap-3 text-[11px] text-slate-600">
              <span class="inline-flex items-center gap-1">
                <span class="inline-block w-3 h-3 rounded" style="background: #ef4444"></span>
                ต่ำ < 60%
              </span>
              <span class="inline-flex items-center gap-1">
                <span class="inline-block w-3 h-3 rounded" style="background: #60a5fa"></span>
                ≥ 60%
              </span>
            </div>
          </div>
          <div class="p-3 rounded border">
            <div class="text-sm text-slate-600 mb-2">กระจายค่า ออกแท็บวินาที/งาน</div>
            <div class="flex items-end gap-1 h-20">
              <div
                v-for="(h, i) in blurSecHist.points"
                :key="'bh-' + i"
                class="w-6 bg-slate-300 rounded"
                :style="{
                  height: barHeight(h, blurSecHist.max),
                  backgroundColor: '#f59e0b',
                  outline: i >= 3 ? '2px solid #b45309' : 'none',
                }"
                :title="blurSecHist.labels[i] + ': ' + h"
              ></div>
            </div>
            <div class="text-[10px] text-slate-500 mt-1 flex justify-between">
              <span v-for="(lab, i) in blurSecHist.labels" :key="'bhl-' + i">{{ lab }}</span>
            </div>
            <div class="mt-2 flex items-center gap-3 text-[11px] text-slate-600">
              <span class="inline-flex items-center gap-1">
                <span
                  class="inline-block w-3 h-3 rounded"
                  style="background: #f59e0b; border: 2px solid #b45309"
                ></span>
                ระยะยาว ≥ 60s
              </span>
            </div>
          </div>
        </div>

        <div v-if="signalsRows.length" class="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
          <table class="min-w-full text-sm">
            <thead class="text-slate-500">
              <tr>
                <th class="text-left py-2 pr-3">รหัส</th>
                <th class="text-left py-2 pr-3">ชื่อ</th>
                <th class="text-left py-2 pr-3">ส่ง</th>
                <th class="text-left py-2 pr-3">ธงออกแท็บ%</th>
                <th class="text-left py-2 pr-3">ออกแท็บ/งาน</th>
                <th class="text-left py-2 pr-3">ออกแท็บวินาที/งาน</th>
                <th class="text-left py-2 pr-3">ความเชื่อมั่นเฉลี่ย</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in signalsRows" :key="row.uid" class="border-t">
                <td class="py-2 pr-3">{{ formatStudentId(row) }}</td>
                <td class="py-2 pr-3">{{ row.name }}</td>
                <td class="py-2 pr-3">{{ row.count }}</td>
                <td class="py-2 pr-3">
                  {{ row.offtabRatePct }}%
                  <RouterLink
                    :to="{
                      name: 'teacher-course-submissions',
                      params: { courseId },
                      query: { studentId: row.uid, offtab: 'flagged' },
                    }"
                    class="ml-2 text-xs text-indigo-600 hover:underline"
                    >ดูรายการที่ถูกธง</RouterLink
                  >
                </td>
                <td class="py-2 pr-3">{{ row.avgBlurCount }}</td>
                <td class="py-2 pr-3">{{ row.avgBlurSec }}</td>
                <td class="py-2 pr-3">
                  {{ row.confidenceAvgPct }}%
                  <RouterLink
                    :to="{
                      name: 'teacher-course-submissions',
                      params: { courseId },
                      query: { studentId: row.uid, confMax: 0.6 },
                    }"
                    class="ml-2 text-xs text-rose-600 hover:underline"
                    >ต่ำ < 60%</RouterLink
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="text-slate-500 text-sm">ยังไม่มีข้อมูลสัญญาณในกลุ่มที่เลือก</div>
      </div>

      <div class="bg-white rounded-xl shadow p-5">
        <h2 class="text-lg font-semibold mb-3">ผู้พัฒนาดีที่สุดล่าสุด</h2>
        <div v-if="topImprovers.length" class="space-y-1">
          <div v-for="t in topImprovers" :key="t.id" class="flex justify-between text-sm">
            <div class="text-slate-700">{{ t.name }}</div>
            <div class="text-emerald-600">+{{ t.delta }} คะแนน (ล่าสุด {{ t.recent }})</div>
          </div>
        </div>
        <div v-else class="text-slate-500 text-sm">ยังไม่มีข้อมูลเพียงพอ</div>
      </div>

      <div class="bg-white rounded-xl shadow p-5">
        <h2 class="text-lg font-semibold mb-3">Heatmap ทักษะแต่ละคน</h2>
        <div class="flex items-center gap-3 text-xs text-slate-500 mb-3">
          <span>ต่ำ</span>
          <div
            class="h-2 w-40 rounded"
            style="
              background: linear-gradient(
                90deg,
                hsl(0 85% 42%) 0%,
                hsl(60 85% 42%) 50%,
                hsl(120 85% 42%) 100%
              );
            "
          ></div>
          <span>สูง</span>
        </div>
        <div class="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
          <table class="min-w-full text-xs">
            <thead>
              <tr>
                <th class="text-left py-2 pr-3">นักเรียน</th>
                <th v-for="k in skillKeys" :key="k" class="text-left py-2 pr-3">{{ k }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in studentsFiltered" :key="s.id" class="border-t">
                <td class="py-2 pr-3 text-slate-700">{{ s.name || s.id }}</td>
                <td v-for="k in skillKeys" :key="k" class="py-2 pr-3">
                  <div
                    class="inline-flex items-center justify-center rounded-md shadow-sm border border-black/10"
                    :class="['w-20 h-8']"
                    :style="{
                      background: heatBg(scoreByStudentSkill[s.id]?.[k] || 0),
                      color: heatText(scoreByStudentSkill[s.id]?.[k] || 0),
                    }"
                    :title="(displayCell(scoreByStudentSkill[s.id]?.[k]) || 0) + '%'"
                  >
                    <span class="text-[12px] font-semibold tracking-wide">
                      {{ displayCell(scoreByStudentSkill[s.id]?.[k]) }}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow p-5">
        <h2 class="text-lg font-semibold mb-3">การเตือนอัจฉริยะ</h2>
        <ul class="list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li v-for="a in smartAlerts" :key="a.id">{{ a.text }}</li>
          <li v-if="!smartAlerts.length" class="text-slate-500">ยังไม่มีการเตือน</li>
        </ul>
      </div>

      <div class="bg-white rounded-xl shadow p-5">
        <h2 class="text-lg font-semibold mb-3">Common Errors Summary</h2>
        <div v-if="commonErrors.total > 0" class="grid md:grid-cols-3 gap-3">
          <div v-for="row in commonErrors.rows" :key="row.tag" class="p-3 rounded border">
            <div class="flex items-center justify-between">
              <div class="text-sm text-slate-700 font-medium">{{ displayTag(row.tag) }}</div>
              <RouterLink
                :to="{
                  name: 'teacher-course-submissions',
                  params: { courseId },
                  query: { tag: row.tag },
                }"
                class="text-indigo-600 text-xs hover:underline"
                >ดูรายการ</RouterLink
              >
            </div>
            <div class="text-slate-500 text-sm mt-1">{{ row.count }} ครั้ง • {{ row.pct }}%</div>
          </div>
        </div>
        <div v-else class="text-slate-500 text-sm">ยังไม่มีแท็กข้อผิดพลาด</div>
      </div>

      <section class="mt-6">
        <div class="card">
          <h3 class="text-xl font-semibold mb-4">ตารางความคืบหน้า</h3>
          <div v-if="sortedRows.length" class="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
            <table class="min-w-full text-sm">
              <thead class="text-slate-500">
                <tr>
                  <th class="text-left py-2 pr-3">รหัส</th>
                  <th class="text-left py-2 pr-3">ชื่อ</th>
                  <th class="text-left py-2 pr-3">Level</th>
                  <th class="text-left py-2 pr-3">เสร็จ/ทั้งหมด</th>
                  <th class="text-left py-2 pr-3">คะแนนเฉลี่ย</th>
                  <th class="text-left py-2 pr-3">ล่าสุด</th>
                  <th class="text-right py-2 pl-3">Portfolio</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in sortedRows"
                  :key="row.uid"
                  class="border-t hover:bg-slate-50 cursor-pointer"
                  @click="openStudent(row.uid)"
                >
                  <td class="py-3 pr-3 font-medium text-slate-700">{{ formatStudentId(row) }}</td>
                  <td class="py-3 pr-3">{{ row.name || '—' }}</td>
                  <td class="py-3 pr-3">{{ row.level ?? '—' }}</td>
                  <td class="py-3 pr-3">{{ row.completed ?? 0 }} / {{ row.total ?? 0 }}</td>
                  <td class="py-3 pr-3">
                    <span v-if="row.avgScore != null">{{ row.avgScore }} / 100</span>
                    <span v-else>—</span>
                  </td>
                  <td class="py-3 pr-3">{{ row.lastActive || '—' }}</td>
                  <td class="py-3 pl-3 text-right">
                    <RouterLink
                      :to="row.portfolioUrl"
                      class="text-indigo-600 hover:underline"
                      @click.stop
                    >
                      ดู Portfolio
                    </RouterLink>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="p-6 text-center text-slate-600">
            <div class="text-lg font-medium mb-1">ไม่พบข้อมูลตามตัวกรอง</div>
            <div class="text-sm mb-3">
              อาจเป็นเพราะเลือกชั้น/ห้อง หรือ “เสี่ยงสูง” ที่ไม่มีข้อมูล
            </div>
            <button
              class="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm"
              type="button"
              @click="clearFilters"
            >
              แสดงทั้งหมด
            </button>
          </div>
        </div>
      </section>

      <!-- Slide-over โปรไฟล์นักเรียน -->
      <div v-if="selectedStudentId" class="fixed inset-0 z-40">
        <div class="absolute inset-0 bg-black/30" @click="closeStudent"></div>
        <div
          class="absolute inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-xl p-5 overflow-y-auto"
        >
          <div class="flex items-start justify-between">
            <h3 class="text-xl font-semibold">โปรไฟล์นักเรียน</h3>
            <button class="text-slate-500 hover:text-slate-700" @click="closeStudent">✕</button>
          </div>
          <div v-if="selectedProfile" class="mt-4 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-lg font-medium text-slate-800">{{ selectedProfile.name }}</div>
                <div class="text-slate-500 text-sm">
                  รหัส: {{ selectedProfile.code }} • ชั้น: {{ selectedProfile.grade || '—' }} •
                  ห้อง:
                  {{ selectedProfile.room || '—' }}
                </div>
              </div>
              <RouterLink
                :to="{ name: 'student-portfolio-view', params: { studentId: selectedStudentId } }"
                class="text-indigo-600 text-sm hover:underline"
                @click.stop
                >ดู Portfolio</RouterLink
              >
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="p-3 rounded border">
                <div class="text-sm text-slate-500">XP</div>
                <div class="text-xl font-semibold">{{ selectedProfile.xp ?? 0 }}</div>
              </div>
              <div class="p-3 rounded border">
                <div class="text-sm text-slate-500">Level</div>
                <div class="text-xl font-semibold">{{ selectedProfile.level ?? '—' }}</div>
              </div>
              <div class="p-3 rounded border">
                <div class="text-sm text-slate-500">เสร็จ/ทั้งหมด</div>
                <div class="text-xl font-semibold">
                  {{ selectedProfile.completed }} / {{ selectedProfile.total }}
                </div>
              </div>
              <div class="p-3 rounded border">
                <div class="text-sm text-slate-500">คะแนนเฉลี่ย</div>
                <div class="text-xl font-semibold">
                  {{ displayScore(selectedProfile.avgScore) }}
                </div>
              </div>
            </div>

            <div class="p-3 rounded border">
              <div class="text-sm text-slate-500">แนวทางการเรียนรู้ / ความสนใจ</div>
              <div class="text-slate-700 text-sm">
                <div>สไตล์: {{ selectedProfile.learningStyle || '—' }}</div>
                <div>ความสนใจ: {{ selectedProfile.interests || '—' }}</div>
                <div>เป้าหมาย: {{ selectedProfile.futureGoal || '—' }}</div>
              </div>
            </div>

            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <div class="text-slate-700 font-medium mb-2">ภารกิจล่าสุด</div>
                <ul class="text-sm space-y-2">
                  <li
                    v-for="m in selectedRecentMissions"
                    :key="m.id"
                    class="flex items-center justify-between gap-3"
                  >
                    <button
                      class="text-left text-slate-700 hover:text-indigo-700 truncate w-2/3"
                      @click="openDetailMission(m)"
                    >
                      {{ missionTitle(m) }}
                    </button>
                    <span class="text-slate-500 shrink-0">{{ m.scoreSummary ?? '—' }}</span>
                  </li>
                  <li v-if="!selectedRecentMissions.length" class="text-slate-500">—</li>
                </ul>
              </div>
              <div>
                <div class="text-slate-700 font-medium mb-2">การส่งงานล่าสุด</div>
                <ul class="text-sm space-y-2">
                  <li
                    v-for="s in selectedRecentSubmissions"
                    :key="s.id"
                    class="flex items-center justify-between gap-3"
                  >
                    <button
                      class="text-left text-slate-700 hover:text-indigo-700 truncate w-2/3"
                      @click="openDetailSubmission(s)"
                    >
                      {{ submissionTitle(s) }}
                    </button>
                    <span class="text-slate-500 shrink-0">{{
                      s.meta_weighted_score ?? s.score ?? '—'
                    }}</span>
                  </li>
                  <li v-if="!selectedRecentSubmissions.length" class="text-slate-500">—</li>
                </ul>
              </div>
            </div>

            <!-- Inline detail panel -->
            <div v-if="selectedInlineDetail" class="mt-4 p-3 rounded border bg-slate-50">
              <div class="flex items-start justify-between">
                <div class="text-slate-800 font-medium">
                  {{ selectedInlineDetail.title }}
                </div>
                <button class="text-slate-500 hover:text-slate-700" @click="closeInlineDetail">
                  ✕
                </button>
              </div>
              <div v-if="selectedInlineDetail.subtitle" class="text-xs text-slate-500 mt-0.5">
                {{ selectedInlineDetail.subtitle }}
              </div>
              <div v-if="selectedInlineDetail.core" class="text-slate-700 mt-2 whitespace-pre-line">
                {{ selectedInlineDetail.core }}
              </div>
              <div
                v-if="selectedInlineDetail.answer"
                class="text-slate-700 mt-2 whitespace-pre-line"
              >
                <span class="text-xs text-slate-500">คำตอบ:</span>
                <div>{{ selectedInlineDetail.answer }}</div>
              </div>
              <div class="mt-2 flex flex-wrap gap-2 text-xs">
                <span
                  v-if="selectedInlineDetail.skill"
                  class="px-2 py-0.5 rounded bg-slate-200 text-slate-700"
                  >ทักษะ: {{ selectedInlineDetail.skill }}</span
                >
                <span
                  v-if="selectedInlineDetail.difficulty"
                  class="px-2 py-0.5 rounded bg-slate-200 text-slate-700"
                  >ระดับ: {{ selectedInlineDetail.difficulty }}</span
                >
                <span
                  v-if="selectedInlineDetail.riskFlag"
                  class="px-2 py-0.5 rounded bg-rose-100 text-rose-700"
                  >เสี่ยง AI</span
                >
                <span
                  v-if="selectedInlineDetail.simPct != null"
                  class="px-2 py-0.5 rounded bg-slate-200 text-slate-700"
                  >คล้าย: {{ selectedInlineDetail.simPct }}%</span
                >
              </div>
            </div>
          </div>
          <div v-else class="mt-4 text-slate-500">กำลังโหลดข้อมูล…</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  getCourseById,
  getStudentsByEnrolledCourse,
  getSubmissionsByStudent,
  listMissionsByCourse,
  getScenariosByIds,
  updateCourse,
} from '@/services/firestoreService'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase/config' // ปรับ path หากโปรเจ็กต์ใช้ path อื่น

const route = useRoute()
const router = useRouter()
const courseId = route.params.courseId
const course = ref(null)
const students = ref([])
const submissionsByStudent = reactive({})
const metrics = reactive({}) // { [uid]: { completed, active, avgScore, lastActive, weeklyCount } }
const missionsCompletedByStudent = reactive({}) // keep arrays to compute advanced stats
const missionsActiveByStudent = reactive({}) // used to infer skill for submissions
const missionById = reactive({})
const scenariosById = reactive({})
const selectedInlineDetail = ref(null)
const savingGoal = ref(false)
const weeklyTarget = ref(3)

// ตัวกรองชั้น/ห้อง
const selectedGrade = ref('')
const selectedRoom = ref('')
const selectedRiskOnly = ref(false)

const skillKeys = [
  'การวิเคราะห์ (Analyzing)',
  'การประเมินค่า (Evaluating)',
  'การสร้างสรรค์ (Creating)',
]
const labelWeight = { ดีเยี่ยม: 100, ดี: 75, พอใช้: 50, ต้องปรับปรุง: 25 }

// ---------- Off-tab & Confidence aggregations ----------
function pickConfidence(sb) {
  const c = sb?.meta_confidence
  if (typeof c === 'number') return c
  if (c && typeof c.score === 'number') return c.score
  return null
}

const cohortOfftab = computed(() => {
  let total = 0
  let flagged = 0
  let sumCount = 0
  let sumSec = 0
  for (const uid of filteredUids.value) {
    for (const sb of submissionsByStudent[uid] || []) {
      total += 1
      if (sb?.meta_offtab?.flag) flagged += 1
      if (typeof sb?.meta_blur_count === 'number') sumCount += sb.meta_blur_count
      if (typeof sb?.meta_blur_ms === 'number') sumSec += Math.round(sb.meta_blur_ms / 1000)
    }
  }
  const ratePct = Math.round((flagged / Math.max(total || 0, 1)) * 100)
  const avgCount = total ? Math.round((sumCount / total) * 10) / 10 : 0
  const avgSec = total ? Math.round(sumSec / total) : 0
  return { total, flagged, ratePct, avgCount, avgSec }
})

const cohortConfidence = computed(() => {
  let total = 0
  let sum = 0
  let low = 0
  for (const uid of filteredUids.value) {
    for (const sb of submissionsByStudent[uid] || []) {
      const c = pickConfidence(sb)
      if (c == null) continue
      total += 1
      sum += c
      if (c < 0.6) low += 1
    }
  }
  const avg = total ? sum / total : 0
  const avgPct = Math.round(avg * 100)
  const lowPct = Math.round((low / Math.max(total || 0, 1)) * 100)
  return { total, avg, avgPct, lowPct }
})

const signalsRows = computed(() => {
  const rows = []
  for (const s of studentsFiltered.value) {
    const list = submissionsByStudent[s.id] || []
    const count = list.length
    if (!count) {
      rows.push({
        uid: s.id,
        name: s.name || s.id,
        count: 0,
        offtabRatePct: 0,
        avgBlurCount: 0,
        avgBlurSec: 0,
        confidenceAvgPct: 0,
      })
      continue
    }
    let flagged = 0
    let sumCount = 0
    let sumSec = 0
    let confSum = 0
    let confN = 0
    for (const sb of list) {
      if (sb?.meta_offtab?.flag) flagged += 1
      if (typeof sb?.meta_blur_count === 'number') sumCount += sb.meta_blur_count
      if (typeof sb?.meta_blur_ms === 'number') sumSec += Math.round(sb.meta_blur_ms / 1000)
      const c = pickConfidence(sb)
      if (c != null) {
        confSum += c
        confN += 1
      }
    }
    const offtabRatePct = Math.round((flagged / Math.max(count, 1)) * 100)
    const avgBlurCount = Math.round((sumCount / count) * 10) / 10
    const avgBlurSec = Math.round(sumSec / count)
    const confidenceAvgPct = Math.round((confN ? confSum / confN : 0) * 100)
    rows.push({
      uid: s.id,
      name: s.name || s.id,
      count,
      offtabRatePct,
      avgBlurCount,
      avgBlurSec,
      confidenceAvgPct,
    })
  }
  // Sort by lowest confidence then highest offtab rate
  return rows.sort(
    (a, b) => a.confidenceAvgPct - b.confidenceAvgPct || b.offtabRatePct - a.offtabRatePct,
  )
})

function exportSignalsCSV() {
  const metaLine = [
    'note',
    'Cohort signals export recalculated for current filters (grade/room/risk). Confidence <60% considered low; offtab seconds bins: 0–10/10–30/30–60/60–180/>180. Generated at ' +
      new Date().toISOString(),
  ]
  const header = [
    'student_uid',
    'student_code',
    'student_name',
    'submissions_count',
    'offtab_flag_rate_pct',
    'avg_blur_count_per_submission',
    'avg_blur_seconds_per_submission',
    'avg_confidence_pct',
  ]
  const rows = signalsRows.value.map((r) => [
    r.uid,
    formatStudentId(r),
    r.name,
    r.count,
    r.offtabRatePct,
    r.avgBlurCount,
    r.avgBlurSec,
    r.confidenceAvgPct,
  ])
  const csv = [metaLine, header, ...rows]
    .map((r) => r.map((x) => `"${String(x ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'cohort-signals.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function getLevel(x) {
  let n = Math.floor((1 + Math.sqrt(1 + x / 25)) / 2)
  while (50 * n * (n - 1) > x) n--
  while (50 * (n + 1) * n <= x) n++
  return Math.max(1, n)
}

// Helper: รายชื่อนักเรียนหลังกรอง
const studentsFiltered = computed(() => {
  const grade = (selectedGrade.value || '').trim()
  const room = (selectedRoom.value || '').trim()
  const out = []
  for (const s of students.value || []) {
    const prof = studentProfiles.value[s.id] || {}
    const g = normalizeGrade(
      prof.grade || prof.gradeLevel || prof.grade_level || s.grade || s.grade_level,
    )
    const r = normalizeRoom(
      prof.room || prof.classroom || prof.room_no || prof.homeroom || s.room || s.classroom,
    )
    if (grade && g !== grade) continue
    if (room && r !== room) continue
    // risk-only filter
    if (selectedRiskOnly.value && !atRiskUids.value.has(s.id)) continue
    out.push(s)
  }
  return out
})

const filteredUids = computed(() => (studentsFiltered.value || []).map((s) => s.id))

const totalMissionsCompleted = computed(() => {
  return filteredUids.value.reduce((sum, uid) => sum + (metrics[uid]?.completed || 0), 0)
})
const totalMissionsActive = computed(() => {
  return filteredUids.value.reduce((sum, uid) => sum + (metrics[uid]?.active || 0), 0)
})
const totalMissionsTotal = computed(() => totalMissionsCompleted.value + totalMissionsActive.value)
const avgLevel = computed(() => {
  if (!studentsFiltered.value.length) return 0
  const sum = studentsFiltered.value.reduce((acc, s) => acc + getLevel(s.xp || 0), 0)
  return sum / studentsFiltered.value.length
})

const classAvgScore = computed(() => {
  const arr = filteredUids.value
    .map((uid) => metrics[uid]?.avgScore)
    .filter((n) => typeof n === 'number')
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
})
const classAvgScoreDisplay = computed(() =>
  classAvgScore.value == null ? '—' : `${Math.round(classAvgScore.value)} / 100`,
)

const classSkillAvg = computed(() => {
  // Prefer completed missions (scoreSummary grouped by skill); fallback to submissions rubric
  const buckets = {}
  for (const k of skillKeys) buckets[k] = []
  let usedMissions = 0
  // Build missionId -> skill map from both completed and active (for inference only)
  const missionSkill = {}
  for (const uid of filteredUids.value) {
    for (const m of missionsCompletedByStudent[uid] || []) {
      if (m?.id && m?.skill_targeted) missionSkill[m.id] = m.skill_targeted
    }
  }
  for (const uid of filteredUids.value) {
    for (const m of missionsActiveByStudent[uid] || []) {
      if (m?.id && m?.skill_targeted) missionSkill[m.id] = m.skill_targeted
    }
  }
  for (const uid of filteredUids.value) {
    const list = missionsCompletedByStudent[uid] || []
    for (const m of list) {
      const skill = m.skill_targeted
      const score = typeof m.scoreSummary === 'number' ? m.scoreSummary : null
      if (skill && score != null && buckets[skill]) {
        buckets[skill].push(score)
        usedMissions++
      }
    }
  }
  // Fallback to submissions only if we had no mission scores at all
  if (usedMissions === 0) {
    for (const uid of filteredUids.value) {
      const subs = submissionsByStudent[uid] || []
      for (const sb of subs) {
        const skill = sb.skill_targeted || sb.scenarioSkill || missionSkill[sb.missionId_ref]
        const scores = sb.feedback?.rubric_scores
        if (!skill || !scores || !buckets[skill]) continue
        const labels = Object.values(scores)
        if (!labels.length) continue
        const avg = labels.reduce((acc, lab) => acc + (labelWeight[lab] || 0), 0) / labels.length
        buckets[skill].push(avg)
      }
    }
  }
  const res = {}
  for (const k of Object.keys(buckets)) {
    const arr = buckets[k]
    res[k] = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  }
  return res
})

onMounted(async () => {
  course.value = await getCourseById(courseId)
  weeklyTarget.value = Number(course.value?.weekly_target || 3)
  students.value = await getStudentsByEnrolledCourse(courseId)
  // Batch fetch all missions for this course once
  const allMissions = await listMissionsByCourse(courseId)
  // Precompute maps by student
  const grouped = {}
  for (const m of allMissions) {
    missionById[m.id] = m
    const uid = m.studentId_ref
    if (!uid) continue
    if (!grouped[uid]) grouped[uid] = { active: [], completed: [] }
    if (m.status === 'completed') grouped[uid].completed.push(m)
    else if (m.active === true) grouped[uid].active.push(m)
  }
  // Prefetch scenarios for titles (missions first; more will be added from subs below)
  const scIds = new Set(allMissions.map((m) => m.scenarioId_ref).filter(Boolean))
  if (scIds.length) {
    try {
      const scList = await getScenariosByIds(Array.from(scIds))
      for (const sc of scList) scenariosById[sc.id] = sc
    } catch {}
  }
  // Now fetch submissions per student (still needed for rubric/lastActive fallback), but only for students with any activity to limit reads
  const uidsNeedingSubs = new Set(students.value.map((s) => s.id))
  await Promise.all(
    Array.from(uidsNeedingSubs).map(async (uid) => {
      const subs = await getSubmissionsByStudent(uid, courseId)
      submissionsByStudent[uid] = subs
      const completed = grouped[uid]?.completed || []
      const actives = grouped[uid]?.active || []
      missionsCompletedByStudent[uid] = completed
      missionsActiveByStudent[uid] = actives
      const avgScore = computeAvgScoreFromMissions(completed) ?? computeAvgScoreFromSubs(subs)
      const lastFromSubs = subs[0]?.submittedAt
      const lastFromMissions = completed[0]?.updatedAt
      const weekStart = startOfWeek(new Date())
      // Weekly count & completion fallback: if no missions (legacy), use submissions
      let weeklyCount = completed.filter(
        (m) => (m.updatedAt?.toMillis?.() ?? 0) >= weekStart.getTime(),
      ).length
      let completedCount = completed.length
      let activeCount = actives.length
      if (!completedCount && subs.length) {
        completedCount = subs.length
        activeCount = 0
        weeklyCount = subs.filter(
          (s) => (s.submittedAt?.toMillis?.() ?? 0) >= weekStart.getTime(),
        ).length
      }
      metrics[uid] = {
        completed: completedCount,
        active: activeCount,
        avgScore,
        lastActive: pickLatest(lastFromSubs, lastFromMissions),
        weeklyCount,
      }
      // Extend scenario prefetch set with ones from submissions
      for (const s of subs) if (s.scenarioId_ref) scIds.add(s.scenarioId_ref)
    }),
  )
  // Prefetch any missing scenarios referenced by submissions
  try {
    const need = Array.from(scIds).filter((id) => !scenariosById[id])
    if (need.length) {
      const extra = await getScenariosByIds(need)
      for (const sc of extra) scenariosById[sc.id] = sc
    }
  } catch {}
})

function pickLatest(a, b) {
  try {
    const ma = a?.toMillis?.() ?? 0
    const mb = b?.toMillis?.() ?? 0
    return ma >= mb ? a : b
  } catch {
    return a || b || null
  }
}

function computeAvgScoreFromMissions(list) {
  const arr = (list || []).map((m) => m?.scoreSummary).filter((n) => typeof n === 'number')
  if (!arr.length) return null
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

function computeAvgScoreFromSubs(list) {
  const scores = []
  for (const sb of list || []) {
    const rub = sb?.feedback?.rubric_scores
    if (!rub) continue
    const vals = Object.values(rub)
    if (!vals.length) continue
    const weight = { ดีเยี่ยม: 4, ดี: 3, พอใช้: 2, ต้องปรับปรุง: 1 }
    const sum = vals.reduce((a, l) => a + (weight[l] || 0), 0)
    scores.push(Math.round((sum / (vals.length * 4)) * 100))
  }
  if (!scores.length) return null
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

function displayScore(score) {
  return score == null ? '—' : `${score} / 100`
}

function displayCell(score) {
  return score == null ? '' : Math.round(score)
}

function formatDate(ts) {
  try {
    const ms = ts?.toMillis?.() ?? null
    return ms ? new Date(ms).toLocaleString() : '—'
  } catch {
    return '—'
  }
}

// ---------- Weekly Goals & Insights ----------
function startOfWeek(d) {
  const dt = new Date(d)
  const day = dt.getDay() || 7 // Monday as 1, Sunday as 7
  if (day !== 1) dt.setDate(dt.getDate() - (day - 1))
  dt.setHours(0, 0, 0, 0)
  return dt
}

const studentsBelowGoal = computed(() => {
  const target = Number(weeklyTarget.value || 0)
  if (!target) return []
  return studentsFiltered.value.filter((s) => (metrics[s.id]?.weeklyCount || 0) < target)
})

const thisWeekTotal = computed(() =>
  filteredUids.value.reduce((a, uid) => a + (metrics[uid]?.weeklyCount || 0), 0),
)

async function saveWeeklyTarget() {
  try {
    savingGoal.value = true
    await updateCourse(courseId, { weekly_target: Number(weeklyTarget.value || 0) })
    course.value = { ...(course.value || {}), weekly_target: Number(weeklyTarget.value || 0) }
  } finally {
    savingGoal.value = false
  }
}

// ---------- 7-day Trend (class avg score per day) ----------
const trend7 = computed(() => {
  const days = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    d.setHours(0, 0, 0, 0)
    days.push(d)
  }
  const buckets = days.map((d) => ({ key: d.toISOString().slice(0, 10), sum: 0, count: 0 }))
  for (const uid of filteredUids.value) {
    const list = missionsCompletedByStudent[uid] || []
    for (const m of list || []) {
      const ms = m.updatedAt?.toMillis?.() ?? null
      const key = ms ? new Date(ms).toISOString().slice(0, 10) : null
      if (!key) continue
      const idx = buckets.findIndex((b) => b.key === key)
      if (idx >= 0 && typeof m.scoreSummary === 'number') {
        buckets[idx].sum += m.scoreSummary
        buckets[idx].count += 1
      }
    }
  }
  const points = buckets.map((b) => ({
    key: b.key,
    value: b.count ? Math.round(b.sum / b.count) : null,
  }))
  const max = Math.max(100, ...points.map((p) => p.value || 0))
  return { points, max }
})

function barHeight(v, max) {
  if (v == null) return '4px'
  const h = Math.max(4, Math.round((v / Math.max(max, 1)) * 60))
  return `${h}px`
}

// Mini histograms for confidence and blur seconds
const confHist = computed(() => {
  const bins = [0, 0, 0, 0, 0]
  const labels = ['0–0.2', '0.2–0.4', '0.4–0.6', '0.6–0.8', '0.8–1.0']
  for (const uid of filteredUids.value) {
    for (const sb of submissionsByStudent[uid] || []) {
      const c = pickConfidence(sb)
      if (c == null) continue
      const idx = Math.min(4, Math.max(0, Math.floor(c * 5)))
      bins[idx]++
    }
  }
  const max = Math.max(1, ...bins)
  return { points: bins, labels, max }
})

const blurSecHist = computed(() => {
  const bins = [0, 0, 0, 0, 0]
  const labels = ['0–10s', '10–30s', '30–60s', '60–180s', '>180s']
  for (const uid of filteredUids.value) {
    for (const sb of submissionsByStudent[uid] || []) {
      const s = typeof sb?.meta_blur_ms === 'number' ? Math.round(sb.meta_blur_ms / 1000) : null
      if (s == null) continue
      let idx = 0
      if (s < 10) idx = 0
      else if (s < 30) idx = 1
      else if (s < 60) idx = 2
      else if (s < 180) idx = 3
      else idx = 4
      bins[idx]++
    }
  }
  const max = Math.max(1, ...bins)
  return { points: bins, labels, max }
})

// ---------- Heatmap data (avg per student x skill) ----------
const scoreByStudentSkill = computed(() => {
  const map = {}
  for (const st of studentsFiltered.value) {
    const buckets = {}
    for (const k of skillKeys) buckets[k] = []
    const list = missionsCompletedByStudent[st.id] || []
    for (const m of list) {
      if (m.skill_targeted && typeof m.scoreSummary === 'number') {
        if (!buckets[m.skill_targeted]) buckets[m.skill_targeted] = []
        buckets[m.skill_targeted].push(m.scoreSummary)
      }
    }
    // fallback from submissions
    if (!list.length && (submissionsByStudent[st.id] || []).length) {
      for (const sb of submissionsByStudent[st.id]) {
        const skill = sb.skill_targeted || sb.scenarioSkill
        const rub = sb.feedback?.rubric_scores
        if (!skill || !rub) continue
        const vals = Object.values(rub)
        if (!vals.length) continue
        const w = { ดีเยี่ยม: 4, ดี: 3, พอใช้: 2, ต้องปรับปรุง: 1 }
        const sum = vals.reduce((a, l) => a + (w[l] || 0), 0)
        const sc = Math.round((sum / (vals.length * 4)) * 100)
        if (!buckets[skill]) buckets[skill] = []
        buckets[skill].push(sc)
      }
    }
    const agg = {}
    for (const k of skillKeys) {
      const arr = buckets[k] || []
      agg[k] = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
    }
    map[st.id] = agg
  }
  return map
})

function heatColor(score) {
  const s = Math.max(0, Math.min(100, score || 0))
  // simple green scale
  const g = Math.round((s / 100) * 200 + 30)
  const r = 255 - g + 30
  return `rgb(${r}, ${g}, 120)`
}

// High-contrast heat background using HSL from red->yellow->green
function heatBg(score) {
  const s = Math.max(0, Math.min(100, score || 0))
  // Map 0..100 to hue 0 (red) -> 120 (green)
  const hue = Math.round((s / 100) * 120)
  return `hsl(${hue} 85% 42%)`
}
// Dynamic text color for contrast on top of heatBg
function heatText(score) {
  const s = Math.max(0, Math.min(100, score || 0))
  // Darker text on lighter hues around green, lighter text on red zone
  return s >= 55 ? 'hsl(0 0% 98%)' : 'hsl(0 0% 96%)'
}

// ---------- Smart alerts ----------
const smartAlerts = computed(() => {
  const alerts = []
  const now = Date.now()
  for (const st of studentsFiltered.value) {
    // inactivity: no submission or mission update in last 7 days
    const subs = submissionsByStudent[st.id] || []
    const lastSub = subs[0]?.submittedAt?.toMillis?.() ?? 0
    const lastMission = missionsCompletedByStudent[st.id]?.[0]?.updatedAt?.toMillis?.() ?? 0
    const last = Math.max(lastSub, lastMission)
    if (last && now - last > 7 * 24 * 60 * 60 * 1000) {
      alerts.push({ id: `${st.id}-inactive`, text: `${st.name || st.id}: ไม่ได้ทำภารกิจมา 7 วัน` })
    }
    // low skill: any skill average < 60
    const agg = scoreByStudentSkill.value[st.id] || {}
    for (const k of skillKeys) {
      const sc = agg[k]
      if (sc != null && sc < 60) {
        alerts.push({
          id: `${st.id}-low-${k}`,
          text: `${st.name || st.id}: คะแนนทักษะ ${k} ต่ำ (<60)`,
        })
      }
    }
    // time_on_task outlier: avg > 60 mins or < 2 mins
    const times = (subs || [])
      .map((s) => (typeof s.time_on_task === 'number' ? Math.round(s.time_on_task / 60000) : null))
      .filter((n) => typeof n === 'number')
    if (times.length) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length
      if (avg > 60)
        alerts.push({
          id: `${st.id}-slow`,
          text: `${st.name || st.id}: ใช้เวลาทำภารกิจนานกว่าปกติ (>${Math.round(avg)} นาที)`,
        })
      if (avg < 2)
        alerts.push({
          id: `${st.id}-fast`,
          text: `${st.name || st.id}: ใช้เวลาสั้นผิดปกติ (<2 นาที)`,
        })
    }
  }
  return alerts
})

// ---------- Common Errors Summary ----------
const commonErrorTags = [
  'reasoning_gap',
  'insufficient_evidence',
  'misunderstanding_question',
  'logical_fallacy',
  'unclear_structure',
  'superficial_analysis',
  'incorrect_fact',
  'none',
]

function extractTag(sb) {
  try {
    const fb = typeof sb.feedback === 'string' ? JSON.parse(sb.feedback) : sb.feedback
    const t = fb?.common_error_tag
    return t && typeof t === 'string' ? t : null
  } catch {
    return null
  }
}

const commonErrors = computed(() => {
  const counts = {}
  let total = 0
  for (const sbList of Object.values(submissionsByStudent)) {
    for (const sb of sbList || []) {
      const t = extractTag(sb)
      if (!t || t === 'none') continue
      counts[t] = (counts[t] || 0) + 1
      total++
    }
  }
  const rows = Object.entries(counts)
    .map(([tag, count]) => ({ tag, count, pct: Math.round((count / Math.max(total, 1)) * 100) }))
    .sort((a, b) => b.count - a.count)
  return { total, rows }
})

import { errorTagLabelTh } from '@/utils/errorTags'
function displayTag(tag) {
  if (tag === 'none') return '—'
  return errorTagLabelTh(tag)
}

// ---------- Top improvers (last 3 vs prev 3) ----------
const topImprovers = computed(() => {
  const items = []
  for (const s of studentsFiltered.value) {
    const list = missionsCompletedByStudent[s.id] || []
    if (list.length < 4) continue
    const last3 = list
      .slice(0, 3)
      .map((m) => m.scoreSummary)
      .filter((n) => typeof n === 'number')
    const prev3 = list
      .slice(3, 6)
      .map((m) => m.scoreSummary)
      .filter((n) => typeof n === 'number')
    if (!last3.length || !prev3.length) continue
    const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
    const delta = avg(last3) - avg(prev3)
    items.push({ id: s.id, name: s.name || s.id, delta, recent: avg(last3) })
  }
  items.sort((a, b) => b.delta - a.delta)
  return items.slice(0, 3)
})

// ---------- Progress table rows (with 5-digit student code later) ----------
const progressRows = computed(() => {
  return (studentsFiltered.value || []).map((s) => {
    const m = metrics[s.id] || {}
    const completed = m.completed || 0
    const active = m.active || 0
    const total = completed + active
    return {
      uid: s.id,
      name: s.name || s.id,
      level: getLevel(s.xp || 0),
      completed,
      total,
      avgScore: m.avgScore ?? null,
      lastActive: formatDate(m.lastActive),
      portfolioUrl: { name: 'student-portfolio-view', params: { studentId: s.id } },
    }
  })
})

// Sorted rows: by 5-digit code (asc), then name (asc), then level (asc)
const sortedRows = computed(() => {
  const rows = [...(progressRows.value || [])]
  const toNum = (s) => {
    const d = String(s || '').replace(/\D/g, '')
    return d ? parseInt(d.slice(-5), 10) : Number.POSITIVE_INFINITY
  }
  return rows.sort((a, b) => {
    const codeA = toNum(formatStudentId(a))
    const codeB = toNum(formatStudentId(b))
    if (codeA !== codeB) return codeA - codeB
    const nameA = a.name || ''
    const nameB = b.name || ''
    const byName = nameA.localeCompare(nameB, 'th')
    if (byName !== 0) return byName
    return (a.level || 0) - (b.level || 0)
  })
})

// โปรไฟล์นักเรียนแบบแผนที่ uid -> profile
const studentProfiles = ref({})

// uid ทั้งหมดของนักเรียน (โหลดโปรไฟล์ล่วงหน้าเพื่อไม่ให้ติด deadlock กับตัวกรอง)
const rosterUids = computed(() => (students.value || []).map((s) => s.id).filter(Boolean))

// โหลดโปรไฟล์นักเรียนที่ยังไม่ได้โหลด
watch(
  rosterUids,
  async (uids) => {
    const need = uids.filter((uid) => !studentProfiles.value[uid])
    await Promise.all(
      need.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, 'students', uid))
          if (snap.exists()) studentProfiles.value[uid] = snap.data()
        } catch (e) {
          // เงียบไว้ไม่ให้รบกวน UI
        }
      }),
    )
  },
  { immediate: true },
)

// คืนค่ารหัส 5 หลัก โดยพยายามหาในหลายฟิลด์ และทำ padding
function formatStudentId(row) {
  const profile = studentProfiles.value[row.uid] || {}
  const raw =
    row.studentId ||
    row.studentCode ||
    row.code ||
    profile.studentId ||
    profile.studentCode ||
    profile.code

  return toFiveDigits(raw)
}

function toFiveDigits(val) {
  const s = String(val ?? '').replace(/\D/g, '')
  if (!s) return '—'
  // ถ้ามากกว่า 5 หลักจะตัดท้าย 5, ถ้าน้อยกว่าก็เติม 0 ข้างหน้า
  return s.slice(-5).padStart(5, '0')
}

// ---------- Grade/Room options ----------
function normalizeGrade(g) {
  const s = String(g ?? '').trim()
  return s || ''
}
function normalizeRoom(r) {
  const s = String(r ?? '').trim()
  return s || ''
}

const availableGrades = computed(() => {
  const set = new Set()
  for (const s of students.value || []) {
    const p = studentProfiles.value[s.id] || {}
    const g = normalizeGrade(p.grade || p.gradeLevel || p.grade_level || s.grade || s.grade_level)
    if (g) set.add(g)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
})

const availableRooms = computed(() => {
  const set = new Set()
  const targetG = (selectedGrade.value || '').trim()
  for (const s of students.value || []) {
    const p = studentProfiles.value[s.id] || {}
    const g = normalizeGrade(p.grade || p.gradeLevel || p.grade_level || s.grade || s.grade_level)
    const r = normalizeRoom(
      p.room || p.classroom || p.room_no || p.homeroom || s.room || s.classroom,
    )
    if (targetG && g !== targetG) continue
    if (r) set.add(r)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
})

watch(selectedGrade, () => {
  // reset room if it no longer exists
  if (selectedRoom.value && !availableRooms.value.includes(selectedRoom.value)) {
    selectedRoom.value = ''
  }
})
function clearFilters() {
  selectedGrade.value = ''
  selectedRoom.value = ''
  selectedRiskOnly.value = false
}

// ---------- Student drawer state ----------
const selectedStudentId = ref('')
function openStudent(uid) {
  selectedStudentId.value = uid
}
function closeStudent() {
  selectedStudentId.value = ''
}

const selectedProfile = computed(() => {
  const uid = selectedStudentId.value
  if (!uid) return null
  const base = students.value.find((s) => s.id === uid) || {}
  const prof = studentProfiles.value[uid] || {}
  const m = metrics[uid] || {}
  return {
    uid,
    name: base.name || prof.name || uid,
    code: toFiveDigits(
      base.studentId ||
        base.studentCode ||
        base.code ||
        prof.studentId ||
        prof.studentCode ||
        prof.code,
    ),
    grade: normalizeGrade(
      prof.grade || prof.gradeLevel || prof.grade_level || base.grade || base.grade_level,
    ),
    room: normalizeRoom(
      prof.room || prof.classroom || prof.room_no || prof.homeroom || base.room || base.classroom,
    ),
    xp: base.xp ?? prof.xp ?? 0,
    level: getLevel(base.xp ?? prof.xp ?? 0),
    completed: m.completed || 0,
    total: (m.completed || 0) + (m.active || 0),
    avgScore: m.avgScore ?? null,
    learningStyle: prof.learningStyle || prof.learning_style || '',
    interests: Array.isArray(prof.interests) ? prof.interests.join(', ') : prof.interests || '',
    futureGoal: prof.futureGoal || prof.future_goal || '',
  }
})

const selectedRecentMissions = computed(() => {
  const uid = selectedStudentId.value
  if (!uid) return []
  const list = missionsCompletedByStudent[uid] || []
  if (list.length) return list.slice(0, 5)
  // Legacy fallback: synthesize from submissions
  const subs = (submissionsByStudent[uid] || []).slice(0, 5)
  return subs.map((s) => ({
    id: `sub:${s.id}`,
    scenarioId_ref: s.scenarioId_ref,
    createdAt: s.submittedAt,
    skill_targeted: null,
    difficulty: null,
    scoreSummary: numericScoreOfSubmission(s),
  }))
})

const selectedRecentSubmissions = computed(() => {
  const uid = selectedStudentId.value
  if (!uid) return []
  return (submissionsByStudent[uid] || []).slice(0, 5)
})

function missionTitle(m) {
  const sc = m?.scenarioId_ref ? scenariosById[m.scenarioId_ref] : null
  if (sc?.scenario_title) return sc.scenario_title
  if (sc?.core_question) return String(sc.core_question).slice(0, 80)
  if (m?.skill_targeted || m?.difficulty)
    return [m.skill_targeted, m.difficulty ? `ระดับ: ${m.difficulty}` : '']
      .filter(Boolean)
      .join(' • ')
  return `ภารกิจ ${m?.id || ''}`.trim()
}

function submissionTitle(s) {
  const m = s?.missionId_ref ? missionById[s.missionId_ref] : null
  if (m) return missionTitle(m)
  return `ผลงาน ${s?.id || ''}`.trim()
}

function openDetailMission(m) {
  const sc = m?.scenarioId_ref ? scenariosById[m.scenarioId_ref] : null
  selectedInlineDetail.value = {
    type: 'mission',
    id: m?.id,
    title: missionTitle(m),
    subtitle: m?.createdAt ? `สร้างเมื่อ ${formatDate(m.createdAt)}` : '',
    core: sc?.core_question || '',
    skill: m?.skill_targeted || '',
    difficulty: m?.difficulty || '',
    riskFlag: false,
    simPct: null,
  }
}

function openDetailSubmission(s) {
  const m = s?.missionId_ref ? missionById[s.missionId_ref] : null
  const sc = m?.scenarioId_ref ? scenariosById[m.scenarioId_ref] : null
  const sim = s?.meta_similarity
  selectedInlineDetail.value = {
    type: 'submission',
    id: s?.id,
    title: m ? missionTitle(m) : missionTitle({ scenarioId_ref: s?.scenarioId_ref }),
    subtitle: s?.submittedAt ? `ส่งเมื่อ ${formatDate(s.submittedAt)}` : '',
    core: sc?.core_question || '',
    answer: (s?.studentAnswer || '').slice(0, 400),
    skill: m?.skill_targeted || '',
    difficulty: m?.difficulty || '',
    riskFlag: !!(s?.meta_llm_risk && (s.meta_llm_risk.flag || s.meta_llm_risk.score >= 0.75)),
    simPct: sim?.max != null ? Math.round(sim.max * 100) : null,
  }
}
// Convert a single submission's rubric into numeric 0-100 for display
function numericScoreOfSubmission(sb) {
  try {
    const rub = sb?.feedback?.rubric_scores
    if (!rub) return null
    const vals = Object.values(rub)
    if (!vals.length) return null
    const weight = { ดีเยี่ยม: 4, ดี: 3, พอใช้: 2, ต้องปรับปรุง: 1 }
    const sum = vals.reduce((a, l) => a + (weight[l] || 0), 0)
    return Math.round((sum / (vals.length * 4)) * 100)
  } catch {
    return null
  }
}

function closeInlineDetail() {
  selectedInlineDetail.value = null
}

// ---------- Risk detection (quick filter) ----------
const atRiskUids = computed(() => {
  const risky = new Set()
  for (const [uid, list] of Object.entries(submissionsByStudent)) {
    const recent = (list || []).slice(0, 10) // check up to 10 recent subs
    for (const sb of recent) {
      const r = sb?.meta_llm_risk ?? sb?.llm_risk
      const score = sb?.meta_weighted_score ?? sb?.weighted_score
      let hazard = false
      if (typeof r === 'string') hazard = /high/i.test(r)
      else if (typeof r === 'number') hazard = r >= 0.7
      if (!hazard && typeof score === 'number') hazard = score >= 0.7
      if (!hazard && typeof sb?.meta_behavior_factor === 'number')
        hazard = sb.meta_behavior_factor >= 0.7
      if (hazard) {
        risky.add(uid)
        break
      }
    }
  }
  return risky
})

// ---------- Sync filters with route query ----------
function syncFromRouteOnce() {
  const q = route.query || {}
  const g = typeof q.grade === 'string' ? q.grade : ''
  const r = typeof q.room === 'string' ? q.room : ''
  const risk = typeof q.risk === 'string' ? q.risk : ''
  selectedGrade.value = g || ''
  selectedRoom.value = r || ''
  selectedRiskOnly.value = risk.toLowerCase() === 'high'
}

function updateQuery() {
  const q = { ...(route.query || {}) }
  if (selectedGrade.value) q.grade = selectedGrade.value
  else delete q.grade
  if (selectedRoom.value) q.room = selectedRoom.value
  else delete q.room
  if (selectedRiskOnly.value) q.risk = 'high'
  else delete q.risk
  router.replace({ query: q })
}

// initialize from URL once
syncFromRouteOnce()

// when filters change, update URL
watch([selectedGrade, selectedRoom, selectedRiskOnly], updateQuery)

// (no course policy editing on this page)
</script>

<style scoped>
/* ตัวเลขแนวตารางอ่านง่ายขึ้นบนบางเบราว์เซอร์ */
td {
  font-variant-numeric: tabular-nums;
}
</style>
