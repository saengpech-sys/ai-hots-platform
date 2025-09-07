// Thai labels and explanations for AI common_error_tag
export const ERROR_TAGS = {
  reasoning_gap: {
    th: 'ช่องว่างในกระบวนการให้เหตุผล',
    desc: 'เหตุผลยังขาดขั้นตอนเชื่อมโยงที่ทำให้ข้อสรุปน่าเชื่อถือ',
  },
  insufficient_evidence: {
    th: 'หลักฐานไม่เพียงพอ',
    desc: 'ยังยกตัวอย่าง/ข้อมูลสนับสนุนไม่ชัดหรือไม่ตรงประเด็น',
  },
  misunderstanding_question: {
    th: 'ตีความคำถามคลาดเคลื่อน',
    desc: 'ตอบไม่ตรงโจทย์หรือเข้าใจเงื่อนไขผิด',
  },
  logical_fallacy: {
    th: 'ตรรกะผิดพลาด',
    desc: 'มีช่องโหว่เชิงตรรกะ เช่น เหมารวมหรืออ้างเหตุผลวงกลม',
  },
  unclear_structure: {
    th: 'โครงสร้างไม่ชัดเจน',
    desc: 'ลำดับความคิดยังสับสน ทำให้จับประเด็นยาก',
  },
  superficial_analysis: {
    th: 'วิเคราะห์ผิวเผิน',
    desc: 'อธิบายกว้าง ๆ ไม่ลงลึกหลายมิติหรือผลกระทบ',
  },
  incorrect_fact: {
    th: 'ข้อมูลข้อเท็จจริงคลาดเคลื่อน',
    desc: 'มีข้อมูลผิดพลาดหรืออ้างอิงไม่ถูกต้อง',
  },
  none: {
    th: 'ไม่มีข้อผิดพลาดเด่นชัด',
    desc: 'คำตอบไม่มีประเด็นผิดพลาดชัดเจนในรายการนี้',
  },
}

export function errorTagLabelTh(tag) {
  return ERROR_TAGS[tag]?.th || tag
}

export function errorTagDescTh(tag) {
  return ERROR_TAGS[tag]?.desc || ''
}
