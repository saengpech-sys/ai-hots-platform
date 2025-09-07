<template>
  <div class="bg-slate-50 min-h-screen p-6 md:p-10">
    <div class="max-w-7xl mx-auto">
      <!-- Header & Controls -->
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold text-slate-900">ประวัติผลงานรายวิชา</h1>
          <p class="text-slate-600 mt-1">ดูผลงานล่าสุดของนักเรียน สรุปคะแนน และข้อเสนอแนะจาก AI</p>
        </div>
        <div class="flex items-center gap-3">
          <RouterLink
            to="/teacher/my-courses"
            class="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
          >
            <span class="i-mdi-arrow-left"></span>
            ย้อนกลับ
          </RouterLink>
        </div>
      </div>

      <!-- Course Policy (read-only summary if available) -->
      <div v-if="coursePolicy" class="mb-4 text-xs text-slate-600">
        นโยบายรายวิชา: บล็อกการวาง = <b>{{ coursePolicy.block_paste ? 'เปิด' : 'ปิด' }}</b>
        <span v-if="coursePolicy.min_time_sec"
          >• เวลาขั้นต่ำ {{ coursePolicy.min_time_sec }} วินาที</span
        >
        <span v-if="coursePolicy.min_length_chars"
          >• ความยาวขั้นต่ำ {{ coursePolicy.min_length_chars }} ตัวอักษร</span
        >
        <span v-if="coursePolicy.min_typing_ratio"
          >• สัดส่วนการพิมพ์ขั้นต่ำ {{ Math.round(coursePolicy.min_typing_ratio * 100) }}%</span
        >
      </div>

      <!-- Tools -->
      <div v-reveal class="bg-white rounded-xl shadow p-4 md:p-5 mb-6 reveal">
        <div class="flex flex-col md:flex-row gap-3 md:items-end">
          <div class="md:w-64">
            <label class="text-sm text-slate-600">ค้นหานักเรียน</label>
            <input
              v-model="q"
              type="text"
              placeholder="พิมพ์ชื่อหรือรหัสนักเรียน"
              class="mt-1 w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div class="md:w-52">
            <label class="text-sm text-slate-600">คะแนนขั้นต่ำ</label>
            <input
              v-model.number="minScore"
              type="number"
              min="0"
              max="100"
              step="5"
              class="mt-1 w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div class="md:w-56">
            <label class="text-sm text-slate-600">ทักษะ</label>
            <select
              v-model="skillFilter"
              class="mt-1 w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="all">ทั้งหมด</option>
              <option v-for="k in uniqueSkills" :key="k" :value="k">{{ k }}</option>
            </select>
          </div>
          <div class="md:w-40">
            <label class="text-sm text-slate-600">ความยาก</label>
            <select
              v-model="difficultyFilter"
              class="mt-1 w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="all">ทั้งหมด</option>
              <option v-for="d in uniqueDifficulties" :key="d" :value="d">{{ d }}</option>
            </select>
          </div>
          <div class="md:w-64">
            <label class="text-sm text-slate-600">แท็กข้อผิดพลาด</label>
            <select
              v-model="tagFilter"
              class="mt-1 w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="all">ทั้งหมด</option>
              <option value="none">ไม่มีแท็ก</option>
              <option v-for="t in uniqueTags" :key="t" :value="t">{{ displayTag(t) }}</option>
            </select>
          </div>
          <div class="md:w-56">
            <label class="text-sm text-slate-600">ความเสี่ยง AI</label>
            <select
              v-model="riskFilter"
              class="mt-1 w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="all">ทั้งหมด</option>
              <option value="flagged">ถูกธงเสี่ยง</option>
              <option value="clean">ไม่ถูกธง</option>
            </select>
          </div>
          <div class="md:w-56">
            <label class="text-sm text-slate-600">ความคล้ายข้อความ</label>
            <select
              v-model="similarityFilter"
              class="mt-1 w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="all">ทั้งหมด</option>
              <option value="flagged">ถูกธงคล้าย</option>
              <option value="clean">ไม่ถูกธง</option>
              <option value="high">สูง ≥85%</option>
              <option value="medium">กลาง 70–84%</option>
              <option value="low">ต่ำ 50–69%</option>
              <option value="none">น้อยกว่า 50%</option>
            </select>
          </div>
          <div class="md:w-56">
            <label class="text-sm text-slate-600">ออกนอกแท็บ (ธงอัตโนมัติ)</label>
            <select
              v-model="offTabFilter"
              class="mt-1 w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="all">ทั้งหมด</option>
              <option value="flagged">ถูกธง</option>
              <option value="clean">ไม่ถูกธง</option>
            </select>
          </div>
          <div class="md:w-56">
            <label class="text-sm text-slate-600">สัดส่วนการพิมพ์ขั้นต่ำ</label>
            <input
              v-model.number="minTypingRatio"
              type="number"
              min="0"
              max="1"
              step="0.05"
              class="mt-1 w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div class="md:w-56">
            <label class="text-sm text-slate-600">ออกนอกแท็บ (ครั้ง) ขั้นต่ำ</label>
            <input
              v-model.number="minBlurCount"
              type="number"
              min="0"
              step="1"
              class="mt-1 w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div class="flex-1"></div>
          <div class="md:w-56">
            <label class="text-sm text-slate-600">เรียงตาม</label>
            <select
              v-model="sortBy"
              class="mt-1 w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="date_desc">ส่งล่าสุด</option>
              <option value="risk_desc">ความเสี่ยง AI สูง → ต่ำ</option>
              <option value="similarity_desc">ความคล้าย สูง → ต่ำ</option>
              <option value="typing_asc">สัดส่วนการพิมพ์ ต่ำ → สูง</option>
              <option value="time_asc">เวลา น้อย → มาก</option>
              <option value="score_desc">คะแนน สูง → ต่ำ</option>
            </select>
          </div>
          <div class="flex items-center gap-2 md:ml-2">
            <input id="toggleTable" type="checkbox" v-model="tableMode" />
            <label for="toggleTable" class="text-sm text-slate-700">แสดงแบบตาราง</label>
          </div>
          <button
            @click="exportCSV()"
            class="inline-flex items-center justify-center rounded-lg bg-slate-800 text-white px-4 py-2 hover:bg-slate-900"
          >
            ส่งออก CSV
          </button>
        </div>
      </div>

      <!-- Table Mode -->
      <div
        v-if="tableMode && sortedItems.length"
        class="overflow-x-auto bg-white rounded-xl shadow"
      >
        <table class="min-w-full text-sm">
          <thead class="text-slate-500">
            <tr>
              <th class="text-left py-2 px-3">ส่งเมื่อ</th>
              <th class="text-left py-2 px-3">นักเรียน</th>
              <th class="text-left py-2 px-3">คะแนน</th>
              <th class="text-left py-2 px-3">เวลา (นาที)</th>
              <th class="text-left py-2 px-3">พิมพ์%</th>
              <th class="text-left py-2 px-3">วาง|บล็อก</th>
              <th class="text-left py-2 px-3">สัญญาณ</th>
              <th class="text-left py-2 px-3">คล้าย</th>
              <th class="text-left py-2 px-3">ธงออกแท็บ</th>
              <th class="text-left py-2 px-3">ออกแท็บ</th>
              <th class="text-left py-2 px-3">เสี่ยง AI</th>
              <th class="text-left py-2 px-3">ความเชื่อมั่น</th>
              <th class="text-right py-2 px-3">ดู</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in paginatedSorted" :key="s.id" class="border-t">
              <td class="py-2 px-3 text-slate-600">{{ formatDate(s.submittedAt) }}</td>
              <td class="py-2 px-3">
                <div class="flex items-center gap-2">
                  <img
                    v-if="photoUrlOf(s)"
                    :src="photoUrlOf(s)"
                    alt="avatar"
                    class="h-7 w-7 rounded-full object-cover bg-slate-200"
                  />
                  <div
                    v-else
                    class="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 grid place-content-center text-xs font-semibold"
                  >
                    {{ (studentName(s.studentId_ref) || 'S')[0] }}
                  </div>
                  <span>{{ studentName(s.studentId_ref) }}</span>
                </div>
              </td>
              <td class="py-2 px-3 font-semibold" :class="scoreColorClass(scoreOf(s))">
                {{ scoreOf(s) ?? '—' }}
              </td>
              <td class="py-2 px-3">{{ timeMinutes(s) ?? '—' }}</td>
              <td class="py-2 px-3">
                {{ s.meta_input_ratio != null ? Math.round(s.meta_input_ratio * 100) : '—' }}
              </td>
              <td class="py-2 px-3">
                {{ s.meta_paste_chars || 0 }} | {{ s.meta_paste_blocked_attempts || 0 }}
              </td>
              <td class="py-2 px-3">
                <span
                  v-if="s.meta_sudden_jump"
                  class="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-xs"
                  >เปลี่ยนเร็ว</span
                >
              </td>
              <td class="py-2 px-3">
                <span
                  v-if="s.meta_similarity?.flag"
                  class="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-xs"
                  >{{ Math.round((s.meta_similarity?.max ?? 0) * 100) }}%</span
                >
                <span v-else class="text-slate-500 text-xs">
                  {{
                    s.meta_similarity?.max != null
                      ? Math.round(s.meta_similarity.max * 100) + '%'
                      : '—'
                  }}
                </span>
              </td>
              <td class="py-2 px-3">
                <span
                  v-if="s.meta_offtab?.flag"
                  class="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-xs"
                  >ธง</span
                >
                <span v-else class="text-slate-400 text-xs">—</span>
              </td>
              <td class="py-2 px-3">
                {{ s.meta_blur_count != null ? s.meta_blur_count : '—' }}
                <span v-if="s.meta_blur_ms != null" class="text-slate-400 text-xs">
                  ({{ Math.round((s.meta_blur_ms || 0) / 1000) }}s)
                </span>
              </td>
              <td class="py-2 px-3">
                <span
                  v-if="s.meta_llm_risk?.flag"
                  class="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-xs"
                  >ธง</span
                >
                <span v-else class="text-slate-400 text-xs">—</span>
              </td>
              <td class="py-2 px-3">
                <span
                  v-if="confidenceScore(s) != null"
                  :class="[
                    'px-2 py-0.5 rounded text-xs font-medium',
                    confidenceBadgeClass(confidenceScore(s)),
                  ]"
                >
                  {{ Math.round(confidenceScore(s) * 100) }}%
                </span>
                <span v-else class="text-slate-400 text-xs">—</span>
              </td>
              <td class="py-2 px-3 text-right">
                <button class="text-indigo-600 text-sm" @click="openDetail(s)">เปิด</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Card Mode -->
      <div v-else-if="paginatedItems.length" class="grid md:grid-cols-2 gap-4 md:gap-6">
        <article
          v-reveal
          v-for="s in paginatedItems"
          :key="s.id"
          class="bg-white rounded-xl shadow hover:shadow-lg transition-shadow card reveal"
        >
          <div class="p-5">
            <!-- Top row -->
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-start gap-3">
                <img
                  v-if="photoUrlOf(s)"
                  :src="photoUrlOf(s)"
                  alt="avatar"
                  class="h-10 w-10 rounded-full object-cover bg-slate-200"
                />
                <div
                  v-else
                  class="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 grid place-content-center font-semibold"
                >
                  {{ (studentName(s.studentId_ref) || 'S')[0] }}
                </div>
                <div>
                  <div class="font-semibold text-slate-900">{{ studentName(s.studentId_ref) }}</div>
                  <div class="text-xs text-slate-500">ส่งเมื่อ {{ formatDate(s.submittedAt) }}</div>
                </div>
              </div>

              <div class="text-right">
                <div class="text-xs text-slate-500">คะแนนรวม</div>
                <div :class="['text-2xl font-bold', scoreColorClass(scoreOf(s))]">
                  {{ scoreOf(s) ?? '—' }}
                </div>
              </div>
            </div>

            <!-- Badges: HOTS + Difficulty (from mission) -->
            <div v-if="missionOf(s)" class="mt-3 flex flex-wrap gap-2">
              <span
                class="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium"
              >
                {{ missionOf(s)?.skill_targeted || '—' }}
              </span>
              <span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                ระดับ: {{ missionOf(s)?.difficulty || '—' }}
              </span>
              <span
                v-if="attemptOf(s) > 1"
                class="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs"
              >
                ครั้งที่ {{ attemptOf(s) }}
              </span>
              <span
                v-if="tagOf(s)"
                class="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs"
              >
                แท็ก: {{ tagOf(s) }}
              </span>
              <span
                v-if="timeMinutes(s) != null"
                class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs"
              >
                เวลา: {{ timeMinutes(s) }} นาที
              </span>
              <span
                v-if="s.meta_input_ratio != null"
                class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs"
              >
                พิมพ์: {{ (s.meta_input_ratio * 100).toFixed(0) }}%
              </span>
              <span
                v-if="(s.meta_paste_chars || 0) > 0 || (s.meta_paste_blocked_attempts || 0) > 0"
                class="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs"
              >
                วาง: {{ s.meta_paste_chars || 0 }} | บล็อก: {{ s.meta_paste_blocked_attempts || 0 }}
              </span>
              <span
                v-if="s.meta_sudden_jump"
                class="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs"
              >
                เปลี่ยนเร็วผิดปกติ
              </span>
              <span
                v-if="s.meta_llm_risk?.flag"
                class="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-xs"
                title="{{ s.meta_llm_risk?.score }}"
              >
                เสี่ยง AI
              </span>
              <span
                v-if="s.meta_offtab?.flag"
                class="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs"
              >
                ออกนอกแท็บ
              </span>
              <span
                v-if="confidenceScore(s) != null"
                :class="[
                  'px-2.5 py-1 rounded-full text-xs',
                  confidenceBadgeClass(confidenceScore(s)),
                ]"
              >
                ความเชื่อมั่น {{ Math.round(confidenceScore(s) * 100) }}%
              </span>
              <span
                v-if="s.meta_similarity?.flag"
                class="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-xs"
                :title="'ความคล้ายสูงสุด ' + Math.round((s.meta_similarity?.max ?? 0) * 100) + '%'"
              >
                คล้าย {{ Math.round((s.meta_similarity?.max ?? 0) * 100) }}%
              </span>
              <span
                v-else-if="s.meta_similarity?.max != null"
                class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs"
              >
                คล้าย {{ Math.round((s.meta_similarity?.max ?? 0) * 100) }}%
              </span>
            </div>

            <!-- Standards / Indicators (compact) -->
            <div
              v-if="missionOf(s)?.meta?.standards?.length || missionOf(s)?.meta?.indicators?.length"
              class="mt-2 flex flex-wrap gap-2"
            >
              <template v-if="missionOf(s)?.meta?.standards?.length">
                <span class="text-xs text-slate-500">มาตรฐาน:</span>
                <span
                  v-for="(st, idx) in (missionOf(s).meta.standards || []).slice(0, 3)"
                  :key="'st-' + idx"
                  class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs"
                  >{{ st }}</span
                >
                <span
                  v-if="(missionOf(s).meta.standards || []).length > 3"
                  class="text-xs text-slate-400"
                  >+{{ (missionOf(s).meta.standards || []).length - 3 }}</span
                >
              </template>
              <template v-if="missionOf(s)?.meta?.indicators?.length">
                <span class="text-xs text-slate-500 ml-1">ตัวชี้วัด:</span>
                <span
                  v-for="(ind, idx) in (missionOf(s).meta.indicators || []).slice(0, 3)"
                  :key="'ind-' + idx"
                  class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs"
                  >{{ ind }}</span
                >
                <span
                  v-if="(missionOf(s).meta.indicators || []).length > 3"
                  class="text-xs text-slate-400"
                  >+{{ (missionOf(s).meta.indicators || []).length - 3 }}</span
                >
              </template>
            </div>

            <!-- Answer preview -->
            <div class="mt-4">
              <div class="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">
                คำตอบของนักเรียน
              </div>
              <p class="text-slate-800 leading-relaxed whitespace-pre-line">
                {{
                  expandId === s.id
                    ? s.studentAnswer || '—'
                    : (s.studentAnswer || '—').slice(0, 220)
                }}<span v-if="(s.studentAnswer || '').length > 220 && expandId !== s.id">…</span>
              </p>
              <button
                v-if="(s.studentAnswer || '').length > 220"
                class="mt-2 text-indigo-600 hover:text-indigo-700 text-sm"
                @click="toggleExpand(s.id)"
              >
                {{ expandId === s.id ? 'ย่อ' : 'อ่านเพิ่มเติม' }}
              </button>
            </div>

            <!-- Rubric chips -->
            <div v-if="parsedFeedback(s)?.rubric_scores" class="mt-4">
              <div class="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
                ผลประเมินตามเกณฑ์
              </div>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="(label, key) in parsedFeedback(s).rubric_scores"
                  :key="key"
                  :class="['px-2.5 py-1 rounded-full text-xs font-medium', badgeClass(label)]"
                >
                  {{ key }}: {{ label }}
                </span>
              </div>
            </div>

            <!-- Detailed feedback -->
            <details v-if="(parsedFeedback(s)?.detailed_feedback || []).length" class="mt-4 group">
              <summary
                class="cursor-pointer select-none text-sm text-slate-700 hover:text-slate-900 flex items-center gap-2"
              >
                <span class="i-mdi-message-text-outline"></span>
                รายละเอียดคำติชม
                <span class="text-slate-400 text-xs">(คลิกเพื่อเปิด/ปิด)</span>
              </summary>
              <div class="mt-3 space-y-3">
                <div
                  v-for="(d, idx) in parsedFeedback(s).detailed_feedback"
                  :key="idx"
                  class="bg-slate-50 rounded-lg p-3 border"
                >
                  <div class="text-sm font-medium text-slate-800">{{ d.criteria }}</div>
                  <div class="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                    {{ d.feedback_text }}
                  </div>
                </div>
              </div>
            </details>

            <!-- Raw JSON (optional) -->
            <details class="mt-3">
              <summary class="text-xs text-slate-500 cursor-pointer">ดูข้อมูลดิบ (JSON)</summary>
              <pre
                class="bg-slate-50 p-3 rounded border overflow-auto text-xs mt-2 pretty-scroll"
                >{{ safeJSONString(s.feedback) }}</pre
              >
            </details>

            <!-- Tiny trend line (sparkline) -->
            <div class="mt-4 flex items-center justify-between">
              <div class="text-xs text-slate-500">แนวโน้มคะแนน</div>
              <svg
                v-if="seriesOf(s.studentId_ref).length >= 2"
                :width="120"
                :height="28"
                :class="scoreColorClass(scoreOf(s))"
              >
                <polyline
                  :points="sparkPoints(seriesOf(s.studentId_ref), 120, 28)"
                  class="stroke-current"
                  fill="none"
                  stroke-width="2"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                />
              </svg>
            </div>

            <!-- Actions -->
            <div class="mt-4 flex items-center gap-3">
              <button
                class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                @click="openDetail(s)"
              >
                ดูภารกิจ
              </button>
              <button
                class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200"
                @click="copyShareLink(s)"
              >
                คัดลอกลิงก์ผลงาน
              </button>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="text-center text-slate-600">ยังไม่มีผลงานในรายวิชานี้</div>

      <!-- Pagination -->
      <div
        v-if="filteredItems.length > pageSize"
        class="mt-8 flex items-center justify-center gap-2"
      >
        <button class="px-3 py-1 rounded border text-sm" :disabled="page === 1" @click="page--">
          ก่อนหน้า
        </button>
        <span class="text-slate-600 text-sm">หน้า {{ page }} / {{ totalPages }}</span>
        <button
          class="px-3 py-1 rounded border text-sm"
          :disabled="page === totalPages"
          @click="page++"
        >
          ถัดไป
        </button>
      </div>

      <!-- Detail Modal -->
      <div
        v-if="detail"
        class="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4 modal-enter-active"
      >
        <div class="bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden">
          <div class="px-6 py-4 border-b flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-900">รายละเอียดภารกิจ</h3>
            <button class="text-slate-500 hover:text-slate-700" @click="closeDetail">✕</button>
          </div>
          <div class="p-6 space-y-5 max-h-[75vh] overflow-auto pretty-scroll">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm text-slate-600">นักเรียน:</span>
              <span class="font-medium">{{
                studentName(detail.studentId_ref) || detail.studentId_ref
              }}</span>
              <span class="text-slate-300">•</span>
              <span class="text-sm text-slate-600"
                >ส่งเมื่อ {{ formatDate(detail.submittedAt) }}</span
              >
              <span v-if="missionOf(detail)" class="text-slate-300">•</span>
              <span v-if="missionOf(detail)" class="text-sm">
                ทักษะ: <b>{{ missionOf(detail).skill_targeted }}</b> | ระดับ:
                <b>{{ missionOf(detail).difficulty }}</b>
              </span>
            </div>

            <section v-if="scenario(detail)">
              <h4 class="font-semibold text-slate-900">สถานการณ์</h4>
              <div class="text-slate-800 mt-1">{{ scenario(detail)?.scenario_title || '—' }}</div>
              <div class="text-slate-700 mt-1 whitespace-pre-line">
                {{ scenario(detail)?.core_question }}
              </div>
            </section>

            <section v-if="assessment(detail)">
              <h4 class="font-semibold text-slate-900">ภารกิจ</h4>
              <div class="text-slate-700 whitespace-pre-line">
                {{ assessment(detail)?.task_description }}
              </div>
            </section>

            <section>
              <h4 class="font-semibold text-slate-900">คำตอบของนักเรียน</h4>
              <div class="text-slate-800 whitespace-pre-line">
                {{ detail.studentAnswer || '—' }}
              </div>
            </section>

            <section v-if="parsedFeedback(detail)">
              <h4 class="font-semibold text-slate-900">ผลประเมิน</h4>
              <div class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="(label, key) in parsedFeedback(detail).rubric_scores || {}"
                  :key="key"
                  :class="['px-2.5 py-1 rounded-full text-xs font-medium', badgeClass(label)]"
                >
                  {{ key }}: {{ label }}
                </span>
              </div>
              <div
                class="mt-3 space-y-3"
                v-if="(parsedFeedback(detail)?.detailed_feedback || []).length"
              >
                <div
                  v-for="(d, idx) in parsedFeedback(detail).detailed_feedback"
                  :key="idx"
                  class="bg-slate-50 rounded-lg p-3 border"
                >
                  <div class="text-sm font-medium">{{ d.criteria }}</div>
                  <div class="text-sm text-slate-700 whitespace-pre-line">
                    {{ d.feedback_text }}
                  </div>
                </div>
              </div>
            </section>
          </div>
          <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-end gap-3">
            <button
              class="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300"
              @click="closeDetail"
            >
              ปิด
            </button>
            <button
              class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              @click="copyShareLink(detail)"
            >
              คัดลอกลิงก์ผลงาน
            </button>
          </div>
        </div>
      </div>
      <!-- Toast -->
      <div
        v-if="toast"
        class="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow z-[60]"
      >
        {{ toast }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  getSubmissionsByCourse,
  getStudentProfile,
  getMissionById,
  getScenarioById,
  getAssessmentById,
} from '@/services/firestoreService'
import { useLearningLoopStore } from '@/stores/learningLoopStore'

const route = useRoute()
const items = ref([])
const q = ref('')
const minScore = ref(0)
const skillFilter = ref('all')
const difficultyFilter = ref('all')
const tagFilter = ref('all')
const riskFilter = ref('all')
const minTypingRatio = ref(0)
const minBlurCount = ref(0)
const similarityFilter = ref('all')
const offTabFilter = ref('all')
const sortBy = ref('date_desc')
const tableMode = ref(false)
const expandId = ref(null)
const names = ref({})
const photos = ref({})
const page = ref(1)
const pageSize = ref(10)
const missions = ref({}) // id -> mission
const scenarios = ref({}) // id -> scenario
const assessments = ref({}) // id -> assessment
const detail = ref(null) // selected submission
const toast = ref('')
const coursePolicy = ref(null)

const { computeNumericScore } = useLearningLoopStore()

onMounted(async () => {
  const courseId = String(route.params.courseId)
  const raw = await getSubmissionsByCourse(courseId)
  items.value = raw

  // load student names (best-effort)
  const ids = [...new Set(raw.map((x) => x.studentId_ref).filter(Boolean))]
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const p = await getStudentProfile(id)
        const nm = p?.name && !String(p.name).includes('@') ? p.name : p?.studentCode || 'ไม่ระบุ'
        const url = p?.photoURL || ''
        return [id, { name: nm, photoURL: url }]
      } catch {
        return [id, { name: 'ไม่ระบุ', photoURL: '' }]
      }
    }),
  )
  const nameMap = {}
  const photoMap = {}
  for (const [id, obj] of results) {
    nameMap[id] = obj.name
    photoMap[id] = obj.photoURL
  }
  names.value = nameMap
  photos.value = photoMap

  // preload missions for HOTS/difficulty
  const misIds = [...new Set(raw.map((x) => x.missionId_ref).filter(Boolean))]
  const misArr = await Promise.all(
    misIds.map(async (id) => {
      try {
        const m = await getMissionById(id)
        return [id, m]
      } catch {
        return [id, null]
      }
    }),
  )
  missions.value = Object.fromEntries(misArr)

  // Optional deep-link preset (?tag=reasoning_gap|none)
  const qtag = route.query?.tag
  if (typeof qtag === 'string' && qtag) tagFilter.value = qtag
  // Optional deep-link preset (?offtab=flagged|clean)
  const qoff = route.query?.offtab
  if (qoff === 'flagged' || qoff === 'clean') offTabFilter.value = qoff

  // Best-effort: derive course policy from first scenario's course_settings
  try {
    const one = raw.find((x) => x.scenarioId_ref)
    if (one) {
      const sc = await getScenarioById(one.scenarioId_ref)
      coursePolicy.value = sc?.course_settings || null
    }
  } catch {}
})

// helpers
function parseFeedback(feedback) {
  try {
    if (!feedback) return null
    if (typeof feedback === 'string') return JSON.parse(feedback)
    return feedback
  } catch {
    return null
  }
}
const parsedFeedback = (s) => parseFeedback(s.feedback)

function scoreOf(s) {
  const fb = parsedFeedback(s)
  if (!fb?.rubric_scores) return null
  return computeNumericScore(fb.rubric_scores)
}

function tagOf(s) {
  const fb = parsedFeedback(s)
  const tag = fb?.common_error_tag
  return tag && tag !== 'none' ? tag : null
}

function attemptOf(s) {
  return Number(s.attempt_number || 1)
}

function timeMinutes(s) {
  try {
    if (typeof s.time_on_task === 'number') return Math.round(s.time_on_task / 60000)
    const m = missionOf(s)
    const created = m?.createdAt?.toMillis?.() ?? null
    const submitted = s.submittedAt?.toMillis?.() ?? null
    if (!created || !submitted) return null
    return Math.max(0, Math.round((submitted - created) / 60000))
  } catch {
    return null
  }
}

function studentName(id) {
  return names.value[id] || 'ไม่ระบุ'
}
function photoUrlOf(s) {
  return photos.value[s.studentId_ref] || ''
}

function formatDate(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

function badgeClass(label) {
  const map = {
    ดีเยี่ยม: 'bg-emerald-100 text-emerald-700',
    ดี: 'bg-sky-100 text-sky-700',
    พอใช้: 'bg-amber-100 text-amber-700',
    ต้องปรับปรุง: 'bg-rose-100 text-rose-700',
  }
  return map[label] || 'bg-slate-100 text-slate-700'
}

function scoreColorClass(v) {
  if (v == null) return 'text-slate-500'
  if (v >= 85) return 'text-emerald-600'
  if (v >= 70) return 'text-sky-600'
  if (v >= 50) return 'text-amber-600'
  return 'text-rose-600'
}

function toggleExpand(id) {
  expandId.value = expandId.value === id ? null : id
}

import { errorTagLabelTh } from '@/utils/errorTags'
function displayTag(tag) {
  return errorTagLabelTh(tag)
}

const filteredItems = computed(() => {
  const term = q.value.trim().toLowerCase()
  const min = Number(minScore.value) || 0
  const qStudent = typeof route.query?.studentId === 'string' ? route.query.studentId : ''
  const qCriteria = typeof route.query?.criteria === 'string' ? route.query.criteria : ''
  const qConfMax = route.query?.confMax != null ? Number(route.query.confMax) : NaN
  const res = items.value.filter((s) => {
    const name = (studentName(s.studentId_ref) || s.studentId_ref || '').toLowerCase()
    const sc = scoreOf(s)
    const passScore = sc == null ? true : sc >= min
    // skill/difficulty filters
    const m = missionOf(s)
    const passSkill = skillFilter.value === 'all' || (m?.skill_targeted || '') === skillFilter.value
    const passDiff =
      difficultyFilter.value === 'all' || (m?.difficulty || '') === difficultyFilter.value
    // tag filter
    const tag = tagOf(s)
    const passTag =
      tagFilter.value === 'all' ||
      (tagFilter.value === 'none' ? tag == null : tag === tagFilter.value)
    // risk filter
    const flag = !!(s.meta_llm_risk && (s.meta_llm_risk.flag || s.meta_llm_risk.score >= 0.75))
    const passRisk = riskFilter.value === 'all' || (riskFilter.value === 'flagged' ? flag : !flag)
    // typing ratio
    const ratio = Number(s.meta_input_ratio ?? 0)
    const passTyping = ratio >= Number(minTypingRatio.value || 0)
    // off-tab
    const blurs = Number(s.meta_blur_count ?? 0)
    const passBlur = blurs >= Number(minBlurCount.value || 0)
    // off-tab flag filter
    const offtabFlag = !!(s.meta_offtab && s.meta_offtab.flag)
    const passOffTab =
      offTabFilter.value === 'all' || (offTabFilter.value === 'flagged' ? offtabFlag : !offtabFlag)
    // similarity filter
    const sim = s.meta_similarity
    const simMax = Number(sim?.max ?? 0)
    const simFlag = !!sim?.flag
    const passSim =
      similarityFilter.value === 'all'
        ? true
        : similarityFilter.value === 'flagged'
          ? simFlag
          : similarityFilter.value === 'clean'
            ? !simFlag
            : similarityFilter.value === 'high'
              ? simMax >= 0.85
              : similarityFilter.value === 'medium'
                ? simMax >= 0.7 && simMax < 0.85
                : similarityFilter.value === 'low'
                  ? simMax >= 0.5 && simMax < 0.7
                  : simMax < 0.5
    // deep link filters
    const passStudent = qStudent ? s.studentId_ref === qStudent : true
    // criteria filter: show examples where this criteria scored low (พอใช้/ต้องปรับปรุง)
    const levelStr = qCriteria ? s?.feedback?.rubric_scores?.[qCriteria] : null
    const passCriteria = qCriteria
      ? typeof levelStr === 'string' &&
        (levelStr.includes('พอใช้') || levelStr.includes('ต้องปรับปรุง'))
      : true
    const cScore = confidenceScore(s)
    const passConf = Number.isFinite(qConfMax)
      ? cScore == null
        ? false
        : cScore <= qConfMax
      : true
    return (
      (!term || name.includes(term)) &&
      passScore &&
      passSkill &&
      passDiff &&
      passTag &&
      passRisk &&
      passTyping &&
      passBlur &&
      passOffTab &&
      passSim &&
      passCriteria &&
      passStudent &&
      passConf
    )
  })
  // reset page if overflow
  if ((page.value - 1) * pageSize.value >= res.length) page.value = 1
  return res
})

const uniqueSkills = computed(() => {
  const set = new Set()
  for (const s of items.value) {
    const skill = missionOf(s)?.skill_targeted
    if (skill) set.add(skill)
  }
  return Array.from(set)
})

const uniqueDifficulties = computed(() => {
  const set = new Set()
  for (const s of items.value) {
    const d = missionOf(s)?.difficulty
    if (d) set.add(d)
  }
  return Array.from(set)
})

const uniqueTags = computed(() => {
  const set = new Set()
  for (const s of items.value) {
    const t = tagOf(s)
    if (t) set.add(t)
  }
  return Array.from(set)
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredItems.value.length / pageSize.value)),
)
const paginatedItems = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredItems.value.slice(start, start + pageSize.value)
})

const sortedItems = computed(() => {
  const arr = [...filteredItems.value]
  const riskScore = (s) => Number(s.meta_llm_risk?.score ?? 0)
  const ratio = (s) => Number(s.meta_input_ratio ?? 0)
  const sim = (s) => Number(s.meta_similarity?.max ?? 0)
  const time = (s) =>
    typeof s.time_on_task === 'number'
      ? s.time_on_task / 60000
      : missionOf(s)?.createdAt?.toMillis?.() && s.submittedAt?.toMillis?.()
        ? Math.max(0, (s.submittedAt.toMillis() - missionOf(s).createdAt.toMillis()) / 60000)
        : 0
  const score = (s) => Number(scoreOf(s) ?? 0)
  const date = (s) => s.submittedAt?.toMillis?.() ?? 0
  switch (sortBy.value) {
    case 'risk_desc':
      arr.sort((a, b) => riskScore(b) - riskScore(a))
      break
    case 'typing_asc':
      arr.sort((a, b) => ratio(a) - ratio(b))
      break
    case 'similarity_desc':
      arr.sort((a, b) => sim(b) - sim(a))
      break
    case 'time_asc':
      arr.sort((a, b) => time(a) - time(b))
      break
    case 'score_desc':
      arr.sort((a, b) => score(b) - score(a))
      break
    default:
      arr.sort((a, b) => date(b) - date(a))
  }
  return arr
})
const paginatedSorted = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return sortedItems.value.slice(start, start + pageSize.value)
})

// series per student for sparkline
const seriesByStudent = computed(() => {
  const map = {}
  const sorted = [...items.value].sort((a, b) => {
    const ta = a.submittedAt?.toMillis?.() ?? 0
    const tb = b.submittedAt?.toMillis?.() ?? 0
    return ta - tb
  })
  for (const s of sorted) {
    const id = s.studentId_ref
    const sc = scoreOf(s)
    if (sc == null) continue
    if (!map[id]) map[id] = []
    map[id].push(sc)
    if (map[id].length > 12) map[id].shift()
  }
  return map
})
function seriesOf(studentId) {
  return seriesByStudent.value[studentId] || []
}
function sparkPoints(series, w, h) {
  if (!series.length) return ''
  const n = series.length
  const dx = n > 1 ? w / (n - 1) : 0
  return series
    .map((v, i) => {
      const x = Math.round(i * dx)
      const y = Math.round(h - (v / 100) * h)
      return `${x},${y}`
    })
    .join(' ')
}

function safeJSONString(obj) {
  try {
    return typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

function confidenceScore(s) {
  const sc = s?.meta_confidence
  if (sc == null) return null
  if (typeof sc === 'number') return sc
  if (typeof sc?.score === 'number') return sc.score
  return null
}
function confidenceBadgeClass(v) {
  if (v == null) return 'bg-slate-100 text-slate-700'
  if (v >= 0.85) return 'bg-emerald-100 text-emerald-700'
  if (v >= 0.7) return 'bg-sky-100 text-sky-700'
  if (v >= 0.5) return 'bg-amber-100 text-amber-700'
  return 'bg-rose-100 text-rose-700'
}

function exportCSV() {
  const header = [
    'submission_id',
    'student_id',
    'student_name',
    'submitted_at',
    'score',
    'skill',
    'difficulty',
    'attempt_number',
    'time_minutes',
    'common_error_tag',
    'typed_keystrokes',
    'paste_chars',
    'input_ratio',
    'paste_blocked_attempts',
    'sudden_jump',
    'blur_count',
    'blur_seconds',
    'offtab_flag',
    'offtab_ms_threshold',
    'offtab_count_threshold',
    'llm_flag',
    'llm_score',
    'similarity_flag',
    'similarity_max_pct',
    'behavior_weighted_score',
    'confidence_score',
  ]
  const rows = filteredItems.value.map((s) => {
    const m = missionOf(s)
    return [
      s.id,
      s.studentId_ref,
      studentName(s.studentId_ref) || '',
      formatDate(s.submittedAt),
      scoreOf(s) ?? '',
      m?.skill_targeted || '',
      m?.difficulty || '',
      attemptOf(s) || 1,
      timeMinutes(s) ?? '',
      tagOf(s) || '',
      s.meta_typing_keystrokes ?? '',
      s.meta_paste_chars ?? '',
      s.meta_input_ratio ?? '',
      s.meta_paste_blocked_attempts ?? '',
      s.meta_sudden_jump ?? '',
      s.meta_blur_count ?? '',
      s.meta_blur_ms != null ? Math.round((s.meta_blur_ms || 0) / 1000) : '',
      (s.meta_offtab && (s.meta_offtab.flag ? '1' : '0')) ?? '',
      s.meta_offtab?.thresholds?.ms ?? '',
      s.meta_offtab?.thresholds?.count ?? '',
      (s.meta_llm_risk && (s.meta_llm_risk.flag ? '1' : '0')) ?? '',
      (s.meta_llm_risk && s.meta_llm_risk.score) ?? '',
      (s.meta_similarity && (s.meta_similarity.flag ? '1' : '0')) ?? '',
      s.meta_similarity?.max != null ? Math.round(s.meta_similarity.max * 100) : '',
      s.meta_weighted_score ?? '',
      s.meta_confidence?.score ?? '',
    ]
  })
  const csv = [header, ...rows]
    .map((r) => r.map((x) => `"${String(x ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')
  // Prepend UTF-8 BOM to ensure Thai characters display correctly in Excel
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'course-history.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// Mission/scenario helpers
function missionOf(s) {
  const id = s.missionId_ref
  return id ? missions.value[id] || null : null
}

function scenario(s) {
  const id = s.scenarioId_ref
  if (!id) return null
  return scenarios.value[id] || null
}

function assessment(s) {
  const id = s.assessmentId_ref
  if (!id) return null
  return assessments.value[id] || null
}

async function openDetail(s) {
  detail.value = s
  // lazy load scenario/assessment if missing
  if (s.scenarioId_ref && !scenarios.value[s.scenarioId_ref]) {
    try {
      scenarios.value[s.scenarioId_ref] = await getScenarioById(s.scenarioId_ref)
    } catch {}
  }
  if (s.assessmentId_ref && !assessments.value[s.assessmentId_ref]) {
    try {
      assessments.value[s.assessmentId_ref] = await getAssessmentById(s.assessmentId_ref)
    } catch {}
  }
}

function closeDetail() {
  detail.value = null
}

async function copyShareLink(s) {
  const base = window.location.origin
  const url = `${base}/portfolio/${encodeURIComponent(s.studentId_ref)}?focus=${encodeURIComponent(s.id)}`
  try {
    await navigator.clipboard.writeText(url)
    toast.value = 'คัดลอกลิงก์แล้ว'
    setTimeout(() => (toast.value = ''), 1800)
  } catch {
    // fallback
    const ta = document.createElement('textarea')
    ta.value = url
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    toast.value = 'คัดลอกลิงก์แล้ว'
    setTimeout(() => (toast.value = ''), 1800)
  }
}
</script>

<style scoped>
/* Icon placeholders if no icon library is used */
.i-mdi-arrow-left::before {
  content: '←';
}
.i-mdi-message-text-outline::before {
  content: '💬';
}
</style>

<style scoped>
/* simple modal animation (scoped) */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
