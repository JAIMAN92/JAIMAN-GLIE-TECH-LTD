import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  LayoutGrid,
  Lock,
  LogOut,
  Maximize2,
  Printer,
  Send,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { BrandLogo } from '../components/BrandLogo.tsx';
import {
  ExamCountdownTimer,
  formatCountdownTime,
} from '../components/cbt/ExamCountdownTimer.tsx';

interface ExamSummary {
  id: number;
  title: string;
  subjectName: string;
  subjectCode: string;
  classLevel: string;
  arm?: string;
  durationMinutes: number;
  examDate: string;
  startTime: string;
  endTime: string;
  instructions: string;
  questionCount: number;
  resultsPublished: boolean;
  attempt: {
    id: number;
    status: string;
    startedAt: string;
    expiresAt: string;
    submittedAt: string | null;
    securityViolations?: number;
    submissionReason?: string;
    score?: number;
    totalMarks?: number;
    correctCount?: number;
    totalQuestions?: number;
    percentage?: number;
  } | null;
}

interface ExamQuestionItem {
  sortOrder: number;
  id: number;
  topic: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  marks: number;
}

interface SubmissionResult {
  resultsPublished: boolean;
  submissionReason?: string;
  securityViolations?: number;
  result: {
    score: number;
    totalMarks: number;
    correctCount: number;
    totalQuestions: number;
    percentage: number;
    submittedAt: string;
  } | null;
}

export function CbtPortalPage() {
  const { studentToken, student, setStudentSession, clearStudentSession } =
    useAuth();

  // Login form state
  const [examNumber, setExamNumber] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Exam list & instructions state
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [examsError, setExamsError] = useState('');
  const [selectedExamForInstructions, setSelectedExamForInstructions] =
    useState<ExamSummary | null>(null);
  const [acknowledgedRules, setAcknowledgedRules] = useState(false);

  // Active Exam Session state
  const [activeAttemptId, setActiveAttemptId] = useState<number | null>(null);
  const [activeExam, setActiveExam] = useState<ExamSummary | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionItem[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submittingExam, setSubmittingExam] = useState(false);
  const [submissionOutcome, setSubmissionOutcome] =
    useState<SubmissionResult | null>(null);

  // Exam Security Lockdown state
  const MAX_SECURITY_VIOLATIONS = 3;
  const [securityViolations, setSecurityViolations] = useState(0);
  const [securityLockMessage, setSecurityLockMessage] = useState<string | null>(
    null
  );
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const autoSubmittedRef = useRef(false);
  const deadlineMsRef = useRef<number | null>(null);
  const enteredFullscreenRef = useRef(false);
  const lastViolationAtRef = useRef(0);
  const securityNoticeTimerRef = useRef<number | null>(null);

  const exitExamFullscreen = useCallback(() => {
    try {
      const nav = navigator as Navigator & {
        keyboard?: { unlock?: () => void };
      };
      nav.keyboard?.unlock?.();
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    } catch {
      // Ignore fullscreen exit errors
    }
    enteredFullscreenRef.current = false;
    setIsFullscreen(false);
  }, []);

  const requestExamFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        }
      }
      if (document.fullscreenElement) {
        enteredFullscreenRef.current = true;
        setIsFullscreen(true);
      }
      const nav = navigator as Navigator & {
        keyboard?: { lock?: (keys?: string[]) => Promise<void> };
      };
      await nav.keyboard?.lock?.(['Escape', 'Tab']).catch(() => {});
    } catch {
      // Fullscreen may be restricted in some embedded preview frames; visibility/focus lockdown remains active
    }
  }, []);

  const showTransientSecurityNotice = useCallback((text: string) => {
    setSecurityNotice(text);
    if (securityNoticeTimerRef.current) {
      window.clearTimeout(securityNoticeTimerRef.current);
    }
    securityNoticeTimerRef.current = window.setTimeout(() => {
      setSecurityNotice(null);
    }, 4500);
  }, []);

  const fetchAssignedExams = useCallback(async (token: string) => {
    setExamsLoading(true);
    setExamsError('');
    try {
      const res = await fetch('/api/cbt/exams', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setExamsError(data.error || 'Unable to load assigned examinations.');
      } else {
        setExams(data.exams || []);
      }
    } catch {
      setExamsError('Network error while loading examinations.');
    } finally {
      setExamsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (studentToken) {
      fetchAssignedExams(studentToken);
    }
  }, [studentToken, fetchAssignedExams]);

  const handleSubmitExam = useCallback(
    async (
      isAuto = false,
      reason: 'manual' | 'time_expired' | 'security_violation' = isAuto
        ? 'time_expired'
        : 'manual'
    ) => {
      if (!studentToken || !activeAttemptId) return;
      if (submittingExam) return;
      if (isAuto && autoSubmittedRef.current) return;
      if (isAuto) autoSubmittedRef.current = true;

      setSubmittingExam(true);
      setShowConfirmModal(false);
      setSecurityLockMessage(null);
      try {
        const res = await fetch(
          `/api/cbt/attempts/${activeAttemptId}/submit`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${studentToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason }),
          }
        );
        const data = await res.json();
        if (res.ok) {
          exitExamFullscreen();
          setSubmissionOutcome({
            resultsPublished: Boolean(data.resultsPublished),
            submissionReason: data.submissionReason ?? reason,
            securityViolations: data.securityViolations,
            result: data.result ?? null,
          });
          setActiveAttemptId(null);
          fetchAssignedExams(studentToken);
        } else {
          setExamsError(data.error || 'Failed to submit examination.');
        }
      } catch {
        setExamsError('Network error while submitting examination.');
      } finally {
        setSubmittingExam(false);
      }
    },
    [
      studentToken,
      activeAttemptId,
      submittingExam,
      fetchAssignedExams,
      exitExamFullscreen,
    ]
  );

  // Drift-free live countdown timer anchored to server remainingSeconds
  useEffect(() => {
    if (!activeAttemptId || submissionOutcome) return;

    const syncCountdown = () => {
      const deadlineMs = deadlineMsRef.current;
      if (deadlineMs === null) return false;
      const nextSeconds = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setRemainingSeconds(nextSeconds);
      if (nextSeconds <= 0) {
        handleSubmitExam(true, 'time_expired');
        return true;
      }
      return false;
    };

    if (syncCountdown()) return;

    const timer = window.setInterval(() => {
      if (syncCountdown()) {
        window.clearInterval(timer);
      }
    }, 250);

    document.addEventListener('visibilitychange', syncCountdown);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', syncCountdown);
    };
  }, [activeAttemptId, submissionOutcome, handleSubmitExam]);

  // Active Exam Security Lockdown (prevents minimizing, switching tabs, opening new tabs, or leaving fullscreen)
  const recordSecurityViolation = useCallback(
    async (
      reason: 'tab_switch' | 'window_blur' | 'fullscreen_exit',
      message: string
    ) => {
      if (!studentToken || !activeAttemptId || autoSubmittedRef.current) return;
      const now = Date.now();
      if (now - lastViolationAtRef.current < 1200) return;
      lastViolationAtRef.current = now;

      setSecurityLockMessage(message);

      try {
        const res = await fetch(
          `/api/cbt/attempts/${activeAttemptId}/violation`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${studentToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason }),
          }
        );
        const data = await res.json();
        if (res.ok) {
          if (typeof data.securityViolations === 'number') {
            setSecurityViolations(data.securityViolations);
          }
          if (data.autoSubmitted) {
            autoSubmittedRef.current = true;
            setSecurityLockMessage(null);
            exitExamFullscreen();
            setSubmissionOutcome({
              resultsPublished: Boolean(data.resultsPublished),
              submissionReason: 'security_violation',
              securityViolations: data.securityViolations,
              result: data.result ?? null,
            });
            setActiveAttemptId(null);
            fetchAssignedExams(studentToken);
          }
        }
      } catch {
        setSecurityViolations((v) => v + 1);
      }
    },
    [studentToken, activeAttemptId, exitExamFullscreen, fetchAssignedExams]
  );

  useEffect(() => {
    if (!activeAttemptId || submissionOutcome) return;

    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState !== 'visible') {
        recordSecurityViolation(
          'tab_switch',
          'You minimized the browser or switched away from the examination tab. Returning to fullscreen is required.'
        );
      }
    };

    const handleWindowBlur = () => {
      window.setTimeout(() => {
        if (document.hasFocus && !document.hasFocus()) {
          recordSecurityViolation(
            'window_blur',
            'The examination window lost focus. Switching windows, minimizing the page, or opening another tab is prohibited.'
          );
        }
      }, 100);
    };

    const handleFullscreenChange = () => {
      const activeFs = Boolean(document.fullscreenElement);
      setIsFullscreen(activeFs);
      if (activeFs) {
        enteredFullscreenRef.current = true;
      } else if (enteredFullscreenRef.current) {
        recordSecurityViolation(
          'fullscreen_exit',
          'You exited fullscreen exam mode. Fullscreen lockdown must remain active throughout the examination.'
        );
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const hasModifier = e.ctrlKey || e.metaKey;
      const blockedModifiedKeys = [
        't',
        'n',
        'w',
        'u',
        'p',
        's',
        'r',
        'c',
        'v',
        'x',
        'tab',
        'pageup',
        'pagedown',
      ];
      const blockedDevToolsKeys = ['i', 'j', 'c', 'n', 't'];

      if (
        e.key === 'F12' ||
        e.key === 'F5' ||
        e.key === 'PrintScreen' ||
        (hasModifier && blockedModifiedKeys.includes(key)) ||
        (hasModifier && e.shiftKey && blockedDevToolsKeys.includes(key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        showTransientSecurityNotice(
          'Opening new tabs, new windows, refreshing, copying, or developer shortcuts are blocked during the examination.'
        );
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      showTransientSecurityNotice(
        'Right-click options are disabled during an active examination.'
      );
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [
    activeAttemptId,
    submissionOutcome,
    recordSecurityViolation,
    showTransientSecurityNotice,
  ]);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!examNumber.trim() || !passcode.trim()) {
      setLoginError('Please enter both your Examination Number and Access Password.');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch('/api/cbt/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examNumber: examNumber.trim(),
          passcode: passcode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Sign-in failed.');
      } else {
        setStudentSession(data.token, data.student);
        setPasscode('');
      }
    } catch {
      setLoginError('Network error. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleStudentLogout = async () => {
    exitExamFullscreen();
    if (studentToken) {
      await fetch('/api/cbt/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
      }).catch(() => {});
    }
    clearStudentSession();
    setExams([]);
    setSelectedExamForInstructions(null);
    setActiveAttemptId(null);
    setActiveExam(null);
    setQuestions([]);
    setAnswers({});
    deadlineMsRef.current = null;
    setRemainingSeconds(0);
    setSecurityViolations(0);
    setSecurityLockMessage(null);
    setSubmissionOutcome(null);
  };

  const handleStartExam = async () => {
    if (!studentToken || !selectedExamForInstructions) return;
    setExamsError('');
    autoSubmittedRef.current = false;
    setSecurityLockMessage(null);
    setSecurityNotice(null);

    await requestExamFullscreen();

    try {
      const res = await fetch(
        `/api/cbt/exams/${selectedExamForInstructions.id}/start`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${studentToken}` },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        exitExamFullscreen();
        setExamsError(data.error || 'Unable to start examination.');
        return;
      }

      const initialRemaining = Math.max(
        0,
        Number(data.attempt.remainingSeconds ?? 0)
      );
      deadlineMsRef.current = Date.now() + initialRemaining * 1000;
      setActiveAttemptId(data.attempt.id);
      setActiveExam(selectedExamForInstructions);
      setQuestions(data.questions || []);
      setAnswers(data.savedAnswers || {});
      setRemainingSeconds(initialRemaining);
      setSecurityViolations(data.attempt.securityViolations ?? 0);
      setCurrentIndex(0);
      setSelectedExamForInstructions(null);
      setSubmissionOutcome(null);
    } catch {
      exitExamFullscreen();
      setExamsError('Network error starting examination.');
    }
  };

  const handleSelectOption = async (questionId: number, option: string) => {
    if (!studentToken || !activeAttemptId) return;
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
    setSaveStatus('saving');

    try {
      const res = await fetch(`/api/cbt/attempts/${activeAttemptId}/answer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questionId, selectedOption: option }),
      });
      if (res.ok) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
  };

  // VIEW 1: STUDENT AUTHENTICATION GATE
  if (!studentToken || !student) {
    return (
      <div className="min-h-screen bg-[#F5F8FC] flex flex-col">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="focus:outline-none">
            <BrandLogo compact />
          </Link>
          <Link
            to="/cbt"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#1769AA] hover:text-[#123B72] whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to CBT Overview
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#123B72] text-[#D4AF37] flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h1 className="font-display text-2xl font-bold text-[#123B72]">
                Student CBT Examination Login
              </h1>
              <p className="text-sm text-slate-600">
                Enter your Examination Number and Access Password issued by your
                school administrator.
              </p>
            </div>

            {loginError && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="examNumber"
                  className="block text-sm font-medium text-[#1E293B] mb-1.5"
                >
                  Examination Number / Student ID
                </label>
                <input
                  id="examNumber"
                  type="text"
                  required
                  value={examNumber}
                  onChange={(e) => setExamNumber(e.target.value)}
                  placeholder="e.g. JGT-2026-001"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono-tabular uppercase focus:outline-none focus:ring-2 focus:ring-[#1769AA]"
                />
              </div>

              <div>
                <label
                  htmlFor="studentPasscode"
                  className="block text-sm font-medium text-[#1E293B] mb-1.5"
                >
                  Access Password
                </label>
                <input
                  id="studentPasscode"
                  type="password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter access password"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1769AA]"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 rounded-lg bg-[#E83E8C] text-white font-semibold text-sm tracking-wide hover:bg-[#d1327c] disabled:opacity-60 transition-colors"
              >
                {loginLoading ? 'AUTHENTICATING...' : 'SIGN IN TO EXAMINATION'}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 text-center leading-relaxed">
              Need student examination credentials? Contact your school
              examination officer or administrator.
            </div>
          </div>
        </main>
      </div>
    );
  }

  // VIEW 2: SUBMISSION RESULT SCREEN
  if (submissionOutcome && activeExam) {
    return (
      <div className="min-h-screen bg-[#F5F8FC] flex flex-col">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 h-16 flex items-center justify-between no-print">
          <BrandLogo compact />
          <button
            type="button"
            onClick={handleStudentLogout}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#123B72]"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div className="space-y-1">
                <p className="text-xs font-semibold tracking-wider text-[#1769AA] uppercase">
                  Examination Submission Confirmed · Locked
                </p>
                <h1 className="font-display text-2xl font-bold text-[#123B72]">
                  {activeExam.title}
                </h1>
                <p className="text-sm text-slate-600">
                  {student.fullName} · {student.examNumber} ·{' '}
                  {student.classLevel}
                  {student.arm ? ` ${student.arm}` : ''} · {student.schoolName}
                </p>
              </div>
              <CheckCircle2 className="w-10 h-10 text-emerald-600 shrink-0" />
            </div>

            {submissionOutcome.submissionReason === 'security_violation' && (
              <div
                role="alert"
                className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm flex items-start gap-2.5"
              >
                <ShieldAlert className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    Automatic Security Submission Triggered
                  </p>
                  <p className="text-xs text-red-800 mt-0.5">
                    This examination was automatically submitted and locked
                    after reaching the maximum limit of 3 security warnings
                    (minimizing the page, exiting fullscreen, or switching tabs).
                  </p>
                </div>
              </div>
            )}

            {submissionOutcome.resultsPublished && submissionOutcome.result ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-[#F5F8FC] border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Score</p>
                    <p className="font-mono-tabular text-2xl font-bold text-[#123B72] mt-1">
                      {submissionOutcome.result.score}/
                      {submissionOutcome.result.totalMarks}
                    </p>
                  </div>
                  <div className="bg-[#F5F8FC] border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Percentage</p>
                    <p className="font-mono-tabular text-2xl font-bold text-[#E83E8C] mt-1">
                      {submissionOutcome.result.percentage}%
                    </p>
                  </div>
                  <div className="bg-[#F5F8FC] border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Correct Answers</p>
                    <p className="font-mono-tabular text-2xl font-bold text-emerald-700 mt-1">
                      {submissionOutcome.result.correctCount}/
                      {submissionOutcome.result.totalQuestions}
                    </p>
                  </div>
                  <div className="bg-[#F5F8FC] border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Status</p>
                    <p className="text-sm font-bold text-[#123B72] mt-2">
                      Submitted & Locked
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-[#F5F8FC] border border-slate-200 text-sm text-slate-700 leading-relaxed">
                Your examination answers have been recorded and locked securely.
                Your official score will be released once published by your
                school administrator.
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 no-print">
              <button
                type="button"
                onClick={() => {
                  setSubmissionOutcome(null);
                  setActiveExam(null);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#123B72] text-white text-sm font-semibold hover:bg-[#1769AA] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to My Examinations
              </button>

              {submissionOutcome.resultsPublished && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-[#1E293B] hover:bg-slate-50"
                >
                  <Printer className="w-4 h-4" />
                  Print Result Slip
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // VIEW 3: ACTIVE TIMED CBT EXAMINATION WORKSPACE
  if (activeAttemptId && activeExam && questions.length > 0) {
    const currentQuestion = questions[currentIndex];
    const answeredCount = questions.filter((q) => Boolean(answers[q.id])).length;
    const completionPercentage =
      questions.length > 0
        ? Math.round((answeredCount / questions.length) * 100)
        : 0;

    return (
      <div className="min-h-screen bg-[#F5F8FC] flex flex-col select-none">
        {/* Examination Top Bar */}
        <header className="sticky top-0 z-30 bg-[#123B72] text-white border-b border-white/15 px-4 sm:px-6 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-[#20C4D8] font-semibold truncate">
                {activeExam.subjectName} · {activeExam.title}
              </p>
              <p className="text-xs sm:text-sm text-slate-200 truncate">
                {student.fullName} ({student.examNumber}) · {student.classLevel}
                {student.arm ? ` ${student.arm}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-3 sm:gap-5 shrink-0">
              <div className="hidden md:flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-slate-200 font-mono-tabular">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#20C4D8]" />
                  <span>
                    Security Lock · Warnings: {securityViolations}/
                    {MAX_SECURITY_VIOLATIONS}
                  </span>
                </span>
                {!isFullscreen && (
                  <button
                    type="button"
                    onClick={requestExamFullscreen}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    <Maximize2 className="w-3 h-3" />
                    Fullscreen
                  </button>
                )}
              </div>

              <div className="text-xs hidden sm:block">
                {saveStatus === 'saving' && (
                  <span className="text-[#D4AF37]">Saving answer...</span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-emerald-300">Answers auto-saved</span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-red-300">Save retry needed</span>
                )}
              </div>

              <ExamCountdownTimer
                variant="header"
                remainingSeconds={remainingSeconds}
                totalDurationMinutes={activeExam.durationMinutes}
              />

              <button
                type="button"
                onClick={() => setShowMobilePalette((prev) => !prev)}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 text-xs font-semibold"
              >
                <LayoutGrid className="w-4 h-4" />
                <span>
                  {answeredCount}/{questions.length}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Exam Grid */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
          {securityNotice && (
            <div
              role="status"
              className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-4 py-3 text-xs sm:text-sm flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-medium">{securityNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setSecurityNotice(null)}
                className="text-amber-700 hover:text-amber-950 shrink-0"
                aria-label="Dismiss notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Visual Completion Progress Bar */}
          <section
            aria-label="Examination completion progress"
            className="bg-white border border-slate-200 rounded-xl p-4 sm:px-6 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="font-display font-bold text-[#123B72]">
                  Examination Progress
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="font-mono-tabular text-slate-600">
                  {answeredCount} of {questions.length} questions completed
                </span>
              </div>
              <span
                className={`font-mono-tabular text-sm sm:text-base font-bold ${
                  completionPercentage === 100
                    ? 'text-emerald-700'
                    : 'text-[#1769AA]'
                }`}
              >
                {completionPercentage}%
              </span>
            </div>

            <div
              role="progressbar"
              aria-valuenow={completionPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Percentage of questions completed"
              className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/80"
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  completionPercentage === 100
                    ? 'bg-emerald-600'
                    : 'bg-[#1769AA]'
                }`}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Question Display */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 sm:p-8 space-y-6">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="font-mono-tabular font-bold text-[#123B72]">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">
                    {currentQuestion.topic}
                  </span>
                </div>
                <span className="font-mono-tabular text-xs font-semibold text-[#1769AA]">
                  {currentQuestion.marks} mark
                  {currentQuestion.marks > 1 ? 's' : ''}
                </span>
              </div>

              <div className="text-base sm:text-lg font-medium text-[#1E293B] leading-relaxed">
                {currentQuestion.questionText}
              </div>

              {/* 4 Answer Options */}
              <div className="space-y-3">
                {(
                  [
                    { key: 'A', text: currentQuestion.optionA },
                    { key: 'B', text: currentQuestion.optionB },
                    { key: 'C', text: currentQuestion.optionC },
                    { key: 'D', text: currentQuestion.optionD },
                  ] as const
                ).map((opt) => {
                  const isSelected = answers[currentQuestion.id] === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() =>
                        handleSelectOption(currentQuestion.id, opt.key)
                      }
                      className={`w-full text-left flex items-start gap-3.5 p-4 rounded-xl border transition-colors min-h-[52px] ${
                        isSelected
                          ? 'border-[#1769AA] bg-[#1769AA]/5 text-[#123B72]'
                          : 'border-slate-200 bg-white hover:border-[#1769AA]/50 text-[#1E293B]'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg font-mono-tabular text-sm font-bold flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#1769AA] text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span className="text-sm sm:text-base pt-0.5 leading-relaxed">
                        {opt.text}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Prev / Next / Submit Controls */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-[#1E293B] hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={currentIndex === questions.length - 1}
                    onClick={() =>
                      setCurrentIndex((i) =>
                        Math.min(questions.length - 1, i + 1)
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#123B72] text-white text-sm font-semibold hover:bg-[#1769AA] disabled:opacity-40 transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c] transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Submit Examination
                </button>
              </div>
            </div>

            {/* Question Navigation & Live Countdown Panel */}
            <aside
              className={`lg:col-span-4 space-y-4 ${
                showMobilePalette ? 'block' : 'hidden lg:block'
              }`}
            >
              <ExamCountdownTimer
                variant="card"
                remainingSeconds={remainingSeconds}
                totalDurationMinutes={activeExam.durationMinutes}
              />

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-bold text-[#123B72]">
                    Question Navigation
                  </h2>
                  <span className="font-mono-tabular text-xs font-semibold text-[#1769AA]">
                    {answeredCount}/{questions.length} ({completionPercentage}%)
                  </span>
                </div>

              <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isAnswered = Boolean(answers[q.id]);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
                        setShowMobilePalette(false);
                      }}
                      className={`h-10 rounded-lg font-mono-tabular text-xs font-bold transition-colors ${
                        isCurrent
                          ? 'bg-[#E83E8C] text-white ring-2 ring-[#E83E8C]/30'
                          : isAnswered
                            ? 'bg-[#123B72] text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-[#E83E8C] inline-block" />
                  <span>Current Question</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-[#123B72] inline-block" />
                  <span>Answered &amp; Saved</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-slate-200 inline-block" />
                  <span>Not Yet Answered</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-[#123B72] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#1769AA]" />
                  Security Monitor Active
                </p>
                <p className="font-mono-tabular">
                  Warnings recorded: {securityViolations}/
                  {MAX_SECURITY_VIOLATIONS}
                </p>
              </div>

                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="w-full py-3 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c] transition-colors"
                >
                  Submit Examination
                </button>
              </div>
            </aside>
          </div>
        </main>

        {/* Exam Security Lockdown Modal (blocks minimizing / tab switch / fullscreen exit) */}
        {securityLockMessage && (
          <div
            role="alertdialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-[#123B72]/95 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <p className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-red-600">
                  Security Warning {securityViolations} of{' '}
                  {MAX_SECURITY_VIOLATIONS}
                </p>
                <h3 className="font-display text-xl font-bold text-[#123B72]">
                  Examination Screen Locked
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {securityLockMessage}
                </p>
                <p className="text-xs text-red-700 font-medium pt-1">
                  If you reach {MAX_SECURITY_VIOLATIONS} security warnings, your
                  examination will be automatically submitted and locked.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await requestExamFullscreen();
                  setSecurityLockMessage(null);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#E83E8C] text-white text-sm font-bold hover:bg-[#d1327c] transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
                Return to Fullscreen &amp; Resume Exam
              </button>
            </div>
          </div>
        )}

        {/* Submission Confirmation Modal */}
        {showConfirmModal && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          >
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-[#123B72]">
                  Confirm Examination Submission
                </h3>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-sm text-slate-700">
                <p>
                  Once submitted, your examination answers will be locked and
                  cannot be changed.
                </p>
                <div className="bg-[#F5F8FC] border border-slate-200 rounded-lg p-4 space-y-1.5 font-mono-tabular text-xs">
                  <div className="flex justify-between">
                    <span>Answered Questions:</span>
                    <strong className="text-[#123B72]">
                      {answeredCount} of {questions.length}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Unanswered Questions:</span>
                    <strong className="text-[#E83E8C]">
                      {questions.length - answeredCount}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Time Remaining:</span>
                    <strong className="text-[#1769AA]">
                      {formatCountdownTime(remainingSeconds)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Continue Exam
                </button>
                <button
                  type="button"
                  disabled={submittingExam}
                  onClick={() => handleSubmitExam(false)}
                  className="px-5 py-2.5 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c] disabled:opacity-60"
                >
                  {submittingExam ? 'Submitting...' : 'Confirm & Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // VIEW 4: EXAMINATION INSTRUCTIONS SCREEN
  if (selectedExamForInstructions) {
    return (
      <div className="min-h-screen bg-[#F5F8FC] flex flex-col">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 h-16 flex items-center justify-between">
          <BrandLogo compact />
          <button
            type="button"
            onClick={() => {
              setSelectedExamForInstructions(null);
              setAcknowledgedRules(false);
            }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1769AA] hover:text-[#123B72]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Subjects
          </button>
        </header>

        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2 border-b border-slate-200 pb-5">
              <p className="text-xs font-semibold tracking-wider text-[#1769AA] uppercase">
                Examination Instructions · {selectedExamForInstructions.subjectName}
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#123B72]">
                {selectedExamForInstructions.title}
              </h1>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div className="bg-[#F5F8FC] border border-slate-200 rounded-lg p-3.5">
                <p className="text-xs text-slate-500">Subject</p>
                <p className="font-semibold text-[#123B72] mt-0.5">
                  {selectedExamForInstructions.subjectName}
                </p>
              </div>
              <div className="bg-[#F5F8FC] border border-slate-200 rounded-lg p-3.5">
                <p className="text-xs text-slate-500">Duration</p>
                <p className="font-mono-tabular font-semibold text-[#123B72] mt-0.5">
                  {selectedExamForInstructions.durationMinutes} mins
                </p>
              </div>
              <div className="bg-[#F5F8FC] border border-slate-200 rounded-lg p-3.5">
                <p className="text-xs text-slate-500">Questions</p>
                <p className="font-mono-tabular font-semibold text-[#123B72] mt-0.5">
                  {selectedExamForInstructions.questionCount}
                </p>
              </div>
              <div className="bg-[#F5F8FC] border border-slate-200 rounded-lg p-3.5">
                <p className="text-xs text-slate-500">Candidate</p>
                <p className="font-mono-tabular font-semibold text-[#123B72] mt-0.5 truncate">
                  {student.examNumber} · {student.classLevel}
                  {student.arm ? ` ${student.arm}` : ''}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="font-display text-base font-bold text-[#123B72] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#E83E8C]" />
                Candidate Instructions
              </h2>
              <div className="p-4 rounded-xl bg-[#F5F8FC] border border-slate-200 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {selectedExamForInstructions.instructions}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#123B72]/5 border border-[#1769AA]/25 text-xs sm:text-sm text-[#1E293B] space-y-1.5">
              <p className="font-display font-bold text-[#123B72] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1769AA]" />
                Examination Security Lockdown Notice
              </p>
              <p className="text-slate-700 leading-relaxed">
                This examination runs in fullscreen lockdown mode. Minimizing
                the browser window, switching tabs, or opening a new tab is
                blocked and monitored. Up to 3 warnings are allowed before the
                system automatically submits and locks your examination.
              </p>
            </div>

            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={acknowledgedRules}
                onChange={(e) => setAcknowledgedRules(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#123B72]"
              />
              <span className="text-sm text-[#1E293B]">
                I confirm my examination details ({student.fullName} ·{' '}
                {student.examNumber} · {student.classLevel}
                {student.arm ? ` ${student.arm}` : ''}) and understand that
                once submitted, or upon reaching 3 security warnings, my
                examination cannot be reopened.
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedExamForInstructions(null);
                  setAcknowledgedRules(false);
                }}
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!acknowledgedRules}
                onClick={handleStartExam}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-lg bg-[#E83E8C] text-white text-sm font-bold tracking-wide hover:bg-[#d1327c] disabled:opacity-40 transition-colors"
              >
                {selectedExamForInstructions.attempt?.status === 'in_progress'
                  ? 'RESUME EXAMINATION'
                  : 'START EXAMINATION'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // VIEW 5: STUDENT ASSIGNED EXAMINATIONS LOBBY
  return (
    <div className="min-h-screen bg-[#F5F8FC] flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 h-16 flex items-center justify-between">
        <BrandLogo compact />
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right text-xs">
            <p className="font-semibold text-[#123B72]">{student.fullName}</p>
            <p className="font-mono-tabular text-slate-500">
              {student.examNumber} · {student.classLevel}
              {student.arm ? ` ${student.arm}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleStudentLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold tracking-wider text-[#1769AA] uppercase">
              {student.schoolName}
            </p>
            <h1 className="font-display text-2xl font-bold text-[#123B72]">
              Assigned CBT Examinations
            </h1>
            <p className="text-sm text-slate-600">
              Select an examination below to review instructions and begin.
            </p>
          </div>
          <div className="font-mono-tabular text-xs bg-[#F5F8FC] border border-slate-200 rounded-lg px-4 py-2.5 text-slate-700 space-y-0.5">
            <div>
              Candidate ID:{' '}
              <strong className="text-[#123B72]">{student.examNumber}</strong>
            </div>
            <div>
              Class &amp; Arm:{' '}
              <strong className="text-[#1769AA]">
                {student.classLevel}
                {student.arm ? ` · ${student.arm}` : ''}
              </strong>
            </div>
          </div>
        </div>

        {examsError && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{examsError}</span>
          </div>
        )}

        {examsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-44 rounded-xl bg-white border border-slate-200 animate-pulse p-6"
              />
            ))}
          </div>
        ) : exams.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
            <FileCheck2 className="w-10 h-10 text-slate-400 mx-auto" />
            <h2 className="font-display text-lg font-bold text-[#123B72]">
              No Active Examinations Assigned
            </h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              There are currently no active examinations assigned to your class
              or school. Please check with your examination officer.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {exams.map((exam) => {
              const isSubmitted = exam.attempt?.status === 'submitted';
              const isInProgress = exam.attempt?.status === 'in_progress';

              return (
                <div
                  key={exam.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#1769AA]">
                        {exam.subjectName} · {exam.subjectCode}
                      </span>
                      <span className="font-mono-tabular text-slate-500">
                        {exam.durationMinutes} mins · {exam.questionCount} Qs
                      </span>
                    </div>

                    <h2 className="font-display text-lg font-bold text-[#123B72]">
                      {exam.title}
                    </h2>

                    <p className="text-xs text-slate-500 font-mono-tabular">
                      Date: {exam.examDate} · Window: {exam.startTime}–
                      {exam.endTime} · Target: {exam.classLevel}
                      {exam.arm && exam.arm !== 'ALL' ? ` ${exam.arm}` : ''}
                    </p>
                  </div>

                  {isSubmitted ? (
                    <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                      {exam.resultsPublished &&
                      exam.attempt?.score !== undefined ? (
                        <div className="text-xs">
                          <span className="text-slate-500">Final Score: </span>
                          <strong className="font-mono-tabular text-sm text-[#123B72]">
                            {exam.attempt.score}/{exam.attempt.totalMarks} (
                            {exam.attempt.percentage}%)
                          </strong>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-emerald-700">
                          Submitted · Results Pending Release
                        </span>
                      )}
                      <span className="text-xs font-semibold text-slate-500">
                        Locked
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={exam.questionCount === 0}
                      onClick={() => {
                        setSelectedExamForInstructions(exam);
                        setAcknowledgedRules(false);
                      }}
                      className="w-full py-2.5 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c] disabled:opacity-40 transition-colors"
                    >
                      {exam.questionCount === 0
                        ? 'Questions Pending'
                        : isInProgress
                          ? 'Resume Examination'
                          : 'View Instructions & Start'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
