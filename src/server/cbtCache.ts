import { asc, eq, inArray } from 'drizzle-orm';
import { db, withDbRetry } from '../db/index.ts';
import {
  examAssignments,
  examQuestions,
  examinations,
  questions,
  subjects,
} from '../db/schema.ts';
import { ensureExamColumns, ensureQuestionColumns } from './authMiddleware.ts';

const EXAM_CATALOG_TTL_MS = 15_000;
const EXAM_QUESTIONS_TTL_MS = 30_000;

export interface CachedActiveExamEntry {
  exam: typeof examinations.$inferSelect;
  subjectName: string;
  subjectCode: string;
}

export interface CachedExamCatalog {
  activeExams: CachedActiveExamEntry[];
  assignmentsByExamId: Map<number, (typeof examAssignments.$inferSelect)[]>;
  questionCountByExamId: Map<number, number>;
  fetchedAtMs: number;
}

export interface SanitizedExamQuestion {
  sortOrder: number;
  id: number;
  topic: string;
  questionText: string;
  imageUrl: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  marks: number;
}

export interface CachedSanitizedQuestionsEntry {
  questions: SanitizedExamQuestion[];
  allowedQuestionIds: Set<number>;
  fetchedAtMs: number;
}

export interface ScoringExamQuestion {
  questionId: number;
  correctOption: string;
  marks: number;
}

interface CachedScoringQuestionsEntry {
  questions: ScoringExamQuestion[];
  fetchedAtMs: number;
}

let cachedCatalog: CachedExamCatalog | null = null;
let inFlightCatalogPromise: Promise<CachedExamCatalog> | null = null;

const sanitizedQuestionsCache = new Map<number, CachedSanitizedQuestionsEntry>();
const inFlightSanitizedQuestions = new Map<
  number,
  Promise<CachedSanitizedQuestionsEntry>
>();

const scoringQuestionsCache = new Map<number, CachedScoringQuestionsEntry>();
const inFlightScoringQuestions = new Map<
  number,
  Promise<ScoringExamQuestion[]>
>();

export function invalidateCbtExamCache(examId?: number): void {
  cachedCatalog = null;
  if (typeof examId === 'number' && Number.isInteger(examId)) {
    sanitizedQuestionsCache.delete(examId);
    scoringQuestionsCache.delete(examId);
  } else {
    sanitizedQuestionsCache.clear();
    scoringQuestionsCache.clear();
  }
}

export async function getCachedExamCatalog(): Promise<CachedExamCatalog> {
  const now = Date.now();
  if (cachedCatalog && now - cachedCatalog.fetchedAtMs < EXAM_CATALOG_TTL_MS) {
    return cachedCatalog;
  }

  if (inFlightCatalogPromise) {
    return inFlightCatalogPromise;
  }

  inFlightCatalogPromise = (async () => {
    try {
      await ensureExamColumns();
      const activeExams = await withDbRetry(() =>
        db
          .select({
            exam: examinations,
            subjectName: subjects.name,
            subjectCode: subjects.code,
          })
          .from(examinations)
          .innerJoin(subjects, eq(examinations.subjectId, subjects.id))
          .where(eq(examinations.isActive, true))
      );

      const examIds = activeExams.map((e) => e.exam.id);
      const [assignments, qRows] =
        examIds.length > 0
          ? await Promise.all([
              withDbRetry(() =>
                db
                  .select()
                  .from(examAssignments)
                  .where(inArray(examAssignments.examId, examIds))
              ),
              withDbRetry(() =>
                db
                  .select({ examId: examQuestions.examId })
                  .from(examQuestions)
                  .where(inArray(examQuestions.examId, examIds))
              ),
            ])
          : [[], []];

      const assignmentsByExamId = new Map<
        number,
        (typeof examAssignments.$inferSelect)[]
      >();
      for (const a of assignments) {
        const list = assignmentsByExamId.get(a.examId);
        if (list) {
          list.push(a);
        } else {
          assignmentsByExamId.set(a.examId, [a]);
        }
      }

      const questionCountByExamId = new Map<number, number>();
      for (const row of qRows) {
        questionCountByExamId.set(
          row.examId,
          (questionCountByExamId.get(row.examId) ?? 0) + 1
        );
      }

      const fresh: CachedExamCatalog = {
        activeExams,
        assignmentsByExamId,
        questionCountByExamId,
        fetchedAtMs: Date.now(),
      };
      cachedCatalog = fresh;
      return fresh;
    } finally {
      inFlightCatalogPromise = null;
    }
  })();

  return inFlightCatalogPromise;
}

export async function getCachedSanitizedExamQuestions(
  examId: number
): Promise<CachedSanitizedQuestionsEntry> {
  const now = Date.now();
  const cached = sanitizedQuestionsCache.get(examId);
  if (cached && now - cached.fetchedAtMs < EXAM_QUESTIONS_TTL_MS) {
    return cached;
  }

  const inFlight = inFlightSanitizedQuestions.get(examId);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async () => {
    try {
      await ensureQuestionColumns();
      // Never select correctOption in the student-facing question cache
      const rows = await withDbRetry(() =>
        db
          .select({
            sortOrder: examQuestions.sortOrder,
            id: questions.id,
            topic: questions.topic,
            questionText: questions.questionText,
            imageUrl: questions.imageUrl,
            optionA: questions.optionA,
            optionB: questions.optionB,
            optionC: questions.optionC,
            optionD: questions.optionD,
            optionE: questions.optionE,
            marks: questions.marks,
          })
          .from(examQuestions)
          .innerJoin(questions, eq(examQuestions.questionId, questions.id))
          .where(eq(examQuestions.examId, examId))
          .orderBy(asc(examQuestions.sortOrder), asc(examQuestions.id))
      );

      const entry: CachedSanitizedQuestionsEntry = {
        questions: rows,
        allowedQuestionIds: new Set(rows.map((r) => r.id)),
        fetchedAtMs: Date.now(),
      };
      sanitizedQuestionsCache.set(examId, entry);
      return entry;
    } finally {
      inFlightSanitizedQuestions.delete(examId);
    }
  })();

  inFlightSanitizedQuestions.set(examId, promise);
  return promise;
}

export async function getCachedExamScoringQuestions(
  examId: number
): Promise<ScoringExamQuestion[]> {
  const now = Date.now();
  const cached = scoringQuestionsCache.get(examId);
  if (cached && now - cached.fetchedAtMs < EXAM_QUESTIONS_TTL_MS) {
    return cached.questions;
  }

  const inFlight = inFlightScoringQuestions.get(examId);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async () => {
    try {
      const rows = await withDbRetry(() =>
        db
          .select({
            questionId: questions.id,
            correctOption: questions.correctOption,
            marks: questions.marks,
          })
          .from(examQuestions)
          .innerJoin(questions, eq(examQuestions.questionId, questions.id))
          .where(eq(examQuestions.examId, examId))
      );

      scoringQuestionsCache.set(examId, {
        questions: rows,
        fetchedAtMs: Date.now(),
      });
      return rows;
    } finally {
      inFlightScoringQuestions.delete(examId);
    }
  })();

  inFlightScoringQuestions.set(examId, promise);
  return promise;
}
