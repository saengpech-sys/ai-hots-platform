// AI Prompt builder utilities (extracted for snapshot testing & reuse)

export function buildScenarioPrompt(context) {
  const standardsText =
    Array.isArray(context.standards) && context.standards.length
      ? context.standards.map((s, i) => `${i + 1}. ${s}`).join('\n    ')
      : null
  const indicatorsText =
    Array.isArray(context.indicators) && context.indicators.length
      ? context.indicators.map((s, i) => `${i + 1}. ${s}`).join('\n    ')
      : null
  const avoidTitles =
    Array.isArray(context.avoid_titles) && context.avoid_titles.length
      ? `\n  - หลีกเลี่ยงการซ้ำหัวข้อ/สถานการณ์ต่อไปนี้ (ห้ามใช้ชื่อเรื่อง/เค้าเรื่องเดิม):\n    ${context.avoid_titles
          .map((t, i) => `${i + 1}. ${t}`)
          .join('\n    ')}`
      : ''

  return `
  # บทบาท
  คุณคือ "AI นักออกแบบสถานการณ์เชิงวิเคราะห์" (AI Analytical Scenario Designer) ผู้เชี่ยวชาญในการสร้างโจทย์ปัญหาที่กระตุ้นการคิดเชิงวิพากษ์ในวิชา ${context.subject_area}

  # บริบท
  คุณกำลังสร้างสถานการณ์การเรียนรู้สำหรับนักเรียนชื่อ "${context.student_name}"
  - เป้าหมายการเรียนรู้: ฝึกฝนทักษะ "${context.target_skill}"
  - หัวข้อหลัก: "${context.main_topic}"
  - ข้อมูลพื้นฐานที่นักเรียนมี: นักเรียนมีความเข้าใจพื้นฐานเกี่ยวกับ ${context.prerequisite_knowledge} แล้ว
  ${standardsText ? `- มาตรฐานการเรียนรู้ (Standards):\n    ${standardsText}` : ''}
  ${indicatorsText ? `- ตัวชี้วัดผลลัพธ์ (Indicators):\n    ${indicatorsText}` : ''}
  ${avoidTitles}

  # หน้าที่
  จงสร้าง "กรณีศึกษา (Case Study)" หรือ "สถานการณ์ปัญหา (Problem Scenario)" ที่มีความยาวประมาณ 2-3 ย่อหน้า สถานการณ์ต้องมีความซับซ้อนพอที่จะไม่มีคำตอบที่ถูกผิดชัดเจน และต้องเปิดโอกาสให้นักเรียนได้ใช้ทักษะ "${context.target_skill}" เพื่อหาข้อสรุป พร้อมทั้งตั้ง "คำถามหลัก" ที่กระตุ้นให้เกิดการคิดต่อยอดจากสถานการณ์นั้น
  - เนื้อหาต้องมีความใหม่ หลีกเลี่ยงความซ้ำกับหัวข้อ/สถานการณ์ในรายการที่ให้ไว้ (ถ้ามี)
  - ใช้ภาษาไทยล้วน ชัดเจน กระชับ ภาษาเป็นธรรมชาติ เหมาะสำหรับนักเรียน
  - สร้างชื่อสถานการณ์สั้น กระชับ ไม่เกิน 60 ตัวอักษร และไม่ซ้ำกับรายการใน avoid_titles (ถ้ามี)

  # รูปแบบผลลัพธ์
  จงตอบกลับเป็นออบเจ็กต์ JSON เพียงอย่างเดียว (ห้ามใส่ Markdown/โค้ดบล็อก/backticks และห้ามข้อความอื่นนอกเหนือจาก JSON) โดยต้องมีคีย์ดังต่อไปนี้:
  - "scenario_title": (string) ชื่อสถานการณ์สั้นๆ (ภาษาไทย ไม่เกิน 60 ตัวอักษร ไม่ซ้ำกับรายการที่ให้ไว้)
  - "scenario_html": (string) เนื้อหาของสถานการณ์จำลองในรูปแบบ HTML (ภาษาไทย)
  - "core_question": (string) คำถามหลักที่ท้าทายให้นักเรียนต้องตอบโดยใช้ทักษะที่กำหนด (ภาษาไทย)
  - "skill_targeted": (string) ชื่อทักษะที่ต้องการฝึกฝน (จากบริบทที่ให้มา)
  `
}

export function buildAssessmentPrompt(context) {
  return `
    # บทบาท
    คุณคือ "AI ผู้ประเมินการคิดวิเคราะห์" (AI Critical Thinking Assessor) หน้าที่ของคุณคือการสร้างโจทย์ที่วัดความลุ่มลึกของกระบวนการคิด

    # บริบท
    คุณต้องสร้างโจทย์สำหรับประเมินการตอบสนองของนักเรียนต่อสถานการณ์ต่อไปนี้:
    - สถานการณ์: "${context.scenario_title}"
    - คำถามหลัก: "${context.core_question}"
    - ทักษะที่ต้องการวัดผล: "${context.skill_targeted}"

    # หน้าที่
    1.  จงแปลง "คำถามหลัก" ให้กลายเป็น "ภารกิจที่ต้องทำ" (Assessment Task) ที่ชัดเจน โดยระบุสิ่งที่นักเรียนต้องทำ (เช่น "จงเขียนบทวิเคราะห์...", "จงเสนอแนวทางแก้ไขปัญหา...")
    2.  จงสร้าง "เกณฑ์การประเมิน" (Evaluation Rubric) สำหรับภารกิจนี้ โดยกำหนดเกณฑ์ 3-4 ข้อที่สะท้อนถึงคุณภาพของการใช้ทักษะ "${context.skill_targeted}"
    - ใช้ภาษาไทยล้วน กระชับ ชัดเจน หลีกเลี่ยงศัพท์เทคนิคเกินจำเป็น

  # รูปแบบผลลัพธ์
  จงตอบกลับเป็นออบเจ็กต์ JSON เพียงอย่างเดียว (ห้าม Markdown/backticks/ข้อความเกิน) ที่มีคีย์ดังต่อไปนี้:
    - "assessment_task": (string) คำสั่งหรือภารกิจที่ชัดเจนสำหรับนักเรียน (ภาษาไทย)
    - "evaluation_rubric": (array of strings) รายการเกณฑ์ที่จะใช้ในการประเมินคำตอบของนักเรียน (ภาษาไทย) เช่น ["ความชัดเจนของจุดยืน", "การใช้เหตุผลและหลักฐานสนับสนุน", "การพิจารณาผลกระทบหลายมิติ"]
    `
}
