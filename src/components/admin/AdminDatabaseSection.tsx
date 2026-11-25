import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  ExternalLink,
  RefreshCw,
  Server,
  ShieldCheck,
} from 'lucide-react';

interface DatabaseStatusPayload {
  activeDriver:
    | 'supabase_postgres'
    | 'postgres_url'
    | 'cloud_sql'
    | 'unconfigured';
  postgresConnected: boolean;
  supabaseSdkConfigured: boolean;
  supabaseProjectHost: string | null;
  supabaseRestReachable: boolean;
  supabaseTablesReady: boolean;
  supabaseError: string | null;
  counts: {
    admins: number;
    schools: number;
    classArms: number;
    students: number;
    subjects: number;
    questions: number;
    examinations: number;
    enquiries: number;
  };
  envChecklist: {
    hasDatabaseUrl: boolean;
    hasSupabaseUrl: boolean;
    hasSupabaseServiceRoleKey: boolean;
    hasAdminInitialPassword: boolean;
    hasEmailSmtp: boolean;
    hasEmailResend: boolean;
  };
}

const SUPABASE_SCHEMA_SQL = `-- JAIMAN GOLDENLITE TECH LTD — Supabase PostgreSQL Schema
-- Paste into Supabase Dashboard -> SQL Editor -> New Query -> Run

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  auth_method TEXT NOT NULL DEFAULT 'password',
  ip_address TEXT NOT NULL DEFAULT 'unknown',
  user_agent TEXT NOT NULL DEFAULT 'unknown',
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP,
  last_attempt_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  admin_label TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_details TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
  id SERIAL PRIMARY KEY,
  section_key TEXT NOT NULL UNIQUE,
  content JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_page TEXT NOT NULL DEFAULT 'all',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  lga TEXT NOT NULL DEFAULT '',
  contact_person TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  access_code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_arms (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  class_level TEXT NOT NULL,
  arm_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  class_level TEXT NOT NULL,
  arm TEXT NOT NULL DEFAULT '',
  passcode_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_sessions (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic TEXT NOT NULL DEFAULT 'General',
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL,
  marks INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS examinations (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  class_level TEXT NOT NULL DEFAULT 'ALL',
  arm TEXT NOT NULL DEFAULT 'ALL',
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  exam_date TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT '08:00',
  end_time TEXT NOT NULL DEFAULT '18:00',
  instructions TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  results_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_questions (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS exam_questions_exam_question_idx
  ON exam_questions(exam_id, question_id);

CREATE TABLE IF NOT EXISTS exam_assignments (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  class_level TEXT,
  arm TEXT,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  submitted_at TIMESTAMP,
  score INTEGER NOT NULL DEFAULT 0,
  total_marks INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  percentage INTEGER NOT NULL DEFAULT 0,
  security_violations INTEGER NOT NULL DEFAULT 0,
  submission_reason TEXT NOT NULL DEFAULT 'manual'
);
CREATE UNIQUE INDEX IF NOT EXISTS exam_attempts_exam_student_idx
  ON exam_attempts(exam_id, student_id);

CREATE TABLE IF NOT EXISTS student_answers (
  id SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS student_answers_attempt_question_idx
  ON student_answers(attempt_id, question_id);

CREATE TABLE IF NOT EXISTS contact_enquiries (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'new',
  admin_notes TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`;

export function AdminDatabaseSection({ token }: { token: string }) {
  const [status, setStatus] = useState<DatabaseStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/database-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Unable to inspect database status.');
      }
      setStatus(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load database status.'
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSyncDefaults = async () => {
    setSyncing(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/database-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Database synchronization failed.');
      }
      setMessage(json.message || 'Default data synced successfully.');
      await loadStatus();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to sync default data.'
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadSql = () => {
    const blob = new Blob([SUPABASE_SCHEMA_SQL], {
      type: 'application/sql;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'jaiman_supabase_schema.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      handleDownloadSql();
    }
  };

  const driverLabel =
    status?.activeDriver === 'supabase_postgres'
      ? 'Supabase PostgreSQL (Primary)'
      : status?.activeDriver === 'postgres_url'
        ? 'PostgreSQL via DATABASE_URL'
        : status?.activeDriver === 'cloud_sql'
          ? 'Cloud SQL PostgreSQL'
          : 'Not Configured';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#123B72]">
            Database &amp; Supabase
          </h2>
          <p className="text-sm text-slate-600">
            Monitor live PostgreSQL &amp; Supabase connectivity, sync initial
            CBT data, and prepare hosting environment variables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={loadStatus}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-[#123B72] hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            Test Connection
          </button>
          <button
            type="button"
            onClick={handleSyncDefaults}
            disabled={syncing || !status?.postgresConnected}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#123B72] text-xs font-semibold text-white hover:bg-[#1769AA] disabled:opacity-50"
          >
            <Database className="w-3.5 h-3.5" />
            {syncing ? 'Syncing...' : 'Sync Default Data'}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start gap-2.5"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-700" />
          <span>{message}</span>
        </div>
      )}

      {/* Status Summary Cards */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Database Engine
              </span>
              <Server className="w-4 h-4 text-[#1769AA]" />
            </div>
            <p className="font-display text-base font-bold text-[#123B72]">
              {driverLabel}
            </p>
            <p className="text-xs font-semibold flex items-center gap-1.5">
              {status.postgresConnected ? (
                <span className="text-emerald-700 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  PostgreSQL Connected
                </span>
              ) : (
                <span className="text-red-700 inline-flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Database Offline
                </span>
              )}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Supabase REST Client
              </span>
              <Database className="w-4 h-4 text-[#20C4D8]" />
            </div>
            <p className="font-display text-base font-bold text-[#123B72]">
              {status.supabaseSdkConfigured
                ? status.supabaseRestReachable
                  ? 'Connected'
                  : 'Credentials Configured'
                : 'Not Configured'}
            </p>
            <p className="text-xs text-slate-600 truncate">
              {status.supabaseProjectHost ||
                'Add SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY in Secrets'}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Supabase Schema Status
              </span>
              <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <p className="font-display text-base font-bold text-[#123B72]">
              {status.supabaseTablesReady
                ? 'Tables Ready'
                : status.supabaseSdkConfigured
                  ? 'Run SQL Script Needed'
                  : 'Using Primary Postgres'}
            </p>
            <p className="text-xs text-slate-600">
              {status.supabaseError && !status.supabaseTablesReady
                ? status.supabaseError
                : 'All 19 CBT & CMS tables supported'}
            </p>
          </div>
        </div>
      )}

      {/* Database Record Counts */}
      {status && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-base font-bold text-[#123B72]">
            Active Database Record Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: 'Admins', value: status.counts.admins },
              { label: 'Schools', value: status.counts.schools },
              { label: 'Class Arms', value: status.counts.classArms },
              { label: 'Students', value: status.counts.students },
              { label: 'Subjects', value: status.counts.subjects },
              { label: 'Questions', value: status.counts.questions },
              { label: 'Exams', value: status.counts.examinations },
              { label: 'Enquiries', value: status.counts.enquiries },
            ].map((item) => (
              <div
                key={item.label}
                className="p-3 rounded-lg bg-[#F5F8FC] border border-slate-200"
              >
                <p className="text-[11px] font-medium text-slate-500">
                  {item.label}
                </p>
                <p className="font-mono-tabular text-xl font-bold text-[#123B72] mt-1">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Environment Variables Checklist & Guided Setup */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="font-display text-base font-bold text-[#123B72]">
              Server Environment Checklist
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              For security, secret values are managed strictly in Vercel
              Environment Variables or AI Studio Secrets (never entered in
              browser forms).
            </p>
          </div>

          {status && (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden text-sm">
              {[
                {
                  name: 'DATABASE_URL',
                  desc: 'Supabase PostgreSQL Pooler URI (required on Vercel)',
                  ok: status.envChecklist.hasDatabaseUrl,
                },
                {
                  name: 'SUPABASE_URL',
                  desc: 'Supabase Project URL (optional REST sync)',
                  ok: status.envChecklist.hasSupabaseUrl,
                },
                {
                  name: 'SUPABASE_SERVICE_ROLE_KEY',
                  desc: 'Server-side Supabase Service Role Key',
                  ok: status.envChecklist.hasSupabaseServiceRoleKey,
                },
                {
                  name: 'ADMIN_INITIAL_PASSWORD',
                  desc: 'Initial Admin Dashboard login password',
                  ok: status.envChecklist.hasAdminInitialPassword,
                },
                {
                  name: 'SMTP_USER / RESEND_API_KEY',
                  desc: 'Optional email forwarding for contact enquiries',
                  ok:
                    status.envChecklist.hasEmailSmtp ||
                    status.envChecklist.hasEmailResend,
                },
              ].map((row) => (
                <div
                  key={row.name}
                  className="px-4 py-3 flex items-center justify-between gap-3 bg-white"
                >
                  <div className="min-w-0">
                    <p className="font-mono-tabular text-xs font-bold text-[#123B72]">
                      {row.name}
                    </p>
                    <p className="text-xs text-slate-500">{row.desc}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold shrink-0 ${
                      row.ok ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {row.ok ? 'Configured' : 'Not Set'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step-by-Step Supabase & Vercel Connection Guide */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-[#123B72]">
                How to Connect Supabase &amp; Vercel
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Follow these 4 steps to link your Supabase database for Vercel
                and AI Studio deployments.
              </p>
            </div>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1769AA] hover:underline shrink-0"
            >
              Supabase
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <ol className="space-y-3 text-xs text-slate-700 leading-relaxed list-decimal list-inside">
            <li>
              <span className="font-semibold text-[#123B72]">
                Create Tables in Supabase:
              </span>{' '}
              Download or copy the SQL script below, open{' '}
              <strong>Supabase Dashboard &rarr; SQL Editor &rarr; New Query</strong>
              , paste, and click <strong>Run</strong>.
            </li>
            <li>
              <span className="font-semibold text-[#123B72]">
                Copy your Supabase <code>DATABASE_URL</code>:
              </span>{' '}
              In Supabase, click <strong>Connect</strong> at the top of your
              project (or{' '}
              <strong>Project Settings &rarr; Database &rarr; Connection string</strong>
              ), select <strong>URI</strong> (use the{' '}
              <strong>Session / Transaction Pooler</strong> URI for Vercel), and
              replace <code>[YOUR-PASSWORD]</code> with your database password.
            </li>
            <li>
              <span className="font-semibold text-[#123B72]">
                Add to Vercel Environment Variables:
              </span>{' '}
              Open{' '}
              <strong>Vercel &rarr; Project &rarr; Settings &rarr; Environment Variables</strong>
              , add <code>DATABASE_URL</code> (and optionally{' '}
              <code>ADMIN_INITIAL_PASSWORD</code>), then click{' '}
              <strong>Redeploy</strong>.
            </li>
            <li>
              <span className="font-semibold text-[#123B72]">
                Verify &amp; Sync After Redeploying:
              </span>{' '}
              Sign in at <code>/admin/login</code> using your username &amp;
              password (or complete Initial Administrator Setup on a fresh
              database), then click <strong>Sync Default Data</strong> above.
            </li>
          </ol>

          <div className="pt-2 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleDownloadSql}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E83E8C] text-xs font-semibold text-white hover:bg-[#d1327c]"
            >
              <Download className="w-3.5 h-3.5" />
              Download Supabase SQL Script
            </button>
            <button
              type="button"
              onClick={handleCopySql}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-[#123B72] hover:bg-slate-50"
            >
              {copiedSql ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  SQL Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy SQL Script
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
