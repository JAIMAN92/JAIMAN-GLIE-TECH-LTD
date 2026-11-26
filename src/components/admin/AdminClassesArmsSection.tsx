import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { SchoolNameBadge } from '../SchoolNameBadge.tsx';

interface SchoolOption {
  id: number;
  name: string;
  code: string;
  logoUrl?: string;
}

interface ClassArmRow {
  id: number;
  schoolId: number | null;
  schoolName: string;
  schoolLogoUrl?: string;
  classLevel: string;
  armName: string;
  displayName: string;
  isActive: boolean;
  studentCount: number;
}

const STANDARD_CLASSES = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];

export function AdminClassesArmsSection({ token }: { token: string }) {
  const [classArms, setClassArms] = useState<ClassArmRow[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Filters
  const [filterSchoolId, setFilterSchoolId] = useState('');
  const [filterClass, setFilterClass] = useState('');

  // Single Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ClassArmRow | null>(null);
  const [form, setForm] = useState({
    schoolId: '',
    classLevel: 'JSS1',
    armName: 'A',
    isActive: true,
  });

  // Bulk Generator Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSchoolId, setBulkSchoolId] = useState('');
  const [bulkClasses, setBulkClasses] = useState<string[]>([
    'JSS1',
    'JSS2',
    'JSS3',
  ]);
  const [customBulkClassesInput, setCustomBulkClassesInput] = useState('');
  const [bulkArmsInput, setBulkArmsInput] = useState(
    'A, B, C, D, E, F, G, H, I, J'
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [caRes, scRes] = await Promise.all([
        fetch('/api/admin/class-arms', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/schools', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (caRes.ok) {
        const d = await caRes.json();
        setClassArms(d.classArms || []);
      }
      if (scRes.ok) {
        const d = await scRes.json();
        setSchools(d.schools || []);
      }
    } catch {
      setErr('Unable to load class and arm records.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openModal = (item?: ClassArmRow) => {
    setErr('');
    if (item) {
      setEditingItem(item);
      setForm({
        schoolId: item.schoolId ? String(item.schoolId) : '',
        classLevel: item.classLevel,
        armName: item.armName,
        isActive: item.isActive,
      });
    } else {
      setEditingItem(null);
      setForm({
        schoolId: '',
        classLevel: 'SS1',
        armName: 'Class 1',
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    const url = editingItem
      ? `/api/admin/class-arms/${editingItem.id}`
      : '/api/admin/class-arms';
    const method = editingItem ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schoolId: form.schoolId ? Number(form.schoolId) : null,
        classLevel: form.classLevel.trim().toUpperCase(),
        armName: form.armName.trim(),
        isActive: form.isActive,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error || 'Unable to save class and arm.');
      return;
    }

    setShowModal(false);
    setMsg(
      editingItem
        ? 'Class & Arm updated successfully.'
        : 'Class & Arm created successfully.'
    );
    loadData();
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');

    const parsedCustomClasses = customBulkClassesInput
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const combinedClasses = Array.from(
      new Set([...bulkClasses, ...parsedCustomClasses])
    );

    const parsedArms = bulkArmsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (combinedClasses.length === 0 || parsedArms.length === 0) {
      setErr(
        'Select or enter at least one class/category level and enter at least one arm or group.'
      );
      return;
    }

    const res = await fetch('/api/admin/class-arms/bulk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schoolId: bulkSchoolId ? Number(bulkSchoolId) : null,
        classLevels: combinedClasses,
        armNames: parsedArms,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setErr(json.error || 'Bulk generation failed.');
      return;
    }

    setShowBulkModal(false);
    setCustomBulkClassesInput('');
    setMsg(
      `Generated ${json.createdCount} new class & arm record(s).${
        json.skippedCount > 0 ? ` (${json.skippedCount} already existed)` : ''
      }`
    );
    loadData();
  };

  const toggleActive = async (item: ClassArmRow) => {
    await fetch(`/api/admin/class-arms/${item.id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    loadData();
  };

  const deleteItem = async (item: ClassArmRow) => {
    await fetch(`/api/admin/class-arms/${item.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setMsg(`Removed ${item.displayName}.`);
    loadData();
  };

  const toggleBulkClass = (cls: string) => {
    setBulkClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  };

  const availableClasses = Array.from(
    new Set([...STANDARD_CLASSES, ...classArms.map((c) => c.classLevel)])
  );

  const filtered = classArms.filter((item) => {
    if (filterSchoolId === 'global' && item.schoolId !== null) return false;
    if (
      filterSchoolId &&
      filterSchoolId !== 'global' &&
      String(item.schoolId ?? '') !== filterSchoolId
    ) {
      return false;
    }
    if (filterClass && item.classLevel !== filterClass) return false;
    return true;
  });

  const activeCount = classArms.filter((c) => c.isActive).length;
  const distinctClassCount = new Set(classArms.map((c) => c.classLevel)).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#123B72]">
            Classes &amp; Arms Management
          </h2>
          <p className="text-sm text-slate-600">
            Configure secondary school class levels (JSS1–SS3) or create custom
            categories, quiz stages, and cohorts scoped separately to any
            participating school or external agency.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setErr('');
              setShowBulkModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#123B72] text-[#123B72] text-sm font-semibold hover:bg-[#123B72] hover:text-white transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Bulk Generate Arms
          </button>
          <button
            type="button"
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Class &amp; Arm
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">
            Configured Class Levels
          </p>
          <p className="font-mono-tabular text-2xl font-bold text-[#123B72] mt-1">
            {distinctClassCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">
            Total Class &amp; Arm Streams
          </p>
          <p className="font-mono-tabular text-2xl font-bold text-[#1769AA] mt-1">
            {classArms.length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">
            Active Streams for CBT
          </p>
          <p className="font-mono-tabular text-2xl font-bold text-emerald-700 mt-1">
            {activeCount}
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
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {err}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#123B72] mr-1">
          <Layers className="w-4 h-4 text-[#1769AA]" />
          <span>Filter:</span>
        </div>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
        >
          <option value="">All Class Levels</option>
          {availableClasses.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>

        <select
          value={filterSchoolId}
          onChange={(e) => setFilterSchoolId(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
        >
          <option value="">All Schools &amp; Global</option>
          <option value="global">Global (All Schools)</option>
          {schools.map((sc) => (
            <option key={sc.id} value={sc.id}>
              {sc.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">
            Loading classes and arms...
          </p>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-600">
              No class and arm records match the current filter.
            </p>
            <button
              type="button"
              onClick={() => openModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#123B72] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              Add Class &amp; Arm
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F5F8FC] text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Class Level</th>
                  <th className="px-4 py-3 font-semibold">Arm</th>
                  <th className="px-4 py-3 font-semibold">Display Label</th>
                  <th className="px-4 py-3 font-semibold">School Scope</th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Enrolled Students
                  </th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono-tabular font-bold text-[#123B72]">
                      {item.classLevel}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#1769AA]">
                      {item.armName}
                    </td>
                    <td className="px-4 py-3 text-[#1E293B] font-medium">
                      {item.displayName}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {item.schoolId ? (
                        <SchoolNameBadge
                          name={item.schoolName}
                          logoUrl={item.schoolLogoUrl}
                          size="xs"
                          nameClassName="text-xs font-medium text-slate-700"
                        />
                      ) : (
                        item.schoolName
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-semibold text-[#123B72]">
                      {item.studentCount}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleActive(item)}
                        className={`text-xs font-semibold ${
                          item.isActive ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {item.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openModal(item)}
                          className="p-1.5 rounded text-[#1769AA] hover:bg-slate-100"
                          title="Edit class & arm"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteItem(item)}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50"
                          title="Delete class & arm"
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

      {/* Add / Edit Single Class & Arm Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#123B72]">
                {editingItem ? 'Edit Class & Arm' : 'Add Class & Arm'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  School Assignment
                </label>
                <select
                  value={form.schoolId}
                  onChange={(e) =>
                    setForm({ ...form, schoolId: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  <option value="">All Registered Schools (Global)</option>
                  {schools.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Class Level *
                  </label>
                  <input
                    type="text"
                    required
                    list="nigerian-classes-list"
                    value={form.classLevel}
                    onChange={(e) =>
                      setForm({ ...form, classLevel: e.target.value })
                    }
                    placeholder="e.g. SS2, QUIZ-SENIOR, STAGE-1"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm uppercase"
                  />
                  <datalist id="nigerian-classes-list">
                    {[
                      ...STANDARD_CLASSES,
                      'QUIZ-JUNIOR',
                      'QUIZ-SENIOR',
                      'STAGE-1',
                      'SEMI-FINAL',
                      'FINAL',
                    ].map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Arm / Group Name *
                  </label>
                  <input
                    type="text"
                    required
                    list="nigerian-arms-list"
                    value={form.armName}
                    onChange={(e) =>
                      setForm({ ...form, armName: e.target.value })
                    }
                    placeholder="e.g. A, Class 1, Group A, Batch 1"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                  <datalist id="nigerian-arms-list">
                    {[
                      'A',
                      'B',
                      'C',
                      'D',
                      'E',
                      'F',
                      'G',
                      'H',
                      'I',
                      'J',
                      'Class 1',
                      'Class 2',
                      'Class 3',
                      'Class 4',
                      'Class 5',
                      'Class 6',
                      'Art',
                    ].map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-[#1E293B]">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="accent-[#123B72]"
                />
                Active for Student Registration &amp; CBT Assignment
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#123B72] text-white text-sm font-semibold hover:bg-[#1769AA]"
                >
                  Save Class &amp; Arm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Generator Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#123B72]">
                Bulk Generate Classes &amp; Arms
              </h3>
              <button type="button" onClick={() => setShowBulkModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleBulkGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  School / Agency Scope
                </label>
                <select
                  value={bulkSchoolId}
                  onChange={(e) => setBulkSchoolId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  <option value="">All Registered Schools (Global)</option>
                  {schools.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name} ({sc.code})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Select a specific organization or quiz agency to keep its
                  custom classes separate from secondary schools.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Standard Class Levels (Optional)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {STANDARD_CLASSES.map((cls) => {
                    const checked = bulkClasses.includes(cls);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => toggleBulkClass(cls)}
                        className={`px-3 py-2 rounded-lg border text-xs font-mono-tabular font-bold transition-colors ${
                          checked
                            ? 'bg-[#123B72] border-[#123B72] text-white'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {cls}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Custom Class / Category / Competition Stage Names (comma-separated)
                </label>
                <input
                  type="text"
                  value={customBulkClassesInput}
                  onChange={(e) => setCustomBulkClassesInput(e.target.value)}
                  placeholder="e.g. QUIZ-JUNIOR, QUIZ-SENIOR, ROUND-1, FINAL"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Arms / Groups / Batches (comma-separated) *
                </label>
                <input
                  type="text"
                  required
                  value={bulkArmsInput}
                  onChange={(e) => setBulkArmsInput(e.target.value)}
                  placeholder="e.g. A, B, C or Group A, Group B, Batch 1"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkClasses(['JSS1', 'JSS2', 'JSS3']);
                      setCustomBulkClassesInput('');
                      setBulkArmsInput('A, B, C, D, E, F, G, H, I, J');
                    }}
                    className="text-xs font-semibold text-[#1769AA] hover:underline"
                  >
                    Preset: JSS1–JSS3 (A–J)
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkClasses(['SS1', 'SS2', 'SS3']);
                      setCustomBulkClassesInput('');
                      setBulkArmsInput(
                        'Class 1, Class 2, Class 3, Class 4, Class 5, Class 6, Art'
                      );
                    }}
                    className="text-xs font-semibold text-[#E83E8C] hover:underline"
                  >
                    Preset: SS1–SS3 (Class 1–6, Art)
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkClasses([]);
                      setCustomBulkClassesInput(
                        'QUIZ-PRELIM, QUIZ-SEMI, QUIZ-FINAL'
                      );
                      setBulkArmsInput('Group A, Group B, Group C, Group D');
                    }}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Preset: Quiz Competition Stages
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c]"
                >
                  Generate Classes &amp; Arms
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
