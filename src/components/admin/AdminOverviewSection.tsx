import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  BookOpen,
  CheckSquare,
  FileCheck2,
  GraduationCap,
  Inbox,
  School,
  ClipboardList,
} from 'lucide-react';

interface OverviewData {
  stats: {
    totalSchools: number;
    totalStudents: number;
    totalExaminations: number;
    activeExaminations: number;
    completedExaminations: number;
    totalSubmittedResults: number;
    unreadEnquiries: number;
    totalQuestions: number;
  };
  charts: {
    subjectPerformance: Array<{
      subject: string;
      submissions: number;
      avgScore: number;
    }>;
    studentsBySchool: Array<{
      school: string;
      students: number;
    }>;
  };
  recentLogs: Array<{
    id: number;
    adminLabel: string;
    action: string;
    targetType: string;
    targetDetails: string;
    createdAt: string;
  }>;
}

export function AdminOverviewSection({ token }: { token: string }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/overview', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load overview.');
        setData(json);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
        {error || 'Unable to load dashboard statistics.'}
      </div>
    );
  }

  const statCards = [
    {
      label: 'Registered Schools',
      value: data.stats.totalSchools,
      icon: School,
      color: 'text-[#123B72]',
    },
    {
      label: 'Registered Students',
      value: data.stats.totalStudents,
      icon: GraduationCap,
      color: 'text-[#1769AA]',
    },
    {
      label: 'Total Examinations',
      value: data.stats.totalExaminations,
      icon: ClipboardList,
      color: 'text-[#123B72]',
    },
    {
      label: 'Active Examinations',
      value: data.stats.activeExaminations,
      icon: CheckSquare,
      color: 'text-[#20C4D8]',
    },
    {
      label: 'Completed Examinations',
      value: data.stats.completedExaminations,
      icon: BookOpen,
      color: 'text-[#D4AF37]',
    },
    {
      label: 'Submitted Results',
      value: data.stats.totalSubmittedResults,
      icon: FileCheck2,
      color: 'text-emerald-600',
    },
    {
      label: 'Unread Enquiries',
      value: data.stats.unreadEnquiries,
      icon: Inbox,
      color: 'text-[#E83E8C]',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-[#123B72]">
          Dashboard Overview
        </h2>
        <p className="text-sm text-slate-600">
          Real-time summary of registered schools, students, examinations,
          results, and enquiries.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4"
            >
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {card.label}
                </p>
                <p className="font-mono-tabular text-3xl font-bold text-[#123B72] mt-2">
                  {card.value}
                </p>
              </div>
              <div className={`p-2.5 rounded-lg bg-[#F5F8FC] ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-base font-bold text-[#123B72]">
            Subject Submissions & Average Score (%)
          </h3>
          {data.charts.subjectPerformance.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">
              No subject metrics recorded yet.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.subjectPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar
                    dataKey="avgScore"
                    name="Avg Score (%)"
                    fill="#1769AA"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="submissions"
                    name="Submissions"
                    fill="#E83E8C"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-base font-bold text-[#123B72]">
            Registered Students by School
          </h3>
          {data.charts.studentsBySchool.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">
              Register schools and students to view distribution.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.studentsBySchool}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="school" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar
                    dataKey="students"
                    name="Students"
                    fill="#123B72"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-display text-base font-bold text-[#123B72]">
            Recent Administrative Activity
          </h3>
        </div>
        {data.recentLogs.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No recent logs.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F5F8FC] text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 font-semibold">Administrator</th>
                  <th className="px-5 py-3 font-semibold">Action</th>
                  <th className="px-5 py-3 font-semibold">Details</th>
                  <th className="px-5 py-3 font-semibold text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-[#123B72]">
                      {log.adminLabel}
                    </td>
                    <td className="px-5 py-3 font-mono-tabular text-xs text-[#1769AA]">
                      {log.action}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {log.targetDetails}
                    </td>
                    <td className="px-5 py-3 text-right font-mono-tabular text-xs text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
