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
import { SchoolNameBadge } from '../SchoolNameBadge.tsx';
import {
  type ParsedBulkStudent,
  parseJsonStudents,
  parsePlainStudentListText,
  parseStudentCsvOrTsvText,
  parseStudentSpreadsheetRows,
} from '../../shared/studentBulkParser.ts';

export interface StudentSchoolOption {
  id: number;
  name: string;
  code: string;
  logoUrl?: string;
}

export interface StudentClassArmOption {
  id: number;
  schoolId: number | null;
  classLevel: string;
  armName: string;
  displayName: string;
  isActive: boolean;
}

export interface CreatedStudentCredential {
  id: number;
  examNumber: string;
  fullName: string;
  schoolName: string;
  classLevel: string;
  arm: string;
  passcode: string;
}

type UploadSourceMode = 'file' | 'name_list' | 'csv_text';

const SAMPLE_NAME_LIST = `1. Adebayo Chinedu Musa
2. Okafor Zainab Tolu
3. Ibrahim Sadiq Bello
4. Nwosu Chiamaka Grace`;

export function BulkStudentsUploadModal({
  token,
  schools,
  classArms,
  initialSchoolId,
  embedded = false,
  onClose,
  onSuccess,
}: {
  token: string;
  schools: StudentSchoolOption[];
  classArms: StudentClassArmOption[];
  initialSchoolId?: string;
  embedded?: boolean;
  onClose?: () => void;
  onSuccess: (
    summaryMessage: string,
    createdStudents: CreatedStudentCredential[]
  ) => void;
}) {
  const [sourceMode, setSourceMode] = useState<UploadSourceMode>('file');
  const [schoolId, setSchoolId] = useState(
    initialSchoolId || (schools[0] ? String(schools[0].id) : '')
  );
  const [defaultClassLevel, setDefaultClassLevel] = useState('SS1');
  const [defaultArm, setDefaultArm] = useState('A');
  const [defaultPasscode, setDefaultPasscode] = useState('pass1234');

  const [nameListText, setNameListText] = useState('');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileRows, setFileRows] = useState<Array<Array<unknown>> | null>(null);
  const [fileRawText, setFileRawText] = useState('');
  const [fileKind, setFileKind] = useState<'xlsx' | 'csv' | 'txt' | 'json' | null>(
    null
  );
  const [fileParseError, setFileParseError] = useState('');

  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const selectedSchool = useMemo(
    () => schools.find((s) => String(s.id) === schoolId),
    [schools, schoolId]
  );

  const selectedSchoolCustomClasses = useMemo(
    () =>
      Array.from(
        new Set(
          classArms
            .filter(
              (c) =>
                c.isActive &&
                c.schoolId !== null &&
                String(c.schoolId) === schoolId
            )
            .map((c) => c.classLevel)
        )
      ),
    [classArms, schoolId]
  );

  const allClassLevels = useMemo(
    () =>
      Array.from(
        new Set([
          'JSS1',
          'JSS2',
          'JSS3',
          'SS1',
          'SS2',
          'SS3',
          ...classArms.filter((c) => c.isActive).map((c) => c.classLevel),
        ])
      ),
    [classArms]
  );

  const otherClassLevels = useMemo(
    () =>
      allClassLevels.filter((c) => !selectedSchoolCustomClasses.includes(c)),
    [allClassLevels, selectedSchoolCustomClasses]
  );

  const armSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          classArms
            .filter(
              (c) =>
                c.isActive &&
                c.classLevel.toUpperCase() === defaultClassLevel.toUpperCase() &&
                (!schoolId || c.schoolId === null || String(c.schoolId) === schoolId)
            )
            .map((c) => c.armName)
        )
      ),
    [classArms, defaultClassLevel, schoolId]
  );

  const parsedResult = useMemo(() => {
    const defaults = {
      classLevel: defaultClassLevel.trim() || 'SS1',
      arm: defaultArm.trim(),
      passcode: defaultPasscode.trim(),
    };

    if (sourceMode === 'name_list') {
      return parsePlainStudentListText(nameListText, defaults);
    }

    if (sourceMode === 'csv_text') {
      if (!csvText.trim()) return { students: [], errors: [] };
      return parseStudentSpreadsheetRows(
        parseStudentCsvOrTsvText(csvText),
        defaults
      );
    }

    if (fileParseError) {
      return {
        students: [],
        errors: [{ itemLabel: fileName || 'File', reason: fileParseError }],
      };
    }

    if (fileKind === 'xlsx' && fileRows) {
      return parseStudentSpreadsheetRows(
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
      return parseStudentSpreadsheetRows(
        parseStudentCsvOrTsvText(fileRawText),
        defaults
      );
    }
    if (fileKind === 'txt' && fileRawText) {
      return parsePlainStudentListText(fileRawText, defaults);
    }
    if (fileKind === 'json' && fileRawText) {
      return parseJsonStudents(fileRawText, defaults);
    }

    return { students: [], errors: [] };
  }, [
    sourceMode,
    nameListText,
    csvText,
    fileParseError,
    fileName,
    fileKind,
    fileRows,
    fileRawText,
    defaultClassLevel,
    defaultArm,
    defaultPasscode,
  ]);

  const activeStudents = useMemo(
    () => parsedResult.students.filter((s) => !removedIds.has(s.id)),
    [parsedResult.students, removedIds]
  );

  const autoExamPreviewPrefix = useMemo(() => {
    const cleanCode = (selectedSchool?.code || 'JGT')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
    return `${cleanCode || 'JGT'}-${new Date().getFullYear()}-...`;
  }, [selectedSchool]);

  const autoCount = useMemo(
    () => activeStudents.filter((s) => !s.examNumber).length,
    [activeStudents]
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
      'fullName,classLevel,arm,passcode,examNumber',
      'Adebayo Chinedu Musa,SS3,Science,pass1234,',
      'Okafor Zainab Tolu,SS2,Art,pass5678,',
      'Ibrahim Sadiq Bello,SS1,A,pass9012,',
    ].join('\n');
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jaiman_student_list_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTxtTemplate = () => {
    const blob = new Blob([SAMPLE_NAME_LIST], {
      type: 'text/plain;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jaiman_student_names_sample.txt';
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
    if (!schoolId) {
      setSubmitError('Please select a target school or organization.');
      return;
    }
    if (activeStudents.length === 0) {
      setSubmitError('No valid student records ready to register.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/students/bulk', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schoolId: Number(schoolId),
          items: activeStudents.map((st: ParsedBulkStudent) => ({
            fullName: st.fullName,
            examNumber: st.examNumber,
            classLevel: st.classLevel,
            arm: st.arm,
            passcode: st.passcode,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || 'Bulk student upload failed.');
        return;
      }

      const autoMsg =
        json.autoGeneratedCount > 0
          ? ` (${json.autoGeneratedCount} exam number${json.autoGeneratedCount === 1 ? '' : 's'} auto-generated)`
          : '';
      const skippedMsg =
        Array.isArray(json.errors) && json.errors.length > 0
          ? ` · ${json.errors.length} skipped`
          : '';

      onSuccess(
        `Registered ${json.imported} student(s) successfully${autoMsg}${skippedMsg}.`,
        Array.isArray(json.createdStudents) ? json.createdStudents : []
      );
    } catch {
      setSubmitError(
        'Unable to upload student list right now. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={
        embedded
          ? 'w-full'
          : 'fixed inset-0 z-50 bg-slate-900/65 flex items-center justify-center p-4'
      }
    >
      <div
        className={
          embedded
            ? 'bg-white border border-slate-200 rounded-xl w-full p-5 sm:p-6 space-y-5'
            : 'bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto'
        }
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="font-display text-lg sm:text-xl font-bold text-[#123B72]">
              Bulk Student List Upload Studio
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Upload an Excel (.xlsx), CSV, TXT, or JSON student roster—or paste
              a plain list of student names or spreadsheet rows. Missing
              examination numbers are generated automatically.
            </p>
          </div>
          {!embedded && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close bulk student upload"
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          )}
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
          {/* Target School & Fallback Defaults */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#F5F8FC] p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-[#123B72] mb-1">
                Target School / Agency *
              </label>
              <select
                required
                value={schoolId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSchoolId(nextId);
                  const scoped = classArms.find(
                    (c) => c.isActive && String(c.schoolId ?? '') === nextId
                  );
                  if (scoped) {
                    setDefaultClassLevel(scoped.classLevel);
                    setDefaultArm(scoped.armName);
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
              >
                {schools.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
              {selectedSchool && (
                <div className="mt-1.5">
                  <SchoolNameBadge
                    name={selectedSchool.name}
                    logoUrl={selectedSchool.logoUrl}
                    code={selectedSchool.code}
                    size="xs"
                    nameClassName="text-xs font-semibold text-[#123B72]"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#123B72] mb-1">
                Default Class / Stage
              </label>
              <select
                value={defaultClassLevel}
                onChange={(e) => setDefaultClassLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
              >
                {selectedSchoolCustomClasses.length > 0 ? (
                  <>
                    <optgroup label="Selected School / Agency Classes">
                      {selectedSchoolCustomClasses.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Other / Standard Classes">
                      {otherClassLevels.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </optgroup>
                  </>
                ) : (
                  allClassLevels.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#123B72] mb-1">
                Default Arm / Group
              </label>
              <input
                type="text"
                list="bulk-student-arm-options"
                value={defaultArm}
                onChange={(e) => setDefaultArm(e.target.value)}
                placeholder="e.g. A, Science, Group 1"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
              />
              <datalist id="bulk-student-arm-options">
                {armSuggestions.map((arm) => (
                  <option key={arm} value={arm} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#123B72] mb-1">
                Default Passcode (min 4)
              </label>
              <input
                type="text"
                value={defaultPasscode}
                onChange={(e) => setDefaultPasscode(e.target.value)}
                placeholder="e.g. pass1234"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono-tabular"
              />
            </div>
          </div>

          {/* Source Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap rounded-lg border border-slate-300 bg-[#F5F8FC] p-1 gap-1">
              <button
                type="button"
                onClick={() => {
                  setSourceMode('file');
                  setRemovedIds(new Set());
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
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
                  setSourceMode('name_list');
                  setRemovedIds(new Set());
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  sourceMode === 'name_list'
                    ? 'bg-[#123B72] text-white'
                    : 'text-slate-600 hover:text-[#123B72]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Paste Student Names List
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceMode('csv_text');
                  setRemovedIds(new Set());
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
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
                className="inline-flex items-center gap-1 font-semibold text-[#1769AA] hover:underline whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                CSV Template
              </button>
              <button
                type="button"
                onClick={downloadTxtTemplate}
                className="inline-flex items-center gap-1 font-semibold text-[#1769AA] hover:underline whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Name List Sample
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
                  : 'Click to choose Excel (.xlsx), CSV, TXT, or JSON student list'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Spreadsheets can include columns: fullName (or firstName +
                lastName), classLevel, arm, passcode, examNumber. Any missing
                class, arm, or passcode falls back to the defaults above.
              </p>
            </label>
          )}

          {sourceMode === 'name_list' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <span>
                  Enter one student per line (e.g.{' '}
                  <code className="font-mono-tabular bg-slate-100 px-1 rounded">
                    1. Adebayo Chinedu Musa
                  </code>{' '}
                  or{' '}
                  <code className="font-mono-tabular bg-slate-100 px-1 rounded">
                    Name | Class | Arm | Passcode
                  </code>
                  ).
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setNameListText(SAMPLE_NAME_LIST);
                    setRemovedIds(new Set());
                  }}
                  className="font-semibold text-[#E83E8C] hover:underline"
                >
                  Load Sample List
                </button>
              </div>
              <textarea
                rows={7}
                value={nameListText}
                onChange={(e) => {
                  setNameListText(e.target.value);
                  setRemovedIds(new Set());
                }}
                placeholder={SAMPLE_NAME_LIST}
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
                placeholder="fullName,classLevel,arm,passcode&#10;Adebayo Chinedu Musa,SS3,Science,pass1234&#10;Okafor Zainab Tolu,SS2,Art,pass5678"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono-tabular leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1769AA]"
              />
            </div>
          )}

          {/* Live Validation & Preview Table */}
          {(parsedResult.students.length > 0 ||
            parsedResult.errors.length > 0) && (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-[#F5F8FC] border border-slate-200">
                  <p className="text-[11px] font-medium text-slate-500">
                    Ready to Register
                  </p>
                  <p className="font-mono-tabular text-xl font-bold text-emerald-700">
                    {activeStudents.length}
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
                    Auto Exam Numbers
                  </p>
                  <p className="font-mono-tabular text-xl font-bold text-[#123B72]">
                    {autoCount}
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

              {activeStudents.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F5F8FC] text-slate-500 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">#</th>
                        <th className="px-3 py-2.5 font-semibold">Full Name</th>
                        <th className="px-3 py-2.5 font-semibold">
                          Exam Number
                        </th>
                        <th className="px-3 py-2.5 font-semibold">
                          Class &amp; Arm
                        </th>
                        <th className="px-3 py-2.5 font-semibold">Passcode</th>
                        <th className="px-3 py-2.5 font-semibold text-right">
                          Exclude
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {activeStudents.map((st, idx) => (
                        <tr key={st.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono-tabular text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 font-medium text-[#123B72]">
                            {st.fullName}
                          </td>
                          <td className="px-3 py-2 font-mono-tabular text-[#1769AA]">
                            {st.examNumber || `Auto (${autoExamPreviewPrefix})`}
                          </td>
                          <td className="px-3 py-2 font-mono-tabular text-slate-700">
                            {st.classLevel}
                            {st.arm ? ` · ${st.arm}` : ''}
                          </td>
                          <td className="px-3 py-2 font-mono-tabular text-slate-600">
                            {st.passcode}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemovePreview(st.id)}
                              title="Exclude this student"
                              className="p-1 rounded text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Up to 1,000 students per upload batch
            </span>
            <div className="flex items-center gap-2">
              {!embedded && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || activeStudents.length === 0}
                className="px-5 py-2 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c] disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {submitting
                  ? 'Registering...'
                  : `Register ${activeStudents.length} Student${activeStudents.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
