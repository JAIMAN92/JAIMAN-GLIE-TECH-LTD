import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  KeyRound,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { BrandLogo } from '../components/BrandLogo.tsx';

async function safeParseJson(res: Response): Promise<Record<string, any>> {
  const raw = await res.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    return {
      error: `Server returned status ${res.status}. Ensure the backend API and database environment variables are configured.`,
    };
  }
}

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { adminToken, admin, setAdminSession, updateAdminUser } = useAuth();

  const [checkingStatus, setCheckingStatus] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  // Standard login state
  const [identifier, setIdentifier] = useState('admin');
  const [password, setPassword] = useState('');

  // First-run bootstrap state (only rendered when no admin exists and no env passcode is configured)
  const [bootUsername, setBootUsername] = useState('admin');
  const [bootFullName, setBootFullName] = useState('System Administrator');
  const [bootEmail, setBootEmail] = useState('');
  const [bootPassword, setBootPassword] = useState('');

  // Mandatory password change state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (adminToken && admin && !admin.mustChangePassword) {
      navigate('/admin', { replace: true });
      return;
    }

    fetch('/api/admin/auth-status')
      .then((res) => safeParseJson(res))
      .then((data) => {
        setNeedsBootstrap(Boolean(data.needsBootstrap));
      })
      .catch(() => {})
      .finally(() => setCheckingStatus(false));
  }, [adminToken, admin, navigate]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });
      const data = await safeParseJson(res);
      if (!res.ok) {
        setError(data.error || `Authentication failed (${res.status}).`);
      } else {
        setAdminSession(data.token, data.admin);
        if (!data.admin.mustChangePassword) {
          navigate('/admin', { replace: true });
        } else {
          setCurrentPwd(password);
        }
        setPassword('');
      }
    } catch {
      setError('Unable to reach the authentication server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (bootPassword.length < 8) {
      setError('Administrator password must be at least 8 characters long.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: bootUsername.trim(),
          fullName: bootFullName.trim(),
          email: bootEmail.trim(),
          password: bootPassword,
        }),
      });
      const data = await safeParseJson(res);
      if (!res.ok) {
        setError(
          data.error || `Unable to set up administrator account (${res.status}).`
        );
      } else {
        setAdminSession(data.token, data.admin);
        navigate('/admin', { replace: true });
      }
    } catch {
      setError('Unable to reach the server during administrator setup.');
    } finally {
      setLoading(false);
    }
  };

  const handleForcedPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPwd.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: currentPwd,
          newPassword: newPwd,
        }),
      });
      const data = await safeParseJson(res);
      if (!res.ok) {
        setError(data.error || `Unable to update password (${res.status}).`);
      } else {
        updateAdminUser(data.admin);
        navigate('/admin', { replace: true });
      }
    } catch {
      setError('Unable to reach the server while updating password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F8FC] flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="focus:outline-none">
          <BrandLogo compact />
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1769AA] hover:text-[#123B72]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Website
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          {checkingStatus ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Checking administrator security status...
            </div>
          ) : adminToken && admin?.mustChangePassword ? (
            /* Forced Password Change After First Login */
            <div className="space-y-5">
              <div className="space-y-2 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#E83E8C]/10 text-[#E83E8C] flex items-center justify-center mx-auto">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h1 className="font-display text-xl font-bold text-[#123B72]">
                  Password Update Required
                </h1>
                <p className="text-sm text-slate-600">
                  For security, you must change the initial administrator
                  password before accessing the Admin Dashboard.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleForcedPasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#1E293B] mb-1">
                    New Password (min 8 characters)
                  </label>
                  <input
                    type="password"
                    required
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1769AA]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1E293B] mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1769AA]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-[#123B72] text-white font-semibold text-sm hover:bg-[#1769AA] disabled:opacity-60 transition-colors"
                >
                  {loading ? 'UPDATING...' : 'UPDATE PASSWORD & CONTINUE'}
                </button>
              </form>
            </div>
          ) : needsBootstrap ? (
            /* Initial First-Run Administrator Claim Form */
            <div className="space-y-5">
              <div className="space-y-2 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#123B72] text-[#D4AF37] flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h1 className="font-display text-xl font-bold text-[#123B72]">
                  Initial Administrator Setup
                </h1>
                <p className="text-sm text-slate-600">
                  No administrator credential has been configured yet. Create
                  your primary administrator account to secure the dashboard.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleBootstrap} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#1E293B] mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={bootFullName}
                    onChange={(e) => setBootFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1E293B] mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={bootUsername}
                    onChange={(e) => setBootUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1E293B] mb-1">
                    Administrator Email
                  </label>
                  <input
                    type="email"
                    required
                    value={bootEmail}
                    onChange={(e) => setBootEmail(e.target.value)}
                    placeholder="admin@schooltech.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1E293B] mb-1">
                    Create Administrator Password (min 8 characters)
                  </label>
                  <input
                    type="password"
                    required
                    value={bootPassword}
                    onChange={(e) => setBootPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-[#E83E8C] text-white font-semibold text-sm hover:bg-[#d1327c] disabled:opacity-60 transition-colors"
                >
                  {loading ? 'SETTING UP...' : 'CREATE ADMINISTRATOR ACCOUNT'}
                </button>
              </form>
            </div>
          ) : (
            /* Standard Administrator Login */
            <div className="space-y-5">
              <div className="space-y-2 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#123B72] text-[#D4AF37] flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <h1 className="font-display text-2xl font-bold text-[#123B72]">
                  Administrator Sign In
                </h1>
                <p className="text-sm text-slate-600">
                  Authorized access for JAIMAN GOLDENLITE TECH LTD website and
                  CBT management.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <label
                    htmlFor="adminIdentifier"
                    className="block text-sm font-medium text-[#1E293B] mb-1.5"
                  >
                    Username or Email
                  </label>
                  <input
                    id="adminIdentifier"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1769AA]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="adminPassword"
                    className="block text-sm font-medium text-[#1E293B] mb-1.5"
                  >
                    Password
                  </label>
                  <input
                    id="adminPassword"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter administrator password"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1769AA]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-[#123B72] text-white font-semibold text-sm tracking-wide hover:bg-[#1769AA] disabled:opacity-60 transition-colors"
                >
                  {loading ? 'SIGNING IN...' : 'SIGN IN TO DASHBOARD'}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
