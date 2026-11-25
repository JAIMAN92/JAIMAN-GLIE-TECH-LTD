import React, { useMemo, useState } from 'react';
import { readSheet } from 'read-excel-file/browser';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  type ParsedBulkQuestion,
  parseCsvOrTsvText,
  parseJsonQuestions,
  parseQaTextBlocks,
  parseSpreadsheetRows,
} from '../../shared/questionBulkParser.ts';

interface SubjectOption {
  id: number;
  name: string;
}

interface ExamOption {
  id: number;
  title: string;
  subjectId: number;
}

type UploadSourceMode = 'file' | 'qa_text' | 'csv_text';

const SAMPLE_QA_TEXT = `1. Solve for x in the linear equation: 3x + 7 = 22.
A. 3
B. 5
C. 7
D. 15
Answer: B
Topic: Algebra
Marks: 2

2. What is the sum of the interior angles of a triangle?
A) 90 degrees
B) 180 degrees
C) 270 degrees
D) 360 degrees
Ans: B
Topic: Geometry
Marks: 2`;

export function BulkQuestionsUploadModal({
  token,
  subjects,
  exams,
  initialSubjectId,
  onClose,
  onSuccess,
}: {
  token: string;
  subjects: SubjectOption[];
  exams: ExamOption[];
  initialSubjectId: string;
  onClose: () => void;
  onSuccess: (summaryMessage: string) => void;
}) {
  const [sourceMode, setSourceMode] = useState<UploadSourceMode>('file');
  const [subjectId, setSubjectId] = useState(
    initialSubjectId || (subjects[0] ? String(subjects[0].id) : '')
  );
  const [examId, setExamId] = useState('');
  const [defaultTopic, setDefaultTopic] = useState('General');
  const [defaultMarks, setDefaultMarks] = useState('1');

  const [qaText, setQaText] = useState('');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileRows, setFileRows] = useState<Array<Array<unknown>> | null>(null);
  const [fileRawText, setFileRawText] = useState('');
  const [fileKind, setFileKind] = useState<'xlsx' | 'csv' | 'txt' | 'json' | null>(null);
  const [fileParseError, setFileParseError] = useState('');

  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const matchingExams = useMemo(
    () => exams.filter((e) => String(e.subjectId) === subjectId),
    [exams, subjectId]
  );

  const parsedResult = useMemo(() => {
    const defaults = {
      topic: defaultTopic.trim() || 'General',
      marks: Math.max(1, Number(defaultMarks) || 1),
    };

    if (sourceMode === 'qa_text') {
      return parseQaTextBlocks(qaText, defaults);
    }

    if (sourceMode === 'csv_text') {
      if (!csvText.trim()) return { questions: [], errors: [] };
      return parseSpreadsheetRows(parseCsvOrTsvText(csvText), defaults);
    }

    if (fileParseError) {
      return {
        questions: [],
        errors: [{ itemLabel: fileName || 'File', reason: fileParseError }],
      };
    }

    if (fileKind === 'xlsx' && fileRows) {
      return parseSpreadsheetRows(
        fileRows.map((row) =>
          row.map((cell) =>
            cell === null || cell === undefined
              ? null
              : typeof cell === 'string' ||
                  typeof cell === 'number' ||
                  typeof cell === 'boolean'
                ? cell
                : String(cell)
          )
        ),
        defaults
      );
    }
    if (fileKind === 'csv' && fileRawText) {
      return parseSpreadsheetRows(parseCsvOrTsvText(fileRawText), defaults);
    }
    if (fileKind === 'txt' && fileRawText) {
      return parseQaTextBlocks(fileRawText, defaults);
    }
    if (fileKind === 'json' && fileRawText) {
      return parseJsonQuestions(fileRawText, defaults);
    }

    return { questions: [], errors: [] };
  }, [
    sourceMode,
    qaText,
    csvText,
    fileParseError,
    fileName,
    fileKind,
    fileRows,
    fileRawText,
    defaultTopic,
    defaultMarks,
  ]);

  const activeQuestions = useMemo(
    () => parsedResult.questions.filter((q) => !removedIds.has(q.id)),
    [parsedResult.questions, removedIds]
  );

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setRemovedIds(new Set());
    setFileParseError('');
    setSubmitError('');
    setFileName(file.name);
    setFileRows(null);
    setFileRawText('');

    const lower = file.name.toLowerCase();
    try {
      if (lower.endsWith('.xlsx')) {
        setFileKind('xlsx');
        const rows = await readSheet(file);
        setFileRows(rows);
      } else if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
        setFileKind('csv');
        setFileRawText(await file.text());
      } else if (lower.endsWith('.json')) {
        setFileKind('json');
        setFileRawText(await file.text());
      } else {
        setFileKind('txt');
        setFileRawText(await file.text());
      }
    } catch (err) {
      setFileParseError(
        err instanceof Error
          ? `Could not read file: ${err.message}`
          : 'Could not read selected file. For Excel, save as .xlsx or .csv.'
      );
    }
  };

  const downloadCsvTemplate = () => {
    const sample = [
      'topic,questionText,optionA,optionB,optionC,optionD,correctOption,marks',
      'Algebra,"Solve for x in 2x + 4 = 10.",2,3,4,5,B,2',
      'Geometry,"What is the sum of interior angles of a triangle?",90 degrees,180 degrees,270 degrees,360 degrees,B,2',
    ].join('\n');
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jaiman_bulk_qa_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTxtTemplate = () => {
    const blob = new Blob([SAMPLE_QA_TEXT], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jaiman_bulk_qa_sample.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRemovePreview = (id: string) => {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!subjectId) {
      setSubmitError('Please select a target subject.');
      return;
    }
    if (activeQuestions.length === 0) {
      setSubmitError('No valid questions ready to upload.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/questions/bulk', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subjectId: Number(subjectId),
          examId: examId ? Number(examId) : null,
          items: activeQuestions.map((q: ParsedBulkQuestion) => ({
            topic: q.topic,
            questionText: q.questionText,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctOption: q.correctOption,
            marks: q.marks,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || 'Bulk questions upload failed.');
        return;
      }

      const attachedMsg =
        json.attachedCount > 0
          ? ` and attached ${json.attachedCount} to the selected examination`
          : '';
      onSuccess(`Uploaded ${json.imported} question(s) successfully${attachedMsg}.`);
    } catch {
      setSubmitError('Unable to upload questions right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="font-display text-xl font-bold text-[#123B72]">
              Bulk Questions &amp; Answers Upload
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Upload an Excel (.xlsx), CSV, JSON, or text Q&amp;A file—or paste
              numbered questions and answers directly from Word or spreadsheets
              with live preview.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bulk upload modal"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitError && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleUploadSubmit} className="space-y-5">
          {/* Target Subject, Defaults & Optional Exam Attachment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#F5F8FC] p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-[#123B72] mb-1">
                Target Subject *
              </label>
              <select
                required
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setExamId('');
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#123B72] mb-1">
                Attach to Examination
              </label>
              <select
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
              >
                <option value="">Question Bank Only</option>
                {matchingExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#123B72] mb-1">
                Default Topic
              </label>
              <input
                type="text"
                value={defaultTopic}
                onChange={(e) => setDefaultTopic(e.target.value)}
                placeholder="General"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#123B72] mb-1">
                Default Marks
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={defaultMarks}
                onChange={(e) => setDefaultMarks(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono-tabular"
              />
            </div>
          </div>

          {/* Source Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-slate-300 bg-[#F5F8FC] p-1 gap-1">
              <button
                type="button"
                onClick={() => {
                  setSourceMode('file');
                  setRemovedIds(new Set());
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  sourceMode === 'file'
                    ? 'bg-[#123B72] text-white'
                    : 'text-slate-600 hover:text-[#123B72]'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload File (.xlsx / .csv / .txt)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceMode('qa_text');
                  setRemovedIds(new Set());
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  sourceMode === 'qa_text'
                    ? 'bg-[#123B72] text-white'
                    : 'text-slate-600 hover:text-[#123B72]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Paste Word / Q&amp;A Text
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceMode('csv_text');
                  setRemovedIds(new Set());
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  sourceMode === 'csv_text'
                    ? 'bg-[#123B72] text-white'
                    : 'text-slate-600 hover:text-[#123B72]'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Paste CSV / Excel Cells
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <button
                type="button"
                onClick={downloadCsvTemplate}
                className="inline-flex items-center gap-1 font-semibold text-[#1769AA] hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                CSV Template
              </button>
              <button
                type="button"
                onClick={downloadTxtTemplate}
                className="inline-flex items-center gap-1 font-semibold text-[#1769AA] hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                Q&amp;A Text Sample
              </button>
            </div>
          </div>

          {/* Input Area per Mode */}
          {sourceMode === 'file' && (
            <label className="block border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-[#1769AA] hover:bg-[#F5F8FC]/60 transition-colors">
              <input
                type="file"
                accept=".xlsx,.csv,.tsv,.txt,.json"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
                className="sr-only"
              />
              <Upload className="w-8 h-8 text-[#1769AA] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#123B72]">
                {fileName
                  ? `Selected: ${fileName}`
                  : 'Click to choose Excel (.xlsx), CSV, TXT, or JSON file'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Spreadsheets should include columns: questionText, optionA,
                optionB, optionC, optionD, correctOption (optional: topic, marks)
              </p>
            </label>
          )}

          {sourceMode === 'qa_text' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>
                  Format each question with options A–D and{' '}
                  <code className="font-mono-tabular bg-slate-100 px-1 rounded">
                    Answer: B
                  </code>{' '}
                  (optional:{' '}
                  <code className="font-mono-tabular bg-slate-100 px-1 rounded">
                    Topic:
                  </code>
                  ,{' '}
                  <code className="font-mono-tabular bg-slate-100 px-1 rounded">
                    Marks:
                  </code>
                  )
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setQaText(SAMPLE_QA_TEXT);
                    setRemovedIds(new Set());
                  }}
                  className="font-semibold text-[#E83E8C] hover:underline"
                >
                  Load Sample Q&amp;A
                </button>
              </div>
              <textarea
                rows={7}
                value={qaText}
                onChange={(e) => {
                  setQaText(e.target.value);
                  setRemovedIds(new Set());
                }}
                placeholder={SAMPLE_QA_TEXT}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono-tabular leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1769AA]"
              />
            </div>
          )}

          {sourceMode === 'csv_text' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-600">
                Paste comma-separated CSV or tab-separated rows copied directly
                from Excel or Google Sheets (with header row).
              </p>
              <textarea
                rows={7}
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setRemovedIds(new Set());
                }}
                placeholder="topic,questionText,optionA,optionB,optionC,optionD,correctOption,marks"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono-tabular leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1769AA]"
              />
            </div>
          )}

          {/* Live Validation & Preview Summary */}
          {(parsedResult.questions.length > 0 || parsedResult.errors.length > 0) && (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-[#F5F8FC] border border-slate-200">
                  <p className="text-[11px] font-medium text-slate-500">
                    Ready to Upload
                  </p>
                  <p className="font-mono-tabular text-xl font-bold text-emerald-700">
                    {activeQuestions.length}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#F5F8FC] border border-slate-200">
                  <p className="text-[11px] font-medium text-slate-500">
                    Issues Detected
                  </p>
                  <p
                    className={`font-mono-tabular text-xl font-bold ${
                      parsedResult.errors.length > 0
                        ? 'text-red-600'
                        : 'text-[#123B72]'
                    }`}
                  >
                    {parsedResult.errors.length}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#F5F8FC] border border-slate-200">
                  <p className="text-[11px] font-medium text-slate-500">
                    Total Marks
                  </p>
                  <p className="font-mono-tabular text-xl font-bold text-[#123B72]">
                    {activeQuestions.reduce((sum, q) => sum + q.marks, 0)}
                  </p>
                </div>
              </div>

              {parsedResult.errors.length > 0 && (
                <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1 max-h-32 overflow-y-auto">
                  <p className="font-semibold">
                    Rows/Items needing attention (skipped unless fixed):
                  </p>
                  {parsedResult.errors.map((er, i) => (
                    <p key={i}>
                      <strong>{er.itemLabel}:</strong> {er.reason}
                    </p>
                  ))}
                </div>
              )}

              {activeQuestions.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {activeQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-xs space-y-0.5">
                          <p className="font-semibold text-[#1769AA]">
                            #{idx + 1} · {q.topic} ·{' '}
                            <span className="font-mono-tabular">
                              {q.marks} mark{q.marks > 1 ? 's' : ''}
                            </span>
                          </p>
                          <p className="text-sm font-medium text-[#1E293B]">
                            {q.questionText}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePreview(q.id)}
                          title="Exclude this question"
                          className="p-1.5 rounded text-red-600 hover:bg-red-50 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                          const optVal =
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
                              className={`px-2.5 py-1.5 rounded border truncate ${
                                isAns
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold'
                                  : 'border-slate-200 bg-[#F5F8FC] text-slate-700'
                              }`}
                            >
                              <strong className="font-mono-tabular mr-1">
                                {opt}.
                              </strong>
                              {optVal}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Up to 500 questions per upload batch
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || activeQuestions.length === 0}
                className="px-5 py-2 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c] disabled:opacity-50"
              >
                {submitting
                  ? 'Uploading...'
                  : `Upload ${activeQuestions.length} Question${activeQuestions.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
