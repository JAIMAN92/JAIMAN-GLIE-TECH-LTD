import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit3,
  FolderOpen,
  KeyRound,
  Plus,
  Search,
  Table2,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import { SchoolNameBadge } from '../SchoolNameBadge.tsx';
import {
  BulkStudentsUploadModal,
  type CreatedStudentCredential,
  type StudentClassArmOption,
} from './BulkStudentsUploadModal.tsx';

interface SchoolRow {
  id: number;
  name: string;
  code: string;
  logoUrl?: string;
  isActive: boolean;
}

interface StudentRow {
  id: number;
  schoolId: number;
  schoolName: string;
  schoolCode: string;
  schoolLogoUrl?: string;
  examNumber: string;
  fullName: string;
  classLevel: string;
  arm: string;
  isActive: boolean;
}

interface ManualBatchRow {
  id: string;
  fullName: string;
  classLevel: string;
  arm: string;
  passcode: string;
  examNumber: string;
}

type StudentWorkspaceTab = 'directory' | 'manual' | 'bulk';
type ManualEntryMode = 'single' | 'multi_row';

function createEmptyBatchRow(
  classLevel: string,
  arm: string,
  passcode: string
): ManualBatchRow {
  return {
    id: `mrow-${Math.random().toString(36).slice(2, 8)}`,
    fullName: '',
    classLevel,
    arm,
    passcode,
    examNumber: '',
  };
}

function generatePasscode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function AdminStudentRegistrationSection({ token }: { token: string }) {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classArms, setClassArms] = useState<StudentClassArmOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<StudentWorkspaceTab>('directory');
  const [manualMode, setManualMode] = useState<ManualEntryMode>('single');

  // Directory filters
  const [filterSchoolId, setFilterSchoolId] = useState('');
  const [filterClassLevel, setFilterClassLevel] = useState('');
  const [filterArm, setFilterArm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Single Manual Student Form (Create or Edit)
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [autoGenerateExamNumber, setAutoGenerateExamNumber] = useState(true);
  const [savingManual, setSavingManual] = useState(false);
  const [studentForm, setStudentForm] = useState({
    schoolId: '',
    examNumber: '',
    fullName: '',
    classLevel: 'SS1',
    arm: 'A',
    passcode: '',
  });

  // Multi-row Manual Entry Sheet
  const [batchSchoolId, setBatchSchoolId] = useState('');
  const [batchDefaultClass, setBatchDefaultClass] = useState('SS1');
  const [batchDefaultArm, setBatchDefaultArm] = useState('A');
  const [batchDefaultPasscode, setBatchDefaultPasscode] = useState('pass1234');
  const [batchRows, setBatchRows] = useState<ManualBatchRow[]>(() =>
    Array.from({ length: 5 }, () =>
      createEmptyBatchRow('SS1', 'A', 'pass1234')
    )
  );
  const [savingBatch, setSavingBatch] = useState(false);

  // Feedback & recent credentials export
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [recentCredentials, setRecentCredentials] = useState<
    CreatedStudentCredential[]
  >([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [scRes, stRes, caRes] = await Promise.all([
        fetch('/api/admin/schools', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/students', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/class-arms', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (scRes.ok) {
        const scJson = await scRes.json();
        setSchools(scJson.schools || []);
      }
      if (stRes.ok) {
        const stJson = await stRes.json();
        setStudents(stJson.students || []);
      }
      if (caRes.ok) {
        const caJson = await caRes.json();
        setClassArms(caJson.classArms || []);
      }
    } catch {
      setErr('Unable to load school and student records.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const effectiveSchoolId =
    studentForm.schoolId ||
    filterSchoolId ||
    (schools[0] ? String(schools[0].id) : '');

  const effectiveBatchSchoolId =
    batchSchoolId || filterSchoolId || (schools[0] ? String(schools[0].id) : '');

  const availableClassLevels = useMemo(
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
          ...students.map((s) => s.classLevel),
        ])
      ),
    [classArms, students]
  );

  const getSchoolClassGroups = useCallback(
    (targetSchoolId: string) => {
      const custom = Array.from(
        new Set(
          classArms
            .filter(
              (c) =>
                c.isActive &&
                c.schoolId !== null &&
                String(c.schoolId) === targetSchoolId
            )
            .map((c) => c.classLevel)
        )
      );
      const others = availableClassLevels.filter((c) => !custom.includes(c));
      return { custom, others };
    },
    [classArms, availableClassLevels]
  );

  const singleSchoolClassGroups = useMemo(
    () => getSchoolClassGroups(effectiveSchoolId),
    [getSchoolClassGroups, effectiveSchoolId]
  );

  const batchSchoolClassGroups = useMemo(
    () => getSchoolClassGroups(effectiveBatchSchoolId),
    [getSchoolClassGroups, effectiveBatchSchoolId]
  );

  const availableArmNames = useMemo(
    () =>
      Array.from(
        new Set(
          classArms
            .filter((c) => c.isActive)
            .map((c) => c.armName)
            .concat(students.map((s) => s.arm).filter(Boolean))
        )
      ),
    [classArms, students]
  );

  const formArmOptions = useMemo(
    () =>
      Array.from(
        new Set(
          classArms
            .filter(
              (c) =>
                c.isActive &&
                c.classLevel.toUpperCase() ===
                  studentForm.classLevel.toUpperCase() &&
                (!effectiveSchoolId ||
                  c.schoolId === null ||
                  String(c.schoolId) === effectiveSchoolId)
            )
            .map((c) => c.armName)
        )
      ),
    [classArms, studentForm.classLevel, effectiveSchoolId]
  );

  const getNextExamNumberPreview = (schoolIdStr: string) => {
    const selectedSchool = schools.find((sc) => String(sc.id) === schoolIdStr);
    const cleanCode = (selectedSchool?.code || 'JGT')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
    const prefix = `${cleanCode || 'JGT'}-${new Date().getFullYear()}-`;
    let maxSeq = 0;
    for (const st of students) {
      const upper = st.examNumber.trim().toUpperCase();
      if (upper.startsWith(prefix)) {
        const suffix = upper.slice(prefix.length);
        if (/^\d+$/.test(suffix)) {
          const parsed = Number.parseInt(suffix, 10);
          if (parsed > maxSeq) maxSeq = parsed;
        }
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
  };

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (filterSchoolId && String(s.schoolId) !== filterSchoolId) return false;
      if (
        filterClassLevel &&
        s.classLevel.toUpperCase() !== filterClassLevel.toUpperCase()
      ) {
        return false;
      }
      if (filterArm && s.arm.trim().toUpperCase() !== filterArm.toUpperCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          s.fullName.toLowerCase().includes(q) ||
          s.examNumber.toLowerCase().includes(q) ||
          s.classLevel.toLowerCase().includes(q) ||
          (s.arm || '').toLowerCase().includes(q) ||
          s.schoolName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [students, filterSchoolId, filterClassLevel, filterArm, searchQuery]);

  const activeStudentsCount = useMemo(
    () => students.filter((s) => s.isActive).length,
    [students]
  );

  const representedClassesCount = useMemo(
    () => new Set(students.map((s) => s.classLevel)).size,
    [students]
  );

  const openManualStudio = (student?: StudentRow) => {
    setErr('');
    setMsg('');
    if (student) {
      setEditingStudent(student);
      setAutoGenerateExamNumber(false);
      setManualMode('single');
      setStudentForm({
        schoolId: String(student.schoolId),
        examNumber: student.examNumber,
        fullName: student.fullName,
        classLevel: student.classLevel,
        arm: student.arm || '',
        passcode: '',
      });
    } else {
      setEditingStudent(null);
      setAutoGenerateExamNumber(true);
      const defaultSchoolId =
        filterSchoolId || (schools[0] ? String(schools[0].id) : '');
      const scopedArm = classArms.find(
        (c) => c.isActive && String(c.schoolId ?? '') === defaultSchoolId
      );
      setStudentForm({
        schoolId: defaultSchoolId,
        examNumber: '',
        fullName: '',
        classLevel: scopedArm ? scopedArm.classLevel : 'SS1',
        arm: scopedArm ? scopedArm.armName : 'A',
        passcode: '',
      });
      if (!batchSchoolId && defaultSchoolId) {
        setBatchSchoolId(defaultSchoolId);
      }
    }
    setActiveTab('manual');
  };

  const handleSaveSingleStudent = async (addAnother: boolean) => {
    setErr('');
    setMsg('');
    const targetSchoolId = Number(effectiveSchoolId);
    if (!targetSchoolId) {
      setErr('Please select a school or organization.');
      return;
    }
    if (!studentForm.fullName.trim() || !studentForm.classLevel.trim()) {
      setErr('Full Name and Class Level are required.');
      return;
    }
    if (!editingStudent && studentForm.passcode.trim().length < 4) {
      setErr('Access Passcode must be at least 4 characters.');
      return;
    }
    if (
      editingStudent &&
      studentForm.passcode.trim() &&
      studentForm.passcode.trim().length < 4
    ) {
      setErr('New Access Passcode must be at least 4 characters.');
      return;
    }
    if (
      (editingStudent || !autoGenerateExamNumber) &&
      !studentForm.examNumber.trim()
    ) {
      setErr('Enter an Examination Number or switch to auto-generation.');
      return;
    }

    setSavingManual(true);
    try {
      const url = editingStudent
        ? `/api/admin/students/${editingStudent.id}`
        : '/api/admin/students';
      const method = editingStudent ? 'PUT' : 'POST';

      const payload = {
        schoolId: targetSchoolId,
        examNumber:
          !editingStudent && autoGenerateExamNumber
            ? ''
            : studentForm.examNumber.trim(),
        fullName: studentForm.fullName.trim(),
        classLevel: studentForm.classLevel.trim(),
        arm: studentForm.arm.trim(),
        passcode: studentForm.passcode.trim(),
      };

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || 'Unable to save student.');
        return;
      }

      const wasEdit = Boolean(editingStudent);
      const assignedSchool =
        schools.find((s) => s.id === targetSchoolId)?.name || '';
      if (!wasEdit && json.student) {
        setRecentCredentials((prev) => [
          {
            id: json.student.id,
            examNumber: json.student.examNumber,
            fullName: json.student.fullName,
            schoolName: assignedSchool,
            classLevel: json.student.classLevel,
            arm: json.student.arm || '',
            passcode: studentForm.passcode.trim(),
          },
          ...prev,
        ]);
      }

      setEditingStudent(null);
      await loadData();

      if (addAnother && !wasEdit) {
        setStudentForm((prev) => ({
          ...prev,
          schoolId: String(targetSchoolId),
          examNumber: '',
          fullName: '',
          passcode: '',
        }));
        setMsg(
          `Registered ${json.student?.fullName || 'student'} (${json.student?.examNumber || ''}). Ready for next entry.`
        );
      } else {
        setMsg(
          wasEdit
            ? `Student record updated (${json.student?.examNumber || studentForm.examNumber}).`
            : `Student registered successfully. Assigned Exam Number: ${json.student?.examNumber || ''}`
        );
        setActiveTab('directory');
      }
    } catch {
      setErr('Network error while saving student.');
    } finally {
      setSavingManual(false);
    }
  };

  const handleSaveBatchRows = async () => {
    setErr('');
    setMsg('');
    const targetSchoolId = Number(effectiveBatchSchoolId);
    if (!targetSchoolId) {
      setErr('Please select a target school or organization.');
      return;
    }

    const filledRows = batchRows.filter(
      (r) => r.fullName.trim() || r.examNumber.trim()
    );
    if (filledRows.length === 0) {
      setErr('Enter at least one student name in the manual sheet.');
      return;
    }

    const invalidIdx = filledRows.findIndex(
      (r) =>
        !r.fullName.trim() ||
        !(r.classLevel || batchDefaultClass).trim() ||
        (r.passcode || batchDefaultPasscode).trim().length < 4
    );
    if (invalidIdx >= 0) {
      setErr(
        `Row #${invalidIdx + 1} needs a Full Name, Class Level, and Passcode (min 4 chars).`
      );
      return;
    }

    setSavingBatch(true);
    try {
      const res = await fetch('/api/admin/students/bulk', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schoolId: targetSchoolId,
          items: filledRows.map((r) => ({
            fullName: r.fullName.trim(),
            classLevel: (r.classLevel || batchDefaultClass).trim(),
            arm: (r.arm !== '' ? r.arm : batchDefaultArm).trim(),
            passcode: (r.passcode || batchDefaultPasscode).trim(),
            examNumber: r.examNumber.trim(),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || 'Unable to register manual student list.');
        return;
      }

      if (Array.isArray(json.createdStudents) && json.createdStudents.length > 0) {
        setRecentCredentials(json.createdStudents);
      }
      setBatchRows(
        Array.from({ length: 5 }, () =>
          createEmptyBatchRow(
            batchDefaultClass,
            batchDefaultArm,
            batchDefaultPasscode
          )
        )
      );
      await loadData();
      setMsg(
        `Registered ${json.imported} student(s) from manual sheet${
          json.autoGeneratedCount
            ? ` (${json.autoGeneratedCount} auto-generated exam numbers)`
            : ''
        }.`
      );
      setActiveTab('directory');
    } catch {
      setErr('Network error while registering student sheet.');
    } finally {
      setSavingBatch(false);
    }
  };

  const toggleStudentActive = async (student: StudentRow) => {
    await fetch(`/api/admin/students/${student.id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    loadData();
  };

  const deleteStudent = async (id: number) => {
    await fetch(`/api/admin/students/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setConfirmDeleteId(null);
    setMsg('Student record removed.');
    loadData();
  };

  const exportFilteredRosterCsv = () => {
    const escapeCsv = (val: string) =>
      `"${String(val ?? '').replace(/"/g, '""')}"`;
    const lines = [
      'examNumber,fullName,schoolName,classLevel,arm,status',
      ...filteredStudents.map((st) =>
        [
          escapeCsv(st.examNumber),
          escapeCsv(st.fullName),
          escapeCsv(st.schoolName),
          escapeCsv(st.classLevel),
          escapeCsv(st.arm || ''),
          escapeCsv(st.isActive ? 'Active' : 'Deactivated'),
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student_roster_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportRecentCredentialsCsv = () => {
    if (recentCredentials.length === 0) return;
    const escapeCsv = (val: string) =>
      `"${String(val ?? '').replace(/"/g, '""')}"`;
    const lines = [
      'examNumber,fullName,schoolName,classLevel,arm,passcode',
      ...recentCredentials.map((c) =>
        [
          escapeCsv(c.examNumber),
          escapeCsv(c.fullName),
          escapeCsv(c.schoolName),
          escapeCsv(c.classLevel),
          escapeCsv(c.arm),
          escapeCsv(c.passcode),
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cbt_student_credentials_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewSchool = schools.find((s) => String(s.id) === effectiveSchoolId);
  const previewSchoolName =
    previewSchool?.name || 'Selected School / Organization';
  const batchPreviewSchool = schools.find(
    (s) => String(s.id) === effectiveBatchSchoolId
  );

  return (
    <div className="space-y-6">
      {/* Header & Workspace Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#123B72]">
            Student Registration &amp; Roster Studio
          </h2>
          <p className="text-sm text-slate-600">
            Manage enrolled candidates, register students manually (single or
            multi-row sheet), or bulk-upload student lists from Excel, CSV, or
            text files.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingStudent(null);
              setActiveTab('directory');
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold border whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'directory'
                ? 'bg-[#123B72] text-white border-[#123B72]'
                : 'bg-white text-[#123B72] border-slate-300 hover:bg-slate-50'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Student Directory ({students.length})
          </button>
          <button
            type="button"
            disabled={schools.length === 0}
            onClick={() => openManualStudio()}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold border whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 ${
              activeTab === 'manual'
                ? 'bg-[#E83E8C] text-white border-[#E83E8C]'
                : 'bg-white text-[#E83E8C] border-[#E83E8C] hover:bg-[#E83E8C]/5'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            {editingStudent ? 'Edit Student' : 'Register Manually'}
          </button>
          <button
            type="button"
            disabled={schools.length === 0}
            onClick={() => {
              setErr('');
              setMsg('');
              setActiveTab('bulk');
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold border whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 ${
              activeTab === 'bulk'
                ? 'bg-[#1769AA] text-white border-[#1769AA]'
                : 'bg-white text-[#1769AA] border-[#1769AA] hover:bg-[#1769AA]/5'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload Student List
          </button>
        </div>
      </div>

      {/* Summary Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium">
            Registered Students
          </p>
          <p className="font-mono-tabular text-2xl font-bold text-[#123B72] mt-1">
            {students.length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium">
            Active CBT Accounts
          </p>
          <p className="font-mono-tabular text-2xl font-bold text-emerald-700 mt-1">
            {activeStudentsCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium">
            Schools / Agencies
          </p>
          <p className="font-mono-tabular text-2xl font-bold text-[#1769AA] mt-1">
            {schools.length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium">
            Classes / Stages
          </p>
          <p className="font-mono-tabular text-2xl font-bold text-[#123B72] mt-1">
            {representedClassesCount}
          </p>
        </div>
      </div>

      {schools.length === 0 && !loading && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          No schools or organizations exist yet. Register at least one under
          School Management before adding students.
        </div>
      )}

      {msg && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{msg}</span>
          </div>
          {recentCredentials.length > 0 && (
            <button
              type="button"
              onClick={exportRecentCredentialsCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Download New Credentials ({recentCredentials.length})
            </button>
          )}
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

      {/* TAB 1: STUDENT DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by exam number, name, class, or arm..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <select
              value={filterSchoolId}
              onChange={(e) => setFilterSchoolId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
            >
              <option value="">All Schools / Agencies</option>
              {schools.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
            <select
              value={filterClassLevel}
              onChange={(e) => setFilterClassLevel(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
            >
              <option value="">All Classes</option>
              {availableClassLevels.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
            <select
              value={filterArm}
              onChange={(e) => setFilterArm(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
            >
              <option value="">All Arms</option>
              {availableArmNames.map((arm) => (
                <option key={arm} value={arm}>
                  {arm}
                </option>
              ))}
            </select>
            {filteredStudents.length > 0 && (
              <button
                type="button"
                onClick={exportFilteredRosterCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-[#123B72] hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Export Roster CSV
              </button>
            )}
          </div>

          {/* Students Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loading ? (
              <p className="p-6 text-sm text-slate-500">Loading students...</p>
            ) : filteredStudents.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-slate-500">
                  No students match your current search or filters.
                </p>
                {schools.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => openManualStudio()}
                      className="px-4 py-2 rounded-lg bg-[#E83E8C] text-white text-xs font-semibold hover:bg-[#d1327c]"
                    >
                      Register Student Manually
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('bulk')}
                      className="px-4 py-2 rounded-lg border border-[#1769AA] text-[#1769AA] text-xs font-semibold hover:bg-[#1769AA]/5"
                    >
                      Upload Student List
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F5F8FC] text-xs text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Exam Number</th>
                      <th className="px-4 py-3 font-semibold">Full Name</th>
                      <th className="px-4 py-3 font-semibold">
                        School / Agency
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Class &amp; Arm
                      </th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredStudents.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono-tabular font-semibold text-[#1769AA]">
                          {st.examNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#123B72]">
                          {st.fullName}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <SchoolNameBadge
                            name={st.schoolName}
                            logoUrl={st.schoolLogoUrl}
                            code={st.schoolCode}
                            size="xs"
                            nameClassName="text-sm font-medium text-slate-700"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono-tabular text-xs font-semibold text-[#1E293B]">
                          {st.classLevel}
                          {st.arm ? ` · ${st.arm}` : ''}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleStudentActive(st)}
                            className={`text-xs font-semibold ${
                              st.isActive ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {st.isActive ? 'Active' : 'Deactivated'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openManualStudio(st)}
                              className="p-1.5 rounded text-[#1769AA] hover:bg-slate-100"
                              title="Edit student or reset passcode"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {confirmDeleteId === st.id ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => deleteStudent(st.id)}
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
                                onClick={() => setConfirmDeleteId(st.id)}
                                className="p-1.5 rounded text-red-600 hover:bg-red-50"
                                title="Delete student"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MANUAL STUDENT REGISTRATION STUDIO */}
      {activeTab === 'manual' && (
        <div className="space-y-4">
          {!editingStudent && (
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 gap-1">
              <button
                type="button"
                onClick={() => setManualMode('single')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  manualMode === 'single'
                    ? 'bg-[#123B72] text-white'
                    : 'text-slate-600 hover:text-[#123B72]'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Single Student Form
              </button>
              <button
                type="button"
                onClick={() => setManualMode('multi_row')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  manualMode === 'multi_row'
                    ? 'bg-[#123B72] text-white'
                    : 'text-slate-600 hover:text-[#123B72]'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                Quick Multi-Row Sheet
              </button>
            </div>
          )}

          {manualMode === 'single' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3.5">
                  <div>
                    <h3 className="font-display text-lg font-bold text-[#123B72]">
                      {editingStudent
                        ? 'Edit Student Record'
                        : 'Register Student Manually'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Assign a school or organization, class level, arm, and CBT
                      access passcode.
                    </p>
                  </div>
                  {editingStudent && (
                    <button
                      type="button"
                      onClick={() => openManualStudio()}
                      className="text-xs font-semibold text-[#1769AA] hover:underline"
                    >
                      Switch to New Student
                    </button>
                  )}
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      School / Organization *
                    </label>
                    <select
                      required
                      value={effectiveSchoolId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        const scoped = classArms.find(
                          (c) =>
                            c.isActive && String(c.schoolId ?? '') === nextId
                        );
                        setStudentForm((prev) => ({
                          ...prev,
                          schoolId: nextId,
                          classLevel: scoped ? scoped.classLevel : prev.classLevel,
                          arm: scoped ? scoped.armName : prev.arm,
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    >
                      {schools.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-slate-600">
                        Examination Number{' '}
                        {!editingStudent && autoGenerateExamNumber
                          ? '(Auto-Generated)'
                          : '*'}
                      </label>
                      {!editingStudent && (
                        <button
                          type="button"
                          onClick={() =>
                            setAutoGenerateExamNumber((prev) => !prev)
                          }
                          className="text-[11px] font-semibold text-[#1769AA] hover:underline"
                        >
                          {autoGenerateExamNumber
                            ? 'Enter manually instead'
                            : 'Use auto-generated number'}
                        </button>
                      )}
                    </div>

                    {!editingStudent && autoGenerateExamNumber ? (
                      <div className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-[#F5F8FC] flex items-center justify-between gap-2">
                        <span className="text-sm font-mono-tabular font-semibold text-[#123B72]">
                          {getNextExamNumberPreview(effectiveSchoolId)}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500">
                          Assigned automatically on save
                        </span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        required
                        value={studentForm.examNumber}
                        onChange={(e) =>
                          setStudentForm({
                            ...studentForm,
                            examNumber: e.target.value,
                          })
                        }
                        placeholder="e.g. JGT-2026-001"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular uppercase"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Student Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={studentForm.fullName}
                      onChange={(e) =>
                        setStudentForm({
                          ...studentForm,
                          fullName: e.target.value,
                        })
                      }
                      placeholder="e.g. Adebayo Chinedu Musa"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Class Level / Category *
                      </label>
                      <select
                        value={studentForm.classLevel}
                        onChange={(e) =>
                          setStudentForm({
                            ...studentForm,
                            classLevel: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                      >
                        {singleSchoolClassGroups.custom.length > 0 ? (
                          <>
                            <optgroup label="Selected School / Agency Classes">
                              {singleSchoolClassGroups.custom.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Other / Standard Classes">
                              {singleSchoolClassGroups.others.map((c) => (
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
                        Arm / Group (e.g. A, Science, Group 1)
                      </label>
                      <input
                        type="text"
                        list="manual-student-arm-options"
                        value={studentForm.arm}
                        onChange={(e) =>
                          setStudentForm({
                            ...studentForm,
                            arm: e.target.value,
                          })
                        }
                        placeholder="e.g. A, Class 1, Art"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                      />
                      <datalist id="manual-student-arm-options">
                        {(formArmOptions.length > 0
                          ? formArmOptions
                          : availableArmNames
                        ).map((a) => (
                          <option key={a} value={a} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-slate-600">
                        {editingStudent
                          ? 'New Access Passcode (leave blank to keep current)'
                          : 'Access Passcode (min 4 chars) *'}
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setStudentForm((prev) => ({
                            ...prev,
                            passcode: generatePasscode(),
                          }))
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1769AA] hover:underline"
                      >
                        <KeyRound className="w-3 h-3" />
                        Generate Passcode
                      </button>
                    </div>
                    <input
                      type="text"
                      required={!editingStudent}
                      value={studentForm.passcode}
                      onChange={(e) =>
                        setStudentForm({
                          ...studentForm,
                          passcode: e.target.value,
                        })
                      }
                      placeholder={
                        editingStudent
                          ? 'Optional new passcode'
                          : 'e.g. pass1234'
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStudent(null);
                      setActiveTab('directory');
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Back to Directory
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    {!editingStudent && (
                      <button
                        type="button"
                        disabled={savingManual}
                        onClick={() => handleSaveSingleStudent(true)}
                        className="px-4 py-2 rounded-lg border border-[#123B72] text-[#123B72] text-sm font-semibold hover:bg-[#123B72] hover:text-white disabled:opacity-50"
                      >
                        {savingManual ? 'Saving...' : 'Save & Add Next'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={savingManual}
                      onClick={() => handleSaveSingleStudent(false)}
                      className="px-5 py-2 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c] disabled:opacity-50"
                    >
                      {savingManual
                        ? 'Saving...'
                        : editingStudent
                          ? 'Save Changes'
                          : 'Save & Open Directory'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Live CBT Credential Slip Preview */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
                <p className="text-sm font-bold text-[#123B72]">
                  CBT Candidate Slip Preview
                </p>
                <div className="p-4 rounded-xl border border-slate-200 bg-[#F5F8FC] space-y-3">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-slate-500">
                      School / Organization
                    </p>
                    <SchoolNameBadge
                      name={previewSchoolName}
                      logoUrl={previewSchool?.logoUrl}
                      code={previewSchool?.code}
                      size="sm"
                      nameClassName="text-sm font-semibold text-[#123B72]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">
                        Candidate Name
                      </p>
                      <p className="text-sm font-semibold text-[#1E293B]">
                        {studentForm.fullName.trim() || 'Student Full Name'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">
                        Class &amp; Arm
                      </p>
                      <p className="text-sm font-mono-tabular font-semibold text-[#1E293B]">
                        {studentForm.classLevel}
                        {studentForm.arm.trim() ? ` · ${studentForm.arm.trim()}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">
                        Exam Number
                      </p>
                      <p className="text-sm font-mono-tabular font-bold text-[#1769AA]">
                        {!editingStudent && autoGenerateExamNumber
                          ? getNextExamNumberPreview(effectiveSchoolId)
                          : studentForm.examNumber.trim().toUpperCase() ||
                            'JGT-2026-001'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">
                        CBT Passcode
                      </p>
                      <p className="text-sm font-mono-tabular font-bold text-[#123B72]">
                        {studentForm.passcode.trim() ||
                          (editingStudent ? '(unchanged)' : '••••••')}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Students sign in at the CBT Portal using their assigned
                  Examination Number and Passcode.
                </p>
              </div>
            </div>
          ) : (
            /* Quick Multi-Row Manual Entry Sheet */
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#123B72]">
                    Quick Multi-Row Manual Student Entry
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Key in multiple students directly in a table. Leave Exam
                    Number blank to auto-generate sequential IDs.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setBatchRows((prev) => [
                        ...prev,
                        createEmptyBatchRow(
                          batchDefaultClass,
                          batchDefaultArm,
                          batchDefaultPasscode
                        ),
                      ])
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#123B72] hover:bg-slate-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Row
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBatchRows((prev) => [
                        ...prev,
                        ...Array.from({ length: 5 }, () =>
                          createEmptyBatchRow(
                            batchDefaultClass,
                            batchDefaultArm,
                            batchDefaultPasscode
                          )
                        ),
                      ])
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#1769AA] hover:bg-slate-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add 5 Rows
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#F5F8FC] p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-[#123B72] mb-1">
                    Target School / Agency *
                  </label>
                  <select
                    value={effectiveBatchSchoolId}
                    onChange={(e) => setBatchSchoolId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  >
                    {schools.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                  {batchPreviewSchool && (
                    <div className="mt-1.5">
                      <SchoolNameBadge
                        name={batchPreviewSchool.name}
                        logoUrl={batchPreviewSchool.logoUrl}
                        code={batchPreviewSchool.code}
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
                    value={batchDefaultClass}
                    onChange={(e) => setBatchDefaultClass(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  >
                    {batchSchoolClassGroups.custom.length > 0 ? (
                      <>
                        <optgroup label="Selected School / Agency Classes">
                          {batchSchoolClassGroups.custom.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Other / Standard Classes">
                          {batchSchoolClassGroups.others.map((c) => (
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
                  <label className="block text-xs font-semibold text-[#123B72] mb-1">
                    Default Arm / Group
                  </label>
                  <input
                    type="text"
                    value={batchDefaultArm}
                    onChange={(e) => setBatchDefaultArm(e.target.value)}
                    placeholder="e.g. A"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#123B72] mb-1">
                    Default Passcode
                  </label>
                  <input
                    type="text"
                    value={batchDefaultPasscode}
                    onChange={(e) => setBatchDefaultPasscode(e.target.value)}
                    placeholder="pass1234"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono-tabular"
                  />
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F5F8FC] text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold w-10">#</th>
                      <th className="px-3 py-2.5 font-semibold min-w-[200px]">
                        Full Name *
                      </th>
                      <th className="px-3 py-2.5 font-semibold min-w-[130px]">
                        Class / Stage *
                      </th>
                      <th className="px-3 py-2.5 font-semibold min-w-[110px]">
                        Arm / Group
                      </th>
                      <th className="px-3 py-2.5 font-semibold min-w-[120px]">
                        Passcode *
                      </th>
                      <th className="px-3 py-2.5 font-semibold min-w-[150px]">
                        Exam No. (Optional)
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-right w-14">
                        Remove
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {batchRows.map((row, idx) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 font-mono-tabular text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={row.fullName}
                            onChange={(e) =>
                              setBatchRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, fullName: e.target.value }
                                    : r
                                )
                              )
                            }
                            placeholder="Student full name"
                            className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={row.classLevel}
                            onChange={(e) =>
                              setBatchRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, classLevel: e.target.value }
                                    : r
                                )
                              )
                            }
                            className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs"
                          >
                            {availableClassLevels.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={row.arm}
                            onChange={(e) =>
                              setBatchRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, arm: e.target.value }
                                    : r
                                )
                              )
                            }
                            placeholder={batchDefaultArm || 'A'}
                            className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={row.passcode}
                            onChange={(e) =>
                              setBatchRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, passcode: e.target.value }
                                    : r
                                )
                              )
                            }
                            placeholder="min 4 chars"
                            className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs font-mono-tabular"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={row.examNumber}
                            onChange={(e) =>
                              setBatchRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, examNumber: e.target.value }
                                    : r
                                )
                              )
                            }
                            placeholder="Auto-generated"
                            className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs font-mono-tabular uppercase"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            disabled={batchRows.length <= 1}
                            onClick={() =>
                              setBatchRows((prev) =>
                                prev.filter((r) => r.id !== row.id)
                              )
                            }
                            className="p-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-30"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('directory')}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Back to Directory
                </button>
                <button
                  type="button"
                  disabled={savingBatch}
                  onClick={handleSaveBatchRows}
                  className="px-5 py-2 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c] disabled:opacity-50"
                >
                  {savingBatch
                    ? 'Registering...'
                    : `Register Entered Students (${
                        batchRows.filter((r) => r.fullName.trim()).length
                      })`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BULK UPLOAD STUDENT LIST STUDIO */}
      {activeTab === 'bulk' && (
        <BulkStudentsUploadModal
          token={token}
          schools={schools}
          classArms={classArms}
          initialSchoolId={filterSchoolId}
          embedded
          onSuccess={async (summaryMsg, created) => {
            setMsg(summaryMsg);
            if (created.length > 0) {
              setRecentCredentials(created);
            }
            await loadData();
            setActiveTab('directory');
          }}
        />
      )}
    </div>
  );
}
