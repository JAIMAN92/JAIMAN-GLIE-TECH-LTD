import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  Plus,
  Printer,
  Trash2,
  Users,
  X,
} from 'lucide-react';

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
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
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
  classLevel: string;
  arm: string;
  durationMinutes: number;
  examDate: string;
  startTime: string;
  endTime: string;
  instructions: string;
  isActive: boolean;
  resultsPublished: boolean;
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
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Subjects & Questions state
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionRow | null>(
    null
  );
  const [qForm, setQForm] = useState({
    subjectId: '',
    topic: 'General',
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctOption: 'A',
    marks: '1',
  });
  const [showQImportModal, setShowQImportModal] = useState(false);
  const [qImportSubjectId, setQImportSubjectId] = useState('');
  const [qCsvText, setQCsvText] = useState('');

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
      'Read each question carefully. Select the most accurate option (A, B, C, or D). Answers are saved automatically.',
    isActive: true,
    resultsPublished: true,
    questionIds: [] as number[],
  });

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

  // Subject Handlers
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    const res = await fetch('/api/admin/subjects', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newSubName, code: newSubCode }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error || 'Unable to add subject.');
      return;
    }
    setNewSubName('');
    setNewSubCode('');
    setMsg(`Added subject: ${json.subject.name}`);
    loadAll();
  };

  // Question Handlers
  const openQuestionModal = (q?: QuestionRow) => {
    setErr('');
    if (q) {
      setEditingQuestion(q);
      setQForm({
        subjectId: String(q.subjectId),
        topic: q.topic,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        marks: String(q.marks),
      });
    } else {
      setEditingQuestion(null);
      setQForm({
        subjectId: filterSubjectId || (subjects[0] ? String(subjects[0].id) : ''),
        topic: 'General',
        questionText: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctOption: 'A',
        marks: '1',
      });
    }
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    const url = editingQuestion
      ? `/api/admin/questions/${editingQuestion.id}`
      : '/api/admin/questions';
    const method = editingQuestion ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...qForm,
        subjectId: Number(qForm.subjectId),
        marks: Number(qForm.marks) || 1,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error || 'Unable to save question.');
      return;
    }
    setShowQuestionModal(false);
    setMsg(editingQuestion ? 'Question updated.' : 'Question added.');
    loadAll();
  };

  const deleteQuestion = async (id: number) => {
    await fetch(`/api/admin/questions/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setMsg('Question removed.');
    loadAll();
  };

  const handleImportQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    const res = await fetch('/api/admin/questions/import', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subjectId: Number(qImportSubjectId),
        csvText: qCsvText,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error || 'Question import failed.');
      return;
    }
    setShowQImportModal(false);
    setQCsvText('');
    setMsg(`Imported ${json.imported} question(s).`);
    loadAll();
  };

  const downloadQuestionTemplate = () => {
    const sample =
      'topic,questionText,optionA,optionB,optionC,optionD,correctOption,marks\nAlgebra,"What is 2x + 4 = 10?",2,3,4,5,B,2\n';
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'question_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

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
        questionIds: ex.questionIds,
      });
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
          'Read each question carefully. Select the most accurate option (A, B, C, or D). Answers are saved automatically.',
        isActive: true,
        resultsPublished: true,
        questionIds: defaultQIds,
      });
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
    const params = new URLSearchParams();
    if (resExamId) params.set('examId', resExamId);
    if (resSchoolId) params.set('schoolId', resSchoolId);
    if (resClass) params.set('classLevel', resClass);
    if (resArm) params.set('arm', resArm);
    const res = await fetch(`/api/admin/results/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'jaiman_cbt_results.csv';
      a.click();
      URL.revokeObjectURL(url);
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

  const examArmOptions = Array.from(
    new Set(
      classArms
        .filter(
          (c) =>
            c.isActive &&
            (examForm.classLevel === 'ALL' ||
              c.classLevel.toUpperCase() === examForm.classLevel.toUpperCase())
        )
        .map((c) => c.armName)
    )
  );

  // QUESTION MANAGEMENT VIEW
  if (mode === 'questions') {
    const filteredQuestions = questions.filter((q) => {
      if (filterSubjectId && String(q.subjectId) !== filterSubjectId)
        return false;
      if (
        filterTopic.trim() &&
        !q.topic.toLowerCase().includes(filterTopic.trim().toLowerCase())
      )
        return false;
      return true;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#123B72]">
              Question Management
            </h2>
            <p className="text-sm text-slate-600">
              Create subjects, organize multiple-choice questions by topic, and
              import question sheets via CSV.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={subjects.length === 0}
              onClick={() => {
                setQImportSubjectId(
                  filterSubjectId || (subjects[0] ? String(subjects[0].id) : '')
                );
                setShowQImportModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#123B72] text-[#123B72] text-sm font-semibold hover:bg-[#123B72] hover:text-white"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Import Questions CSV
            </button>
            <button
              type="button"
              disabled={subjects.length === 0}
              onClick={() => openQuestionModal()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c]"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          </div>
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

        {/* Quick Subject Creator & Filter */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <form
            onSubmit={handleAddSubject}
            className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-3"
          >
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                New Subject Name
              </label>
              <input
                type="text"
                required
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder="e.g. Biology"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Code
              </label>
              <input
                type="text"
                required
                value={newSubCode}
                onChange={(e) => setNewSubCode(e.target.value)}
                placeholder="BIO"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm uppercase"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#123B72] text-white text-sm font-semibold hover:bg-[#1769AA]"
            >
              Add Subject
            </button>
          </form>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Filter by Subject
              </label>
              <select
                value={filterSubjectId}
                onChange={(e) => setFilterSubjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              >
                <option value="">All Subjects ({questions.length})</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.questionCount})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Filter by Topic
              </label>
              <input
                type="text"
                value={filterTopic}
                onChange={(e) => setFilterTopic(e.target.value)}
                placeholder="Search topic..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading questions...</p>
          ) : filteredQuestions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
              No questions found for the selected filter.
            </div>
          ) : (
            filteredQuestions.map((q) => (
              <div
                key={q.id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#1769AA]">
                      {q.subjectName} · {q.topic} ·{' '}
                      <span className="font-mono-tabular">
                        {q.marks} mark{q.marks > 1 ? 's' : ''}
                      </span>
                    </p>
                    <p className="text-sm sm:text-base font-medium text-[#1E293B]">
                      {q.questionText}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openQuestionModal(q)}
                      className="p-1.5 rounded text-[#1769AA] hover:bg-slate-100"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteQuestion(q.id)}
                      className="p-1.5 rounded text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                    const text =
                      opt === 'A'
                        ? q.optionA
                        : opt === 'B'
                          ? q.optionB
                          : opt === 'C'
                            ? q.optionC
                            : q.optionD;
                    const isAns = q.correctOption === opt;
                    return (
                      <div
                        key={opt}
                        className={`px-3 py-2 rounded-lg border ${
                          isAns
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold'
                            : 'border-slate-200 bg-[#F5F8FC] text-slate-700'
                        }`}
                      >
                        <strong className="font-mono-tabular mr-1.5">
                          {opt}.
                        </strong>
                        {text}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add/Edit Question Modal */}
        {showQuestionModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-[#123B72]">
                  {editingQuestion ? 'Edit Question' : 'Add Multiple-Choice Question'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSaveQuestion} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Subject *
                    </label>
                    <select
                      required
                      value={qForm.subjectId}
                      onChange={(e) =>
                        setQForm({ ...qForm, subjectId: e.target.value })
                      }
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
                      Topic
                    </label>
                    <input
                      type="text"
                      value={qForm.topic}
                      onChange={(e) =>
                        setQForm({ ...qForm, topic: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Question Text *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={qForm.questionText}
                    onChange={(e) =>
                      setQForm({ ...qForm, questionText: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                    const field = `option${opt}` as
                      | 'optionA'
                      | 'optionB'
                      | 'optionC'
                      | 'optionD';
                    return (
                      <div key={opt}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Option {opt} *
                        </label>
                        <input
                          type="text"
                          required
                          value={qForm[field]}
                          onChange={(e) =>
                            setQForm({ ...qForm, [field]: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Correct Answer *
                    </label>
                    <select
                      value={qForm.correctOption}
                      onChange={(e) =>
                        setQForm({ ...qForm, correctOption: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    >
                      <option value="A">Option A</option>
                      <option value="B">Option B</option>
                      <option value="C">Option C</option>
                      <option value="D">Option D</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Marks
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={qForm.marks}
                      onChange={(e) =>
                        setQForm({ ...qForm, marks: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowQuestionModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-[#123B72] text-white text-sm font-semibold"
                  >
                    Save Question
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Import Questions CSV Modal */}
        {showQImportModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-[#123B72]">
                  Import Questions via CSV
                </h3>
                <button
                  type="button"
                  onClick={() => setShowQImportModal(false)}
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="flex items-center justify-between text-xs bg-[#F5F8FC] p-3 rounded-lg border border-slate-200">
                <span>
                  Columns: topic, questionText, optionA..D, correctOption, marks
                </span>
                <button
                  type="button"
                  onClick={downloadQuestionTemplate}
                  className="inline-flex items-center gap-1 font-semibold text-[#1769AA]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Template
                </button>
              </div>
              <form onSubmit={handleImportQuestions} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Subject *
                  </label>
                  <select
                    required
                    value={qImportSubjectId}
                    onChange={(e) => setQImportSubjectId(e.target.value)}
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
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) f.text().then(setQCsvText);
                    }}
                    className="block w-full text-xs text-slate-600 mb-2"
                  />
                  <textarea
                    rows={6}
                    required
                    value={qCsvText}
                    onChange={(e) => setQCsvText(e.target.value)}
                    placeholder="topic,questionText,optionA,optionB,optionC,optionD,correctOption,marks"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQImportModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold"
                  >
                    Import Questions
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // EXAMINATION MANAGEMENT VIEW
  if (mode === 'examinations') {
    const subjectQuestions = questions.filter(
      (q) => String(q.subjectId) === examForm.subjectId
    );

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
                    <span className="text-slate-600">{ex.schoolName}</span>
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
                    {ex.submissionCount} Submitted · {ex.inProgressCount} Active
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleExamActive(ex)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
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
                      Class Level
                    </label>
                    <select
                      value={examForm.classLevel}
                      onChange={(e) =>
                        setExamForm({ ...examForm, classLevel: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    >
                      <option value="ALL">All Classes</option>
                      {availableClassLevels.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
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
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#123B72]">
                      Attach Questions ({examForm.questionIds.length} selected)
                    </label>
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
                      className="text-xs font-semibold text-[#1769AA] hover:underline"
                    >
                      {examForm.questionIds.length === subjectQuestions.length
                        ? 'Deselect All'
                        : 'Select All Subject Questions'}
                    </button>
                  </div>
                  <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-200">
                    {subjectQuestions.length === 0 ? (
                      <p className="p-3 text-xs text-slate-500">
                        No questions exist for this subject yet. Add questions
                        under Question Management.
                      </p>
                    ) : (
                      subjectQuestions.map((q) => {
                        const checked = examForm.questionIds.includes(q.id);
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
                            <span className="text-[#1E293B]">
                              <strong className="text-[#1769AA] mr-1">
                                [{q.topic}]
                              </strong>
                              {q.questionText}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 pt-1">
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
                          {s.schoolName} ({s.classLevel}
                          {s.arm ? ` · ${s.arm}` : ''})
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
            publication, export CSV sheets, and print reports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleExportResultsCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#123B72] text-[#123B72] text-sm font-semibold hover:bg-[#123B72] hover:text-white"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c]"
          >
            <Printer className="w-4 h-4" />
            Print Result Report
          </button>
        </div>
      </div>

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
                      {r.schoolName} · {r.classLevel}
                      {r.arm ? ` ${r.arm}` : ''}
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
