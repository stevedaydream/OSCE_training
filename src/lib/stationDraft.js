import { timingRuleFor } from './constants';

/** 空白題目。分科預設外科，因為這套系統就是為了外科甄審做的。 */
export function emptyStation() {
  return {
    title: '',
    department: 'surgical',
    source: 'manual',
    reviewed: false,
    door_sheet: { patient: '', chiefComplaint: '', vitalSigns: '', task: '' },
    examiner_guide: { overview: '', standardPatientPrompt: '' },
    cue_cards: [],
    rubric_items: [],
    timing: { ...timingRuleFor('surgical') },
  };
}

/**
 * OCR 草稿用 camelCase，資料表用 snake_case，在這裡收斂成一種形狀。
 * reviewed 一律強制為 false：模型抄的東西還沒有人看過。
 */
export function draftToStation(draft) {
  const department = draft.department ?? 'surgical';
  const rule = timingRuleFor(department);

  return {
    title: draft.title ?? '',
    department,
    source: draft.source ?? 'ocr',
    reviewed: false,
    door_sheet: draft.doorSheet ?? draft.door_sheet ?? {},
    examiner_guide: draft.examinerGuide ?? draft.examiner_guide ?? {},
    cue_cards: (draft.cueCards ?? draft.cue_cards ?? []).map((cue, index) => ({
      id: cue.id || `cue_${index + 1}`,
      label: cue.label ?? '',
      title: cue.title ?? '',
      content: cue.content ?? '',
      category: cue.category ?? '',
      peItem: cue.peItem ?? '',
      triggerKeywords: cue.triggerKeywords ?? [],
    })),
    rubric_items: (draft.rubricItems ?? draft.rubric_items ?? []).map((item, index) => ({
      id: item.id || `r_${index + 1}`,
      category: item.category ?? '',
      title: item.title ?? '',
      maxPoints: item.maxPoints ?? null,
      critical: Boolean(item.critical),
    })),
    timing: {
      readingSeconds: draft.timing?.readingSeconds ?? rule.readingSeconds,
      examSeconds: draft.timing?.examSeconds ?? rule.examSeconds,
      alertSeconds: draft.timing?.alertSeconds ?? rule.alertSeconds,
    },
    unreadable: draft.unreadable ?? [],
  };
}
