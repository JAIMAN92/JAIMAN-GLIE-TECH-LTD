import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Compass,
  HeartHandshake,
  Lightbulb,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useSiteData } from '../context/SiteContext.tsx';
import { PublicLayout } from '../components/PublicLayout.tsx';

const VALUE_ICONS = [
  Award,
  ShieldCheck,
  Lightbulb,
  CheckCircle2,
  Compass,
  HeartHandshake,
];

export function AboutPage() {
  const { siteData } = useSiteData();
  const { about, branding } = siteData;

  return (
    <PublicLayout pageKey="about">
      {/* Page Header */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18 space-y-4">
          <p className="text-xs font-semibold tracking-widest text-[#E83E8C] uppercase">
            About Us · {branding.companyName}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#123B72] max-w-3xl text-balance leading-tight">
            Dedicated to Reliable Digital Examinations for Nigerian Secondary
            Schools
          </h1>
        </div>
      </section>

      {/* Who We Are */}
      <section className="py-14 lg:py-18 bg-[#F5F8FC] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4">
            <h2 className="font-display text-2xl font-bold text-[#123B72]">
              Who We Are
            </h2>
          </div>
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
            <p className="text-base sm:text-lg text-[#1E293B] leading-relaxed">
              {about.whoWeAre}
            </p>
          </div>
        </div>
      </section>

      {/* What We Do */}
      <section className="py-14 lg:py-18 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-2xl space-y-3">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#123B72]">
              What We Do
            </h2>
            <p className="text-slate-600 text-base leading-relaxed">
              {about.whatWeDoIntro}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {about.whatWeDoItems.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#F5F8FC] border border-slate-200 rounded-xl p-6 flex items-start gap-4"
              >
                <span className="font-mono-tabular text-sm font-bold text-[#E83E8C] pt-0.5">
                  0{idx + 1}
                </span>
                <p className="text-base font-medium text-[#123B72] leading-relaxed">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-14 lg:py-18 bg-[#F5F8FC] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-widest text-[#1769AA] uppercase">
              Principles That Guide Us
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#123B72]">
              Our Core Values
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {about.coreValues.map((val, idx) => {
              const Icon = VALUE_ICONS[idx % VALUE_ICONS.length] ?? Sparkles;
              return (
                <div
                  key={val.title}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#123B72]/5 border border-[#123B72]/15 text-[#1769AA] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#123B72]">
                    {val.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {val.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Our Commitment */}
      <section className="py-14 lg:py-18 bg-[#123B72] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <p className="text-xs font-semibold tracking-widest text-[#D4AF37] uppercase">
            Our Commitment
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold">
            {about.commitmentTitle}
          </h2>
          <p className="text-base sm:text-lg text-slate-200 leading-relaxed max-w-3xl">
            {about.commitmentBody}
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <Link
              to="/cbt"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#E83E8C] text-white font-semibold text-sm hover:bg-[#d1327c] transition-colors whitespace-nowrap shrink-0"
            >
              EXPLORE CBT SOLUTIONS
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              CONTACT OUR TEAM
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
