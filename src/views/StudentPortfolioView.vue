<template>
  <div class="bg-slate-50 min-h-screen p-6 md:p-8">
    <div class="mx-auto max-w-6xl space-y-8">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold text-slate-800">แผนที่การเดินทางทางความคิดของฉัน</h1>
        <span v-if="isTeacherMode" class="text-xs text-slate-500">มุมมองครู (อ่านอย่างเดียว)</span>
      </div>

      <!-- Identity -->
      <section v-reveal class="bg-white rounded-xl shadow p-5 reveal">
        <h2 class="text-lg font-semibold mb-4">ข้อมูลระบุตัวตน</h2>
        <div v-if="profile" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-slate-600">ชื่อ-นามสกุล</label>
            <input
              v-model="editableProfile.name"
              :disabled="isTeacherMode"
              class="input-style w-full"
            />
          </div>
          <div class="md:col-span-2 flex items-center gap-4">
            <img
              :src="editableProfile.photoURL || placeholder"
              alt="avatar"
              class="h-16 w-16 rounded-full object-cover bg-slate-200"
            />
            <div>
              <input
                v-if="!isTeacherMode"
                type="file"
                accept="image/*"
                @change="onPickStudentImage"
              />
              <div v-if="!isTeacherMode" class="text-xs text-slate-500">
                อัปโหลดรูป (ไม่บังคับ) • รองรับไฟล์ภาพ ขนาดไม่เกิน ~2MB
              </div>
            </div>
          </div>
          <div>
            <label class="block text-sm text-slate-600">รหัสนักเรียน (5 หลัก)</label>
            <input
              v-model="editableProfile.studentCode"
              :disabled="isTeacherMode"
              class="input-style w-full"
              type="text"
              inputmode="numeric"
              pattern="[0-9]{5}"
              maxlength="5"
              placeholder="เช่น 12345"
            />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-sm text-slate-600">ระดับชั้น</label>
              <select
                v-model="editableProfile.gradeLevel"
                :disabled="isTeacherMode"
                class="input-style w-full"
              >
                <option v-for="g in gradeLevels" :key="g" :value="g">{{ g }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-slate-600">ห้อง</label>
              <select
                v-model="editableProfile.room"
                :disabled="isTeacherMode"
                class="input-style w-full"
              >
                <option v-for="n in 20" :key="n" :value="String(n)">{{ n }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-slate-600">เลขที่</label>
              <input
                v-model.number="editableProfile.number"
                :disabled="isTeacherMode"
                type="number"
                class="input-style w-full"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm text-slate-600">ตอน</label>
            <select
              v-model="editableProfile.section"
              :disabled="isTeacherMode"
              class="input-style w-full"
            >
              <option value="">ไม่มี</option>
              <option value="ก">ก</option>
              <option value="ข">ข</option>
            </select>
          </div>
        </div>
        <div v-else class="text-slate-500">กำลังโหลด...</div>
        <div v-if="!isTeacherMode" class="mt-4">
          <button @click="saveIdentity" class="px-4 py-2 rounded-md bg-indigo-600 text-white">
            บันทึก
          </button>
        </div>
      </section>

      <!-- Skills & Gamification -->
      <section v-reveal class="bg-white rounded-xl shadow p-5 reveal">
        <h2 class="text-lg font-semibold mb-4">แดชบอร์ดทักษะและ Gamification</h2>
        <div class="grid md:grid-cols-2 gap-6">
          <div>
            <div class="flex items-center justify-between text-sm text-slate-600 mb-1">
              <span>Level {{ level }}</span>
              <span>{{ progressXp }}/{{ xpToNext }} XP</span>
            </div>
            <div class="h-2 bg-slate-200 rounded">
              <div class="h-2 bg-emerald-500 rounded" :style="{ width: progressPct + '%' }"></div>
            </div>
            <div class="mt-3 text-sm text-slate-600">รวม: {{ profile?.xp ?? 0 }} XP</div>
          </div>
          <div class="space-y-2">
            <div v-for="s in skillKeys" :key="s">
              <div class="flex justify-between text-sm">
                <span>{{ s }}</span>
                <span>{{ Math.round(skillAverages[s] || 0) }}%</span>
              </div>
              <div class="h-2 bg-slate-200 rounded">
                <div
                  class="h-2 bg-indigo-500 rounded"
                  :style="{ width: (skillAverages[s] || 0) + '%' }"
                ></div>
              </div>
            </div>
            <div class="text-sm text-slate-700 mt-2">
              ทักษะที่โดดเด่น: <span class="font-semibold">{{ topSkill || '-' }}</span>
            </div>
            <div class="text-sm text-slate-700">
              เป้าหมายถัดไป: <span class="font-semibold">{{ nextTarget || '-' }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Capability Overview -->
      <section v-reveal class="bg-white rounded-xl shadow p-5 reveal">
        <h2 class="text-lg font-semibold mb-4">ภาพรวมความสามารถ</h2>
        <div class="grid md:grid-cols-4 gap-4">
          <div class="p-4 bg-slate-50 rounded-lg">
            <div class="text-sm text-slate-500">ภารกิจทั้งหมด</div>
            <div class="text-2xl font-bold">{{ totalTasks }}</div>
          </div>
          <div class="p-4 bg-slate-50 rounded-lg">
            <div class="text-sm text-slate-500">คะแนนเฉลี่ย</div>
            <div class="text-2xl font-bold">{{ avgScoreDisplay }}</div>
          </div>
          <div class="p-4 bg-slate-50 rounded-lg">
            <div class="text-sm text-slate-500">อัตราความสำเร็จ (≥70)</div>
            <div class="text-2xl font-bold">{{ successRateDisplay }}</div>
          </div>
          <div class="p-4 bg-slate-50 rounded-lg">
            <div class="text-sm text-slate-500">ความยากที่เหมาะตอนนี้</div>
            <div class="text-2xl font-bold capitalize">{{ currentDifficulty }}</div>
          </div>
        </div>
      </section>

      <!-- Profile skill levels (dynamic scale) -->
      <section v-reveal class="bg-white rounded-xl shadow p-5 reveal">
        <h2 class="text-lg font-semibold mb-4">โปรไฟล์ทักษะ</h2>
        <div v-if="profile?.skill_profile" class="space-y-3">
          <div v-for="label in profileSkillOrder" :key="label">
            <div class="flex justify-between text-sm">
              <span>{{ label }}</span>
              <span class="text-slate-500">{{ profile.skill_profile[label] ?? 0 }}</span>
            </div>
            <div class="h-2 bg-slate-200 rounded overflow-hidden">
              <div
                class="h-2 bg-emerald-500 rounded"
                :style="{ width: barWidth(profile.skill_profile[label]) }"
              ></div>
            </div>
          </div>
          <div class="mt-3 text-xs text-slate-500 leading-relaxed">
            หมายเหตุ: ค่าเริ่มต้นของแต่ละทักษะคือ <b>5</b> (Baseline)
            และจะเพิ่ม/ลดแบบค่อยเป็นค่อยไปตามผลการประเมินจากภารกิจ
            (<i>ดีเยี่ยม/ดี/พอใช้/ต้องปรับปรุง</i>). ความยาวแถบเทียบกับค่าสูงสุดของฉันในตอนนี้
            (ไม่ใช่เปอร์เซ็นต์) เพื่อดูแนวโน้มความแข็งแรงของทักษะแต่ละด้านครับ
          </div>
        </div>
        <div v-else class="text-slate-500 text-sm">ยังไม่มีโปรไฟล์ทักษะ</div>
      </section>

      <!-- Analytics & Factors -->
      <section v-reveal class="bg-white rounded-xl shadow p-5 reveal">
        <h2 class="text-lg font-semibold mb-4">สถิติและปัจจัยการเรียนรู้</h2>
        <div class="flex flex-wrap gap-3 mb-4 items-center">
          <div class="text-sm text-slate-600">ช่วงเวลา</div>
          <select v-model.number="timeWindowDays" class="input-style">
            <option :value="7">7 วัน</option>
            <option :value="30">30 วัน</option>
            <option :value="90">90 วัน</option>
            <option :value="365">1 ปี</option>
            <option :value="0">ทั้งหมด</option>
          </select>
          <div class="text-sm text-slate-600 ml-2">รายวิชา</div>
          <select v-model="courseFilter" class="input-style">
            <option v-if="!isTeacherMode" value="all">ทั้งหมด</option>
            <option v-for="(c, id) in coursesMap" :key="id" :value="id">{{ c.title }}</option>
          </select>
          <div
            v-if="isTeacherMode && peerPercentile != null"
            class="ml-auto text-sm text-slate-600"
          >
            เปอร์เซ็นไทล์ในชั้น: <span class="font-semibold">{{ peerPercentile }}%</span>
          </div>
        </div>

        <!-- Teacher-mode guidance -->
        <div
          v-if="isTeacherMode && (!courseFilter || courseFilter === '')"
          class="mb-4 p-3 rounded bg-amber-50 text-amber-800 text-sm"
        >
          เลือกรายวิชาที่ครูสอนของนักเรียนคนนี้เพื่อดูผลงานค่ะ
        </div>
        <div
          v-else-if="isTeacherMode && submissions.length === 0"
          class="mb-4 p-3 rounded bg-slate-50 text-slate-600 text-sm"
        >
          ยังไม่มีผลงานในรายวิชานี้ หรือครูอาจไม่มีสิทธิ์เข้าถึง
        </div>

        <div class="flex gap-2 mb-4">
          <button @click="exportCSV" class="px-3 py-1.5 rounded-md border">Export CSV</button>
          <button @click="exportPNG" class="px-3 py-1.5 rounded-md border">บันทึกเป็นภาพ</button>
        </div>

        <!-- Multi-series line chart (by skill) -->
        <div class="mb-6">
          <div class="w-full">
            <svg
              width="100%"
              :height="chartH"
              viewBox="0 0 640 160"
              class="bg-white border rounded"
            >
              <!-- axes -->
              <line x1="40" :y1="chartH - 30" x2="620" :y2="chartH - 30" stroke="#e2e8f0" />
              <line x1="40" y1="10" x2="40" :y2="chartH - 30" stroke="#e2e8f0" />
              <text x="8" y="18" font-size="10" fill="#64748b">100</text>
              <text x="15" :y="chartH - 30" font-size="10" fill="#64748b">0</text>
              <!-- series -->
              <template v-for="(pts, idx) in seriesPaths" :key="idx">
                <path :d="pts" :stroke="seriesColors[idx]" fill="none" stroke-width="2" />
              </template>
            </svg>
          </div>
        </div>
        <div class="grid md:grid-cols-3 gap-4">
          <div class="p-4 bg-slate-50 rounded-lg">
            <div class="text-sm text-slate-500">Learning Streak</div>
            <div class="text-2xl font-bold">{{ streak }} วัน</div>
            <div class="text-xs text-slate-500">สูงสุด: {{ maxStreak }} วัน</div>
          </div>
          <div class="p-4 bg-slate-50 rounded-lg">
            <div class="text-sm text-slate-500">ภารกิจทั้งหมด</div>
            <div class="text-2xl font-bold">{{ submissions.length }}</div>
          </div>
          <div class="p-4 bg-slate-50 rounded-lg">
            <div class="text-sm text-slate-500">Pacing</div>
            <div class="text-xs text-slate-500">จะคำนวณเวลาใช้งานต่อภารกิจในรุ่นถัดไป</div>
          </div>
        </div>
        <div class="mt-4">
          <h3 class="font-medium mb-2">การวิเคราะห์ตามบริบท</h3>
          <div class="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="text-left text-slate-500">
                  <th class="py-2 pr-4">หมวดหมู่</th>
                  <th class="py-2 pr-4">ภารกิจ</th>
                  <th class="py-2 pr-4">คะแนนเฉลี่ย</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in contextualBySubject" :key="row.key" class="border-t">
                  <td class="py-2 pr-4">{{ row.key }}</td>
                  <td class="py-2 pr-4">{{ row.count }}</td>
                  <td class="py-2 pr-4">{{ Math.round(row.avg) }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="mt-6 grid md:grid-cols-3 gap-4">
          <div class="p-4 bg-slate-50 rounded-lg">
            <div class="text-sm text-slate-500 mb-1">แนวโน้มตามทักษะ</div>
            <div class="space-y-2">
              <div v-for="k in skillKeys" :key="k">
                <div class="text-xs text-slate-600 mb-1">{{ k }}</div>
                <div class="flex items-end gap-1 h-16">
                  <div
                    v-for="v in perSkillTrend[k]"
                    :key="v + '-' + k"
                    class="w-2 bg-indigo-500/70 rounded"
                    :style="{ height: Math.max(4, Math.round((v / 100) * 64)) + 'px' }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
          <div class="p-4 bg-slate-50 rounded-lg">
            <div class="text-sm text-slate-500 mb-1">ผลลัพธ์ตามความยาก</div>
            <div class="text-xs text-slate-600">
              easy: {{ difficultyOutcomes.easy.avg ?? '—' }} ({{ difficultyOutcomes.easy.count }})
            </div>
            <div class="text-xs text-slate-600">
              normal: {{ difficultyOutcomes.normal.avg ?? '—' }} ({{
                difficultyOutcomes.normal.count
              }})
            </div>
            <div class="text-xs text-slate-600">
              hard: {{ difficultyOutcomes.hard.avg ?? '—' }} ({{ difficultyOutcomes.hard.count }})
            </div>
          </div>
          <div class="p-4 bg-slate-50 rounded-lg">
            <div class="text-sm text-slate-500 mb-1">เวลาเฉลี่ยต่อภารกิจ</div>
            <div class="text-2xl font-bold">{{ timeToComplete.avg ?? '—' }} นาที</div>
            <div class="text-xs text-slate-600">
              p50: {{ timeToComplete.p50 ?? '—' }} • p90: {{ timeToComplete.p90 ?? '—' }}
            </div>
          </div>
        </div>
        <div class="mt-6 p-4 bg-slate-50 rounded-lg">
          <div class="text-sm text-slate-500 mb-1">ภาพรวมการพัฒนา</div>
          <div class="text-slate-700">
            แนวโน้ม: <span class="font-semibold">{{ improvement.trend }}</span>
            <span v-if="improvement.delta != null"
              >({{ improvement.delta >= 0 ? '+' : '' }}{{ improvement.delta }})</span
            >
          </div>
        </div>
      </section>

      <!-- Compact Leaderboard for selected course -->
      <section v-reveal class="bg-white rounded-xl shadow p-5 reveal" v-if="miniCourseId">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold">กระดานผู้นำ (ย่อ)</h2>
          <div class="inline-flex rounded-lg overflow-hidden border border-slate-200">
            <button
              class="px-3 py-1 text-sm"
              :class="
                miniTimeframe === 'week' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'
              "
              @click="setMiniTimeframe('week')"
            >
              7 วัน
            </button>
            <button
              class="px-3 py-1 text-sm"
              :class="
                miniTimeframe === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'
              "
              @click="setMiniTimeframe('all')"
            >
              ทั้งหมด
            </button>
          </div>
          <div
            class="inline-flex rounded-lg overflow-hidden border border-slate-200 ml-2"
            title="โหมดเรียง: L=Level • B=คะแนนสูงสุด • A=ค่าเฉลี่ยคะแนน"
          >
            <button
              class="px-2 py-1 text-xs"
              :class="miniSort === 'level' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'"
              @click="miniSort = 'level'"
            >
              L
            </button>
            <button
              class="px-2 py-1 text-xs"
              :class="miniSort === 'best' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'"
              @click="miniSort = 'best'"
            >
              B
            </button>
            <button
              class="px-2 py-1 text-xs"
              :class="miniSort === 'avg' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'"
              @click="miniSort = 'avg'"
            >
              A
            </button>
          </div>
          <div class="inline-flex items-center ml-2 gap-1 text-xs text-slate-600">
            <span>Top</span>
            <select v-model.number="miniLimit" class="input-style text-xs w-16">
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select>
          </div>
          <button
            @click="showXpBars = !showXpBars"
            class="ml-2 px-2 py-1 text-xs rounded border transition"
            :class="
              showXpBars
                ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                : 'bg-white text-slate-600 border-slate-200'
            "
            title="แสดง/ซ่อนแถบ XP"
          >
            XP {{ showXpBars ? 'On' : 'Off' }}
          </button>
        </div>
        <div class="flex items-center justify-between text-sm text-slate-600 mb-2">
          <div v-if="miniMyRank">
            อันดับของฉัน: <span class="font-semibold text-indigo-700">#{{ miniMyRank }}</span>
            <span
              v-if="miniMyLevel"
              class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200"
              >Lv {{ miniMyLevel }}</span
            >
            <span v-if="miniMyAvg != null" class="ml-1 text-[10px] text-slate-500"
              >Avg {{ miniMyAvg }}%</span
            >
            <span v-if="miniMyXp != null" class="ml-1 text-[10px] text-slate-500"
              >XP {{ miniMyXp }}</span
            >
          </div>
          <div class="ml-auto text-xs text-slate-500">Top {{ miniLeaderboard.length }}</div>
        </div>
        <div v-if="miniLeaderboard.length">
          <ul class="divide-y divide-slate-100">
            <li
              v-for="(p, idx) in miniLeaderboard"
              :key="p.uid"
              class="flex items-center gap-3 py-2"
            >
              <div class="w-6 text-slate-500 font-semibold">#{{ idx + 1 }}</div>
              <img
                :src="p.photoURL || '/avatar.svg'"
                class="h-7 w-7 rounded-full object-cover bg-slate-200"
                alt="avatar"
              />
              <div class="flex-1 min-w-0">
                <div class="truncate text-sm text-slate-800 flex items-center gap-2">
                  <span>{{ p.name || 'Student' }}</span>
                  <span
                    v-if="p.level"
                    class="px-1.5 py-0.5 text-[10px] rounded bg-indigo-50 text-indigo-600 border border-indigo-200"
                    >Lv {{ p.level }}</span
                  >
                </div>
              </div>
              <div class="flex flex-col items-end w-20">
                <div
                  class="text-sm font-semibold"
                  :class="
                    idx === 0
                      ? 'text-emerald-600'
                      : idx === 1
                        ? 'text-blue-600'
                        : idx === 2
                          ? 'text-amber-600'
                          : 'text-slate-700'
                  "
                >
                  {{ p.bestScore }}%
                </div>
                <div class="h-1.5 bg-slate-200 rounded w-full mt-1 overflow-hidden">
                  <div
                    v-if="showXpBars"
                    class="h-1.5 bg-indigo-500"
                    :style="{ width: miniXpPercent(p) + '%' }"
                    :title="`XP ${p.xp || 0} (${miniXpPercent(p)}% ของผู้นำ)`"
                  ></div>
                </div>
              </div>
            </li>
          </ul>
        </div>
        <div v-else class="text-sm text-slate-500">ยังไม่มีข้อมูล</div>
      </section>

      <!-- Showcase & Log -->
      <section v-reveal class="bg-white rounded-xl shadow p-5 reveal">
        <h2 class="text-lg font-semibold mb-4">เส้นทางการเรียนรู้</h2>
        <div v-if="submissions.length" class="space-y-4">
          <div
            v-reveal
            v-for="s in submissions"
            :key="s.id"
            :id="'sub-' + s.id"
            :class="[
              'border rounded-lg p-4 card reveal',
              focusId === s.id ? 'ring-2 ring-indigo-400' : '',
            ]"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="text-sm text-slate-500">{{ formatDate(s.submittedAt) }}</div>
                <div class="font-semibold">{{ scenarioTitle(s.scenarioId_ref) }}</div>
                <div class="mt-1 flex flex-wrap gap-1">
                  <span class="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                    ทักษะ: {{ scenarioSkill(s.scenarioId_ref) || '-' }}
                  </span>
                  <span class="px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700">
                    ความยาก: {{ submissionDifficulty(s) || '-' }}
                  </span>
                  <span
                    v-if="numericScore(s) != null"
                    class="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700"
                  >
                    คะแนน: {{ numericScore(s) }} / 100
                  </span>
                  <span
                    v-if="numericScore(s) != null"
                    class="px-2 py-0.5 rounded-full text-xs border"
                    :class="medalBadgeClass(numericScore(s))"
                  >
                    {{ medalLabel(numericScore(s)) }}
                  </span>
                  <span
                    v-if="s.feedback?.common_error_tag"
                    class="px-2 py-0.5 rounded-full text-xs bg-rose-50 text-rose-700"
                  >
                    แท็ก: {{ errorTagLabelTh(s.feedback.common_error_tag) }}
                  </span>
                  <span
                    v-if="timeOnTaskMinutes(s) != null"
                    class="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700"
                  >
                    เวลา: {{ timeOnTaskMinutes(s) }} นาที
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  v-if="!isTeacherMode"
                  @click="togglePin(s)"
                  class="text-xs px-2 py-1 rounded border"
                >
                  {{ s.pinned ? 'ยกเลิกปักหมุด' : 'ปักหมุด' }}
                </button>
              </div>
            </div>
            <p class="mt-2 text-slate-700" v-if="s.feedback?.summary_feedback">
              {{ s.feedback.summary_feedback }}
            </p>
            <div
              v-if="s.meta_prompt || s.meta_response"
              class="mt-2 p-2 rounded bg-amber-50 border border-amber-200"
            >
              <div class="text-xs text-amber-800">สะท้อนคิด:</div>
              <div class="text-xs text-slate-700" v-if="s.meta_prompt">
                ถาม: {{ s.meta_prompt }}
              </div>
              <div class="text-xs text-slate-700" v-if="s.meta_response">
                ตอบ: {{ s.meta_response }}
              </div>
            </div>
            <div v-if="!isTeacherMode" class="mt-3">
              <label class="block text-xs text-slate-500 mb-1">บันทึกสะท้อนคิด</label>
              <textarea
                v-model="s.reflection"
                @blur="saveReflection(s)"
                rows="2"
                class="w-full input-style"
              ></textarea>
            </div>
          </div>
        </div>
        <div v-else class="text-slate-500">ยังไม่มีภารกิจ</div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue'
import { errorTagLabelTh } from '@/utils/errorTags'
import { useRoute } from 'vue-router'
import { auth } from '@/firebase/config'
import {
  getStudentProfile,
  updateStudentProfile,
  getSubmissionsByStudent,
  getScenariosByIds,
  getCourseById,
  updateSubmission,
  uploadUserImage,
  getMissionById,
  getStudentsByEnrolledCourse,
  listCompletedMissionsForCourse,
  onStudentProfileSnapshot,
  getTeacherCourses,
  getSubmissionsByCourse,
} from '@/services/firestoreService'

const route = useRoute()
const studentIdParam = route.params.studentId || null
const isTeacherMode = computed(() => !!studentIdParam)
const studentId = ref(null)

const profile = ref(null)
const editableProfile = reactive({})
const submissions = ref([])
const focusId = ref(null)
const scenarios = ref({}) // id -> scenario
const coursesMap = ref({})
const missionMap = ref({}) // id -> mission (for difficulty)

// Filters (ปรับต่อได้)
const timeWindowDays = ref(30) // 7/30/90/365
const courseFilter = ref('all') // 'all' or courseId

const gradeLevels = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6']
const placeholder = '/avatar.svg'

const xp = computed(() => profile.value?.xp ?? 0)
const level = computed(() => {
  const x = xp.value
  let n = Math.floor((1 + Math.sqrt(1 + x / 25)) / 2)
  while (50 * n * (n - 1) > x) n--
  while (50 * (n + 1) * n <= x) n++
  return Math.max(1, n)
})
const xpBase = computed(() => 50 * level.value * (level.value - 1))
const xpNext = computed(() => 50 * (level.value + 1) * level.value)
const progressXp = computed(() => xp.value - xpBase.value)
const xpToNext = computed(() => Math.max(1, xpNext.value - xpBase.value))
const progressPct = computed(() =>
  Math.min(100, Math.max(0, (progressXp.value / xpToNext.value) * 100)),
)

const skillKeys = [
  'การวิเคราะห์ (Analyzing)',
  'การประเมินค่า (Evaluating)',
  'การสร้างสรรค์ (Creating)',
]
const labelWeight = { ดีเยี่ยม: 100, ดี: 75, พอใช้: 50, ต้องปรับปรุง: 25 }

const filteredSubs = computed(() => {
  const days = Number(timeWindowDays.value || 0)
  const since = days > 0 ? Date.now() - days * 86400000 : 0
  return submissions.value.filter((s) => {
    const t = s.submittedAt?.toMillis?.() ?? new Date(s.submittedAt).getTime?.() ?? 0
    if (since && t < since) return false
    if (courseFilter.value && courseFilter.value !== 'all') {
      const sc = scenarios.value[s.scenarioId_ref]
      if (sc?.courseId_ref !== courseFilter.value) return false
    }
    return true
  })
})

const skillAverages = computed(() => {
  const buckets = {}
  for (const k of skillKeys) buckets[k] = []
  for (const s of filteredSubs.value) {
    const sc = scenarios.value[s.scenarioId_ref]
    const skill = sc?.skill_targeted
    const scores = s.feedback?.rubric_scores
    if (!skill || !scores) continue
    const labels = Object.values(scores)
    if (!labels.length) continue
    const avg = labels.reduce((acc, lab) => acc + (labelWeight[lab] || 0), 0) / labels.length
    if (!buckets[skill]) buckets[skill] = []
    buckets[skill].push(avg)
  }
  const res = {}
  for (const k of Object.keys(buckets)) {
    const arr = buckets[k]
    res[k] = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  }
  return res
})

const topSkill = computed(() => {
  let best = null,
    val = -1
  for (const k of skillKeys) {
    const v = skillAverages.value[k] || 0
    if (v > val) {
      val = v
      best = k
    }
  }
  return best
})
const nextTarget = computed(() => {
  let worst = null,
    val = 1e9
  for (const k of skillKeys) {
    const v = skillAverages.value[k] || 0
    if (v < val) {
      val = v
      worst = k
    }
  }
  return worst
})

const contextualBySubject = computed(() => {
  // group by course subject_area
  const bucket = {}
  for (const s of filteredSubs.value) {
    const sc = scenarios.value[s.scenarioId_ref]
    const cid = sc?.courseId_ref
    const course = cid ? coursesMap.value[cid] : null
    const key = course?.subject_area || 'ทั่วไป'
    const scores = s.feedback?.rubric_scores
    if (!scores) continue
    const labels = Object.values(scores)
    if (!labels.length) continue
    const avg = labels.reduce((acc, lab) => acc + (labelWeight[lab] || 0), 0) / labels.length
    if (!bucket[key]) bucket[key] = []
    bucket[key].push(avg)
  }
  return Object.entries(bucket).map(([key, arr]) => ({
    key,
    count: arr.length,
    avg: arr.reduce((a, b) => a + b, 0) / arr.length,
  }))
})

// ---------- Capability overview ----------
function scoreFromRubric(rub) {
  if (!rub) return null
  const vals = Object.values(rub)
  if (!vals.length) return null
  const weight = { ดีเยี่ยม: 4, ดี: 3, พอใช้: 2, ต้องปรับปรุง: 1 }
  const sum = vals.reduce((a, l) => a + (weight[l] || 0), 0)
  return Math.round((sum / (vals.length * 4)) * 100)
}
const scores = computed(() =>
  filteredSubs.value
    .map((s) => scoreFromRubric(s.feedback?.rubric_scores))
    .filter((n) => typeof n === 'number'),
)
const totalTasks = computed(() => filteredSubs.value.length)
const avgScore = computed(() => {
  const arr = scores.value
  if (!arr.length) return null
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
})
const avgScoreDisplay = computed(() => (avgScore.value == null ? '—' : avgScore.value + ' / 100'))
const successRate = computed(() => {
  const arr = scores.value
  if (!arr.length) return null
  const pass = arr.filter((n) => n >= 70).length
  return Math.round((pass / arr.length) * 100)
})
const successRateDisplay = computed(() =>
  successRate.value == null ? '—' : successRate.value + '%',
)
const currentDifficulty = computed(() => {
  const last3 = scores.value.slice(0, 3)
  if (!last3.length) return 'normal'
  const avg = Math.round(last3.reduce((a, b) => a + b, 0) / last3.length)
  if (avg < 50) return 'easy'
  if (avg > 85) return 'hard'
  return 'normal'
})

function submissionDifficulty(s) {
  const mid = s.missionId_ref
  const m = mid ? missionMap.value[mid] : null
  return m?.difficulty || null
}
function numericScore(s) {
  return scoreFromRubric(s.feedback?.rubric_scores)
}

const profileSkillOrder = ['การวิเคราะห์', 'การประเมินค่า', 'การสร้างสรรค์']

// Dynamic scaling for skill bars: max of current values (at least 10)
const uiSkillMax = computed(() => {
  const sp = (profile.value && profile.value.skill_profile) || {}
  const vals = profileSkillOrder.map((k) => Number(sp[k] ?? 0)).filter((n) => Number.isFinite(n))
  return Math.max(10, ...(vals.length ? vals : [0]))
})
function barWidth(v) {
  const n = Number(v ?? 0)
  const pct = Math.max(0, Math.min(100, Math.round((n / uiSkillMax.value) * 100)))
  return pct + '%'
}

// Medal helpers
function medalLabel(score) {
  if (score == null) return ''
  if (score >= 80) return 'เหรียญทอง'
  if (score >= 60) return 'เหรียญเงิน'
  if (score >= 40) return 'เหรียญทองแดง'
  return 'กำลังพัฒนา'
}
function medalBadgeClass(score) {
  if (score == null) return 'bg-slate-50 text-slate-700 border-slate-200'
  if (score >= 80) return 'bg-yellow-50 text-yellow-800 border-yellow-200'
  if (score >= 60) return 'bg-slate-50 text-slate-700 border-slate-200'
  if (score >= 40) return 'bg-amber-50 text-amber-800 border-amber-200'
  return 'bg-rose-50 text-rose-700 border-rose-200'
}

// ---------- Deep insights ----------
const perSkillTrend = computed(() => {
  const trend = {}
  for (const k of skillKeys) trend[k] = []
  for (const s of filteredSubs.value.slice().reverse()) {
    const sc = scenarios.value[s.scenarioId_ref]
    const skill = sc?.skill_targeted
    const scNum = scoreFromRubric(s.feedback?.rubric_scores)
    if (skill && typeof scNum === 'number') trend[skill].push(scNum)
  }
  return trend
})

const difficultyOutcomes = computed(() => {
  const map = { easy: [], normal: [], hard: [] }
  for (const s of filteredSubs.value) {
    const d = submissionDifficulty(s)
    const sc = scoreFromRubric(s.feedback?.rubric_scores)
    if (!d || typeof sc !== 'number') continue
    if (!map[d]) map[d] = []
    map[d].push(sc)
  }
  const toObj = (arr) => ({
    count: arr.length,
    avg: arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null,
  })
  return {
    easy: toObj(map.easy),
    normal: toObj(map.normal),
    hard: toObj(map.hard),
  }
})

const timeToComplete = computed(() => {
  const mins = []
  for (const s of filteredSubs.value) {
    if (typeof s.time_on_task === 'number') {
      mins.push(Math.round(s.time_on_task / 60000))
      continue
    }
    const m = s.missionId_ref ? missionMap.value[s.missionId_ref] : null
    const created = m?.createdAt?.toMillis?.() ?? null
    const submitted = s.submittedAt?.toMillis?.() ?? null
    if (!created || !submitted) continue
    const diffMin = Math.max(0, Math.round((submitted - created) / 60000))
    mins.push(diffMin)
  }
  if (!mins.length) return { avg: null, p50: null, p90: null, buckets: {} }
  const sorted = mins.slice().sort((a, b) => a - b)
  const pick = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
  const buckets = { '<=10': 0, '10-30': 0, '30-60': 0, '>60': 0 }
  for (const m of mins) {
    if (m <= 10) buckets['<=10']++
    else if (m <= 30) buckets['10-30']++
    else if (m <= 60) buckets['30-60']++
    else buckets['>60']++
  }
  const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length)
  return { avg, p50: pick(50), p90: pick(90), buckets }
})

const improvement = computed(() => {
  const arr = scores.value
  if (arr.length < 4) return { trend: '—', delta: null }
  const last3 = arr.slice(0, 3)
  const prev3 = arr.slice(3, 6)
  const avg = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
  const d = avg(last3) - (prev3.length ? avg(prev3) : avg(last3))
  let trend = 'ทรงตัว'
  if (d >= 5) trend = 'ดีขึ้น'
  else if (d <= -5) trend = 'ลดลง'
  return { trend, delta: d }
})

// In-class percentile (for selected course)
const peerPercentile = ref(null)
async function computePercentileForCourse() {
  // Only teachers (viewing another student's portfolio) may compute cohort percentile
  peerPercentile.value = null
  if (!isTeacherMode.value) return
  const cid = courseFilter.value
  if (!cid || cid === 'all' || !studentId.value) return
  try {
    // Fetch all submissions for this course (teacher-of-course permitted)
    const all = await getSubmissionsByCourse(cid)
    const byStudent = new Map()
    for (const s of all) {
      const n = scoreFromRubric(s.feedback?.rubric_scores)
      const sid = s.studentId_ref
      if (!sid || typeof n !== 'number') continue
      if (!byStudent.has(sid)) byStudent.set(sid, [])
      byStudent.get(sid).push(n)
    }
    const arr = Array.from(byStudent.values())
      .map((xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null))
      .filter((n) => typeof n === 'number')
    const mine = avgScore.value
    if (arr.length && mine != null) {
      const below = arr.filter((n) => n <= mine).length
      peerPercentile.value = Math.round((below / arr.length) * 100)
    }
  } catch {
    // Silently ignore errors (e.g., permission issues) and keep percentile hidden
  }
}

// Helper: load submissions and related maps respecting role/course filter
async function loadDataForCourse(uid) {
  // Decide course scope
  const cid = isTeacherMode.value ? courseFilter.value : null
  // In teacher mode, do nothing until a valid course is selected to satisfy security rules
  if (isTeacherMode.value && (!cid || cid === 'all')) {
    submissions.value = []
    scenarios.value = {}
    missionMap.value = {}
    return
  }
  let subs = []
  try {
    subs = await getSubmissionsByStudent(uid, cid && cid !== 'all' ? cid : null)
  } catch (e) {
    // If a teacher queries without a course filter, security rules may block; keep empty
    subs = []
  }
  submissions.value = subs

  // load scenarios referenced
  const scIds = [...new Set(subs.map((s) => s.scenarioId_ref).filter(Boolean))]
  const scArr = await getScenariosByIds(scIds)
  const sMap = {}
  scArr.forEach((s) => (sMap[s.id] = s))
  scenarios.value = sMap

  // load courses for contextual subject (auth users can read courses)
  const cids = [...new Set(scArr.map((s) => s.courseId_ref).filter(Boolean))]
  const cMap = { ...(isTeacherMode.value ? coursesMap.value : {}) }
  for (const id of cids) {
    if (!cMap[id]) {
      const c = await getCourseById(id)
      if (c) cMap[id] = c
    }
  }
  coursesMap.value = cMap

  // load missions for difficulty chips (only for submissions that reference a mission)
  const mIds = [...new Set(subs.map((s) => s.missionId_ref).filter(Boolean))].slice(0, 30)
  const mMap = {}
  for (const id of mIds) {
    const m = await getMissionById(id)
    if (m) mMap[id] = m
  }
  missionMap.value = mMap
}

// Watch filters to recompute percentile automatically
watch([courseFilter, timeWindowDays, isTeacherMode], () => {
  if (!isTeacherMode.value) {
    peerPercentile.value = null
    return
  }
  computePercentileForCourse()
})

// -------- Compact Leaderboard logic --------
const miniTimeframe = ref('week') // 'week' | 'all'
const miniLeaderboard = ref([]) // [{uid,name,photoURL,bestScore,latestAt,level}]
const miniMyRank = ref(null)
const miniMyLevel = ref(null)
const miniMyAvg = ref(null)
const miniMyXp = ref(null)
const miniSort = ref('level')
const miniLimit = ref(5)
const miniCourseId = computed(() => {
  // pick selected course (student: derive from recent submissions if 'all')
  if (isTeacherMode.value)
    return courseFilter.value && courseFilter.value !== 'all' ? courseFilter.value : ''
  if (courseFilter.value && courseFilter.value !== 'all') return courseFilter.value
  // derive from latest submission
  const last = submissions.value[0]
  const sc = last ? scenarios.value[last.scenarioId_ref] : null
  return sc?.courseId_ref || ''
})

// XP bar visibility (shared preference key with main leaderboard for consistency)
const showXpBars = ref(true)
try {
  const sv = localStorage.getItem('lb:showXpBars')
  if (sv === '0') showXpBars.value = false
} catch {}

import { fetchCourseLeaderboard } from '@/services/leaderboardService'

async function loadMiniLeaderboard() {
  miniLeaderboard.value = []
  miniMyRank.value = null
  const cid = miniCourseId.value
  if (!cid) return
  try {
    const resp = await fetchCourseLeaderboard({
      courseId: cid,
      timeframe: miniTimeframe.value,
      limit: miniLimit.value,
      sortBy: miniSort.value,
    })
    miniLeaderboard.value = (resp?.top || []).map((t) => ({
      uid: t.uid || null,
      name: t.name || 'Student',
      photoURL: t.photoURL || '',
      bestScore: t.bestScore,
      latestAt: t.latestAt,
      level: t.level,
      avgScore: t.avgScore,
      xp: t.xp,
    }))
    miniMyRank.value = resp?.myRank || null
    miniMyLevel.value = resp?.myLevel || null
    miniMyAvg.value = resp?.myAvg || null
    miniMyXp.value = resp?.myXp || null
  } catch (_) {
    miniLeaderboard.value = []
    miniMyRank.value = null
    miniMyLevel.value = null
    miniMyAvg.value = null
    miniMyXp.value = null
  }
}
function setMiniTimeframe(tf) {
  if (tf !== 'week' && tf !== 'all') return
  miniTimeframe.value = tf
  loadMiniLeaderboard()
}

watch([miniCourseId, miniTimeframe, miniSort, miniLimit], () => {
  loadMiniLeaderboard()
})

watch(
  () => showXpBars.value,
  (v) => {
    try {
      localStorage.setItem('lb:showXpBars', v ? '1' : '0')
    } catch {}
  },
)

// Leader-relative XP percent (like main leaderboard)
const miniLeaderXp = computed(() => {
  if (!miniLeaderboard.value.length) return 0
  return Math.max(...miniLeaderboard.value.map((p) => p.xp || 0))
})
function miniXpPercent(p) {
  const lx = miniLeaderXp.value
  if (!lx) return 0
  return Math.min(100, Math.round(((p.xp || 0) / lx) * 100))
}

// ---------- Chart helpers ----------
const chartW = 640,
  chartH = 160
const seriesColors = ['#22c55e', '#6366f1', '#f97316']
const seriesPaths = computed(() => {
  const keys = skillKeys
  const maxX = Math.max(1, Math.max(...keys.map((k) => perSkillTrend.value[k].length)))
  const mkPath = (arr) => {
    if (!arr.length) return ''
    const pts = arr.map((v, i) => {
      const x = 40 + (i / Math.max(1, maxX - 1)) * 580
      const y = chartH - 30 - (Math.max(0, Math.min(100, v)) / 100) * (chartH - 40)
      return `${x},${y}`
    })
    return 'M ' + pts.map((p) => p.replace(',', ' ')).join(' L ')
  }
  return keys.map((k) => mkPath(perSkillTrend.value[k]))
})

// ---------- Export helpers ----------
function exportCSV() {
  const rows = [['date', 'course', 'skill', 'difficulty', 'score']]
  for (const s of filteredSubs.value) {
    const sc = scenarios.value[s.scenarioId_ref]
    const course = sc?.courseId_ref ? coursesMap.value[sc.courseId_ref]?.title || '' : ''
    const skill = sc?.skill_targeted || ''
    const difficulty = submissionDifficulty(s) || ''
    const score = numericScore(s)
    const date = new Date(s.submittedAt?.toMillis?.() ?? s.submittedAt).toISOString()
    rows.push([date, course, skill, difficulty, score ?? ''])
  }
  const csv = rows.map((r) => r.map((c) => (c == null ? '' : String(c))).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'portfolio.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function exportPNG() {
  try {
    const el = document.querySelector('.reveal')
    if (!el) return
    const scale = window.devicePixelRatio || 2
    const rect = el.getBoundingClientRect()
    const canvas = document.createElement('canvas')
    canvas.width = rect.width * scale
    canvas.height = rect.height * scale
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    // Very lightweight capture: draw SVG chart only (rest would need html2canvas)
    const svg = document.querySelector('svg')
    if (svg) {
      const xml = new XMLSerializer().serializeToString(svg)
      const img = new Image()
      const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)
        const link = document.createElement('a')
        link.download = 'portfolio.png'
        link.href = canvas.toDataURL('image/png')
        link.click()
      }
      img.src = url
    }
  } catch {}
}

const streak = computed(() => calcStreak(submissions.value))
const maxStreak = computed(() => calcMaxStreak(submissions.value))

function calcStreak(list) {
  if (!list.length) return 0
  const days = new Set(list.map((d) => toDay(d.submittedAt)))
  let d = toDay(new Date())
  let s = 0
  while (days.has(d)) {
    s++
    d = addDay(d, -1)
  }
  return s
}
function calcMaxStreak(list) {
  if (!list.length) return 0
  const days = [...new Set(list.map((d) => toDay(d.submittedAt)))].sort()
  let max = 1,
    cur = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]),
      now = new Date(days[i])
    if (now - prev === 86400000) cur++
    else {
      max = Math.max(max, cur)
      cur = 1
    }
  }
  return Math.max(max, cur)
}
function toDay(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
}
function addDay(iso, delta) {
  const d = new Date(iso)
  d.setDate(d.getDate() + delta)
  return d.toISOString()
}

function formatDate(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString()
}
function scenarioTitle(id) {
  return scenarios.value[id]?.scenario_title || '-'
}
function scenarioSkill(id) {
  return scenarios.value[id]?.skill_targeted || null
}

async function saveIdentity() {
  if (!studentId.value) return
  // Basic validation
  const name = String(editableProfile.name || '').trim()
  const code = String(editableProfile.studentCode || '').trim()
  const grade = String(editableProfile.gradeLevel || '').trim()
  const room = String(editableProfile.room || '').trim()
  const number = Number(editableProfile.number)
  const codeOk = /^\d{5}$/.test(code)
  if (!name) return alert('กรุณากรอกชื่อ-นามสกุล')
  if (!codeOk) return alert('กรุณากรอกรหัสนักเรียนให้ถูกต้อง (5 หลัก)')
  if (!grade) return alert('กรุณาเลือกระดับชั้น')
  if (!room) return alert('กรุณาเลือกห้อง')
  if (!Number.isFinite(number) || number <= 0) return alert('กรุณากรอกเลขที่ให้ถูกต้อง')

  await updateStudentProfile(studentId.value, { ...editableProfile, studentCode: code })
  // sync back
  profile.value = { ...profile.value, ...editableProfile, studentCode: code }
}
async function onPickStudentImage(e) {
  const file = e.target.files?.[0]
  if (!file || !studentId.value) return
  try {
    const url = await uploadUserImage(studentId.value, file, 'avatars')
    editableProfile.photoURL = url
    await updateStudentProfile(studentId.value, { photoURL: url })
  } catch (err) {
    console.error('Upload failed:', err)
    alert(
      'อัปโหลดรูปไม่สำเร็จ (อาจติด CORS). โปรดลองรีเฟรช และหากยังไม่หาย ดูขั้นตอนตั้งค่า CORS ใน Storage ผ่าน gsutil',
    )
  }
}
async function togglePin(s) {
  s.pinned = !s.pinned
  await updateSubmission(s.id, { pinned: s.pinned })
}
async function saveReflection(s) {
  await updateSubmission(s.id, { reflection: s.reflection || '' })
}

onMounted(async () => {
  const uid = studentIdParam || auth.currentUser?.uid
  if (!uid) return
  studentId.value = uid
  // Initial fetch; subscribe to live updates only for student self-view
  profile.value = await getStudentProfile(uid)
  if (!isTeacherMode.value) {
    const unsub = onStudentProfileSnapshot(uid, (p) => {
      if (p) profile.value = p
    })
    // optional: store unsub if needed to cleanup later
  }
  Object.assign(editableProfile, {
    name: profile.value.name && !String(profile.value.name).includes('@') ? profile.value.name : '',
    studentCode: profile.value.studentCode || '',
    gradeLevel: profile.value.gradeLevel || 'ม.1',
    room: profile.value.room || '1',
    number: profile.value.number || 1,
    section: profile.value.section || '',
    photoURL: profile.value.photoURL || '',
  })

  // Teacher view: preload teacher's courses and set a default filter
  if (isTeacherMode.value) {
    try {
      const myCourses = await getTeacherCourses(auth.currentUser?.uid)
      const cMapUI = {}
      for (const c of myCourses || []) cMapUI[c.id] = c
      coursesMap.value = cMapUI
      // Auto-select a course that actually has this student's work (best-effort)
      if (!courseFilter.value || courseFilter.value === 'all') {
        const ids = Object.keys(cMapUI)
        let picked = ''
        for (const id of ids) {
          try {
            const subs = await getSubmissionsByStudent(uid, id)
            if (subs && subs.length) {
              picked = id
              break
            }
          } catch (_) {}
        }
        // fallback to first course if none found
        courseFilter.value = picked || ids[0] || ''
      }
    } catch {}
  }

  await loadDataForCourse(uid)

  // focus via query param
  const f = route.query?.focus ? String(route.query.focus) : null
  if (f) {
    focusId.value = f
    await nextTick()
    const el = document.getElementById('sub-' + f)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
})

// When teacher switches course, refetch submissions and related data
watch(courseFilter, async (val, prev) => {
  if (!isTeacherMode.value) return
  if (!studentId.value) return
  await loadDataForCourse(studentId.value)
})

function timeOnTaskMinutes(s) {
  try {
    if (typeof s.time_on_task === 'number') return Math.round(s.time_on_task / 60000)
    const m = s.missionId_ref ? missionMap.value[s.missionId_ref] : null
    const created = m?.createdAt?.toMillis?.() ?? null
    const submitted = s.submittedAt?.toMillis?.() ?? null
    if (!created || !submitted) return null
    const diffMin = Math.max(0, Math.round((submitted - created) / 60000))
    return diffMin
  } catch {
    return null
  }
}

// Expose selected methods to parent (unified profile view)
defineExpose({ exportCSV, exportPNG })
</script>

<style scoped></style>
