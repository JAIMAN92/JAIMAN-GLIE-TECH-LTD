import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  ImagePlus,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  isValidImageUrl,
  prepareSchoolLogoFile,
} from '../../lib/imageUpload.ts';
import { SchoolNameBadge } from '../SchoolNameBadge.tsx';
import { AdminStudentRegistrationSection } from './AdminStudentRegistrationSection.tsx';

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
  logoUrl: string;
  isActive: boolean;
  studentCount: number;
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
  if (mode === 'students') {
    return <AdminStudentRegistrationSection token={token} />;
  }
  return <AdminSchoolsSectionContent token={token} />;
}

function AdminSchoolsSectionContent({ token }: { token: string }) {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // School Form Modal
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolRow | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [schoolForm, setSchoolForm] = useState({
    name: '',
    code: '',
    state: '',
    lga: '',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    accessCode: '',
    logoUrl: '',
  });

  // School Records Modal
  const [recordsSchool, setRecordsSchool] = useState<SchoolRow | null>(null);
  const [schoolRecords, setSchoolRecords] = useState<SchoolExamRecord[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const scRes = await fetch('/api/admin/schools', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (scRes.ok) {
        const scJson = await scRes.json();
        setSchools(scJson.schools || []);
      }
    } catch {
      setErr('Unable to load school records.');
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
        logoUrl: school.logoUrl || '',
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
        logoUrl: '',
      });
    }
    setShowSchoolModal(true);
  };

  const handleLogoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    setUploadingLogo(true);
    try {
      const dataUrl = await prepareSchoolLogoFile(file);
      setSchoolForm((prev) => ({ ...prev, logoUrl: dataUrl }));
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : 'Unable to process selected logo image.'
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');

    if (schoolForm.logoUrl && !isValidImageUrl(schoolForm.logoUrl)) {
      setErr(
        'Logo URL must be a valid image upload or an http(s) / relative image link.'
      );
      return;
    }

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
      setErr(json.error || 'Unable to save school or agency.');
      return;
    }
    setShowSchoolModal(false);
    setMsg(
      editingSchool
        ? 'School / agency details updated.'
        : 'School / agency registered successfully.'
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
                    <th className="px-4 py-3 font-semibold">
                      School / Agency &amp; Code
                    </th>
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
                        <SchoolNameBadge
                          name={sc.name}
                          logoUrl={sc.logoUrl}
                          code={sc.code}
                          subtitle={sc.code}
                          size="md"
                        />
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
                  {editingSchool
                    ? 'Edit School / Agency'
                    : 'Register New School / Agency'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSchoolModal(false)}
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              {err && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
                  {err}
                </div>
              )}
              <form onSubmit={handleSaveSchool} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    School / Agency Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolForm.name}
                    onChange={(e) =>
                      setSchoolForm({ ...schoolForm, name: e.target.value })
                    }
                    placeholder="e.g. Kings College Lagos or National Quiz Board"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="p-3.5 rounded-xl bg-[#F5F8FC] border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <label className="block text-xs font-semibold text-[#123B72]">
                      School / Agency Logo (Optional)
                    </label>
                    {schoolForm.logoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setSchoolForm({ ...schoolForm, logoUrl: '' })
                        }
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <SchoolNameBadge
                      name={schoolForm.name.trim() || 'School / Agency'}
                      logoUrl={schoolForm.logoUrl}
                      code={schoolForm.code}
                      size="lg"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-[#123B72] hover:bg-slate-50 cursor-pointer">
                      <ImagePlus className="w-3.5 h-3.5 text-[#1769AA]" />
                      {uploadingLogo ? 'Processing...' : 'Upload Logo File'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                        onChange={handleLogoFileChange}
                        className="sr-only"
                      />
                    </label>
                    <input
                      type="text"
                      value={
                        schoolForm.logoUrl.startsWith('data:')
                          ? ''
                          : schoolForm.logoUrl
                      }
                      onChange={(e) =>
                        setSchoolForm({
                          ...schoolForm,
                          logoUrl: e.target.value,
                        })
                      }
                      placeholder={
                        schoolForm.logoUrl.startsWith('data:')
                          ? 'Uploaded logo attached (paste URL to replace)'
                          : 'Or paste https://... logo image URL'
                      }
                      className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                  </div>
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
              <div className="flex items-center justify-between gap-4">
                <SchoolNameBadge
                  name={`${recordsSchool.name} — Examination Records`}
                  logoUrl={recordsSchool.logoUrl}
                  code={recordsSchool.code}
                  subtitle={`Code: ${recordsSchool.code}`}
                  size="md"
                  nameClassName="font-display text-lg font-bold text-[#123B72]"
                />
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
