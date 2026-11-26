import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  Shield,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface EnquiryRow {
  id: number;
  fullName: string;
  organizationName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  isRead: boolean;
  status: string;
  adminNotes: string;
  createdAt: string;
}

interface SessionRow {
  id: number;
  authMethod: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

interface ActivityRow {
  id: number;
  adminLabel: string;
  action: string;
  targetType: string;
  targetDetails: string;
  createdAt: string;
}

export function AdminEnquiriesSecuritySection({
  token,
  mode,
  onLogout,
}: {
  token: string;
  mode: 'enquiries' | 'security';
  onLogout: () => void;
}) {
  const { admin, updateAdminUser } = useAuth();

  // Enquiries state
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [selectedEnquiry, setSelectedEnquiry] = useState<EnquiryRow | null>(
    null
  );
  const [notesInput, setNotesInput] = useState('');

  // Profile & Security state
  const [profileForm, setProfileForm] = useState({
    fullName: admin?.fullName ?? '',
    username: admin?.username ?? '',
    email: admin?.email ?? '',
  });
  const [pwdForm, setPwdForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [logs, setLogs] = useState<ActivityRow[]>([]);

  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const loadEnquiries = useCallback(async () => {
    const res = await fetch('/api/admin/enquiries', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setEnquiries(json.enquiries || []);
    }
  }, [token]);

  const isSuperAdmin = admin?.role === 'super_admin';

  const loadSecurityData = useCallback(async () => {
    const sesRes = await fetch('/api/admin/sessions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (sesRes.ok) {
      const d = await sesRes.json();
      setSessions(d.sessions || []);
      setCurrentSessionId(d.currentSessionId ?? null);
    }

    if (isSuperAdmin) {
      const logRes = await fetch('/api/admin/activity-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (logRes.ok) {
        const d = await logRes.json();
        setLogs(d.logs || []);
      }
    }
  }, [token, isSuperAdmin]);

  useEffect(() => {
    if (mode === 'enquiries') loadEnquiries();
    else loadSecurityData();
  }, [mode, loadEnquiries, loadSecurityData]);

  useEffect(() => {
    if (admin) {
      setProfileForm({
        fullName: admin.fullName,
        username: admin.username,
        email: admin.email,
      });
    }
  }, [admin]);

  const openEnquiry = async (enq: EnquiryRow) => {
    setSelectedEnquiry(enq);
    setNotesInput(enq.adminNotes || '');
    if (!enq.isRead) {
      await fetch(`/api/admin/enquiries/${enq.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isRead: true, status: 'read' }),
      });
      loadEnquiries();
    }
  };

  const updateEnquiryStatus = async (
    enqId: number,
    status: string,
    notes: string
  ) => {
    await fetch(`/api/admin/enquiries/${enqId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isRead: true, status, adminNotes: notes }),
    });
    setMsg('Enquiry status updated.');
    setSelectedEnquiry(null);
    loadEnquiries();
  };

  const deleteEnquiry = async (id: number) => {
    await fetch(`/api/admin/enquiries/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (selectedEnquiry?.id === id) setSelectedEnquiry(null);
    setMsg('Enquiry deleted.');
    loadEnquiries();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    const res = await fetch('/api/admin/profile', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileForm),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error || 'Unable to update profile.');
      return;
    }
    updateAdminUser(json.admin);
    setMsg('Administrator profile updated.');
    loadSecurityData();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    if (pwdForm.newPassword.length < 8) {
      setErr('New password must be at least 8 characters long.');
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setErr('Password confirmation does not match.');
      return;
    }
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error || 'Unable to change password.');
      return;
    }
    setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setMsg('Password updated successfully.');
    loadSecurityData();
  };

  const revokeSession = async (sessionId: number) => {
    await fetch(`/api/admin/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (sessionId === currentSessionId) {
      onLogout();
    } else {
      loadSecurityData();
    }
  };

  if (mode === 'enquiries') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#123B72]">
            Contact Enquiries
          </h2>
          <p className="text-sm text-slate-600">
            Review messages submitted by schools and parents, mark enquiries as
            read or responded, and follow up directly.
          </p>
        </div>

        {msg && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{msg}</span>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {enquiries.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No contact enquiries received yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-200">
              {enquiries.map((enq) => (
                <div
                  key={enq.id}
                  className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 ${
                    !enq.isRead ? 'bg-[#1769AA]/[0.03]' : ''
                  }`}
                >
                  <div
                    className="space-y-1 cursor-pointer flex-1"
                    onClick={() => openEnquiry(enq)}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`font-semibold ${
                          enq.isRead ? 'text-slate-500' : 'text-[#E83E8C]'
                        }`}
                      >
                        {enq.isRead ? enq.status.toUpperCase() : 'UNREAD'}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-semibold text-[#123B72]">
                        {enq.fullName}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-600">
                        {enq.organizationName}
                      </span>
                    </div>
                    <p className="font-semibold text-sm text-[#1E293B]">
                      {enq.subject}
                    </p>
                    <p className="text-xs text-slate-600 line-clamp-1">
                      {enq.message}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEnquiry(enq)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#123B72] hover:bg-white"
                    >
                      Read Details
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteEnquiry(enq.id)}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                      title="Delete enquiry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Read & Respond Enquiry Modal */}
        {selectedEnquiry && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#1769AA] uppercase">
                    {selectedEnquiry.organizationName}
                  </p>
                  <h3 className="font-display text-lg font-bold text-[#123B72]">
                    {selectedEnquiry.subject}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEnquiry(null)}
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="bg-[#F5F8FC] border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                <p>
                  <strong>From:</strong> {selectedEnquiry.fullName}
                </p>
                <div className="flex flex-wrap gap-4 pt-1">
                  <a
                    href={`mailto:${selectedEnquiry.email}?subject=${encodeURIComponent(
                      `Re: ${selectedEnquiry.subject}`
                    )}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#1769AA] hover:underline"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {selectedEnquiry.email}
                  </a>
                  <a
                    href={`tel:${selectedEnquiry.phone}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#123B72] hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {selectedEnquiry.phone}
                  </a>
                </div>
              </div>

              <div className="p-4 border border-slate-200 rounded-xl text-sm text-[#1E293B] whitespace-pre-line leading-relaxed">
                {selectedEnquiry.message}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Internal Admin Notes
                </label>
                <textarea
                  rows={2}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Record follow-up notes..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div className="flex flex-wrap justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => deleteEnquiry(selectedEnquiry.id)}
                  className="px-4 py-2 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50"
                >
                  Delete Enquiry
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateEnquiryStatus(
                        selectedEnquiry.id,
                        'read',
                        notesInput
                      )
                    }
                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                  >
                    Save as Read
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateEnquiryStatus(
                        selectedEnquiry.id,
                        'responded',
                        notesInput
                      )
                    }
                    className="px-4 py-2 rounded-lg bg-[#123B72] text-white text-xs font-semibold"
                  >
                    Mark Responded
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // PROFILE & SECURITY VIEW
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#123B72]">
            Admin Profile & Security
          </h2>
          <p className="text-sm text-slate-600">
            Manage administrator account details, update password, control
            active sessions, and review activity logs.
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Form */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h3 className="font-display text-base font-bold text-[#123B72] flex items-center gap-2">
            <User className="w-4 h-4 text-[#1769AA]" />
            Administrator Profile
          </h3>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={profileForm.fullName}
              onChange={(e) =>
                setProfileForm({ ...profileForm, fullName: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Username
            </label>
            <input
              type="text"
              required
              value={profileForm.username}
              onChange={(e) =>
                setProfileForm({ ...profileForm, username: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={profileForm.email}
              onChange={(e) =>
                setProfileForm({ ...profileForm, email: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-[#123B72] text-white text-sm font-semibold hover:bg-[#1769AA]"
          >
            Update Profile
          </button>
        </form>

        {/* Change Password Form */}
        <form
          onSubmit={handleChangePassword}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h3 className="font-display text-base font-bold text-[#123B72] flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#E83E8C]" />
            Change Password
          </h3>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={pwdForm.currentPassword}
              onChange={(e) =>
                setPwdForm({ ...pwdForm, currentPassword: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              New Password (min 8 characters)
            </label>
            <input
              type="password"
              required
              value={pwdForm.newPassword}
              onChange={(e) =>
                setPwdForm({ ...pwdForm, newPassword: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={pwdForm.confirmPassword}
              onChange={(e) =>
                setPwdForm({ ...pwdForm, confirmPassword: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c]"
          >
            Change Password
          </button>
        </form>
      </div>

      {/* Session Management */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#1769AA]" />
          <h3 className="font-display text-base font-bold text-[#123B72]">
            Session Management
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#F5F8FC] text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sessions.map((s) => {
                const isCurrent = s.id === currentSessionId;
                const isRevoked = Boolean(s.revokedAt);
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3 capitalize font-medium">
                      {s.authMethod} {isCurrent ? '(Current)' : ''}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-xs">
                      {s.ipAddress}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-xs text-slate-500">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {isRevoked ? (
                        <span className="text-slate-400">Revoked</span>
                      ) : (
                        <span className="text-emerald-700">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isRevoked && (
                        <button
                          type="button"
                          onClick={() => revokeSession(s.id)}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Administrative Activity Logs (Super Admin Only) */}
      {isSuperAdmin && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-display text-base font-bold text-[#123B72]">
              Administrative Activity Logs
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#F5F8FC] text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 font-medium text-[#123B72]">
                      {log.adminLabel}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-xs text-[#1769AA]">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.targetDetails}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular text-xs text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
