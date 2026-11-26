import { CheckCircle2, CircleDashed, SkipForward } from 'lucide-react';

export interface ProgressQuestionItem {
  id: number;
}

export function ExamProgressBar({
  questions,
  answers,
  currentIndex,
  onJumpToQuestion,
  variant = 'full',
}: {
  questions: ProgressQuestionItem[];
  answers: Record<number, string>;
  currentIndex: number;
  onJumpToQuestion?: (index: number) => void;
  variant?: 'full' | 'compact';
}) {
  const totalQuestions = questions.length;
  const answeredCount = questions.filter((q) => Boolean(answers[q.id])).length;
  const remainingCount = Math.max(0, totalQuestions - answeredCount);
  const completionPercentage =
    totalQuestions > 0
      ? Math.round((answeredCount / totalQuestions) * 100)
      : 0;

  const isComplete = totalQuestions > 0 && answeredCount === totalQuestions;

  const nextUnansweredIndex = questions.findIndex(
    (q, idx) => idx > currentIndex && !answers[q.id]
  );
  const firstUnansweredIndex =
    nextUnansweredIndex !== -1
      ? nextUnansweredIndex
      : questions.findIndex((q) => !answers[q.id]);

  if (variant === 'compact') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#123B72] font-mono-tabular">
            {answeredCount} / {totalQuestions} Completed
          </span>
          <span
            className={`font-mono-tabular font-bold ${
              isComplete ? 'text-emerald-700' : 'text-[#1769AA]'
            }`}
          >
            {completionPercentage}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={answeredCount}
          aria-valuemin={0}
          aria-valuemax={totalQuestions}
          aria-label="Exam questions completed"
          className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isComplete ? 'bg-emerald-600' : 'bg-[#1769AA]'
            }`}
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Examination completion progress"
      className="bg-white border border-slate-200 rounded-xl p-4 sm:px-6 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-display text-sm font-bold text-[#123B72] flex items-center gap-1.5">
            {isComplete ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <CircleDashed className="w-4 h-4 text-[#1769AA] shrink-0" />
            )}
            Examination Progress
          </span>

          <span className="font-mono-tabular text-xs sm:text-sm font-semibold text-[#123B72]">
            {answeredCount} of {totalQuestions} questions completed
          </span>

          <span className="font-mono-tabular text-xs text-slate-500">
            ({remainingCount} remaining)
          </span>
        </div>

        <div className="flex items-center gap-3">
          {!isComplete && firstUnansweredIndex !== -1 && onJumpToQuestion && (
            <button
              type="button"
              onClick={() => onJumpToQuestion(firstUnansweredIndex)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1769AA] hover:text-[#123B72] hover:underline"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Next Unanswered (Q{firstUnansweredIndex + 1})
            </button>
          )}
          <span
            className={`font-mono-tabular text-sm sm:text-base font-bold ${
              isComplete ? 'text-emerald-700' : 'text-[#1769AA]'
            }`}
          >
            {completionPercentage}%
          </span>
        </div>
      </div>

      {/* Main Continuous Progress Bar */}
      <div
        role="progressbar"
        aria-valuenow={answeredCount}
        aria-valuemin={0}
        aria-valuemax={totalQuestions}
        aria-valuetext={`${answeredCount} of ${totalQuestions} questions completed (${completionPercentage}%)`}
        className="relative h-3.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/80"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isComplete ? 'bg-emerald-600' : 'bg-[#1769AA]'
          }`}
          style={{ width: `${completionPercentage}%` }}
        />
      </div>

      {/* Interactive Per-Question Progress Strip (shown when <= 60 questions) */}
      {totalQuestions > 1 && totalQuestions <= 60 && onJumpToQuestion && (
        <div
          className="grid gap-1 pt-0.5"
          style={{
            gridTemplateColumns: `repeat(${totalQuestions}, minmax(0, 1fr))`,
          }}
        >
          {questions.map((q, idx) => {
            const isAnswered = Boolean(answers[q.id]);
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onJumpToQuestion(idx)}
                title={`Question ${idx + 1}: ${
                  isCurrent
                    ? 'Current'
                    : isAnswered
                      ? 'Completed'
                      : 'Unanswered'
                }`}
                aria-label={`Jump to question ${idx + 1} (${
                  isAnswered ? 'Completed' : 'Unanswered'
                })`}
                className={`h-1.5 rounded-full transition-all ${
                  isCurrent
                    ? 'bg-[#E83E8C] scale-y-125'
                    : isAnswered
                      ? 'bg-[#123B72] hover:bg-[#1769AA]'
                      : 'bg-slate-200 hover:bg-slate-300'
                }`}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
