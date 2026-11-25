import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

interface SchoolRow {
  id: number;
  name: string;
  code: string;
  state: string;
  lga: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  accessCode: string;
  isActive: boolean;
  studentCount: number;
}

interface StudentRow {
  id: number;
  schoolId: number;
  schoolName: string;
  schoolCode: string;
  examNumber: string;
  fullName: string;
  classLevel: string;
  arm: string;
  isActive: boolean;
}

interface ClassArmOption {
  id: number;
  schoolId: number | null;
  classLevel: string;
  armName: string;
  displayName: string;
  isActive: boolean;
}

interface SchoolExamRecord {
  attemptId: number;
  studentName: string;
  examNumber: string;
  classLevel: string;
  arm: string;
  examTitle: string;
  subjectName: string;
  score: number;
  totalMarks: number;
  percentage: number;
  status: string;
}

export function AdminSchoolsStudentsSection({
  token,
  mode,
}: {
  token: string;
  mode: 'schools' | 'students';
}) {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classArms, setClassArms] = useState<ClassArmOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // School Form Modal
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolRow | null>(null);
  const [schoolForm, setSchoolForm] = useState({
    name: '',
    code: '',
    state: '',
    lga: '',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    accessCode: '',
  });

  // School Records Modal
  const [recordsSchool, setRecordsSchool] = useState<SchoolRow | null>(null);
  const [schoolRecords, setSchoolRecords] = useState<SchoolExamRecord[]>([]);

  // Student Filters & Modal
  const [filterSchoolId, setFilterSchoolId] = useState('');
  const [filterClassLevel, setFilterClassLevel] = useState('');
  const [filterArm, setFilterArm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [autoGenerateExamNumber, setAutoGenerateExamNumber] = useState(true);
  const [studentForm, setStudentForm] = useState({
    schoolId: '',
    examNumber: '',
    fullName: '',
    classLevel: 'SS1',
    arm: 'Class 1',
    passcode: '',
  });

  // CSV Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSchoolId, setImportSchoolId] = useState('');
  const [csvText, setCsvText] = useState('');

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

  // School Handlers
  const openSchoolModal = (school?: SchoolRow) => {
    setErr('');
    if (school) {
      setEditingSchool(school);
      setSchoolForm({
        name: school.name,
        code: school.code,
        state: school.state,
        lga: school.lga,
        contactPerson: school.contactPerson,
        contactEmail: school.contactEmail,
        contactPhone: school.contactPhone,
        accessCode: school.accessCode,
      });
    } else {
      setEditingSchool(null);
      setSchoolForm({
        name: '',
        code: '',
        state: '',
        lga: '',
        contactPerson: '',
        contactEmail: '',
        contactPhone: '',
        accessCode: '',
      });
    }
    setShowSchoolModal(true);
  };

  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    const url = editingSchool
      ? `/api/admin/schools/${editingSchool.id}`
      : '/api/admin/schools';
    const method = editingSchool ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(schoolForm),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error || 'Unable to save school.');
      return;
    }
    setShowSchoolModal(false);
    setMsg(
      editingSchool
        ? 'School details updated.'
        : 'School registered successfully.'
    );
    loadData();
  };

  const toggleSchoolActive = async (school: SchoolRow) => {
    await fetch(`/api/admin/schools/${school.id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    loadData();
  };

  const deleteSchool = async (school: SchoolRow) => {
    await fetch(`/api/admin/schools/${school.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setMsg(`Removed school: ${school.name}`);
    loadData();
  };

  const viewSchoolRecords = async (school: SchoolRow) => {
    setRecordsSchool(school);
    const res = await fetch(`/api/admin/schools/${school.id}/records`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setSchoolRecords(json.records || []);
    }
  };

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

  // Student Handlers
  const openStudentModal = (student?: StudentRow) => {
    setErr('');
    if (student) {
      setEditingStudent(student);
      setAutoGenerateExamNumber(false);
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
      setStudentForm({
        schoolId: schools[0] ? String(schools[0].id) : '',
        examNumber: '',
        fullName: '',
        classLevel: 'SS1',
        arm: 'A',
        passcode: '',
      });
    }
    setShowStudentModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    const url = editingStudent
      ? `/api/admin/students/${editingStudent.id}`
      : '/api/admin/students';
    const method = editingStudent ? 'PUT' : 'POST';

    const payload =
      !editingStudent && autoGenerateExamNumber
        ? { ...studentForm, examNumber: '' }
        : studentForm;

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
    setShowStudentModal(false);
    setMsg(
      editingStudent
        ? `Student record updated (${json.student?.examNumber || studentForm.examNumber}).`
        : `Student registered successfully. Assigned Exam Number: ${json.student?.examNumber || ''}`
    );
    loadData();
  };

  const toggleStudentActive = async (student: StudentRow) => {
    await fetch(`/api/admin/students/${student.id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    loadData();
  };

  const deleteStudent = async (student: StudentRow) => {
    await fetch(`/api/admin/students/${student.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setMsg(`Removed student: ${student.fullName}`);
    loadData();
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    const res = await fetch('/api/admin/students/import', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schoolId: Number(importSchoolId),
        csvText,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error || 'CSV import failed.');
      return;
    }
    setShowImportModal(false);
    setCsvText('');
    setMsg(
      `Imported ${json.imported} student(s)${
        json.autoGeneratedCount
          ? ` with ${json.autoGeneratedCount} auto-generated exam number(s)`
          : ''
      }.${json.errors?.length ? ` (${json.errors.length} skipped)` : ''}`
    );
    loadData();
  };

  const downloadStudentTemplate = () => {
    const sample =
      'fullName,classLevel,arm,passcode\nAdebayo Chinedu Musa,SS3,Science,pass1234\nOkafor Zainab Tolu,SS2,Art,pass5678\n';
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
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
    new Set(
      classArms
        .filter((c) => c.isActive)
        .map((c) => c.armName)
        .concat(students.map((s) => s.arm).filter(Boolean))
    )
  );

  const formArmOptions = Array.from(
    new Set(
      classArms
        .filter(
          (c) =>
            c.isActive &&
            c.classLevel.toUpperCase() === studentForm.classLevel.toUpperCase() &&
            (!studentForm.schoolId ||
              c.schoolId === null ||
              String(c.schoolId) === studentForm.schoolId)
        )
        .map((c) => c.armName)
    )
  );

  const filteredStudents = students.filter((s) => {
    if (filterSchoolId && String(s.schoolId) !== filterSchoolId) return false;
    if (filterClassLevel && s.classLevel.toUpperCase() !== filterClassLevel)
      return false;
    if (filterArm && s.arm.trim().toUpperCase() !== filterArm.toUpperCase())
      return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.examNumber.toLowerCase().includes(q) ||
        s.classLevel.toLowerCase().includes(q) ||
        (s.arm || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (mode === 'schools') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#123B72]">
              School Management
            </h2>
            <p className="text-sm text-slate-600">
              Register Nigerian secondary schools, manage school credentials,
              and inspect examination records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openSchoolModal()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c]"
          >
            <Plus className="w-4 h-4" />
            Add School
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

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading schools...</p>
          ) : schools.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm text-slate-600">
                No schools registered yet. Add your first secondary school to
                begin student enrolment.
              </p>
              <button
                type="button"
                onClick={() => openSchoolModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#123B72] text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                Register First School
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F5F8FC] text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">School & Code</th>
                    <th className="px-4 py-3 font-semibold">Location</th>
                    <th className="px-4 py-3 font-semibold">Contact Officer</th>
                    <th className="px-4 py-3 font-semibold">Access Credential</th>
                    <th className="px-4 py-3 font-semibold text-right">Students</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {schools.map((sc) => (
                    <tr key={sc.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#123B72]">{sc.name}</p>
                        <p className="font-mono-tabular text-xs text-slate-500">
                          {sc.code}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {sc.lga ? `${sc.lga}, ` : ''}
                        {sc.state}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <p className="font-medium text-[#1E293B]">
                          {sc.contactPerson}
                        </p>
                        <p>{sc.contactPhone}</p>
                      </td>
                      <td className="px-4 py-3 font-mono-tabular text-xs text-[#1769AA]">
                        {sc.accessCode}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-tabular font-semibold">
                        {sc.studentCount}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSchoolActive(sc)}
                          className={`text-xs font-semibold ${
                            sc.isActive ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {sc.isActive ? 'Active' : 'Deactivated'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => viewSchoolRecords(sc)}
                            className="px-2.5 py-1 rounded border border-slate-200 text-xs font-medium hover:bg-slate-100"
                          >
                            Records
                          </button>
                          <button
                            type="button"
                            onClick={() => openSchoolModal(sc)}
                            className="p-1.5 rounded text-[#1769AA] hover:bg-slate-100"
                            title="Edit school"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSchool(sc)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50"
                            title="Delete school"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* School Add/Edit Modal */}
        {showSchoolModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-[#123B72]">
                  {editingSchool ? 'Edit School' : 'Register New School'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSchoolModal(false)}
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSaveSchool} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    School Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolForm.name}
                    onChange={(e) =>
                      setSchoolForm({ ...schoolForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      School Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={schoolForm.code}
                      onChange={(e) =>
                        setSchoolForm({ ...schoolForm, code: e.target.value })
                      }
                      placeholder="e.g. KINGS01"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Access Credential (optional)
                    </label>
                    <input
                      type="text"
                      value={schoolForm.accessCode}
                      onChange={(e) =>
                        setSchoolForm({
                          ...schoolForm,
                          accessCode: e.target.value,
                        })
                      }
                      placeholder="Auto-generated if blank"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      State *
                    </label>
                    <input
                      type="text"
                      required
                      value={schoolForm.state}
                      onChange={(e) =>
                        setSchoolForm({ ...schoolForm, state: e.target.value })
                      }
                      placeholder="e.g. Lagos"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      LGA
                    </label>
                    <input
                      type="text"
                      value={schoolForm.lga}
                      onChange={(e) =>
                        setSchoolForm({ ...schoolForm, lga: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Contact Officer / Principal *
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolForm.contactPerson}
                    onChange={(e) =>
                      setSchoolForm({
                        ...schoolForm,
                        contactPerson: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Contact Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={schoolForm.contactEmail}
                      onChange={(e) =>
                        setSchoolForm({
                          ...schoolForm,
                          contactEmail: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Contact Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={schoolForm.contactPhone}
                      onChange={(e) =>
                        setSchoolForm({
                          ...schoolForm,
                          contactPhone: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSchoolModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-[#123B72] text-white text-sm font-semibold hover:bg-[#1769AA]"
                  >
                    Save School
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* School Exam Records Modal */}
        {recordsSchool && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#123B72]">
                    {recordsSchool.name} — Examination Records
                  </h3>
                  <p className="text-xs text-slate-500">
                    Code: {recordsSchool.code}
                  </p>
                </div>
                <button type="button" onClick={() => setRecordsSchool(null)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              {schoolRecords.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">
                  No examination attempts recorded for this school yet.
                </p>
              ) : (
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#F5F8FC] text-xs text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Class</th>
                      <th className="px-3 py-2">Examination</th>
                      <th className="px-3 py-2 text-right">Score</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {schoolRecords.map((rec) => (
                      <tr key={rec.attemptId}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-[#123B72]">
                            {rec.studentName}
                          </p>
                          <p className="font-mono-tabular text-xs text-slate-500">
                            {rec.examNumber}
                          </p>
                        </td>
                        <td className="px-3 py-2 font-mono-tabular">
                          {rec.classLevel}
                          {rec.arm ? ` · ${rec.arm}` : ''}
                        </td>
                        <td className="px-3 py-2">
                          {rec.examTitle} ({rec.subjectName})
                        </td>
                        <td className="px-3 py-2 text-right font-mono-tabular font-semibold">
                          {rec.score}/{rec.totalMarks} ({rec.percentage}%)
                        </td>
                        <td className="px-3 py-2 capitalize">{rec.status}</td>
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

  // STUDENT MANAGEMENT VIEW
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#123B72]">
            Student Management
          </h2>
          <p className="text-sm text-slate-600">
            Register students, assign schools and classes, import CSV records,
            and manage CBT credentials.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={schools.length === 0}
            onClick={() => {
              setImportSchoolId(schools[0] ? String(schools[0].id) : '');
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#123B72] text-[#123B72] text-sm font-semibold hover:bg-[#123B72] hover:text-white disabled:opacity-40"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Import CSV
          </button>
          <button
            type="button"
            disabled={schools.length === 0}
            onClick={() => openStudentModal()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c] disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            Register Student
          </button>
        </div>
      </div>

      {schools.length === 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          Please register at least one school under School Management before
          adding students.
        </div>
      )}

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
          <option value="">All Schools</option>
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
      </div>

      {/* Students Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading students...</p>
        ) : filteredStudents.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No students found matching your criteria.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F5F8FC] text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Exam Number</th>
                  <th className="px-4 py-3 font-semibold">Full Name</th>
                  <th className="px-4 py-3 font-semibold">School</th>
                  <th className="px-4 py-3 font-semibold">Class &amp; Arm</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
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
                    <td className="px-4 py-3 text-slate-600">{st.schoolName}</td>
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
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openStudentModal(st)}
                          className="p-1.5 rounded text-[#1769AA] hover:bg-slate-100"
                          title="Edit student / reset password"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteStudent(st)}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50"
                          title="Delete student"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Student Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#123B72]">
                {editingStudent ? 'Edit Student' : 'Register Student'}
              </h3>
              <button type="button" onClick={() => setShowStudentModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSaveStudent} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  School *
                </label>
                <select
                  required
                  value={studentForm.schoolId}
                  onChange={(e) =>
                    setStudentForm({ ...studentForm, schoolId: e.target.value })
                  }
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
                    Examination Number {!editingStudent && autoGenerateExamNumber ? '(Auto-Generated)' : '*'}
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
                      {getNextExamNumberPreview(studentForm.schoolId)}
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
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={studentForm.fullName}
                  onChange={(e) =>
                    setStudentForm({ ...studentForm, fullName: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Class Level *
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
                    {availableClassLevels.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Arm (e.g. A, Class 1, Art)
                  </label>
                  <input
                    type="text"
                    list="student-arm-options"
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
                  <datalist id="student-arm-options">
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
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {editingStudent
                    ? 'New Access Password (optional)'
                    : 'Access Password (min 4 chars) *'}
                </label>
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#123B72] text-white text-sm font-semibold hover:bg-[#1769AA]"
                >
                  Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#123B72]">
                Import Student Records (CSV)
              </h3>
              <button type="button" onClick={() => setShowImportModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-600 bg-[#F5F8FC] p-3 rounded-lg border border-slate-200">
              <span>
                Columns: fullName, classLevel, arm, passcode (examNumber is
                optional &mdash; auto-generated if omitted)
              </span>
              <button
                type="button"
                onClick={downloadStudentTemplate}
                className="inline-flex items-center gap-1 font-semibold text-[#1769AA] hover:underline shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Template
              </button>
            </div>
            <form onSubmit={handleImportCsv} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Target School *
                </label>
                <select
                  required
                  value={importSchoolId}
                  onChange={(e) => setImportSchoolId(e.target.value)}
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
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Upload .csv File or Paste CSV Content *
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      f.text().then(setCsvText);
                    }
                  }}
                  className="block w-full text-xs text-slate-600 mb-2"
                />
                <textarea
                  rows={6}
                  required
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="fullName,classLevel,arm,passcode&#10;Chinedu Okafor,SS3,Science,pass1234&#10;Zainab Musa,SS2,Art,pass5678"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold"
                >
                  Import Students
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
