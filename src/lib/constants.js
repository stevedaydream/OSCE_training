/**
 * 領域常數。所有數字都直接對應《專科護理師甄審口試流程及評分方式公告》，
 * 每一條都附上出處，日後有人想改數字時看得到依據。
 */

/**
 * 分科的時間規則分兩組，這是原始計畫最大的錯誤來源：
 * 公告一（內科、精神科、兒科、外科、婦產科）與公告二（麻醉科）的 15 分鐘意義不同。
 */
export const TIMING_RULES = {
  general: {
    readingSeconds: 120,
    examSeconds: 900,
    alertSeconds: 120,
    total: 1020,
    label: '門前閱讀 2 分鐘（不計入）＋ 考間口試 15 分鐘',
    basis:
      '公告一、(二)：應考人於進入詢答區之檢查室前 2 分鐘，應詳細閱讀檢查室門前所提供之病人基本資料與主訴；' +
      '公告一、(四)：每一應考人時間為 15 分鐘。門前 2 分鐘不含在這 15 分鐘內。',
  },
  anesthesia: {
    readingSeconds: 120,
    examSeconds: 780,
    alertSeconds: 120,
    total: 900,
    label: '15 分鐘含考間外讀題 2 分鐘 ＋ 考間口試 13 分鐘',
    basis:
      '公告二、(四)：每一應考人時間為 15 分鐘（含考間外讀題 2 分鐘，進入考間口試 13 分鐘）。' +
      '這是麻醉科獨有的算法，不適用於其他分科。',
  },
};

export const DEPARTMENTS = [
  { id: 'surgical', name: '外科', rule: 'general' },
  { id: 'internal', name: '內科', rule: 'general' },
  { id: 'pediatric', name: '兒科', rule: 'general' },
  { id: 'obgyn', name: '婦產科', rule: 'general' },
  { id: 'psychiatric', name: '精神科', rule: 'general' },
  // 家庭科為現行分科之一，但 110 年度公告條文未列入，時間比照公告一那一組。
  { id: 'family', name: '家庭科', rule: 'general' },
  { id: 'anesthesia', name: '麻醉科', rule: 'anesthesia' },
];

export const DEPARTMENT_NAME = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.id, d.name]),
);

export function timingRuleFor(departmentId) {
  const dept = DEPARTMENTS.find((d) => d.id === departmentId);
  return TIMING_RULES[dept?.rule ?? 'general'];
}

/**
 * 通用骨架檢核項：不隨題目改變，因此可以跨場次累積成「反覆漏掉」排行榜。
 * 四個大分類直接取自公告一、(一)：以病人為中心之評估、病史詢問、臨床推理與決策、溝通。
 * 「說做合一」三要素則取自公告一、(三) 的明文要求。
 */
export const CORE_CHECKLIST = [
  { key: 'hx_intro', category: '病史詢問', label: '自我介紹並確認病人身分' },
  { key: 'hx_chief', category: '病史詢問', label: '確認並複述主訴' },
  {
    key: 'hx_lqqopera',
    category: '病史詢問',
    label: '以 LQQOPERA 架構詢問症狀',
    hint: '部位、性質、程度、時序、誘發因子、緩解因子、相關症狀、伴隨表現，至少涵蓋五項才算達成',
  },
  { key: 'hx_meds', category: '病史詢問', label: '詢問用藥史與過敏史' },
  { key: 'hx_past', category: '病史詢問', label: '詢問過去病史與手術史' },
  { key: 'hx_social', category: '病史詢問', label: '詢問個人史與家族史' },

  {
    key: 'pe_purpose',
    category: '身體評估（說做合一）',
    label: '執行檢查時說明檢查「目的」',
    hint: '公告明文要求。每一項檢查都要說，只在第一項說不算全程達成',
  },
  {
    key: 'pe_item',
    category: '身體評估（說做合一）',
    label: '執行檢查時說明檢查「項目」',
    hint: '公告明文要求',
  },
  {
    key: 'pe_site',
    category: '身體評估（說做合一）',
    label: '執行檢查時說明檢查「部位」',
    hint: '公告明文要求。這是三要素中最常被漏掉的一項',
  },
  { key: 'pe_consent', category: '身體評估（說做合一）', label: '檢查前徵得同意並顧及隱私' },

  { key: 'cr_problem', category: '臨床推理與決策', label: '向口試委員說明病人可能的健康問題' },
  { key: 'cr_reason', category: '臨床推理與決策', label: '說明推論該健康問題的理由與依據' },
  { key: 'cr_redflag', category: '臨床推理與決策', label: '指出需要警覺的危險徵象' },
  { key: 'cr_plan', category: '臨床推理與決策', label: '提出下一步處置計畫' },

  { key: 'cm_explain', category: '溝通', label: '向病人解釋評估結果' },
  {
    key: 'cm_next',
    category: '溝通',
    label: '向病人說明下一步計畫或注意事項',
    hint: '公告一、(三) 明列的收尾動作，最容易因為時間到而被跳過',
  },
  { key: 'cm_empathy', category: '溝通', label: '展現同理與以病人為中心的態度' },
  { key: 'cm_structure', category: '溝通', label: '向口試委員報告時結構清楚（如 SBAR）' },
];

export const CORE_CATEGORIES = [...new Set(CORE_CHECKLIST.map((c) => c.category))];

/**
 * 現行考試的四類配分比重。
 *
 * 這組數字**不是**公告規定的——公告完全沒有提到細項配分。
 * 它來自使用者對現行甄審實況的認知：臨床推理與決策佔最重。
 * 之所以要寫死在這裡，是因為考官端的「參考配時」是由配分佔比換算的，
 * 比重錯了就會叫委員在最吃重的那一段少留時間，等於教錯節奏。
 */
export const CATEGORY_WEIGHTS = {
  病史詢問: 15,
  '身體評估（說做合一）': 25,
  臨床推理與決策: 45,
  溝通: 15,
};

/**
 * 評分表骨架：匯入的教學案例通常沒有附評分表，
 * 而沒有評分表就等於沒有片段特訓的段落、也沒辦法讓陪練委員打分。
 *
 * 四條的措辭直接取自公告一、(一) 與一、(三) 的原文，沒有推論成分；
 * 配分則套用上面的現行比重當起點，你可以在編輯器裡依實際紙本改。
 */
export const RUBRIC_SKELETON = [
  {
    category: '病史詢問',
    title: '依病患主訴執行焦點式病史訪談',
    maxPoints: CATEGORY_WEIGHTS['病史詢問'],
    critical: true,
  },
  {
    category: '身體評估（說做合一）',
    title: '執行焦點式健康評估，並同時向病人說明檢查目的、項目及部位',
    maxPoints: CATEGORY_WEIGHTS['身體評估（說做合一）'],
    critical: true,
  },
  {
    category: '臨床推理與決策',
    title: '依評估結果向口試委員解釋病人可能的健康問題及理由',
    maxPoints: CATEGORY_WEIGHTS['臨床推理與決策'],
    critical: true,
  },
  {
    category: '溝通',
    title: '對病人解釋評估結果與下一步計畫或注意事項',
    maxPoints: CATEGORY_WEIGHTS['溝通'],
    critical: true,
  },
];

/** 及格分數，公告一、(六) 與二、(六)。僅在陪練場由真人評分時才會用到。 */
export const PASSING_SCORE = 60.0;

export const PHASES = {
  IDLE: 'idle',
  READING: 'reading',
  EXAM: 'exam',
  ENDED: 'ended',
};

export const PHASE_LABEL = {
  [PHASES.IDLE]: '尚未開始',
  [PHASES.READING]: '門前閱讀',
  [PHASES.EXAM]: '考間口試',
  [PHASES.ENDED]: '已結束',
};
