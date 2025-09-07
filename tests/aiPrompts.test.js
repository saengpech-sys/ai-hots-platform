import { describe, it, expect } from 'vitest'
import { buildScenarioPrompt, buildAssessmentPrompt } from '@/utils/aiPrompts'

describe('aiPrompts', () => {
  it('scenario prompt snapshot', () => {
    const prompt = buildScenarioPrompt({
      standards: ['STD1', 'STD2'],
      indicators: ['IND1'],
      avoid_titles: ['A', 'B'],
      subject_area: 'คณิตศาสตร์',
      student_name: 'นักเรียนตัวอย่าง',
      target_skill: 'การวิเคราะห์',
      main_topic: 'เศษส่วน',
      prerequisite_knowledge: 'พื้นฐานเศษส่วน',
    })
    expect(prompt).toMatchSnapshot()
  })

  it('assessment prompt snapshot', () => {
    const prompt = buildAssessmentPrompt({
      scenario_title: 'สถานการณ์ทดลอง',
      core_question: 'เพราะเหตุใด...',
      skill_targeted: 'การประเมินค่า',
    })
    expect(prompt).toMatchSnapshot()
  })
})
