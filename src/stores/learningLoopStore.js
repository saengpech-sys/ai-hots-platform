import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as aiService from '@/services/aiService'
import { logAppEvent, logError } from '@/services/logService'
import { getAuthInstance } from '@/firebase/config'
import {
  saveScenario,
  saveAssessment,
  createSubmission,
  addXP,
  getCourseById,
  getStudentProfile,
  findUnansweredScenarioGeneral,
  getAssessmentByScenarioId,
  getScenarioById,
  getAssessmentById,
  getMissionById,
  createMission,
  getOldestActiveMissionForCourse,
  completeMission,
  listActiveMissionsForCourse,
  listCompletedMissionsForCourse,
  updateStudentProfile,
  listSubmissionsByMissionId,
  findScenarioByHashInCourse,
} from '@/services/firestoreService'

export const useLearningLoopStore = defineStore('learningLoop', () => {
  // --- STATE ---
  const status = ref('idle') // idle -> generating -> readyForTask -> evaluating -> showingFeedback -> error

  const currentScenario = ref(null)
  const currentAssessment = ref(null)
  const currentFeedback = ref(null)
  const currentMission = ref(null)
  const errorMessage = ref('')
  const MAX_ACTIVE_BACKLOG = 3 // ป้องกันค้างเยอะเกินไป
  const beginAt = ref(null) // ms timestamp when task shown to student

  // --- ACTIONS ---

  // HOTS skill options supported by the AI prompts
  const HOTS_SKILLS = [
    'การวิเคราะห์ (Analyzing)',
    'การประเมินค่า (Evaluating)',
    'การสร้างสรรค์ (Creating)',
  ]

  // Map profile keys to canonical labels used in prompts
  const skillNameMap = {
    การวิเคราะห์: 'การวิเคราะห์ (Analyzing)',
    การประเมินค่า: 'การประเมินค่า (Evaluating)',
    การสร้างสรรค์: 'การสร้างสรรค์ (Creating)',
  }

  async function pickTargetHotsSkill(course) {
    // 1) Candidate set: course.target_skills if provided, otherwise full list
    let candidates = HOTS_SKILLS
    if (Array.isArray(course?.target_skills) && course.target_skills.length) {
      candidates = course.target_skills
    }

    // Strategy: weakest (default) or random
    const strategy = (course?.skill_strategy || 'weakest').toLowerCase()

    // Random helper
    const pickRandom = () => candidates[Math.floor(Math.random() * candidates.length)]

    if (strategy === 'random') return pickRandom()

    // 2) Weakest-by-profile selection
    try {
      const authInst1 = await getAuthInstance()
      const uid = authInst1.currentUser?.uid
      if (uid) {
        const profile = await getStudentProfile(uid)
        const sp = profile?.skill_profile
        if (sp && typeof sp === 'object') {
          const ordered = Object.entries(sp)
            .filter(([k]) => skillNameMap[k])
            .sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0)) // lower value = weaker
          for (const [k] of ordered) {
            const mapped = skillNameMap[k]
            if (candidates.includes(mapped)) return mapped
          }
        }
      }
    } catch (e) {
      console.warn('pickTargetHotsSkill(): fallback to random due to error:', e)
    }

    // 3) Fallback
    return pickRandom()
  }

  async function startOrContinueLoop(options = {}) {
    try {
      status.value = 'generating'
      errorMessage.value = ''

      const { forceNew = false } = options
      // Try to reuse existing unanswered scenario (general)
      if (!forceNew) {
        const reuse = await findUnansweredScenarioGeneral().catch(() => null)
        if (reuse?.scenario && reuse?.assessment) {
          currentScenario.value = reuse.scenario
          currentAssessment.value = reuse.assessment
          status.value = 'readyForTask'
          return
        }
      }

      // Otherwise, choose HOTS skill dynamically (no course context)
      const targetSkill = await pickTargetHotsSkill(null)

      // Parallel generate scenario + assessment (generic loop start)
      const { scenario: scenarioResult, assessment: parallelAssessment } =
        await aiService.generateScenarioAndAssessment({
          subject_area: 'สังคมศึกษา',
          student_name: 'มานี',
          target_skill: targetSkill,
          main_topic: 'นโยบายสาธารณะ',
          prerequisite_knowledge: 'ความหมายของนโยบายสาธารณะและภาษี',
        })
      // ตรวจสอบผลลัพธ์ก่อนใช้งานต่อ
      if (!scenarioResult) throw new Error('AI failed to generate a scenario.')
      if (!scenarioResult.skill_targeted) scenarioResult.skill_targeted = targetSkill
      // Ensure scenario_title exists and is short
      scenarioResult.scenario_title = ensureScenarioTitle(
        scenarioResult.scenario_title,
        scenarioResult.core_question,
      )
      // Compute content hash early for dedupe across sessions
      scenarioResult.content_hash = await computeContentHash(
        scenarioResult.scenario_title,
        scenarioResult.core_question,
      )
      currentScenario.value = { ...scenarioResult, course_settings: { block_paste: true } }

      // Persist scenario to Firestore (only if authenticated)
      const authInst2 = await getAuthInstance()
      if (authInst2.currentUser?.uid) {
        try {
          const scenarioId = await saveScenario({
            ...scenarioResult,
            course_settings: { block_paste: true },
          })
          currentScenario.value._id = scenarioId
        } catch (e) {
          const msg = String(e?.message || e || '')
          if (!msg.includes('Missing or insufficient permissions')) {
            console.warn('Failed to save scenario (non-blocking):', msg)
          }
        }
      }

      const assessmentResult = parallelAssessment
      // ตรวจสอบผลลัพธ์ก่อนใช้งานต่อ
      if (!assessmentResult) throw new Error('AI failed to generate an assessment.')
      currentAssessment.value = assessmentResult

      // Persist assessment linked to scenario (only if authenticated)
      const authInst3 = await getAuthInstance()
      if (authInst3.currentUser?.uid && currentScenario.value?._id) {
        try {
          const assessId = await saveAssessment(assessmentResult, currentScenario.value._id)
          currentAssessment.value._id = assessId
        } catch (e) {
          const msg = String(e?.message || e || '')
          if (!msg.includes('Missing or insufficient permissions')) {
            console.warn('Failed to save assessment (non-blocking):', msg)
          }
        }
      }

      status.value = 'readyForTask'
    } catch (error) {
      console.error('Error in learning loop:', error.message)
      status.value = 'error'
      errorMessage.value = error.message
    }
  }

  // Start by a specific mission id (continue an assigned mission)
  async function startLoopWithMission(missionId) {
    try {
      status.value = 'generating'
      errorMessage.value = ''
      if (!missionId) throw new Error('missing mission id')
      const mission = await getMissionById(missionId)
      if (!mission) throw new Error('ไม่พบภารกิจ')
      currentMission.value = mission
      const scenario = await getScenarioById(mission.scenarioId_ref)
      const assessment = mission.assessmentId_ref
        ? await getAssessmentById(mission.assessmentId_ref)
        : await getAssessmentByScenarioId(mission.scenarioId_ref)
      if (!scenario || !assessment) throw new Error('ไม่พบข้อมูลภารกิจ')
      currentScenario.value = { ...scenario, _id: scenario.id }
      currentAssessment.value = { ...assessment, _id: assessment.id }
      status.value = 'readyForTask'
    } catch (e) {
      console.error('startLoopWithMission failed:', e?.message || e)
      status.value = 'error'
      errorMessage.value = e?.message || 'เริ่มภารกิจไม่สำเร็จ'
    }
  }

  async function submitAndEvaluate(studentAnswer, options = {}) {
    try {
      status.value = 'evaluating'
      errorMessage.value = ''
      const isRevision = options?.isRevision === true

      const feedbackResult = await aiService.evaluateSubmission({
        assessment_task:
          currentAssessment.value.assessment_task || currentAssessment.value.task_description,
        evaluation_rubric_array: currentAssessment.value.evaluation_rubric,
        student_free_text_answer: studentAnswer,
      })
      // ตรวจสอบผลลัพธ์ก่อนใช้งานต่อ
      if (!feedbackResult) throw new Error('AI failed to evaluate the submission.')
      currentFeedback.value = feedbackResult

      // Persist submission and optionally award XP (skip on revision)
      try {
        const authInst4 = await getAuthInstance()
        if (authInst4.currentUser?.uid) {
          // Determine attempt number for this mission
          let attempt_number = 1
          try {
            if (currentMission.value?.id) {
              const prev = await listSubmissionsByMissionId(currentMission.value.id)
              attempt_number = (prev?.length || 0) + 1
            }
          } catch (_) {}

          const submissionId = await createSubmission({
            scenarioId_ref: currentScenario.value?._id || null,
            assessmentId_ref: currentAssessment.value?._id || null,
            courseId_ref: currentScenario.value?.courseId_ref || null,
            missionId_ref: currentMission.value?.id || null,
            attempt_number,
            // Keep targeted skill on submission for analytics fallbacks
            skill_targeted:
              currentMission.value?.skill_targeted || currentScenario.value?.skill_targeted || null,
            // Legacy alias some views may look for
            scenarioSkill:
              currentMission.value?.skill_targeted || currentScenario.value?.skill_targeted || null,
            // Time on task metrics from the view (ms), fallback to mission timestamps if missing
            beginAtClient: beginAt.value || null,
            time_on_task: computeTimeOnTaskMillis(),
            studentAnswer,
            feedback: feedbackResult,
            meta_revision: isRevision === true,
          })
          currentFeedback.value._submissionId = submissionId
          if (!isRevision && currentMission.value?.id) {
            const numericScore = computeNumericScore(feedbackResult?.rubric_scores)
            await completeMission(currentMission.value.id, {
              submissionId_ref: submissionId,
              scoreSummary: numericScore,
            })
            // Pre-create next mission in background for continuous learning
            const nextCourseId =
              currentMission.value.courseId_ref || currentScenario.value?.courseId_ref
            if (nextCourseId) ensureNextMission(nextCourseId).catch(() => {})

            // Update student's skill profile adaptively (non-blocking)
            try {
              const authLocal = await getAuthInstance()
              const uid = authLocal.currentUser?.uid
              const targeted =
                currentMission.value?.skill_targeted || currentScenario.value?.skill_targeted
              if (uid && targeted && typeof numericScore === 'number') {
                await adaptStudentSkillProfile(uid, targeted, numericScore)
              }
            } catch (_) {}
          }
        }
      } catch (e) {
        const msg = String(e?.message || e || '')
        if (!msg.includes('Missing or insufficient permissions')) {
          console.warn('Failed to save submission (non-blocking):', msg)
        }
      }

      // Award XP based on rubric scores if logged in (skip for revision attempts)
      if (!isRevision) {
        const authXP = await getAuthInstance()
        const user = authXP.currentUser
        if (user && feedbackResult?.rubric_scores) {
          const xpEarned = computeXpFromRubric(feedbackResult.rubric_scores)
          try {
            await addXP(user.uid, xpEarned)
          } catch (e) {
            const msg = String(e?.message || e || '')
            if (!msg.includes('Missing or insufficient permissions')) {
              console.warn('Failed to add XP (non-blocking):', msg)
            }
          }
        }
      }

      status.value = 'showingFeedback'
    } catch (error) {
      console.error('Error during evaluation:', error.message)
      status.value = 'error'
      errorMessage.value = error.message
    }
  }

  // Create one additional mission for the course if backlog is below cap
  async function ensureNextMission(courseId) {
    try {
      const authEns = await getAuthInstance()
      const uid = authEns.currentUser?.uid
      if (!uid) return
      const active = await listActiveMissionsForCourse(uid, courseId)
      if (active.length >= MAX_ACTIVE_BACKLOG) return

      const course = await getCourseById(courseId)
      if (!course) return
      const targetSkill = await pickTargetHotsSkill(course)

      // Build avoid list from recent active mission titles to reduce duplicates
      const recentTitles = active
        .slice(-5)
        .map((m) => m?.scenario?.scenario_title || m?.scenario?.title || m?.title || null)
        .filter(Boolean)

      const { scenario: scenarioResult, assessment: assessmentResult } =
        await aiService.generateScenarioAndAssessment({
          subject_area: course.subject_area,
          student_name:
            (await getAuthInstance()).currentUser?.displayName ||
            (await getAuthInstance()).currentUser?.email ||
            'นักเรียน',
          target_skill: targetSkill,
          main_topic: course.main_topic,
          prerequisite_knowledge: course.prerequisite_knowledge || '—',
          standards: Array.isArray(course.standards) ? course.standards : [],
          indicators: Array.isArray(course.indicators) ? course.indicators : [],
          courseId_ref: course.id,
          avoid_titles: recentTitles,
        })
      if (!scenarioResult) return
      if (!scenarioResult.skill_targeted) scenarioResult.skill_targeted = targetSkill
      // Ensure scenario_title exists and is short
      scenarioResult.scenario_title = ensureScenarioTitle(
        scenarioResult.scenario_title,
        scenarioResult.core_question,
      )
      // Simple dedupe via hash of canonical content (title + core_question)
      scenarioResult.content_hash = await computeContentHash(
        scenarioResult.scenario_title,
        scenarioResult.core_question,
      )

      const scenarioId = await saveScenario({
        ...scenarioResult,
        courseId_ref: course.id,
        course_settings: {
          enable_random_button: course.enable_random_button !== false,
          // stricter defaults (can be relaxed per course)
          block_paste: course.block_paste !== false,
          min_time_sec: Number(course.min_time_sec ?? 90),
          min_length_chars: Number(course.min_length_chars ?? 300),
          min_typing_ratio: Number(course.min_typing_ratio ?? 0.5),
          require_stepwise: course.require_stepwise ?? true,
          standards: course.standards || [],
          indicators: course.indicators || [],
        },
      })

      // assessmentResult already generated in parallel above
      if (!assessmentResult) return
      const assessId = await saveAssessment(
        {
          ...assessmentResult,
          courseId_ref: course.id,
          course_settings: {
            enable_random_button: course.enable_random_button !== false,
            block_paste: course.block_paste !== false,
            min_time_sec: Number(course.min_time_sec ?? 90),
            min_length_chars: Number(course.min_length_chars ?? 300),
            min_typing_ratio: Number(course.min_typing_ratio ?? 0.5),
            require_stepwise: course.require_stepwise ?? true,
            standards: course.standards || [],
            indicators: course.indicators || [],
          },
        },
        scenarioId,
      )

      const difficulty = await computeAdaptiveDifficulty(uid, course.id)

      await createMission({
        courseId: course.id,
        studentId: uid,
        scenarioId,
        assessmentId: assessId,
        skill_targeted: targetSkill,
        difficulty,
        meta: {
          standards: course.standards || [],
          indicators: course.indicators || [],
          strategy: course.skill_strategy || 'weakest',
          generatorVersion: 'v1',
        },
      })
    } catch (e) {
      console.warn('ensureNextMission failed:', e?.message || e)
    }
  }

  // New: Start loop using a selected course
  async function startLoopForCourse(courseId, options = {}) {
    try {
      logAppEvent({ event: 'loop.start', level: 'info', courseId, data: { options } })
      status.value = 'generating'
      errorMessage.value = ''
      const course = await getCourseById(courseId)
      if (!course) throw new Error('ไม่พบรายวิชา')

      const { forceNew = false } = options
      // Try to reuse oldest active mission for this course
      const authCheck1 = await getAuthInstance()
      if (!forceNew && authCheck1.currentUser?.uid) {
        const mission = await getOldestActiveMissionForCourse(authCheck1.currentUser.uid, course.id)
        if (mission) {
          currentMission.value = mission
          const scenario = await getScenarioById(mission.scenarioId_ref)
          const assessment = mission.assessmentId_ref
            ? await getAssessmentById(mission.assessmentId_ref)
            : await getAssessmentByScenarioId(mission.scenarioId_ref)
          if (!scenario || !assessment) throw new Error('ไม่พบข้อมูลภารกิจเดิม')
          currentScenario.value = { ...scenario, _id: scenario.id }
          currentAssessment.value = { ...assessment, _id: assessment.id }
          logAppEvent({
            event: 'loop.reuse.activeMission',
            level: 'info',
            courseId,
            missionId: mission.id,
            scenarioId: scenario.id,
            assessmentId: assessment.id,
          })
          status.value = 'readyForTask'
          return
        }
      }

      // If no active mission, try to reuse scenario with anti-collusion constraint first
      const authCheck2 = await getAuthInstance()
      if (!forceNew && authCheck2.currentUser?.uid) {
        const { findReusableScenarioAntiCollusion } = await import('@/services/firestoreService')
        const cooldownMin = Number(course.reuse_cooldown_min ?? 5) // default 5 minutes
        const minAgeMs = Math.max(0, Math.round(cooldownMin)) * 60 * 1000
        const reuseSafe = await findReusableScenarioAntiCollusion(
          course.id,
          authCheck2.currentUser.uid,
          minAgeMs,
        ).catch(() => null)
        if (reuseSafe?.scenario && reuseSafe?.assessment) {
          currentScenario.value = { ...reuseSafe.scenario, _id: reuseSafe.scenario.id }
          currentAssessment.value = { ...reuseSafe.assessment, _id: reuseSafe.assessment.id }
          try {
            const difficulty = await computeAdaptiveDifficulty(
              authCheck2.currentUser.uid,
              course.id,
            )
            const missionId = await createMission({
              courseId: course.id,
              studentId: authCheck2.currentUser.uid,
              scenarioId: reuseSafe.scenario.id,
              assessmentId: reuseSafe.assessment.id,
              skill_targeted:
                reuseSafe.scenario.skill_targeted ||
                reuseSafe.assessment.skill_targeted ||
                'วิเคราะห์',
              difficulty,
              meta: { reused: true, anti_collusion: true, generatorVersion: 'v1' },
            })
            currentMission.value = {
              id: missionId,
              courseId_ref: course.id,
              scenarioId_ref: reuseSafe.scenario.id,
              assessmentId_ref: reuseSafe.assessment.id,
              skill_targeted:
                reuseSafe.scenario.skill_targeted ||
                reuseSafe.assessment.skill_targeted ||
                'วิเคราะห์',
              status: 'assigned',
              active: true,
            }
            logAppEvent({
              event: 'loop.reuse.scenario.safe',
              level: 'info',
              courseId,
              missionId,
              scenarioId: reuseSafe.scenario.id,
              assessmentId: reuseSafe.assessment.id,
            })
          } catch (_) {}
          status.value = 'readyForTask'
          return
        }
      }

      // Next, try to reuse any existing unused scenario in the course (legacy behavior)
      if (!forceNew) {
        const reuse = await findUnansweredScenarioForCourse(course.id)
        if (reuse?.scenario && reuse?.assessment) {
          currentScenario.value = { ...reuse.scenario, _id: reuse.scenario.id }
          currentAssessment.value = { ...reuse.assessment, _id: reuse.assessment.id }
          // Link mission for this student
          try {
            const authCheck3 = await getAuthInstance()
            if (authCheck3.currentUser?.uid) {
              const difficulty = await computeAdaptiveDifficulty(
                authCheck3.currentUser.uid,
                course.id,
              )
              const missionId = await createMission({
                courseId: course.id,
                studentId: authCheck3.currentUser.uid,
                scenarioId: reuse.scenario.id,
                assessmentId: reuse.assessment.id,
                skill_targeted:
                  reuse.scenario.skill_targeted || reuse.assessment.skill_targeted || 'วิเคราะห์',
                difficulty,
                meta: {
                  reused: true,
                  generatorVersion: 'v1',
                },
              })
              currentMission.value = {
                id: missionId,
                courseId_ref: course.id,
                scenarioId_ref: reuse.scenario.id,
                assessmentId_ref: reuse.assessment.id,
                skill_targeted:
                  reuse.scenario.skill_targeted || reuse.assessment.skill_targeted || 'วิเคราะห์',
                status: 'assigned',
                active: true,
              }
              logAppEvent({
                event: 'loop.reuse.scenario',
                level: 'info',
                courseId,
                missionId,
                scenarioId: reuse.scenario.id,
                assessmentId: reuse.assessment.id,
              })
            }
          } catch (_) {}
          status.value = 'readyForTask'
          return
        }
      }

      const targetSkill = await pickTargetHotsSkill(course)

      // Build avoid list from current active missions for this course (if any)
      let avoid_titles = []
      try {
        const authAvoid = await getAuthInstance()
        if (authAvoid.currentUser?.uid) {
          const active = await listActiveMissionsForCourse(authAvoid.currentUser.uid, course.id)
          avoid_titles = active
            .slice(-5)
            .map((m) => m?.scenario?.scenario_title || m?.scenario?.title || m?.title || null)
            .filter(Boolean)
        }
      } catch {}

      const authGen = await getAuthInstance()
      const { scenario: scenarioResult, assessment: assessmentResult } =
        await aiService.generateScenarioAndAssessment({
          subject_area: course.subject_area,
          student_name:
            authGen.currentUser?.displayName || authGen.currentUser?.email || 'นักเรียน',
          target_skill: targetSkill,
          main_topic: course.main_topic,
          prerequisite_knowledge: course.prerequisite_knowledge || '—',
          standards: Array.isArray(course.standards) ? course.standards : [],
          indicators: Array.isArray(course.indicators) ? course.indicators : [],
          courseId_ref: course.id,
          avoid_titles,
        })
      if (!scenarioResult) throw new Error('AI failed to generate a scenario.')
      logAppEvent({
        event: 'loop.generate.scenario.success',
        level: 'info',
        courseId,
        data: { title: scenarioResult.scenario_title },
      })
      if (!scenarioResult.skill_targeted) scenarioResult.skill_targeted = targetSkill
      // Compute content hash and avoid duplicates per course (best-effort)
      try {
        const canonical = `${scenarioResult.scenario_title || ''}\n${scenarioResult.core_question || ''}`
        const enc = new TextEncoder().encode(canonical)
        let hex = null
        if (window?.crypto?.subtle) {
          const buf = await window.crypto.subtle.digest('SHA-256', enc)
          hex = Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
        } else {
          // simple fallback hash
          let h = 0
          for (let i = 0; i < canonical.length; i++) h = (h * 31 + canonical.charCodeAt(i)) | 0
          hex = String(h >>> 0)
        }
        if (hex) {
          const dup = await findScenarioByHashInCourse(course.id, hex)
          if (dup) {
            // Try once more to regenerate a different scenario by adding more avoid_titles
            const retry = await aiService.generateScenario({
              subject_area: course.subject_area,
              student_name: auth.currentUser?.displayName || auth.currentUser?.email || 'นักเรียน',
              target_skill: targetSkill,
              main_topic: course.main_topic,
              prerequisite_knowledge: course.prerequisite_knowledge || '—',
              standards: Array.isArray(course.standards) ? course.standards : [],
              indicators: Array.isArray(course.indicators) ? course.indicators : [],
              courseId_ref: course.id,
              avoid_titles: [...(avoid_titles || []), scenarioResult.scenario_title].slice(-8),
            })
            if (retry) {
              scenarioResult.scenario_title = retry.scenario_title
              scenarioResult.scenario_html = retry.scenario_html
              scenarioResult.core_question = retry.core_question
            }
          }
          scenarioResult.content_hash = hex
        }
      } catch {}
      currentScenario.value = scenarioResult

      // Parallelize: save scenario while generating assessment
      let scenarioId = null
      const saveScenarioPromise = auth.currentUser?.uid
        ? (async () => {
            try {
              const id = await saveScenario({
                ...scenarioResult,
                courseId_ref: course.id,
                course_settings: {
                  enable_random_button: course.enable_random_button !== false,
                  block_paste: course.block_paste !== false,
                  min_time_sec: Number(course.min_time_sec ?? 90),
                  min_length_chars: Number(course.min_length_chars ?? 300),
                  min_typing_ratio: Number(course.min_typing_ratio ?? 0.5),
                  require_stepwise: course.require_stepwise ?? true,
                  standards: course.standards || [],
                  indicators: course.indicators || [],
                },
              })
              scenarioId = id
              currentScenario.value._id = id
              logAppEvent({ event: 'loop.save.scenario', level: 'info', courseId, scenarioId: id })
              currentScenario.value.course_settings = {
                enable_random_button: course.enable_random_button !== false,
                block_paste: course.block_paste !== false,
                min_time_sec: Number(course.min_time_sec ?? 90),
                min_length_chars: Number(course.min_length_chars ?? 300),
                min_typing_ratio: Number(course.min_typing_ratio ?? 0.5),
                require_stepwise: course.require_stepwise ?? true,
                standards: course.standards || [],
                indicators: course.indicators || [],
              }
            } catch (e) {
              const msg = String(e?.message || e || '')
              if (!msg.includes('Missing or insufficient permissions')) {
                console.warn('Failed to save scenario (non-blocking):', msg)
              }
            }
          })()
        : Promise.resolve()

      if (!assessmentResult) throw new Error('AI failed to generate an assessment.')
      currentAssessment.value = assessmentResult

      if (saveScenarioPromise) await saveScenarioPromise

      try {
        if (currentScenario.value?._id) {
          const assessId = await saveAssessment(
            {
              ...assessmentResult,
              courseId_ref: course.id,
              course_settings: {
                enable_random_button: course.enable_random_button !== false,
                block_paste: course.block_paste !== false,
                min_time_sec: Number(course.min_time_sec ?? 90),
                min_length_chars: Number(course.min_length_chars ?? 300),
                min_typing_ratio: Number(course.min_typing_ratio ?? 0.5),
                require_stepwise: course.require_stepwise ?? true,
                standards: course.standards || [],
                indicators: course.indicators || [],
              },
            },
            currentScenario.value._id,
          )
          currentAssessment.value._id = assessId
          logAppEvent({
            event: 'loop.save.assessment',
            level: 'info',
            courseId,
            scenarioId: currentScenario.value._id,
            assessmentId: assessId,
          })
        }
      } catch (e) {
        const msg = String(e?.message || e || '')
        if (!msg.includes('Missing or insufficient permissions')) {
          console.warn('Failed to save assessment (non-blocking):', msg)
        }
        logError('loop.save.assessment.fail', msg, {
          courseId,
          scenarioId: currentScenario.value?._id,
        })
      }

      // Create a mission linking scenario + assessment
      try {
        if (auth.currentUser?.uid && currentScenario.value?._id && currentAssessment.value?._id) {
          const difficulty = await computeAdaptiveDifficulty(auth.currentUser.uid, course.id)
          const missionId = await createMission({
            courseId: course.id,
            studentId: auth.currentUser.uid,
            scenarioId: currentScenario.value._id,
            assessmentId: currentAssessment.value._id,
            skill_targeted: targetSkill,
            difficulty,
            meta: {
              standards: course.standards || [],
              indicators: course.indicators || [],
              strategy: course.skill_strategy || 'weakest',
              generatorVersion: 'v1',
            },
          })
          currentMission.value = {
            id: missionId,
            courseId_ref: course.id,
            scenarioId_ref: currentScenario.value._id,
            assessmentId_ref: currentAssessment.value._id,
            skill_targeted: targetSkill,
            status: 'assigned',
            active: true,
          }
          logAppEvent({
            event: 'loop.create.mission',
            level: 'info',
            courseId,
            missionId,
            scenarioId: currentScenario.value._id,
            assessmentId: currentAssessment.value._id,
          })
        }
      } catch (e) {
        console.warn('Failed to create mission (non-blocking):', e?.message || e)
        logError('loop.create.mission.fail', e?.message || String(e), {
          courseId,
          scenarioId: currentScenario.value?._id,
          assessmentId: currentAssessment.value?._id,
        })
      }

      status.value = 'readyForTask'
    } catch (error) {
      console.error('Error in learning loop for course:', error.message)
      status.value = 'error'
      errorMessage.value = error.message
    }
  }

  // --- Helpers ---
  function ensureScenarioTitle(title, core) {
    let t = String(title || '').trim()
    if (!t && core) {
      // Derive from first sentence of core question
      t = String(core)
        .split(/\.|\?|!|\n/)[0]
        .trim()
    }
    if (!t) t = 'สถานการณ์'
    if (t.length > 60) t = t.slice(0, 57).trim() + '…'
    return t
  }

  async function computeContentHash(title, core) {
    try {
      const canonical = `${title || ''}\n${core || ''}`
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    } catch (_) {
      return null
    }
  }

  // ---------- Adaptive helpers ----------
  async function computeAdaptiveDifficulty(studentId, courseId) {
    try {
      const recent = await listCompletedMissionsForCourse(studentId, courseId, 3)
      const scores = (recent || [])
        .map((m) => (typeof m.scoreSummary === 'number' ? m.scoreSummary : null))
        .filter((n) => typeof n === 'number')
        .slice(0, 3)
      if (!scores.length) return 'normal'
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      if (avg < 50) return 'easy'
      if (avg > 85) return 'hard'
      return 'normal'
    } catch {
      return 'normal'
    }
  }

  const canonicalToProfile = {
    'การวิเคราะห์ (Analyzing)': 'การวิเคราะห์',
    'การประเมินค่า (Evaluating)': 'การประเมินค่า',
    'การสร้างสรรค์ (Creating)': 'การสร้างสรรค์',
  }

  async function adaptStudentSkillProfile(studentId, canonicalSkill, numericScore) {
    try {
      const profile = await getStudentProfile(studentId)
      const key = canonicalToProfile[canonicalSkill] || canonicalSkill?.replace(/\s*\(.+\)$/, '')
      if (!key) return
      const current = Number(profile?.skill_profile?.[key] ?? 5)
      let delta = 0
      if (numericScore >= 85) delta = 1
      else if (numericScore < 50) delta = -1
      // Unlimited upper bound; keep minimum at 1
      const next = Math.max(1, Math.round(current + delta))
      const nextProfile = {
        ...(profile?.skill_profile || {}),
        [key]: next,
      }
      await updateStudentProfile(studentId, { skill_profile: nextProfile })
    } catch (_) {}
  }

  function computeXpFromRubric(rubricScores) {
    // Map rubric labels to numeric weights
    const weight = { ดีเยี่ยม: 30, ดี: 20, พอใช้: 10, ต้องปรับปรุง: 5 }
    let total = 0
    for (const key in rubricScores) {
      const label = rubricScores[key]
      total += weight[label] || 0
    }
    // Add a small bonus when many criteria exist
    const criteriaCount = Object.keys(rubricScores).length
    if (criteriaCount >= 4) total += 10
    return total
  }

  // Convert rubric labels to percentage score 0..100
  function computeNumericScore(rubricScores) {
    const weight = { ดีเยี่ยม: 4, ดี: 3, พอใช้: 2, ต้องปรับปรุง: 1 }
    const values = Object.values(rubricScores || {})
    if (!values.length) return null
    const sum = values.reduce((a, l) => a + (weight[l] || 0), 0)
    return Math.round((sum / (values.length * 4)) * 100)
  }

  function computeTimeOnTaskMillis() {
    try {
      const now = Date.now()
      const start = Number(beginAt.value || 0)
      if (!start || now < start) return null
      // clamp to 3 hours to avoid runaway values
      const diff = Math.min(3 * 60 * 60 * 1000, now - start)
      return diff
    } catch {
      return null
    }
  }

  return {
    status,
    currentScenario,
    currentAssessment,
    currentFeedback,
    currentMission,
    errorMessage,
    beginAt,
    startOrContinueLoop,
    submitAndEvaluate,
    startLoopForCourse,
    startLoopWithMission,
    // internal helpers (optionally exposed)
    computeXpFromRubric,
    computeNumericScore,
    computeTimeOnTaskMillis,
  }
})
