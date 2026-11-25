import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Eye, Target } from 'lucide-react';
import { useSiteData } from '../context/SiteContext.tsx';
import { PublicLayout } from '../components/PublicLayout.tsx';

export function VisionPage() {
  const { siteData } = useSiteData();
  const { vision } = siteData;

  return (
    <PublicLayout pageKey="vision">
      {/* Header */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18 space-y-4">
          <p className="text-xs font-semibold tracking-widest text-[#1769AA] uppercase">
            Vision & Mission
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#123B72] max-w-4xl text-balance leading-tight">
            {vision.mainHeading}
          </h1>
        </div>
      </section>

      {/* Vision & Mission Two-Column Cards */}
      <section className="py-14 lg:py-18 bg-[#F5F8FC] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-7 sm:p-8 space-y-4">
            <div className="w-11 h-11 rounded-lg bg-[#123B72] text-[#D4AF37] flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <h2 className="font-display text-2xl font-bold text-[#123B72]">
              Our Vision
            </h2>
            <p className="text-base text-slate-700 leading-relaxed">
              {vision.visionStatement}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-7 sm:p-8 space-y-4">
            <div className="w-11 h-11 rounded-lg bg-[#E83E8C] text-white flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <h2 className="font-display text-2xl font-bold text-[#123B72]">
              Our Mission
            </h2>
            <p className="text-base text-slate-700 leading-relaxed">
              {vision.missionStatement}
            </p>
          </div>
        </div>
      </section>

      {/* Our Goals */}
      <section className="py-14 lg:py-18 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-[#1769AA] uppercase">
              <Target className="w-4 h-4 text-[#E83E8C]" />
              Strategic Direction
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#123B72]">
              Our Goals
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {vision.goals.map((goal, idx) => (
              <div
                key={idx}
                className="bg-[#F5F8FC] border border-slate-200 rounded-xl p-6 space-y-3"
              >
                <span className="font-mono-tabular text-xs font-bold text-[#1769AA]">
                  GOAL {String(idx + 1).padStart(2, '0')}
                </span>
                <p className="text-sm sm:text-base font-medium text-[#1E293B] leading-relaxed">
                  {goal}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commitment to the Future */}
      <section className="py-16 lg:py-20 bg-[#123B72] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <p className="text-xs font-semibold tracking-widest text-[#20C4D8] uppercase">
            Looking Ahead
          </p>
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-balance">
            {vision.futureCommitmentTitle}
          </h2>
          <p className="text-base sm:text-lg text-slate-200 max-w-3xl mx-auto leading-relaxed">
            {vision.futureCommitmentBody}
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <Link
              to="/cbt"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-[#E83E8C] text-white font-semibold text-sm hover:bg-[#d1327c] transition-colors whitespace-nowrap shrink-0"
            >
              EXPLORE CBT SOLUTIONS
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg border border-[#D4AF37] text-[#D4AF37] font-semibold text-sm hover:bg-[#D4AF37] hover:text-[#123B72] transition-colors whitespace-nowrap shrink-0"
            >
              PARTNER WITH US
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
