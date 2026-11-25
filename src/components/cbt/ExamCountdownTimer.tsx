import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

export function formatCountdownTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

interface ExamCountdownTimerProps {
  remainingSeconds: number;
  totalDurationMinutes: number;
  variant?: 'header' | 'card';
  className?: string;
}

export function ExamCountdownTimer({
  remainingSeconds,
  totalDurationMinutes,
  variant = 'header',
  className = '',
}: ExamCountdownTimerProps) {
  const safeRemaining = Math.max(0, Math.floor(remainingSeconds));
  const totalSeconds = Math.max(1, Math.round(totalDurationMinutes * 60));
  const percentRemaining = Math.min(
    100,
    Math.max(0, Math.round((safeRemaining / totalSeconds) * 100))
  );

  const isCritical = safeRemaining <= 60;
  const isWarning = !isCritical && safeRemaining <= 300;
  const formatted = formatCountdownTime(safeRemaining);

  const announcement =
    safeRemaining === 300
      ? '5 minutes remaining in this examination.'
      : safeRemaining === 60
        ? '1 minute remaining in this examination.'
        : '';

  if (variant === 'card') {
    return (
      <section
        aria-label="Examination countdown timer"
        className={`rounded-xl border p-4 space-y-3 transition-colors ${
          isCritical
            ? 'bg-red-50 border-red-300'
            : isWarning
              ? 'bg-amber-50 border-amber-300'
              : 'bg-white border-slate-200'
        } ${className}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isCritical ? (
              <AlertTriangle className="w-4 h-4 text-red-600 animate-pulse shrink-0" />
            ) : (
              <Clock
                className={`w-4 h-4 shrink-0 ${
                  isWarning ? 'text-amber-700' : 'text-[#1769AA]'
                }`}
              />
            )}
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                isCritical
                  ? 'text-red-700'
                  : isWarning
                    ? 'text-amber-800'
                    : 'text-[#123B72]'
              }`}
            >
              Time Remaining
            </span>
          </div>
          <span
            className={`text-xs font-semibold font-mono-tabular ${
              isCritical
                ? 'text-red-700'
                : isWarning
                  ? 'text-amber-800'
                  : 'text-slate-500'
            }`}
          >
            {isCritical
              ? 'Final Minute'
              : isWarning
                ? 'Low Time'
                : `${totalDurationMinutes} min limit`}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <div
            role="timer"
            aria-live="off"
            className={`font-mono-tabular text-2xl sm:text-3xl font-bold tracking-tight ${
              isCritical
                ? 'text-red-700'
                : isWarning
                  ? 'text-amber-900'
                  : 'text-[#123B72]'
            }`}
          >
            {formatted}
          </div>
          <span
            className={`font-mono-tabular text-xs font-semibold ${
              isCritical
                ? 'text-red-700'
                : isWarning
                  ? 'text-amber-800'
                  : 'text-[#1769AA]'
            }`}
          >
            {percentRemaining}% left
          </span>
        </div>

        <div
          aria-hidden="true"
          className={`h-2 w-full rounded-full overflow-hidden ${
            isCritical
              ? 'bg-red-200'
              : isWarning
                ? 'bg-amber-200'
                : 'bg-slate-100'
          }`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isCritical
                ? 'bg-red-600'
                : isWarning
                  ? 'bg-amber-500'
                  : 'bg-[#1769AA]'
            }`}
            style={{ width: `${percentRemaining}%` }}
          />
        </div>

        {(isWarning || isCritical) && (
          <p
            className={`text-xs leading-relaxed ${
              isCritical ? 'text-red-800 font-medium' : 'text-amber-900'
            }`}
          >
            {isCritical
              ? 'Less than 1 minute left. Your answers will submit automatically at 00:00.'
              : 'Less than 5 minutes remaining. Review any unanswered questions.'}
          </p>
        )}

        {announcement && (
          <span className="sr-only" aria-live="polite">
            {announcement}
          </span>
        )}
      </section>
    );
  }

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`Time remaining: ${formatted}`}
      className={`relative overflow-hidden rounded-lg border px-3.5 py-1.5 transition-colors ${
        isCritical
          ? 'bg-red-600 border-red-400 text-white'
          : isWarning
            ? 'bg-amber-400 border-amber-300 text-slate-950'
            : 'bg-white/10 border-white/15 text-[#D4AF37]'
      } ${className}`}
    >
      <div className="flex items-center gap-2">
        {isCritical ? (
          <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
        ) : (
          <Clock className="w-4 h-4 shrink-0" />
        )}
        <div className="leading-tight">
          <span
            className={`block text-[9px] font-bold uppercase tracking-wider ${
              isCritical
                ? 'text-red-100'
                : isWarning
                  ? 'text-slate-800'
                  : 'text-slate-300'
            }`}
          >
            {isCritical
              ? 'Final Minute'
              : isWarning
                ? '5 Min Warning'
                : 'Time Left'}
          </span>
          <span className="block font-mono-tabular text-sm sm:text-base font-bold leading-none mt-0.5">
            {formatted}
          </span>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/20"
      >
        <div
          className={`h-full transition-all duration-500 ${
            isCritical
              ? 'bg-white'
              : isWarning
                ? 'bg-slate-900'
                : 'bg-[#20C4D8]'
          }`}
          style={{ width: `${percentRemaining}%` }}
        />
      </div>

      {announcement && (
        <span className="sr-only" aria-live="polite">
          {announcement}
        </span>
      )}
    </div>
  );
}
