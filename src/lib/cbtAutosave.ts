export interface ExamDraftPayload {
  answers: Record<number, string>;
  currentIndex: number;
  dirtyQuestionIds: number[];
  updatedAt: number;
}

const DRAFT_PREFIX = 'jgt_cbt_draft';

export function getExamDraftKey(studentId: number, attemptId: number): string {
  return `${DRAFT_PREFIX}:${studentId}:${attemptId}`;
}

export function loadExamDraft(
  studentId: number,
  attemptId: number
): ExamDraftPayload | null {
  try {
    const raw = window.localStorage.getItem(getExamDraftKey(studentId, attemptId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ExamDraftPayload>;
    if (!parsed || typeof parsed !== 'object') return null;

    const cleanAnswers: Record<number, string> = {};
    if (parsed.answers && typeof parsed.answers === 'object') {
      for (const [k, v] of Object.entries(parsed.answers)) {
        const qId = Number(k);
        const opt = String(v ?? '').toUpperCase();
        if (Number.isInteger(qId) && ['A', 'B', 'C', 'D'].includes(opt)) {
          cleanAnswers[qId] = opt;
        }
      }
    }

    const dirtyIds = Array.isArray(parsed.dirtyQuestionIds)
      ? parsed.dirtyQuestionIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id))
      : [];

    return {
      answers: cleanAnswers,
      currentIndex:
        typeof parsed.currentIndex === 'number' && parsed.currentIndex >= 0
          ? Math.floor(parsed.currentIndex)
          : 0,
      dirtyQuestionIds: dirtyIds,
      updatedAt:
        typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveExamDraft(
  studentId: number,
  attemptId: number,
  draft: ExamDraftPayload
): boolean {
  try {
    window.localStorage.setItem(
      getExamDraftKey(studentId, attemptId),
      JSON.stringify(draft)
    );
    return true;
  } catch {
    return false;
  }
}

export function clearExamDraft(studentId: number, attemptId: number): void {
  try {
    window.localStorage.removeItem(getExamDraftKey(studentId, attemptId));
  } catch {
    // Ignore storage removal errors
  }
}
