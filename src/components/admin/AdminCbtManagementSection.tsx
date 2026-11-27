import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Plus,
  Printer,
  Shuffle,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { AdminQuestionBankSection } from './AdminQuestionBankSection.tsx';
import { MathText } from '../MathText.tsx';
import { SchoolNameBadge } from '../SchoolNameBadge.tsx';
import { exportResultsToPdf } from '../../lib/resultsExport.ts';

interface SubjectRow {
  id: number;
  name: string;
  code: string;
  description: string;
  questionCount: number;
}

interface QuestionRow {
  id: number;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  topic: string;
  questionText: string;
  imageUrl?: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  correctOption: string;
  marks: number;
}

interface ExamRow {
  id: number;
  title: string;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  schoolId: number | null;
  schoolName: string;
  schoolLogoUrl?: string;
  classLevel: string;
  arm: string;
  durationMinutes: number;
  examDate: string;
  startTime: string;
  endTime: string;
  instructions: string;
  isActive: boolean;
  resultsPublished: boolean;
  shuffleQuestions?: boolean;
  questionIds: number[];
  submissionCount: number;
  inProgressCount: number;
}

interface SchoolOption {
  id: number;
  name: string;
  code: string;
}

interface ClassArmOption {
  id: number;
  schoolId: number | null;
  classLevel: string;
  armName: string;
  displayName: string;
  isActive: boolean;
}

interface ResultRow {
  attemptId: number;
  examId: number;
  examTitle: string;
  resultsPublished: boolean;
  subjectName: string;
  subjectCode: string;
  schoolId: number;
  schoolName: string;
  schoolLogoUrl?: string;
  examNumber: string;
  studentName: string;
  classLevel: string;
  arm: string;
  score: number;
  totalMarks: number;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  securityViolations?: number;
  submissionReason?: string;
  submittedAt: string;
}

interface SubmissionMonitorRow {
  attemptId: number;
  studentName: string;
  examNumber: string;
  classLevel: string;
  arm: string;
  schoolName: string;
  schoolLogoUrl?: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  score: number;
  totalMarks: number;
  percentage: number;
  securityViolations?: number;
  submissionReason?: string;
}

export function AdminCbtManagementSection({
  token,
  mode,
}: {
  token: string;
  mode: 'examinations' | 'questions' | 'results';
}) {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [classArms, setClassArms] = useState<ClassArmOption[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'pdf' | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Examination state
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamRow | null>(null);
  const [examForm, setExamForm] = useState({
    title: '',
    subjectId: '',
    schoolId: '',
    classLevel: 'ALL',
    arm: 'ALL',
    durationMinutes: '30',
    examDate: new Date().toISOString().slice(0, 10),
    startTime: '08:00',
    endTime: '18:00',
    instructions:
      'Read each question carefully. Select the most accurate option (A, B, C, D, or E). Answers are saved automatically.',
    isActive: true,
    resultsPublished: true,
    shuffleQuestions: false,
    questionIds: [] as number[],
  });
  const [pickerDisplayOrder, setPickerDisplayOrder] = useState<number[]>([]);

  // Submissions Monitor modal
  const [monitorExam, setMonitorExam] = useState<ExamRow | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionMonitorRow[]>([]);

  // Results filters
  const [resSchoolId, setResSchoolId] = useState('');
  const [resClass, setResClass] = useState('');
  const [resArm, setResArm] = useState('');
  const [resSubjectId, setResSubjectId] = useState('');
  const [resExamId, setResExamId] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, qRes, exRes, scRes, caRes] = await Promise.all([
        fetch('/api/admin/subjects', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/questions', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/examinations', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/schools', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/class-arms', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (subRes.ok) {
        const d = await subRes.json();
        setSubjects(d.subjects || []);
      }
      if (qRes.ok) {
        const d = await qRes.json();
        setQuestions(d.questions || []);
      }
      if (exRes.ok) {
        const d = await exRes.json();
        setExams(d.examinations || []);
      }
      if (scRes.ok) {
        const d = await scRes.json();
        setSchools(d.schools || []);
      }
      if (caRes.ok) {
        const d = await caRes.json();
        setClassArms(d.classArms || []);
      }
    } catch {
      setErr('Unable to load CBT data.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadResults = useCallback(async () => {
    const params = new URLSearchParams();
    if (resSchoolId) params.set('schoolId', resSchoolId);
    if (resClass) params.set('classLevel', resClass);
    if (resArm) params.set('arm', resArm);
    if (resSubjectId) params.set('subjectId', resSubjectId);
    if (resExamId) params.set('examId', resExamId);

    const res = await fetch(`/api/admin/results?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const d = await res.json();
      setResults(d.results || []);
    }
  }, [token, resSchoolId, resClass, resArm, resSubjectId, resExamId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (mode === 'results') {
      loadResults();
    }
  }, [mode, loadResults]);

  // Examination Handlers
  const openExamModal = (ex?: ExamRow) => {
    setErr('');
    if (ex) {
      setEditingExam(ex);
      setExamForm({
        title: ex.title,
        subjectId: String(ex.subjectId),
        schoolId: ex.schoolId ? String(ex.schoolId) : '',
        classLevel: ex.classLevel,
        arm: ex.arm || 'ALL',
        durationMinutes: String(ex.durationMinutes),
        examDate: ex.examDate,
        startTime: ex.startTime,
        endTime: ex.endTime,
        instructions: ex.instructions,
        isActive: ex.isActive,
        resultsPublished: ex.resultsPublished,
        shuffleQuestions: Boolean(ex.shuffleQuestions),
        questionIds: ex.questionIds,
      });
      setPickerDisplayOrder(ex.questionIds);
    } else {
      setEditingExam(null);
      const defaultSub = subjects[0] ? String(subjects[0].id) : '';
      const defaultQIds = questions
        .filter((q) => String(q.subjectId) === defaultSub)
        .map((q) => q.id);
      setExamForm({
        title: '',
        subjectId: defaultSub,
        schoolId: '',
        classLevel: 'ALL',
        arm: 'ALL',
        durationMinutes: '30',
        examDate: new Date().toISOString().slice(0, 10),
        startTime: '08:00',
        endTime: '18:00',
        instructions:
          'Read each question carefully. Select the most accurate option (A, B, C, D, or E). Answers are saved automatically.',
        isActive: true,
        resultsPublished: true,
        shuffleQuestions: false,
        questionIds: defaultQIds,
      });
      setPickerDisplayOrder(defaultQIds);
    }
    setShowExamModal(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    const url = editingExam
      ? `/api/admin/examinations/${editingExam.id}`
      : '/api/admin/examinations';
    const method = editingExam ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...examForm,
        subjectId: Number(examForm.subjectId),
        schoolId: examForm.schoolId ? Number(examForm.schoolId) : null,
        durationMinutes: Number(examForm.durationMinutes) || 30,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error || 'Unable to save examination.');
      return;
    }
    setShowExamModal(false);
    setMsg(editingExam ? 'Examination updated.' : 'Examination created.');
    loadAll();
  };

  const toggleExamActive = async (ex: ExamRow) => {
    await fetch(`/api/admin/examinations/${ex.id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    loadAll();
  };

  const toggleExamShuffle = async (ex: ExamRow) => {
    setErr('');
    setMsg('');
    const res = await fetch(`/api/admin/examinations/${ex.id}/shuffle`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shuffleQuestions: !ex.shuffleQuestions }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setErr(json.error || 'Unable to update shuffle setting.');
      return;
    }
    setMsg(
      !ex.shuffleQuestions
        ? `Per-candidate question shuffling enabled for "${ex.title}".`
        : `Per-candidate question shuffling disabled for "${ex.title}".`
    );
    loadAll();
  };

  const handleShuffleModalQuestionOrder = () => {
    setExamForm((prev) => {
      if (prev.questionIds.length < 2) return prev;
      const shuffled = [...prev.questionIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      setPickerDisplayOrder(shuffled);
      return { ...prev, questionIds: shuffled };
    });
  };

  const toggleExamResultsPublished = async (exId: number, current: boolean) => {
    await fetch(`/api/admin/examinations/${exId}/publish-results`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ published: !current }),
    });
    loadAll();
    if (mode === 'results') loadResults();
  };

  const deleteExam = async (id: number) => {
    await fetch(`/api/admin/examinations/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setMsg('Examination deleted.');
    loadAll();
  };

  const openMonitorSubmissions = async (ex: ExamRow) => {
    setMonitorExam(ex);
    const res = await fetch(`/api/admin/examinations/${ex.id}/submissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setSubmissions(json.submissions || []);
    }
  };

  const handleExportResultsCsv = async () => {
    setErr('');
    setMsg('');
    if (results.length === 0) {
      setErr('No examination results match the current filters to export.');
      return;
    }

    setExportingFormat('csv');
    try {
      const params = new URLSearchParams();
      if (resExamId) params.set('examId', resExamId);
      if (resSchoolId) params.set('schoolId', resSchoolId);
      if (resSubjectId) params.set('subjectId', resSubjectId);
      if (resClass) params.set('classLevel', resClass);
      if (resArm) params.set('arm', resArm);
      const res = await fetch(`/api/admin/results/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setErr('Unable to export CSV results right now.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const dateTag = new Date().toISOString().slice(0, 10);
      const fileName = `jaiman_cbt_results_${dateTag}.csv`;
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`Exported ${results.length} examination result(s) to ${fileName}.`);
    } catch {
      setErr('Network error while exporting CSV results.');
    } finally {
      setExportingFormat(null);
    }
  };

  const handleExportResultsPdf = () => {
    setErr('');
    setMsg('');
    if (results.length === 0) {
      setErr('No examination results match the current filters to export.');
      return;
    }

    setExportingFormat('pdf');
    try {
      const schoolName = resSchoolId
        ? schools.find((s) => String(s.id) === resSchoolId)?.name
        : undefined;
      const subjectName = resSubjectId
        ? subjects.find((s) => String(s.id) === resSubjectId)?.name
        : undefined;
      const examTitle = resExamId
        ? exams.find((ex) => String(ex.id) === resExamId)?.title
        : undefined;

      const fileName = exportResultsToPdf(results, {
        schoolName,
        classLevel: resClass || undefined,
        arm: resArm || undefined,
        subjectName,
        examTitle,
      });
      setMsg(`Exported ${results.length} examination result(s) to ${fileName}.`);
    } catch {
      setErr('Unable to generate PDF results report.');
    } finally {
      setExportingFormat(null);
    }
  };

  const availableClassLevels = Array.from(
    new Set([
      'JSS1',
      'JSS2',
      'JSS3',
      'SS1',
      'SS2',
      'SS3',
      ...classArms.filter((c) => c.isActive).map((c) => c.classLevel),
    ])
  );

  const availableArmNames = Array.from(
    new Set(classArms.filter((c) => c.isActive).map((c) => c.armName))
  );

  const examScopedClasses = Array.from(
    new Set(
      classArms
        .filter(
          (c) =>
            c.isActive &&
            c.schoolId !== null &&
            examForm.schoolId !== '' &&
            String(c.schoolId) === examForm.schoolId
        )
        .map((c) => c.classLevel)
    )
  );

  const examOtherClassLevels = availableClassLevels.filter(
    (c) => !examScopedClasses.includes(c)
  );

  const examArmOptions = Array.from(
    new Set(
      classArms
        .filter(
          (c) =>
            c.isActive &&
            (!examForm.schoolId ||
              c.schoolId === null ||
              String(c.schoolId) === examForm.schoolId) &&
            (examForm.classLevel === 'ALL' ||
              c.classLevel.toUpperCase() === examForm.classLevel.toUpperCase())
        )
        .map((c) => c.armName)
    )
  );

  // QUESTION MANAGEMENT VIEW
  if (mode === 'questions') {
    return (
      <AdminQuestionBankSection
        token={token}
        subjects={subjects}
        questions={questions}
        exams={exams}
        loading={loading}
        onReload={loadAll}
      />
    );
  }

  // EXAMINATION MANAGEMENT VIEW
  if (mode === 'examinations') {
    const rawSubjectQuestions = questions.filter(
      (q) => String(q.subjectId) === examForm.subjectId
    );
    const orderRank = new Map<number, number>();
    pickerDisplayOrder.forEach((id, idx) => orderRank.set(id, idx));
    const subjectQuestions = [...rawSubjectQuestions].sort((a, b) => {
      const rankA = orderRank.get(a.id);
      const rankB = orderRank.get(b.id);
      if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
      if (rankA !== undefined) return -1;
      if (rankB !== undefined) return 1;
      return a.id - b.id;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#123B72]">
              Examination Management
            </h2>
            <p className="text-sm text-slate-600">
              Schedule CBT examinations, attach questions, assign schools/classes,
              and monitor live submissions.
            </p>
          </div>
          <button
            type="button"
            disabled={subjects.length === 0}
            onClick={() => openExamModal()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c]"
          >
            <Plus className="w-4 h-4" />
            Create Examination
          </button>
        </div>

        {msg && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{msg}</span>
          </div>
        )}
        {err && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            {err}
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading examinations...</p>
          ) : exams.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
              No examinations created yet.
            </div>
          ) : (
            exams.map((ex) => (
              <div
                key={ex.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-[#1769AA]">
                      {ex.subjectName}
                    </span>
                    <span className="text-slate-400">·</span>
                    {ex.schoolId ? (
                      <SchoolNameBadge
                        name={ex.schoolName}
                        logoUrl={ex.schoolLogoUrl}
                        size="xs"
                        nameClassName="text-xs font-medium text-slate-700"
                      />
                    ) : (
                      <span className="text-slate-600">{ex.schoolName}</span>
                    )}
                    <span className="text-slate-400">·</span>
                    <span className="font-mono-tabular text-slate-600">
                      Class: {ex.classLevel}
                      {ex.arm && ex.arm !== 'ALL' ? ` · ${ex.arm}` : ' (All Arms)'}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#123B72]">
                    {ex.title}
                  </h3>
                  <p className="font-mono-tabular text-xs text-slate-500">
                    Date: {ex.examDate} ({ex.startTime}–{ex.endTime}) ·{' '}
                    {ex.durationMinutes} mins · {ex.questionIds.length} Qs ·{' '}
                    {ex.submissionCount} Submitted · {ex.inProgressCount} Active ·{' '}
                    {ex.shuffleQuestions ? 'Shuffled per candidate' : 'Fixed order'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleExamShuffle(ex)}
                    title="Toggle unique random question order for each student or applicant"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 ${
                      ex.shuffleQuestions
                        ? 'border-sky-200 bg-sky-50 text-[#1769AA]'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    {ex.shuffleQuestions ? 'Shuffle: On' : 'Shuffle: Off'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleExamActive(ex)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 ${
                      ex.isActive
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-100 text-slate-600'
                    }`}
                  >
                    {ex.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openMonitorSubmissions(ex)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#123B72] hover:bg-slate-50"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Submissions
                  </button>
                  <button
                    type="button"
                    onClick={() => openExamModal(ex)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#1769AA] hover:bg-slate-50"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteExam(ex.id)}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create/Edit Examination Modal */}
        {showExamModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-[#123B72]">
                  {editingExam ? 'Edit Examination' : 'Create Examination'}
                </h3>
                <button type="button" onClick={() => setShowExamModal(false)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSaveExam} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Examination Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={examForm.title}
                    onChange={(e) =>
                      setExamForm({ ...examForm, title: e.target.value })
                    }
                    placeholder="e.g. First Term SS2 Mathematics Examination"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Subject *
                    </label>
                    <select
                      required
                      value={examForm.subjectId}
                      onChange={(e) => {
                        const subId = e.target.value;
                        const matchingQs = questions
                          .filter((q) => String(q.subjectId) === subId)
                          .map((q) => q.id);
                        setExamForm({
                          ...examForm,
                          subjectId: subId,
                          questionIds: matchingQs,
                        });
                        setPickerDisplayOrder(matchingQs);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Target School
                    </label>
                    <select
                      value={examForm.schoolId}
                      onChange={(e) =>
                        setExamForm({ ...examForm, schoolId: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    >
                      <option value="">All Registered Schools</option>
                      {schools.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Class Level / Category
                    </label>
                    <select
                      value={examForm.classLevel}
                      onChange={(e) =>
                        setExamForm({ ...examForm, classLevel: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    >
                      <option value="ALL">All Classes</option>
                      {examScopedClasses.length > 0 ? (
                        <>
                          <optgroup label="Selected School / Agency Classes">
                            {examScopedClasses.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Other / Standard Classes">
                            {examOtherClassLevels.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </optgroup>
                        </>
                      ) : (
                        availableClassLevels.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Target Arm
                    </label>
                    <select
                      value={examForm.arm}
                      onChange={(e) =>
                        setExamForm({ ...examForm, arm: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    >
                      <option value="ALL">All Arms</option>
                      {examArmOptions.map((arm) => (
                        <option key={arm} value={arm}>
                          {arm}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Duration (Mins)
                    </label>
                    <input
                      type="number"
                      min={5}
                      value={examForm.durationMinutes}
                      onChange={(e) =>
                        setExamForm({
                          ...examForm,
                          durationMinutes: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Exam Date
                    </label>
                    <input
                      type="date"
                      required
                      value={examForm.examDate}
                      onChange={(e) =>
                        setExamForm({ ...examForm, examDate: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={examForm.startTime}
                      onChange={(e) =>
                        setExamForm({ ...examForm, startTime: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={examForm.endTime}
                      onChange={(e) =>
                        setExamForm({ ...examForm, endTime: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Examination Instructions *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={examForm.instructions}
                    onChange={(e) =>
                      setExamForm({ ...examForm, instructions: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>

                {/* Question Picker */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-[#123B72]">
                      Attach Questions ({examForm.questionIds.length} selected)
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      {examForm.questionIds.length > 1 && (
                        <button
                          type="button"
                          onClick={handleShuffleModalQuestionOrder}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#E83E8C] hover:underline whitespace-nowrap shrink-0"
                        >
                          <Shuffle className="w-3.5 h-3.5" />
                          Shuffle List Order
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setExamForm({
                            ...examForm,
                            questionIds:
                              examForm.questionIds.length ===
                              subjectQuestions.length
                                ? []
                                : subjectQuestions.map((q) => q.id),
                          })
                        }
                        className="text-xs font-semibold text-[#1769AA] hover:underline whitespace-nowrap shrink-0"
                      >
                        {examForm.questionIds.length === subjectQuestions.length
                          ? 'Deselect All'
                          : 'Select All Subject Questions'}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-200">
                    {subjectQuestions.length === 0 ? (
                      <p className="p-3 text-xs text-slate-500">
                        No questions exist for this subject yet. Add questions
                        under Question Management.
                      </p>
                    ) : (
                      subjectQuestions.map((q) => {
                        const selectedOrderIdx = examForm.questionIds.indexOf(q.id);
                        const checked = selectedOrderIdx !== -1;
                        return (
                          <label
                            key={q.id}
                            className="flex items-start gap-2.5 p-2.5 text-xs cursor-pointer hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...examForm.questionIds, q.id]
                                  : examForm.questionIds.filter(
                                      (id) => id !== q.id
                                    );
                                setExamForm({ ...examForm, questionIds: next });
                              }}
                              className="mt-0.5 accent-[#123B72]"
                            />
                            {checked && (
                              <span className="font-mono-tabular text-[11px] font-bold text-[#1769AA] shrink-0 min-w-[24px]">
                                #{selectedOrderIdx + 1}
                              </span>
                            )}
                            <span className="text-[#1E293B]">
                              <strong className="text-[#1769AA] mr-1">
                                [{q.topic}]
                              </strong>
                              <MathText text={q.questionText} />
                              {q.imageUrl && (
                                <span className="ml-1.5 text-[11px] font-semibold text-emerald-700">
                                  · Diagram attached
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-[#1E293B]">
                    <input
                      type="checkbox"
                      checked={examForm.isActive}
                      onChange={(e) =>
                        setExamForm({ ...examForm, isActive: e.target.checked })
                      }
                      className="accent-[#123B72]"
                    />
                    Examination Active for Students
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-[#1E293B]">
                    <input
                      type="checkbox"
                      checked={examForm.resultsPublished}
                      onChange={(e) =>
                        setExamForm({
                          ...examForm,
                          resultsPublished: e.target.checked,
                        })
                      }
                      className="accent-[#123B72]"
                    />
                    Publish Scores Immediately Upon Submission
                  </label>
                  <label className="sm:col-span-2 flex items-start gap-2.5 p-3 rounded-lg bg-[#F5F8FC] border border-slate-200 text-xs text-[#1E293B] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={examForm.shuffleQuestions}
                      onChange={(e) =>
                        setExamForm({
                          ...examForm,
                          shuffleQuestions: e.target.checked,
                        })
                      }
                      className="mt-0.5 accent-[#123B72]"
                    />
                    <span>
                      <strong className="block text-[#123B72]">
                        Shuffle Questions for Each Student / Applicant
                      </strong>
                      <span className="text-slate-600">
                        Automatically randomizes the question sequence for each
                        candidate when they begin the exam (and preserves their
                        exact sequence if they resume).
                      </span>
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowExamModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-[#123B72] text-white text-sm font-semibold"
                  >
                    Save Examination
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Monitor Submissions Modal */}
        {monitorExam && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#123B72]">
                    Submissions — {monitorExam.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {monitorExam.subjectName} · {monitorExam.examDate}
                  </p>
                </div>
                <button type="button" onClick={() => setMonitorExam(null)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              {submissions.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">
                  No students have started this examination yet.
                </p>
              ) : (
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#F5F8FC] text-xs text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Candidate</th>
                      <th className="px-3 py-2">School & Class</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Warnings</th>
                      <th className="px-3 py-2 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {submissions.map((s) => (
                      <tr key={s.attemptId}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-[#123B72]">
                            {s.studentName}
                          </p>
                          <p className="font-mono-tabular text-xs text-slate-500">
                            {s.examNumber}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          <SchoolNameBadge
                            name={s.schoolName}
                            logoUrl={s.schoolLogoUrl}
                            size="xs"
                            subtitle={`${s.classLevel}${s.arm ? ` · ${s.arm}` : ''}`}
                            nameClassName="text-xs font-medium text-slate-700"
                          />
                        </td>
                        <td className="px-3 py-2 capitalize font-medium">
                          {s.status.replace('_', ' ')}
                          {s.submissionReason === 'security_violation' && (
                            <span className="block text-[11px] text-red-600 font-semibold">
                              Auto-submitted (Security)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono-tabular">
                          <span
                            className={
                              (s.securityViolations ?? 0) > 0
                                ? 'text-red-600 font-semibold'
                                : 'text-slate-500'
                            }
                          >
                            {s.securityViolations ?? 0}/3
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono-tabular font-semibold">
                          {s.status === 'submitted'
                            ? `${s.score}/${s.totalMarks} (${s.percentage}%)`
                            : 'In Progress'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // RESULTS MANAGEMENT VIEW
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#123B72]">
            Results Management
          </h2>
          <p className="text-sm text-slate-600">
            Filter automatically marked CBT results, control result
            publication, and export reports as PDF or CSV.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={exportingFormat !== null}
            onClick={handleExportResultsCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#123B72] text-[#123B72] text-sm font-semibold hover:bg-[#123B72] hover:text-white disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exportingFormat === 'csv' ? 'Exporting CSV...' : 'Export CSV'}
          </button>
          <button
            type="button"
            disabled={exportingFormat !== null}
            onClick={handleExportResultsPdf}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#123B72] text-white text-sm font-semibold hover:bg-[#1769AA] disabled:opacity-50 transition-colors"
          >
            <FileText className="w-4 h-4" />
            {exportingFormat === 'pdf' ? 'Generating PDF...' : 'Export PDF'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c] transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2 no-print">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{msg}</span>
        </div>
      )}
      {err && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm no-print">
          {err}
        </div>
      )}

      {/* Publication Controls per Exam */}
      {exams.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 no-print">
          <p className="text-xs font-semibold text-[#123B72] uppercase tracking-wider">
            Result Publication Control
          </p>
          <div className="flex flex-wrap gap-2.5">
            {exams.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() =>
                  toggleExamResultsPublished(ex.id, ex.resultsPublished)
                }
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                  ex.resultsPublished
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{ex.title}:</span>
                <span>{ex.resultsPublished ? 'Published' : 'Withheld'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 no-print">
        <select
          value={resSchoolId}
          onChange={(e) => setResSchoolId(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
        >
          <option value="">All Schools</option>
          {schools.map((sc) => (
            <option key={sc.id} value={sc.id}>
              {sc.name}
            </option>
          ))}
        </select>

        <select
          value={resClass}
          onChange={(e) => setResClass(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
        >
          <option value="">All Classes</option>
          {availableClassLevels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={resArm}
          onChange={(e) => setResArm(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
        >
          <option value="">All Arms</option>
          {availableArmNames.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          value={resSubjectId}
          onChange={(e) => setResSubjectId(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={resExamId}
          onChange={(e) => setResExamId(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
        >
          <option value="">All Examinations</option>
          {exams.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.title}
            </option>
          ))}
        </select>
      </div>

      {/* Results Table (Printable!) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="hidden print:block p-5 border-b border-slate-300">
          <h1 className="text-xl font-bold text-[#123B72]">
            JAIMAN GOLDENLITE TECH LTD — Official CBT Result Report
          </h1>
          <p className="text-xs text-slate-600">
            Generated on {new Date().toLocaleString()}
          </p>
        </div>

        {results.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No submitted examination results match your filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F5F8FC] text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Candidate</th>
                  <th className="px-4 py-3 font-semibold">
                    School, Class &amp; Arm
                  </th>
                  <th className="px-4 py-3 font-semibold">Examination</th>
                  <th className="px-4 py-3 font-semibold text-right">Correct</th>
                  <th className="px-4 py-3 font-semibold text-right">Score</th>
                  <th className="px-4 py-3 font-semibold text-right">%</th>
                  <th className="px-4 py-3 font-semibold text-right no-print">
                    Reset
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {results.map((r) => (
                  <tr key={r.attemptId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#123B72]">
                        {r.studentName}
                      </p>
                      <p className="font-mono-tabular text-xs text-slate-500">
                        {r.examNumber}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <SchoolNameBadge
                        name={r.schoolName}
                        logoUrl={r.schoolLogoUrl}
                        size="xs"
                        subtitle={`${r.classLevel}${r.arm ? ` ${r.arm}` : ''}`}
                        nameClassName="text-sm font-medium text-slate-700"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1E293B]">
                        {r.examTitle}
                      </p>
                      <p className="text-xs text-[#1769AA]">
                        {r.subjectName}
                        {(r.securityViolations ?? 0) > 0 && (
                          <span className="text-red-600 font-semibold">
                            {' '}
                            · {r.securityViolations}/3 security warning
                            {r.securityViolations === 1 ? '' : 's'}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular">
                      {r.correctCount}/{r.totalQuestions}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-semibold text-[#123B72]">
                      {r.score}/{r.totalMarks}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-bold text-[#E83E8C]">
                      {r.percentage}%
                    </td>
                    <td className="px-4 py-3 text-right no-print">
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/admin/results/${r.attemptId}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          loadResults();
                        }}
                        className="p-1.5 rounded text-red-600 hover:bg-red-50"
                        title="Reset attempt so candidate can retake"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
