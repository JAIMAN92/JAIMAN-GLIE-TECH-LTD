import { Router } from 'express';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  examAssignments,
  examAttempts,
  examQuestions,
  examinations,
  questions,
  schools,
  studentAnswers,
  studentSessions,
  students,
  subjects,
} from '../../db/schema.ts';
import {
  checkLoginLockout,
  clearLoginFailures,
  ensureQuestionColumns,
  ensureSchoolColumns,
  recordFailedLogin,
  requireStudent,
  type StudentRequest,
} from '../authMiddleware.ts';
import {
  generateSessionToken,
  hashSessionToken,
  verifyPassword,
} from '../crypto.ts';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { examNumber, passcode } = req.body ?? {};
    if (
      typeof examNumber !== 'string' ||
      !examNumber.trim() ||
      typeof passcode !== 'string' ||
      !passcode.trim()
    ) {
      return res.status(400).json({
        error: 'Examination Number and Access Password are required.',
      });
    }

    const cleanExamNo = examNumber.trim().toUpperCase();
    const rateKey = `student:${cleanExamNo}`;
    const lockout = await checkLoginLockout(rateKey);
    if (lockout.locked) {
      return res.status(429).json({
        error: `Too many failed attempts. Please wait ${lockout.retryMinutes} minute(s) or contact your examination officer.`,
      });
    }

    await ensureSchoolColumns();
    const rows = await db
      .select({
        student: students,
        school: schools,
      })
      .from(students)
      .innerJoin(schools, eq(students.schoolId, schools.id))
      .where(eq(students.examNumber, cleanExamNo))
      .limit(1);

    if (
      rows.length === 0 ||
      !verifyPassword(passcode.trim(), rows[0].student.passcodeHash)
    ) {
      await recordFailedLogin(rateKey);
      return res.status(401).json({
        error: 'Invalid Examination Number or Access Password.',
      });
    }

    const { student, school } = rows[0];
    if (!student.isActive || !school.isActive) {
      return res.status(403).json({
        error:
          'Your examination account or school portal is currently inactive. Contact your school examination officer.',
      });
    }

    await clearLoginFailures(rateKey);
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    await db.insert(studentSessions).values({
      studentId: student.id,
      tokenHash,
      expiresAt,
    });

    res.json({
      token: rawToken,
      student: {
        id: student.id,
        examNumber: student.examNumber,
        fullName: student.fullName,
        classLevel: student.classLevel,
        arm: student.arm,
        schoolId: school.id,
        schoolName: school.name,
        schoolCode: school.code,
        schoolLogoUrl: school.logoUrl || '',
      },
    });
  } catch (error) {
    console.error('Student login error:', error);
    res
      .status(500)
      .json({ error: 'Unable to log in right now. Please try again.' });
  }
});

router.post('/logout', requireStudent, async (req: StudentRequest, res) => {
  try {
    await db
      .update(studentSessions)
      .set({ revokedAt: new Date() })
      .where(eq(studentSessions.id, req.student!.sessionId));
    res.json({ success: true });
  } catch (error) {
    console.error('Student logout error:', error);
    res.status(500).json({ error: 'Unable to log out.' });
  }
});

async function getEligibleExamsForStudent(student: NonNullable<StudentRequest['student']>) {
  const activeExams = await db
    .select({
      exam: examinations,
      subjectName: subjects.name,
      subjectCode: subjects.code,
    })
    .from(examinations)
    .innerJoin(subjects, eq(examinations.subjectId, subjects.id))
    .where(eq(examinations.isActive, true));

  const examIds = activeExams.map((e) => e.exam.id);
  const assignments =
    examIds.length > 0
      ? await db
          .select()
          .from(examAssignments)
          .where(inArray(examAssignments.examId, examIds))
      : [];

  const qCounts =
    examIds.length > 0
      ? await db
          .select()
          .from(examQuestions)
          .where(inArray(examQuestions.examId, examIds))
      : [];

  const attempts = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.studentId, student.id));

  const attemptMap = new Map(attempts.map((a) => [a.examId, a]));

  const eligible = activeExams.filter(({ exam }) => {
    const studentArm = (student.arm || '').trim().toUpperCase();
    const examAssigns = assignments.filter((a) => a.examId === exam.id);
    if (examAssigns.length > 0) {
      return examAssigns.some((a) => {
        if (a.studentId && a.studentId === student.id) return true;
        const schoolOk = !a.schoolId || a.schoolId === student.schoolId;
        const classOk =
          !a.classLevel ||
          a.classLevel === 'ALL' ||
          a.classLevel.toUpperCase() === student.classLevel.toUpperCase();
        const armOk =
          !a.arm ||
          a.arm.toUpperCase() === 'ALL' ||
          a.arm.trim().toUpperCase() === studentArm;
        return !a.studentId && schoolOk && classOk && armOk;
      });
    }
    const schoolMatches =
      exam.schoolId === null || exam.schoolId === student.schoolId;
    const classMatches =
      exam.classLevel === 'ALL' ||
      exam.classLevel.toUpperCase() === student.classLevel.toUpperCase();
    const armMatches =
      !exam.arm ||
      exam.arm.toUpperCase() === 'ALL' ||
      exam.arm.trim().toUpperCase() === studentArm;
    return schoolMatches && classMatches && armMatches;
  });

  return eligible.map(({ exam, subjectName, subjectCode }) => {
    const questionCount = qCounts.filter((q) => q.examId === exam.id).length;
    const attempt = attemptMap.get(exam.id);
    return {
      id: exam.id,
      title: exam.title,
      subjectName,
      subjectCode,
      classLevel: exam.classLevel,
      arm: exam.arm,
      durationMinutes: exam.durationMinutes,
      examDate: exam.examDate,
      startTime: exam.startTime,
      endTime: exam.endTime,
      instructions: exam.instructions,
      questionCount,
      resultsPublished: exam.resultsPublished,
      attempt: attempt
        ? {
            id: attempt.id,
            status: attempt.status,
            startedAt: attempt.startedAt,
            expiresAt: attempt.expiresAt,
            submittedAt: attempt.submittedAt,
            securityViolations: attempt.securityViolations,
            submissionReason: attempt.submissionReason,
            ...(exam.resultsPublished && attempt.status === 'submitted'
              ? {
                  score: attempt.score,
                  totalMarks: attempt.totalMarks,
                  correctCount: attempt.correctCount,
                  totalQuestions: attempt.totalQuestions,
                  percentage: attempt.percentage,
                }
              : {}),
          }
        : null,
    };
  });
}

router.get('/exams', requireStudent, async (req: StudentRequest, res) => {
  try {
    const exams = await getEligibleExamsForStudent(req.student!);
    res.json({
      student: req.student,
      exams,
    });
  } catch (error) {
    console.error('Fetch student exams error:', error);
    res.status(500).json({ error: 'Unable to load assigned examinations.' });
  }
});

router.post(
  '/exams/:examId/start',
  requireStudent,
  async (req: StudentRequest, res) => {
    try {
      const examId = Number(req.params.examId);
      if (!Number.isInteger(examId)) {
        return res.status(400).json({ error: 'Invalid examination ID.' });
      }

      const eligible = await getEligibleExamsForStudent(req.student!);
      const targetExam = eligible.find((e) => e.id === examId);
      if (!targetExam) {
        return res.status(403).json({
          error: 'You are not authorized to access this examination.',
        });
      }

      if (targetExam.questionCount === 0) {
        return res.status(400).json({
          error:
            'This examination has no questions configured yet. Contact your examination officer.',
        });
      }

      const [existingAttempt] = await db
        .select()
        .from(examAttempts)
        .where(
          and(
            eq(examAttempts.examId, examId),
            eq(examAttempts.studentId, req.student!.id)
          )
        )
        .limit(1);

      if (existingAttempt?.status === 'submitted') {
        return res.status(409).json({
          error:
            'This examination has already been submitted and is locked against changes.',
        });
      }

      let attempt = existingAttempt;
      if (!attempt) {
        const now = new Date();
        const expiresAt = new Date(
          now.getTime() + targetExam.durationMinutes * 60 * 1000
        );
        const [inserted] = await db
          .insert(examAttempts)
          .values({
            examId,
            studentId: req.student!.id,
            status: 'in_progress',
            startedAt: now,
            expiresAt,
          })
          .returning();
        attempt = inserted;
      }

      await ensureQuestionColumns();

      // Fetch questions WITHOUT leaking correctOption!
      const examQRows = await db
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
        .orderBy(asc(examQuestions.sortOrder), asc(examQuestions.id));

      const savedAnswers = await db
        .select({
          questionId: studentAnswers.questionId,
          selectedOption: studentAnswers.selectedOption,
        })
        .from(studentAnswers)
        .where(eq(studentAnswers.attemptId, attempt.id));

      const answersMap: Record<number, string> = {};
      for (const ans of savedAnswers) {
        if (ans.selectedOption) {
          answersMap[ans.questionId] = ans.selectedOption;
        }
      }

      const remainingSeconds = Math.max(
        0,
        Math.floor((attempt.expiresAt.getTime() - Date.now()) / 1000)
      );

      res.json({
        attempt: {
          id: attempt.id,
          examId: attempt.examId,
          status: attempt.status,
          startedAt: attempt.startedAt,
          expiresAt: attempt.expiresAt,
          remainingSeconds,
          securityViolations: attempt.securityViolations,
          maxSecurityViolations: 3,
        },
        exam: targetExam,
        questions: examQRows,
        savedAnswers: answersMap,
      });
    } catch (error) {
      console.error('Start exam error:', error);
      res.status(500).json({ error: 'Unable to start examination.' });
    }
  }
);

router.post(
  '/attempts/:attemptId/answer',
  requireStudent,
  async (req: StudentRequest, res) => {
    try {
      const attemptId = Number(req.params.attemptId);
      const { questionId, selectedOption } = req.body ?? {};

      if (
        !Number.isInteger(attemptId) ||
        !Number.isInteger(Number(questionId)) ||
        !['A', 'B', 'C', 'D', 'E'].includes(String(selectedOption))
      ) {
        return res.status(400).json({ error: 'Invalid answer payload.' });
      }

      const [attempt] = await db
        .select()
        .from(examAttempts)
        .where(
          and(
            eq(examAttempts.id, attemptId),
            eq(examAttempts.studentId, req.student!.id)
          )
        )
        .limit(1);

      if (!attempt) {
        return res.status(404).json({ error: 'Examination attempt not found.' });
      }

      if (attempt.status === 'submitted') {
        return res.status(409).json({
          error: 'This examination is already submitted and locked.',
        });
      }

      if (Date.now() > attempt.expiresAt.getTime() + 15000) {
        return res.status(409).json({
          error: 'Examination time has elapsed.',
        });
      }

      await db
        .insert(studentAnswers)
        .values({
          attemptId,
          questionId: Number(questionId),
          selectedOption: String(selectedOption),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [studentAnswers.attemptId, studentAnswers.questionId],
          set: {
            selectedOption: String(selectedOption),
            updatedAt: new Date(),
          },
        });

      res.json({ saved: true, savedAt: new Date().toISOString() });
    } catch (error) {
      console.error('Save answer error:', error);
      res.status(500).json({ error: 'Failed to save answer.' });
    }
  }
);

router.post(
  '/attempts/:attemptId/answers/batch',
  requireStudent,
  async (req: StudentRequest, res) => {
    try {
      const attemptId = Number(req.params.attemptId);
      const rawAnswers = req.body?.answers;

      if (
        !Number.isInteger(attemptId) ||
        !rawAnswers ||
        typeof rawAnswers !== 'object' ||
        Array.isArray(rawAnswers)
      ) {
        return res.status(400).json({ error: 'Invalid batch answers payload.' });
      }

      const [attempt] = await db
        .select()
        .from(examAttempts)
        .where(
          and(
            eq(examAttempts.id, attemptId),
            eq(examAttempts.studentId, req.student!.id)
          )
        )
        .limit(1);

      if (!attempt) {
        return res.status(404).json({ error: 'Examination attempt not found.' });
      }

      if (attempt.status === 'submitted') {
        return res.status(409).json({
          error: 'This examination is already submitted and locked.',
        });
      }

      if (Date.now() > attempt.expiresAt.getTime() + 15000) {
        return res.status(409).json({
          error: 'Examination time has elapsed.',
        });
      }

      const assignedRows = await db
        .select({ questionId: examQuestions.questionId })
        .from(examQuestions)
        .where(eq(examQuestions.examId, attempt.examId));
      const allowedQuestionIds = new Set(assignedRows.map((r) => r.questionId));

      const now = new Date();
      const entriesToSave: Array<{
        attemptId: number;
        questionId: number;
        selectedOption: string;
        updatedAt: Date;
      }> = [];

      for (const [rawQId, rawOpt] of Object.entries(
        rawAnswers as Record<string, unknown>
      )) {
        const questionId = Number(rawQId);
        const selectedOption = String(rawOpt ?? '').trim().toUpperCase();
        if (
          Number.isInteger(questionId) &&
          allowedQuestionIds.has(questionId) &&
          ['A', 'B', 'C', 'D', 'E'].includes(selectedOption)
        ) {
          entriesToSave.push({
            attemptId,
            questionId,
            selectedOption,
            updatedAt: now,
          });
        }
      }

      if (entriesToSave.length > 0) {
        await db
          .insert(studentAnswers)
          .values(entriesToSave)
          .onConflictDoUpdate({
            target: [studentAnswers.attemptId, studentAnswers.questionId],
            set: {
              selectedOption: sql`excluded.selected_option`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }

      res.json({
        saved: true,
        savedCount: entriesToSave.length,
        savedAt: now.toISOString(),
      });
    } catch (error) {
      console.error('Batch auto-save answers error:', error);
      res.status(500).json({ error: 'Failed to auto-save answers.' });
    }
  }
);

const MAX_SECURITY_VIOLATIONS = 3;
const VALID_SUBMISSION_REASONS = new Set([
  'manual',
  'time_expired',
  'security_violation',
]);
const VALID_VIOLATION_REASONS = new Set([
  'tab_switch',
  'window_blur',
  'fullscreen_exit',
  'blocked_shortcut',
]);

async function finalizeAttemptSubmission(
  attempt: typeof examAttempts.$inferSelect,
  reasonInput?: unknown
) {
  const [exam] = await db
    .select()
    .from(examinations)
    .where(eq(examinations.id, attempt.examId))
    .limit(1);

  if (attempt.status === 'submitted') {
    return {
      alreadySubmitted: true,
      resultsPublished: exam?.resultsPublished ?? false,
      submissionReason: attempt.submissionReason,
      securityViolations: attempt.securityViolations,
      result: exam?.resultsPublished
        ? {
            score: attempt.score,
            totalMarks: attempt.totalMarks,
            correctCount: attempt.correctCount,
            totalQuestions: attempt.totalQuestions,
            percentage: attempt.percentage,
            submittedAt: attempt.submittedAt,
          }
        : null,
    };
  }

  const examQRows = await db
    .select({
      questionId: questions.id,
      correctOption: questions.correctOption,
      marks: questions.marks,
    })
    .from(examQuestions)
    .innerJoin(questions, eq(examQuestions.questionId, questions.id))
    .where(eq(examQuestions.examId, attempt.examId));

  const savedAnswers = await db
    .select()
    .from(studentAnswers)
    .where(eq(studentAnswers.attemptId, attempt.id));

  const answerMap = new Map(
    savedAnswers.map((a) => [a.questionId, a.selectedOption])
  );

  let score = 0;
  let totalMarks = 0;
  let correctCount = 0;
  const totalQuestions = examQRows.length;

  for (const q of examQRows) {
    totalMarks += q.marks;
    const chosen = answerMap.get(q.questionId) ?? null;
    const isCorrect = chosen !== null && chosen === q.correctOption;
    if (isCorrect) {
      correctCount += 1;
      score += q.marks;
    }
    if (chosen !== null) {
      await db
        .update(studentAnswers)
        .set({ isCorrect })
        .where(
          and(
            eq(studentAnswers.attemptId, attempt.id),
            eq(studentAnswers.questionId, q.questionId)
          )
        );
    }
  }

  const percentage =
    totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const submittedAt = new Date();
  const submissionReason =
    typeof reasonInput === 'string' && VALID_SUBMISSION_REASONS.has(reasonInput)
      ? reasonInput
      : 'manual';

  const [finalized] = await db
    .update(examAttempts)
    .set({
      status: 'submitted',
      submittedAt,
      score,
      totalMarks,
      correctCount,
      totalQuestions,
      percentage,
      submissionReason,
    })
    .where(eq(examAttempts.id, attempt.id))
    .returning();

  return {
    submitted: true,
    resultsPublished: exam?.resultsPublished ?? false,
    submissionReason: finalized.submissionReason,
    securityViolations: finalized.securityViolations,
    result: exam?.resultsPublished
      ? {
          score: finalized.score,
          totalMarks: finalized.totalMarks,
          correctCount: finalized.correctCount,
          totalQuestions: finalized.totalQuestions,
          percentage: finalized.percentage,
          submittedAt: finalized.submittedAt,
        }
      : null,
  };
}

router.post(
  '/attempts/:attemptId/violation',
  requireStudent,
  async (req: StudentRequest, res) => {
    try {
      const attemptId = Number(req.params.attemptId);
      const rawReason = req.body?.reason;

      if (!Number.isInteger(attemptId)) {
        return res.status(400).json({ error: 'Invalid attempt ID.' });
      }
      if (
        typeof rawReason !== 'string' ||
        !VALID_VIOLATION_REASONS.has(rawReason)
      ) {
        return res.status(400).json({ error: 'Invalid security violation type.' });
      }

      const [attempt] = await db
        .select()
        .from(examAttempts)
        .where(
          and(
            eq(examAttempts.id, attemptId),
            eq(examAttempts.studentId, req.student!.id)
          )
        )
        .limit(1);

      if (!attempt) {
        return res.status(404).json({ error: 'Examination attempt not found.' });
      }

      if (attempt.status === 'submitted') {
        return res.json({
          securityViolations: attempt.securityViolations,
          maxViolations: MAX_SECURITY_VIOLATIONS,
          autoSubmitted: true,
        });
      }

      const [updated] = await db
        .update(examAttempts)
        .set({ securityViolations: sql`${examAttempts.securityViolations} + 1` })
        .where(
          and(
            eq(examAttempts.id, attempt.id),
            eq(examAttempts.status, 'in_progress')
          )
        )
        .returning();

      if (!updated) {
        return res.json({
          securityViolations: attempt.securityViolations,
          maxViolations: MAX_SECURITY_VIOLATIONS,
          autoSubmitted: true,
        });
      }

      const nextCount = updated.securityViolations;

      if (nextCount >= MAX_SECURITY_VIOLATIONS) {
        const finalizedOutcome = await finalizeAttemptSubmission(
          updated,
          'security_violation'
        );
        return res.json({
          maxViolations: MAX_SECURITY_VIOLATIONS,
          autoSubmitted: true,
          ...finalizedOutcome,
        });
      }

      return res.json({
        securityViolations: nextCount,
        maxViolations: MAX_SECURITY_VIOLATIONS,
        autoSubmitted: false,
      });
    } catch (error) {
      console.error('Security violation record error:', error);
      return res
        .status(500)
        .json({ error: 'Unable to record examination security check.' });
    }
  }
);

router.post(
  '/attempts/:attemptId/submit',
  requireStudent,
  async (req: StudentRequest, res) => {
    try {
      const attemptId = Number(req.params.attemptId);
      if (!Number.isInteger(attemptId)) {
        return res.status(400).json({ error: 'Invalid attempt ID.' });
      }

      const [attempt] = await db
        .select()
        .from(examAttempts)
        .where(
          and(
            eq(examAttempts.id, attemptId),
            eq(examAttempts.studentId, req.student!.id)
          )
        )
        .limit(1);

      if (!attempt) {
        return res.status(404).json({ error: 'Attempt not found.' });
      }

      const outcome = await finalizeAttemptSubmission(
        attempt,
        req.body?.reason
      );
      res.json(outcome);
    } catch (error) {
      console.error('Submit exam error:', error);
      res.status(500).json({ error: 'Unable to submit examination.' });
    }
  }
);

export default router;
