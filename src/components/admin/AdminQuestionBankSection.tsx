import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Edit3,
  FolderOpen,
  ImagePlus,
  Layers,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  isValidQuestionImageUrl,
  prepareQuestionImageFile,
} from '../../lib/imageUpload.ts';
import { MathText, validateLatexInText } from '../MathText.tsx';
import { BulkQuestionsUploadModal } from './BulkQuestionsUploadModal.tsx';
import {
  LatexFormulaToolbar,
  type QuestionFieldKey,
} from './LatexFormulaToolbar.tsx';

export interface QuestionBankSubject {
  id: number;
  name: string;
  code: string;
  description: string;
  questionCount: number;
}

export interface QuestionBankItem {
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
  correctOption: string;
  marks: number;
}

export interface QuestionBankExam {
  id: number;
  title: string;
  subjectId: number;
}

type QuestionWorkspaceTab = 'directory' | 'manual' | 'bulk';

export function AdminQuestionBankSection({
  token,
  subjects,
  questions,
  exams,
  loading,
  onReload,
}: {
  token: string;
  subjects: QuestionBankSubject[];
  questions: QuestionBankItem[];
  exams: QuestionBankExam[];
  loading: boolean;
  onReload: () => Promise<void> | void;
}) {
  const { admin } = useAuth();
  const isSuperAdmin = admin?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<QuestionWorkspaceTab>('directory');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick subject creation (Super Admin only)
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');

  // Manual Question Studio state
  const [editingQuestion, setEditingQuestion] =
    useState<QuestionBankItem | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [qForm, setQForm] = useState({
    subjectId: subjects[0] ? String(subjects[0].id) : '',
    topic: 'General',
    questionText: '',
    imageUrl: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctOption: 'A' as 'A' | 'B' | 'C' | 'D',
    marks: '1',
  });

  const [activeField, setActiveField] =
    useState<QuestionFieldKey>('questionText');
  const fieldRefs = useRef<
    Record<QuestionFieldKey, HTMLTextAreaElement | HTMLInputElement | null>
  >({
    questionText: null,
    optionA: null,
    optionB: null,
    optionC: null,
    optionD: null,
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const insertLatexSnippet = (snippet: string) => {
    const el = fieldRefs.current[activeField];
    const current = qForm[activeField];
    if (!el) {
      const next = current ? `${current} ${snippet}` : snippet;
      setQForm((prev) => ({ ...prev, [activeField]: next }));
      return;
    }

    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const nextValue =
      current.slice(0, start) + snippet + current.slice(end);
    setQForm((prev) => ({ ...prev, [activeField]: nextValue }));

    const nextCursor = start + snippet.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const wrapSelectionWithDollar = () => {
    const el = fieldRefs.current[activeField];
    const current = qForm[activeField];
    if (!el) {
      setQForm((prev) => ({
        ...prev,
        [activeField]: current ? `$${current}$` : '$  $',
      }));
      return;
    }

    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const selected = current.slice(start, end);
    const wrapped = selected ? `$${selected}$` : '$$';
    const nextValue =
      current.slice(0, start) + wrapped + current.slice(end);
    setQForm((prev) => ({ ...prev, [activeField]: nextValue }));

    const cursorPos = selected ? start + wrapped.length : start + 1;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const latexWarnings = useMemo(() => {
    return [
      ...validateLatexInText(qForm.questionText),
      ...validateLatexInText(qForm.optionA),
      ...validateLatexInText(qForm.optionB),
      ...validateLatexInText(qForm.optionC),
      ...validateLatexInText(qForm.optionD),
    ];
  }, [
    qForm.questionText,
    qForm.optionA,
    qForm.optionB,
    qForm.optionC,
    qForm.optionD,
  ]);

  const effectiveSubjectId =
    qForm.subjectId ||
    filterSubjectId ||
    (subjects[0] ? String(subjects[0].id) : '');

  const subjectSummaries = useMemo(() => {
    return subjects.map((sub) => {
      const subQuestions = questions.filter((q) => q.subjectId === sub.id);
      const topics = new Set(subQuestions.map((q) => q.topic || 'General'));
      const totalMarks = subQuestions.reduce((acc, q) => acc + (q.marks || 1), 0);
      return {
        ...sub,
        liveCount: subQuestions.length,
        topicCount: topics.size,
        totalMarks,
      };
    });
  }, [subjects, questions]);

  const topicsForSelectedSubject = useMemo(() => {
    const source = filterSubjectId
      ? questions.filter((q) => String(q.subjectId) === filterSubjectId)
      : questions;
    return Array.from(
      new Set(source.map((q) => q.topic.trim() || 'General'))
    ).sort((a, b) => a.localeCompare(b));
  }, [questions, filterSubjectId]);

  const builderTopicSuggestions = useMemo(() => {
    return Array.from(
      new Set(
        questions
          .filter((q) =>
            effectiveSubjectId ? String(q.subjectId) === effectiveSubjectId : true
          )
          .map((q) => q.topic.trim() || 'General')
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [questions, effectiveSubjectId]);

  const filteredQuestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return questions.filter((q) => {
      if (filterSubjectId && String(q.subjectId) !== filterSubjectId) {
        return false;
      }
      if (filterTopic && (q.topic.trim() || 'General') !== filterTopic) {
        return false;
      }
      if (query) {
        const haystack = `${q.questionText} ${q.topic} ${q.subjectName} ${q.optionA} ${q.optionB} ${q.optionC} ${q.optionD}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [questions, filterSubjectId, filterTopic, searchQuery]);

  const totalBankMarks = useMemo(
    () => questions.reduce((sum, q) => sum + (q.marks || 1), 0),
    [questions]
  );

  const totalTopicsCount = useMemo(
    () =>
      new Set(
        questions.map((q) => `${q.subjectId}::${q.topic.trim() || 'General'}`)
      ).size,
    [questions]
  );

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
    setFilterSubjectId(String(json.subject.id));
    setQForm((prev) => ({ ...prev, subjectId: String(json.subject.id) }));
    setMsg(`Added subject: ${json.subject.name}`);
    await onReload();
  };

  const handleDiagramFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    setUploadingImage(true);
    try {
      const dataUrl = await prepareQuestionImageFile(file);
      setQForm((prev) => ({ ...prev, imageUrl: dataUrl }));
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : 'Unable to process selected image.'
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const openManualBuilder = (q?: QuestionBankItem) => {
    setErr('');
    setMsg('');
    if (q) {
      setEditingQuestion(q);
      setQForm({
        subjectId: String(q.subjectId),
        topic: q.topic || 'General',
        questionText: q.questionText,
        imageUrl: q.imageUrl || '',
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption:
          q.correctOption === 'B' ||
          q.correctOption === 'C' ||
          q.correctOption === 'D'
            ? q.correctOption
            : 'A',
        marks: String(q.marks || 1),
      });
    } else {
      setEditingQuestion(null);
      setQForm({
        subjectId: effectiveSubjectId,
        topic: filterTopic || 'General',
        questionText: '',
        imageUrl: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctOption: 'A',
        marks: '1',
      });
    }
    setActiveTab('manual');
  };

  const submitManualQuestion = async (addAnother: boolean) => {
    setErr('');
    setMsg('');

    const targetSubjectId = Number(effectiveSubjectId);
    if (!targetSubjectId) {
      setErr('Please select a subject before saving a question.');
      return;
    }
    if (
      !qForm.questionText.trim() ||
      !qForm.optionA.trim() ||
      !qForm.optionB.trim() ||
      !qForm.optionC.trim() ||
      !qForm.optionD.trim()
    ) {
      setErr('Enter the question text and all four options (A, B, C, and D).');
      return;
    }

    if (!isValidQuestionImageUrl(qForm.imageUrl)) {
      setErr(
        'Enter a valid image URL (starting with https:// or http://) or upload an image file.'
      );
      return;
    }

    setSavingQuestion(true);
    try {
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
          subjectId: targetSubjectId,
          topic: qForm.topic.trim() || 'General',
          questionText: qForm.questionText.trim(),
          imageUrl: qForm.imageUrl.trim(),
          optionA: qForm.optionA.trim(),
          optionB: qForm.optionB.trim(),
          optionC: qForm.optionC.trim(),
          optionD: qForm.optionD.trim(),
          correctOption: qForm.correctOption,
          marks: Math.max(1, Number(qForm.marks) || 1),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || 'Unable to save question.');
        return;
      }

      const wasEdit = Boolean(editingQuestion);
      setEditingQuestion(null);
      await onReload();

      if (addAnother && !wasEdit) {
        setQForm((prev) => ({
          ...prev,
          subjectId: String(targetSubjectId),
          questionText: '',
          imageUrl: '',
          optionA: '',
          optionB: '',
          optionC: '',
          optionD: '',
          correctOption: 'A',
        }));
        setMsg(
          'Question saved to the bank. Ready to enter the next question.'
        );
      } else {
        setMsg(
          wasEdit
            ? 'Question updated in the question bank.'
            : 'Question added to the question bank.'
        );
        setActiveTab('directory');
      }
    } catch {
      setErr('Network error while saving question.');
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    setErr('');
    setMsg('');
    const res = await fetch(`/api/admin/questions/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setErr('Unable to delete question.');
      return;
    }
    setConfirmDeleteId(null);
    setMsg('Question removed from the question bank.');
    await onReload();
  };

  const previewSubjectName =
    subjects.find((s) => String(s.id) === effectiveSubjectId)?.name ||
    'Selected Subject';

  return (
    <div className="space-y-6">
      {/* Header & Workspace Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#123B72]">
            Structured Question Bank
          </h2>
          <p className="text-sm text-slate-600">
            Organize examination questions by subject and topic, build items
            manually with A–D options, or bulk-upload Q&amp;A sets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingQuestion(null);
              setActiveTab('directory');
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold border transition-colors ${
              activeTab === 'directory'
                ? 'bg-[#123B72] text-white border-[#123B72]'
                : 'bg-white text-[#123B72] border-slate-300 hover:bg-slate-50'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Question Bank ({questions.length})
          </button>
          <button
            type="button"
            disabled={subjects.length === 0}
            onClick={() => openManualBuilder()}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold border transition-colors disabled:opacity-50 ${
              activeTab === 'manual'
                ? 'bg-[#E83E8C] text-white border-[#E83E8C]'
                : 'bg-white text-[#E83E8C] border-[#E83E8C] hover:bg-[#E83E8C]/5'
            }`}
          >
            <Plus className="w-4 h-4" />
            {editingQuestion ? 'Edit Question' : 'Manual Question Builder'}
          </button>
          <button
            type="button"
            disabled={subjects.length === 0}
            onClick={() => {
              setErr('');
              setMsg('');
              setActiveTab('bulk');
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold border transition-colors disabled:opacity-50 ${
              activeTab === 'bulk'
                ? 'bg-[#1769AA] text-white border-[#1769AA]'
                : 'bg-white text-[#1769AA] border-[#1769AA] hover:bg-[#1769AA]/5'
            }`}
          >
            <Upload className="w-4 h-4" />
            Bulk Upload Q&amp;A
          </button>
        </div>
      </div>

      {/* Bank Structure Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium">Total Questions</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#123B72] mt-1">
            {questions.length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium">Subjects</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#1769AA] mt-1">
            {subjects.length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium">Structured Topics</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#123B72] mt-1">
            {totalTopicsCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium">Total Bank Marks</p>
          <p className="font-mono-tabular text-2xl font-bold text-emerald-700 mt-1">
            {totalBankMarks}
          </p>
        </div>
      </div>

      {msg && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{msg}</span>
        </div>
      )}
      {err && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm"
        >
          {err}
        </div>
      )}

      {subjects.length === 0 && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900">
          {isSuperAdmin
            ? 'No subjects exist yet. Create your first subject below before adding or bulk-uploading questions.'
            : 'No subjects have been created yet. Ask a Full Administrator to create subjects before loading questions.'}
        </div>
      )}

      {/* TAB 1: STRUCTURED QUESTION BANK DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="space-y-6">
          {/* Subject Folder Cards */}
          {subjects.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-[#123B72] flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#1769AA]" />
                  Subjects Structure
                </h3>
                {filterSubjectId && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterSubjectId('');
                      setFilterTopic('');
                    }}
                    className="text-xs font-semibold text-[#1769AA] hover:underline"
                  >
                    Show All Subjects
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {subjectSummaries.map((sub) => {
                  const selected = filterSubjectId === String(sub.id);
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        setFilterSubjectId(selected ? '' : String(sub.id));
                        setFilterTopic('');
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-colors ${
                        selected
                          ? 'border-[#123B72] bg-[#123B72]/5'
                          : 'border-slate-200 hover:border-[#1769AA]/60 hover:bg-[#F5F8FC]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-bold text-[#123B72] truncate">
                          {sub.name}
                        </span>
                        <span className="font-mono-tabular text-[11px] font-semibold text-[#1769AA]">
                          {sub.code}
                        </span>
                      </div>
                      <p className="font-mono-tabular text-xs text-slate-600 mt-1.5">
                        {sub.liveCount} Qs · {sub.topicCount} topic
                        {sub.topicCount === 1 ? '' : 's'} · {sub.totalMarks} marks
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subject Creator (Super Admin Only) + Filter Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {isSuperAdmin && (
              <form
                onSubmit={handleAddSubject}
                className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-3"
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
                <div className="w-24">
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
            )}

            <div
              className={`${
                isSuperAdmin ? 'lg:col-span-7' : 'lg:col-span-12'
              } bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3`}
            >
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Subject
                </label>
                <select
                  value={filterSubjectId}
                  onChange={(e) => {
                    setFilterSubjectId(e.target.value);
                    setFilterTopic('');
                  }}
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
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Topic
                </label>
                <select
                  value={filterTopic}
                  onChange={(e) => setFilterTopic(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  <option value="">All Topics</option>
                  {topicsForSelectedSubject.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Search Question Text
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Keyword or option..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Questions Bank List */}
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-slate-500">Loading question bank...</p>
            ) : filteredQuestions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
                <p className="text-sm text-slate-500">
                  No questions match your current subject, topic, or search
                  filters.
                </p>
                {subjects.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => openManualBuilder()}
                      className="px-4 py-2 rounded-lg bg-[#E83E8C] text-white text-xs font-semibold hover:bg-[#d1327c]"
                    >
                      Add Question Manually
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('bulk')}
                      className="px-4 py-2 rounded-lg border border-[#1769AA] text-[#1769AA] text-xs font-semibold hover:bg-[#1769AA]/5"
                    >
                      Bulk Upload Q&amp;A
                    </button>
                  </div>
                )}
              </div>
            ) : (
              filteredQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[#1769AA]">
                        <span className="font-mono-tabular text-slate-400 mr-1.5">
                          #{idx + 1}
                        </span>
                        {q.subjectName} · {q.topic || 'General'} ·{' '}
                        <span className="font-mono-tabular">
                          {q.marks} mark{q.marks > 1 ? 's' : ''}
                        </span>
                      </p>
                      <div className="text-sm sm:text-base font-medium text-[#1E293B] whitespace-pre-line">
                        <MathText text={q.questionText} />
                      </div>
                      {q.imageUrl && (
                        <div className="mt-2 inline-block rounded-lg border border-slate-200 bg-white p-2">
                          <img
                            src={q.imageUrl}
                            alt={`Diagram for question ${idx + 1}`}
                            className="max-h-48 w-auto object-contain rounded"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openManualBuilder(q)}
                        className="p-1.5 rounded text-[#1769AA] hover:bg-slate-100"
                        title="Edit question"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {confirmDeleteId === q.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="px-2 py-1 rounded bg-red-600 text-white text-xs font-semibold"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded border border-slate-300 text-xs font-semibold text-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(q.id)}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50"
                          title="Delete question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
                          <MathText text={text} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MANUAL QUESTION BUILDER STUDIO */}
      {activeTab === 'manual' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3.5">
              <div>
                <h3 className="font-display text-lg font-bold text-[#123B72]">
                  {editingQuestion
                    ? 'Edit Question Bank Entry'
                    : 'Add Question Manually'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter the question stem, four answer options (A–D), and mark
                  the single correct option.
                </p>
              </div>
              {editingQuestion && (
                <button
                  type="button"
                  onClick={() => openManualBuilder()}
                  className="text-xs font-semibold text-[#1769AA] hover:underline"
                >
                  Switch to New Question
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Subject *
                </label>
                <select
                  required
                  value={effectiveSubjectId}
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
                  Topic / Module
                </label>
                <input
                  type="text"
                  list="question-bank-topics"
                  value={qForm.topic}
                  onChange={(e) =>
                    setQForm({ ...qForm, topic: e.target.value })
                  }
                  placeholder="e.g. Algebra"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
                <datalist id="question-bank-topics">
                  {builderTopicSuggestions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Marks
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={qForm.marks}
                  onChange={(e) =>
                    setQForm({ ...qForm, marks: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                />
              </div>
            </div>

            <LatexFormulaToolbar
              activeField={activeField}
              onInsertSnippet={insertLatexSnippet}
              onWrapSelection={wrapSelectionWithDollar}
            />

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Question Text *{' '}
                <span className="text-slate-400 font-normal">
                  (Supports inline $...$ and block $$...$$ LaTeX)
                </span>
              </label>
              <textarea
                ref={(el) => {
                  fieldRefs.current.questionText = el;
                }}
                rows={4}
                required
                value={qForm.questionText}
                onFocus={() => setActiveField('questionText')}
                onChange={(e) =>
                  setQForm({ ...qForm, questionText: e.target.value })
                }
                placeholder="Type the complete question here, e.g. Solve $x^{2} - 5x + 6 = 0$."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm leading-relaxed"
              />
            </div>

            {/* Diagram / Figure Image Uploader */}
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-[#123B72] flex items-center gap-1.5">
                    <ImagePlus className="w-4 h-4 text-[#1769AA]" />
                    Question Diagram / Image Attachment (Optional)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Attach graphs, geometric figures, circuit schematics,
                    chemical structures, or biology diagrams (PNG, JPG, WebP,
                    GIF, SVG).
                  </p>
                </div>
                {qForm.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setQForm((prev) => ({ ...prev, imageUrl: '' }))}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                  >
                    <X className="w-3.5 h-3.5" />
                    Remove Image
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#123B72] text-white text-xs font-semibold cursor-pointer hover:bg-[#1769AA] transition-colors shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingImage
                    ? 'Optimizing Image...'
                    : qForm.imageUrl
                      ? 'Replace Diagram Image'
                      : 'Upload Diagram Image'}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingImage}
                    onChange={handleDiagramFileChange}
                    className="sr-only"
                  />
                </label>

                <input
                  type="text"
                  value={
                    qForm.imageUrl.startsWith('data:') ? '' : qForm.imageUrl
                  }
                  onChange={(e) =>
                    setQForm((prev) => ({ ...prev, imageUrl: e.target.value }))
                  }
                  placeholder={
                    qForm.imageUrl.startsWith('data:')
                      ? 'Uploaded image attached (click Replace to change)'
                      : 'Or paste an image URL (https://...)'
                  }
                  className="flex-1 min-w-[210px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>

              {qForm.imageUrl && (
                <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-center">
                  <img
                    src={qForm.imageUrl}
                    alt="Question diagram preview"
                    className="max-h-48 w-auto object-contain rounded"
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-600">
                  Options &amp; Correct Answer Selection *
                </label>
                <span className="text-[11px] text-slate-500">
                  Click any option box to insert LaTeX formulas into it
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                  const field = `option${opt}` as QuestionFieldKey;
                  const isCorrect = qForm.correctOption === opt;
                  return (
                    <div
                      key={opt}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                        isCorrect
                          ? 'border-emerald-500 bg-emerald-50/70'
                          : 'border-slate-200 bg-[#F5F8FC]'
                      }`}
                    >
                      <label className="inline-flex items-center gap-2 cursor-pointer shrink-0 pl-1">
                        <input
                          type="radio"
                          name="manualCorrectOption"
                          value={opt}
                          checked={isCorrect}
                          onChange={() =>
                            setQForm({ ...qForm, correctOption: opt })
                          }
                        />
                        <span
                          className={`font-mono-tabular text-xs font-bold w-6 h-6 rounded-md flex items-center justify-center ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white border border-slate-300 text-[#123B72]'
                          }`}
                        >
                          {opt}
                        </span>
                      </label>
                      <input
                        ref={(el) => {
                          fieldRefs.current[field] = el;
                        }}
                        type="text"
                        required
                        value={qForm[field]}
                        onFocus={() => setActiveField(field)}
                        onChange={(e) =>
                          setQForm({ ...qForm, [field]: e.target.value })
                        }
                        placeholder={`Enter Option ${opt} (supports $...$ LaTeX)`}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setEditingQuestion(null);
                  setActiveTab('directory');
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to Bank
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {!editingQuestion && (
                  <button
                    type="button"
                    disabled={savingQuestion}
                    onClick={() => submitManualQuestion(true)}
                    className="px-4 py-2 rounded-lg border border-[#123B72] text-[#123B72] text-sm font-semibold hover:bg-[#123B72] hover:text-white disabled:opacity-50"
                  >
                    {savingQuestion ? 'Saving...' : 'Save & Add Next'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={savingQuestion}
                  onClick={() => submitManualQuestion(false)}
                  className="px-5 py-2 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c] disabled:opacity-50"
                >
                  {savingQuestion
                    ? 'Saving...'
                    : editingQuestion
                      ? 'Save Changes'
                      : 'Save & Open Bank'}
                </button>
              </div>
            </div>
          </div>

          {/* Live Question Preview Panel */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#1769AA]">
              <Layers className="w-4 h-4" />
              Live Question Bank Preview
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-[#F5F8FC] space-y-3">
              <p className="text-xs font-semibold text-[#1769AA]">
                {previewSubjectName} · {qForm.topic.trim() || 'General'} ·{' '}
                <span className="font-mono-tabular">
                  {Math.max(1, Number(qForm.marks) || 1)} mark
                  {Number(qForm.marks) > 1 ? 's' : ''}
                </span>
              </p>
              <div className="text-sm font-medium text-[#1E293B] whitespace-pre-line leading-relaxed">
                {qForm.questionText.trim() ? (
                  <MathText text={qForm.questionText} />
                ) : (
                  'Your question stem and rendered KaTeX equations will appear here as you type.'
                )}
              </div>
              {qForm.imageUrl.trim() && (
                <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex justify-center">
                  <img
                    src={qForm.imageUrl}
                    alt="Live diagram preview"
                    className="max-h-52 w-auto object-contain rounded"
                  />
                </div>
              )}
              <div className="space-y-2 pt-1">
                {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                  const field = `option${opt}` as QuestionFieldKey;
                  const isAns = qForm.correctOption === opt;
                  return (
                    <div
                      key={opt}
                      className={`px-3 py-2 rounded-lg border text-xs ${
                        isAns
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <strong className="font-mono-tabular mr-1.5">
                        {opt}.
                      </strong>
                      {qForm[field].trim() ? (
                        <MathText text={qForm[field]} />
                      ) : (
                        `Option ${opt}`
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {latexWarnings.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  LaTeX Formula Check
                </p>
                {latexWarnings.slice(0, 3).map((warn, i) => (
                  <p key={i} className="text-[11px]">
                    {warn}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: EMBEDDED BULK UPLOAD STUDIO */}
      {activeTab === 'bulk' && (
        <BulkQuestionsUploadModal
          token={token}
          subjects={subjects}
          exams={exams}
          initialSubjectId={filterSubjectId}
          embedded
          onSuccess={async (summaryMsg) => {
            setMsg(summaryMsg);
            await onReload();
            setActiveTab('directory');
          }}
        />
      )}
    </div>
  );
}
