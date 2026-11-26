import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import type { AdminRole } from '../../shared/types.ts';

interface AdminAccountRow {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export function AdminAccountsSection({ token }: { token: string }) {
  const { admin: currentAdmin } = useAuth();
  const [accounts, setAccounts] = useState<AdminAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    role: 'data_entry' as AdminRole,
    mustChangePassword: true,
  });

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/admins', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || 'Unable to load administrator accounts.');
        return;
      }
      setAccounts(json.admins || []);
    } catch {
      setErr('Network error while loading administrator accounts.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const resetForm = () => {
    setForm({
      fullName: '',
      username: '',
      email: '',
      password: '',
      role: 'data_entry',
      mustChangePassword: true,
    });
    setShowPassword(false);
  };

  const handleRegisterAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');

    if (form.password.length < 8) {
      setErr('Password must be at least 8 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          username: form.username.trim().toLowerCase(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          mustChangePassword: form.mustChangePassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || 'Unable to register administrator.');
        return;
      }

      setShowRegisterModal(false);
      resetForm();
      setMsg(
        `Registered ${json.admin.fullName} (@${json.admin.username}) as ${
          json.admin.role === 'data_entry'
            ? 'Students & Questions Operator'
            : 'Full Administrator'
        }.`
      );
      loadAccounts();
    } catch {
      setErr('Unable to register administrator right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (row: AdminAccountRow) => {
    setErr('');
    setMsg('');
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/admins/${row.id}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || 'Unable to update administrator status.');
        return;
      }
      setMsg(
        `${json.admin.fullName} is now ${
          json.admin.isActive ? 'active' : 'deactivated'
        }.`
      );
      loadAccounts();
    } catch {
      setErr('Network error while updating account status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSwitchRole = async (row: AdminAccountRow) => {
    setErr('');
    setMsg('');
    const nextRole: AdminRole =
      row.role === 'data_entry' ? 'super_admin' : 'data_entry';
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/admins/${row.id}/role`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: nextRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || 'Unable to update administrator role.');
        return;
      }
      setMsg(
        `Updated ${json.admin.fullName} to ${
          nextRole === 'data_entry'
            ? 'Students & Questions Only'
            : 'Full Administrator'
        }.`
      );
      loadAccounts();
    } catch {
      setErr('Network error while updating administrator role.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    setErr('');
    setMsg('');
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/admins/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || 'Unable to delete administrator account.');
        return;
      }
      setConfirmDeleteId(null);
      setMsg('Administrator account removed.');
      loadAccounts();
    } catch {
      setErr('Network error while deleting administrator account.');
    } finally {
      setBusyId(null);
    }
  };

  const totalCount = accounts.length;
  const activeCount = accounts.filter((a) => a.isActive).length;
  const dataEntryCount = accounts.filter((a) => a.role === 'data_entry').length;
  const superAdminCount = accounts.filter((a) => a.role === 'super_admin').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#123B72]">
            Administrator Accounts &amp; Roles
          </h2>
          <p className="text-sm text-slate-600">
            Register additional administrators with focused Student &amp; Q&amp;A
            loading permissions or full platform management access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setErr('');
            setMsg('');
            resetForm();
            setShowRegisterModal(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c]"
        >
          <UserPlus className="w-4 h-4" />
          Register Administrator
        </button>
      </div>

      {/* Role Scope Notice */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-[#F5F8FC] border border-slate-200 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#1769AA]">
            <UserCheck className="w-4 h-4" />
            Students &amp; Questions Only (Data Entry)
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Can register, import, and manage students and load/edit/bulk-upload
            questions and answers into existing subjects. Restricted from schools,
            classes, examinations, results, website content, enquiries, database
            tools, and administrator accounts.
          </p>
        </div>
        <div className="p-4 rounded-lg bg-[#F5F8FC] border border-slate-200 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#123B72]">
            <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
            Full Administrator (Super Admin)
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Full access across website management, schools, classes, students,
            subject creation, examination scheduling, results export, enquiries,
            database sync, and administrator registration.
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium">Total Accounts</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#123B72] mt-1">
            {totalCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium">Active Accounts</p>
          <p className="font-mono-tabular text-2xl font-bold text-emerald-700 mt-1">
            {activeCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium">
            Students &amp; Q&amp;A Only
          </p>
          <p className="font-mono-tabular text-2xl font-bold text-[#1769AA] mt-1">
            {dataEntryCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium">
            Full Administrators
          </p>
          <p className="font-mono-tabular text-2xl font-bold text-[#123B72] mt-1">
            {superAdminCount}
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
          className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {/* Directory Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-[#123B72] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1769AA]" />
            Registered Administrators
          </h3>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Loading administrator accounts...
          </p>
        ) : accounts.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No administrator accounts found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#F5F8FC] text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Administrator</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Role &amp; Access</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {accounts.map((row) => {
                  const isSelf = currentAdmin?.id === row.id;
                  const isBusy = busyId === row.id;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#123B72]">
                          {row.fullName}{' '}
                          {isSelf && (
                            <span className="text-xs font-medium text-[#1769AA]">
                              (You)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">{row.email}</p>
                      </td>
                      <td className="px-4 py-3 font-mono-tabular text-xs font-medium text-slate-700">
                        @{row.username}
                      </td>
                      <td className="px-4 py-3">
                        <p
                          className={`text-xs font-semibold ${
                            row.role === 'super_admin'
                              ? 'text-[#123B72]'
                              : 'text-[#1769AA]'
                          }`}
                        >
                          {row.role === 'super_admin'
                            ? 'Full Administrator'
                            : 'Students & Questions Only'}
                        </p>
                        {row.mustChangePassword && (
                          <p className="text-[11px] text-amber-700">
                            Password update pending
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold ${
                            row.isActive ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {row.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono-tabular text-xs text-slate-500">
                        {new Date(row.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isSelf ? (
                          <span className="text-xs text-slate-400">
                            Current Session
                          </span>
                        ) : confirmDeleteId === row.id ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="text-xs text-red-700 font-medium">
                              Delete?
                            </span>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDeleteAccount(row.id)}
                              className="px-2.5 py-1 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 rounded border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleSwitchRole(row)}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-semibold text-[#123B72] hover:bg-slate-50 disabled:opacity-50"
                            >
                              {row.role === 'data_entry'
                                ? 'Promote to Full'
                                : 'Restrict to Q&A/Students'}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleToggleActive(row)}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-semibold disabled:opacity-50 ${
                                row.isActive
                                  ? 'border-amber-200 text-amber-800 hover:bg-amber-50'
                                  : 'border-emerald-200 text-emerald-800 hover:bg-emerald-50'
                              }`}
                            >
                              {row.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteId(row.id)}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Remove administrator"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Administrator Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3.5">
              <div>
                <h3 className="font-display text-lg font-bold text-[#123B72] flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#E83E8C]" />
                  Register New Administrator
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create login credentials and assign dashboard access permissions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                  placeholder="e.g. Chinedu Okafor"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={form.username}
                    onChange={(e) =>
                      setForm({ ...form, username: e.target.value })
                    }
                    placeholder="e.g. operator.cbt"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="operator@school.edu.ng"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Initial Password (min 8 characters) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    placeholder="Create strong initial password"
                    className="w-full pl-9 pr-10 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Administrator Role *
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.role === 'data_entry'
                        ? 'border-[#1769AA] bg-[#1769AA]/5'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="adminRole"
                      value="data_entry"
                      checked={form.role === 'data_entry'}
                      onChange={() => setForm({ ...form, role: 'data_entry' })}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold text-[#123B72]">
                        Students &amp; Questions Only (Recommended for Operators)
                      </p>
                      <p className="text-xs text-slate-600">
                        Can register/import students and add or bulk-upload
                        exam questions and answers only.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.role === 'super_admin'
                        ? 'border-[#123B72] bg-[#123B72]/5'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="adminRole"
                      value="super_admin"
                      checked={form.role === 'super_admin'}
                      onChange={() => setForm({ ...form, role: 'super_admin' })}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold text-[#123B72]">
                        Full Administrator
                      </p>
                      <p className="text-xs text-slate-600">
                        Unrestricted access to schools, classes, exams, results,
                        website content, database sync, and admin accounts.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={form.mustChangePassword}
                  onChange={(e) =>
                    setForm({ ...form, mustChangePassword: e.target.checked })
                  }
                />
                Require password change on first sign-in
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c] disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Register Administrator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
