import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ClipboardList,
  Database,
  ExternalLink,
  FileQuestion,
  Globe,
  GraduationCap,
  Inbox,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  School,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { AdminOverviewSection } from '../components/admin/AdminOverviewSection.tsx';
import { AdminWebsiteSection } from '../components/admin/AdminWebsiteSection.tsx';
import { AdminSchoolsStudentsSection } from '../components/admin/AdminSchoolsStudentsSection.tsx';
import { AdminClassesArmsSection } from '../components/admin/AdminClassesArmsSection.tsx';
import { AdminCbtManagementSection } from '../components/admin/AdminCbtManagementSection.tsx';
import { AdminEnquiriesSecuritySection } from '../components/admin/AdminEnquiriesSecuritySection.tsx';
import { AdminDatabaseSection } from '../components/admin/AdminDatabaseSection.tsx';

type SectionKey =
  | 'overview'
  | 'website'
  | 'schools'
  | 'classes_arms'
  | 'students'
  | 'examinations'
  | 'questions'
  | 'results'
  | 'enquiries'
  | 'settings'
  | 'database'
  | 'security';

const NAV_ITEMS: Array<{
  key: SectionKey;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
  { key: 'website', label: 'Website Management', icon: Globe },
  { key: 'schools', label: 'School Management', icon: School },
  { key: 'classes_arms', label: 'Classes & Arms', icon: Layers },
  { key: 'students', label: 'Student Management', icon: GraduationCap },
  { key: 'examinations', label: 'Examination Management', icon: ClipboardList },
  { key: 'questions', label: 'Question Management', icon: FileQuestion },
  { key: 'results', label: 'Results Management', icon: BarChart3 },
  { key: 'enquiries', label: 'Contact Enquiries', icon: Inbox },
  { key: 'settings', label: 'Website Settings', icon: Settings },
  { key: 'database', label: 'Database & Supabase', icon: Database },
  { key: 'security', label: 'Profile & Security', icon: ShieldCheck },
];

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { adminToken, admin, clearAdminSession } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionKey>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!adminToken || !admin) {
      navigate('/admin/login', { replace: true });
      return;
    }
    if (admin.mustChangePassword) {
      navigate('/admin/login', { replace: true });
    }
  }, [adminToken, admin, navigate]);

  const handleLogout = async () => {
    if (adminToken) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      }).catch(() => {});
    }
    clearAdminSession();
    navigate('/admin/login', { replace: true });
  };

  if (!adminToken || !admin || admin.mustChangePassword) {
    return null;
  }

  const activeLabel =
    NAV_ITEMS.find((i) => i.key === activeSection)?.label || 'Admin Dashboard';

  return (
    <div className="min-h-screen bg-[#F5F8FC] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-[#123B72] text-white shrink-0 no-print">
        <div className="h-16 px-5 flex items-center border-b border-white/15">
          <Link to="/" className="focus:outline-none">
            <BrandLogo compact lightText />
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveSection(item.key)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors text-left ${
                  isActive
                    ? 'bg-[#E83E8C] text-white'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/15 space-y-2">
          <div className="px-2">
            <p className="text-xs font-semibold text-white truncate">
              {admin.fullName}
            </p>
            <p className="text-[11px] text-slate-300 truncate">{admin.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-[#123B72] text-white flex flex-col z-10">
            <div className="h-16 px-4 flex items-center justify-between border-b border-white/15">
              <BrandLogo compact lightText />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-200 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold text-left ${
                      isActive
                        ? 'bg-[#E83E8C] text-white'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/15">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-white/10 text-xs font-semibold text-white hover:bg-red-600"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open dashboard menu"
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-[#123B72] hover:bg-slate-50"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs sm:text-sm text-slate-500 truncate">
              <span>Admin</span>
              <span className="mx-2">/</span>
              <span className="font-semibold text-[#123B72]">
                {activeLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#1769AA] hover:bg-[#F5F8FC] whitespace-nowrap"
            >
              View Public Site
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeSection === 'overview' && (
            <AdminOverviewSection token={adminToken} />
          )}
          {activeSection === 'website' && (
            <AdminWebsiteSection token={adminToken} mode="management" />
          )}
          {activeSection === 'settings' && (
            <AdminWebsiteSection token={adminToken} mode="settings" />
          )}
          {activeSection === 'schools' && (
            <AdminSchoolsStudentsSection token={adminToken} mode="schools" />
          )}
          {activeSection === 'classes_arms' && (
            <AdminClassesArmsSection token={adminToken} />
          )}
          {activeSection === 'students' && (
            <AdminSchoolsStudentsSection token={adminToken} mode="students" />
          )}
          {activeSection === 'examinations' && (
            <AdminCbtManagementSection
              token={adminToken}
              mode="examinations"
            />
          )}
          {activeSection === 'questions' && (
            <AdminCbtManagementSection token={adminToken} mode="questions" />
          )}
          {activeSection === 'results' && (
            <AdminCbtManagementSection token={adminToken} mode="results" />
          )}
          {activeSection === 'enquiries' && (
            <AdminEnquiriesSecuritySection
              token={adminToken}
              mode="enquiries"
              onLogout={handleLogout}
            />
          )}
          {activeSection === 'database' && (
            <AdminDatabaseSection token={adminToken} />
          )}
          {activeSection === 'security' && (
            <AdminEnquiriesSecuritySection
              token={adminToken}
              mode="security"
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>
    </div>
  );
}
