import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  FileCheck2,
  KeyRound,
  Layers,
  LayoutGrid,
  ListChecks,
  Lock,
  Navigation,
  Save,
  School,
  Send,
  UserCheck,
} from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout.tsx';
import { CbtInterfaceIllustration } from '../components/CbtInterfaceIllustration.tsx';
import { useSiteData } from '../context/SiteContext.tsx';

const CBT_FEATURES = [
  { label: 'Student examination login', icon: KeyRound },
  { label: 'Secure student authentication', icon: Lock },
  { label: 'Examination instructions', icon: BookOpen },
  { label: 'Subject selection', icon: ListChecks },
  { label: 'Multiple-choice questions (A, B, C, D)', icon: CheckCircle2 },
  { label: 'Examination countdown timer', icon: Clock },
  { label: 'Automatic answer saving', icon: Save },
  { label: 'Previous and Next question navigation', icon: Navigation },
  { label: 'Question number navigation', icon: LayoutGrid },
  { label: 'Examination submission', icon: Send },
  { label: 'Automatic objective marking', icon: FileCheck2 },
  { label: 'Examination result generation', icon: BarChart3 },
  { label: 'Examination performance management', icon: UserCheck },
];

const EXAM_RULES = [
  'Students must authenticate with a valid Examination Number and Access Password before accessing an examination.',
  'Students must read and acknowledge the examination instructions before starting.',
  'The countdown timer tracks remaining examination time and automatically submits when time expires.',
  'Selected answers are saved automatically to the database as students progress.',
  'Students receive an explicit confirmation prompt before final submission.',
  'Submitted examinations are locked immediately against unauthorized changes.',
  'Objective questions are marked automatically using verified answer keys.',
  'Results are calculated strictly from actual submitted student answers.',
  'Examination schedules, activation, and result publication are controlled by authorized administrators.',
];

export function CbtPage() {
  const { siteData } = useSiteData();

  const groupedClassArms = (siteData.classArms ?? []).reduce<
    Record<string, string[]>
  >((acc, item) => {
    const cls = item.classLevel;
    if (!acc[cls]) acc[cls] = [];
    if (!acc[cls].includes(item.armName)) {
      acc[cls].push(item.armName);
    }
    return acc;
  }, {});

  const classEntries = Object.entries(groupedClassArms).map(
    ([classLevel, arms]): [string, string[]] => {
      const sorted = [...arms].sort((a, b) => {
        const aSingle = a.length === 1;
        const bSingle = b.length === 1;
        if (aSingle && !bSingle) return -1;
        if (!aSingle && bSingle) return 1;
        const aClass = /^Class\s+\d+$/i.test(a);
        const bClass = /^Class\s+\d+$/i.test(b);
        if (aClass && !bClass) return -1;
        if (!aClass && bClass) return 1;
        return a.localeCompare(b, undefined, { numeric: true });
      });
      return [classLevel, sorted];
    }
  );

  return (
    <PublicLayout pageKey="cbt">
      {/* Hero */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-6">
              <p className="text-xs font-semibold tracking-widest text-[#1769AA] uppercase">
                Computer-Based Testing Platform
              </p>
              <h1
                className="font-display font-extrabold text-[#123B72] leading-[1.14] text-balance"
                style={{ fontSize: 'clamp(1.9rem, 3.2vw, 2.9rem)' }}
              >
                PROFESSIONAL COMPUTER-BASED TESTING FOR SECONDARY SCHOOLS
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                Experience a smarter way of conducting examinations with JAIMAN
                GOLDENLITE TECH LTD. Our CBT solutions are designed to make
                digital assessments organized, accessible, and user-friendly for
                schools and students.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <Link
                  to="/cbt/portal"
                  className="inline-flex items-center gap-2.5 px-7 py-4 rounded-lg bg-[#E83E8C] text-white font-bold text-sm tracking-wide hover:bg-[#d1327c] transition-colors whitespace-nowrap shrink-0 shadow-sm"
                >
                  ENTER CBT EXAMINATION
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 px-6 py-4 rounded-lg border border-[#123B72] text-[#123B72] font-semibold text-sm hover:bg-[#123B72] hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  REQUEST SCHOOL ONBOARDING
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6">
              <CbtInterfaceIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* CBT Features */}
      <section className="py-14 lg:py-18 bg-[#F5F8FC] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold tracking-widest text-[#E83E8C] uppercase">
              Platform Capabilities
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#123B72]">
              CBT Features Built for Exam Clarity
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CBT_FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.label}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-3.5"
                >
                  <span className="w-9 h-9 rounded-lg bg-[#1769AA]/10 text-[#1769AA] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-sm font-semibold text-[#1E293B]">
                    {feat.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Examination Rules & Integrity */}
      <section className="py-14 lg:py-18 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 space-y-4">
            <p className="text-xs font-semibold tracking-widest text-[#1769AA] uppercase">
              Examination Integrity
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#123B72] text-balance">
              Standardized CBT Controls & Safeguards
            </h2>
            <p className="text-slate-600 text-base leading-relaxed">
              Every examination session enforces strict server-side rules to
              ensure fair, reliable, and auditable outcomes.
            </p>
            <div className="pt-2">
              <Link
                to="/cbt/portal"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#123B72] text-white font-semibold text-sm hover:bg-[#1769AA] transition-colors whitespace-nowrap shrink-0"
              >
                ENTER CBT EXAMINATION
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-3">
            {EXAM_RULES.map((rule, idx) => (
              <div
                key={idx}
                className="bg-[#F5F8FC] border border-slate-200 rounded-lg px-5 py-3.5 flex items-start gap-3"
              >
                <span className="font-mono-tabular text-xs font-bold text-[#1769AA] pt-0.5">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <p className="text-sm text-[#1E293B] leading-relaxed">{rule}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Classes & Arms Organization */}
      <section className="py-14 lg:py-18 bg-[#F5F8FC] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold tracking-widest text-[#1769AA] uppercase inline-flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#E83E8C]" />
              Class &amp; Arm Structure
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#123B72]">
              Organized Around Nigerian Secondary School Classes &amp; Arms
            </h2>
            <p className="text-slate-600 text-base leading-relaxed">
              Schools can structure student cohorts, assign targeted subject
              examinations, and filter result sheets by exact class level and
              academic arm.
            </p>
          </div>

          {classEntries.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {classEntries.map(([classLevel, arms]) => (
                <div
                  key={classLevel}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="font-display text-lg font-bold text-[#123B72]">
                      {classLevel}
                    </h3>
                    <span className="font-mono-tabular text-xs font-semibold text-[#1769AA]">
                      {arms.length} {arms.length === 1 ? 'Arm' : 'Arms'}
                    </span>
                  </div>
                  <p className="text-sm text-[#1E293B] leading-relaxed">
                    {arms.join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                <h3 className="font-display text-lg font-bold text-[#123B72]">
                  Junior Secondary (JSS1 – JSS3)
                </h3>
                <p className="text-sm text-slate-600">
                  Organized across 10 class arms (A through J) and custom school
                  streams.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                <h3 className="font-display text-lg font-bold text-[#123B72]">
                  Senior Secondary (SS1 – SS3)
                </h3>
                <p className="text-sm text-slate-600">
                  Supports Senior Secondary arms including Class 1 through Class
                  6 and Art.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* School CBT Services Onboarding */}
      <section className="py-14 lg:py-18 bg-[#123B72] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-[#D4AF37] uppercase">
                <School className="w-4 h-4" />
                School CBT Services
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-balance">
                How Schools Onboard and Configure Examinations
              </h2>
              <p className="text-slate-200 text-base leading-relaxed">
                JAIMAN GOLDENLITE TECH LTD works with Nigerian secondary school
                administrators and examination officers to register schools,
                organize classes and arms, import student records, build subject
                question banks, schedule examinations, and publish verified
                results.
              </p>
            </div>
            <div className="lg:col-span-5 bg-white/10 border border-white/15 rounded-xl p-6 space-y-4">
              <ol className="space-y-3 text-sm text-slate-100">
                <li>
                  <strong className="text-[#D4AF37]">1. Reach Out:</strong>{' '}
                  Contact our team with your school details and assessment
                  requirements.
                </li>
                <li>
                  <strong className="text-[#20C4D8]">2. School Setup:</strong>{' '}
                  We provision your school profile, class levels, arms, and
                  student login credentials.
                </li>
                <li>
                  <strong className="text-[#E83E8C]">3. Conduct CBT:</strong>{' '}
                  Students log in securely, complete timed tests, and receive
                  accurate objective grading.
                </li>
              </ol>
              <Link
                to="/contact"
                className="block w-full text-center px-5 py-3 rounded-lg bg-[#E83E8C] text-white font-semibold text-sm hover:bg-[#d1327c] transition-colors"
              >
                CONTACT US FOR SCHOOL ONBOARDING
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
