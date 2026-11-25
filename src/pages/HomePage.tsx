import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Laptop,
  Layers,
  MonitorCheck,
  ShieldCheck,
} from 'lucide-react';
import { useSiteData } from '../context/SiteContext.tsx';
import { PublicLayout } from '../components/PublicLayout.tsx';

const SERVICE_ICONS = [
  MonitorCheck,
  ClipboardCheck,
  GraduationCap,
  Laptop,
  Layers,
];

export function HomePage() {
  const { siteData } = useSiteData();
  const { homepage, branding } = siteData;

  return (
    <PublicLayout pageKey="home">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white border-b border-slate-200">
        <div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#123B72] via-[#E83E8C] to-[#20C4D8]"
          aria-hidden="true"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <p className="text-xs font-semibold tracking-widest text-[#1769AA] uppercase">
                {branding.companyName}
              </p>

              <h1
                className="font-display font-extrabold text-[#123B72] tracking-tight leading-[1.12] text-balance"
                style={{ fontSize: 'clamp(2rem, 3.6vw, 3.25rem)' }}
              >
                {homepage.heroHeading}
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                {homepage.heroSubheading}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/cbt"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-[#E83E8C] text-white font-semibold text-sm tracking-wide hover:bg-[#d1327c] transition-colors whitespace-nowrap shrink-0"
                >
                  EXPLORE OUR CBT
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg border border-[#123B72] text-[#123B72] font-semibold text-sm tracking-wide hover:bg-[#123B72] hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  CONTACT US
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-4">
              {/* Primary Luxury CBT Examination Center Image */}
              <figure className="group relative aspect-[16/9] rounded-2xl overflow-hidden border border-[#D4AF37]/40 bg-gradient-to-br from-[#123B72] to-[#1769AA] shadow-sm">
                <img
                  src="/src/assets/images/hero_luxury_cbt_hall_1795523614595.jpg"
                  alt="Modern secondary school digital examination center equipped with CBT workstations"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-[#123B72]/85 via-[#123B72]/20 to-transparent pointer-events-none"
                  aria-hidden="true"
                />
                <figcaption className="absolute inset-x-0 bottom-0 p-4 sm:p-5 flex items-end justify-between gap-4 text-white">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-[#D4AF37] uppercase">
                      Digital Examination Environment
                    </p>
                    <p className="text-sm sm:text-base font-semibold leading-snug">
                      Structured, distraction-free CBT suites built for Nigerian schools
                    </p>
                  </div>
                </figcaption>
              </figure>

              {/* Secondary Luxury Inset Pair */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <figure className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-br from-[#123B72] to-[#1769AA] shadow-sm">
                  <img
                    src="/src/assets/images/hero_luxury_tablet_desk_1795523614055.jpg"
                    alt="Executive digital assessment tablet and stylus on travertine study desk"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-[#123B72]/80 via-transparent to-transparent pointer-events-none"
                    aria-hidden="true"
                  />
                  <figcaption className="absolute inset-x-0 bottom-0 p-3.5 text-white">
                    <p className="text-xs font-semibold text-[#D4AF37]">
                      Seamless Multi-Device Access
                    </p>
                    <p className="text-xs text-slate-100">
                      Desktop, laptop, and tablet ready
                    </p>
                  </figcaption>
                </figure>

                <figure className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-br from-[#123B72] to-[#1769AA] shadow-sm">
                  <img
                    src="/src/assets/images/hero_luxury_executive_academy_1795523615019.jpg"
                    alt="Modern Nigerian secondary school technology pavilion bathed in golden hour sunlight"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-[#123B72]/80 via-transparent to-transparent pointer-events-none"
                    aria-hidden="true"
                  />
                  <figcaption className="absolute inset-x-0 bottom-0 p-3.5 text-white">
                    <p className="text-xs font-semibold text-[#D4AF37]">
                      Institutional Excellence
                    </p>
                    <p className="text-xs text-slate-100">
                      Reliable school assessment partner
                    </p>
                  </figcaption>
                </figure>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Preview */}
      <section className="py-16 lg:py-20 bg-[#F5F8FC] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-5 space-y-3">
              <p className="text-xs font-semibold tracking-widest text-[#E83E8C] uppercase">
                About {branding.companyName}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#123B72] text-balance">
                {homepage.aboutPreviewTitle}
              </h2>
            </div>
            <div className="lg:col-span-7 space-y-5">
              <p className="text-base text-slate-700 leading-relaxed">
                {homepage.aboutPreviewBody}
              </p>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#1769AA] hover:text-[#123B72] transition-colors"
              >
                Learn more about who we are
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Our Services */}
      <section className="py-16 lg:py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold tracking-widest text-[#1769AA] uppercase">
              Our Services
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#123B72] text-balance">
              Comprehensive Digital Examination Solutions
            </h2>
            <p className="text-slate-600 text-base">
              Purpose-built educational technology services supporting secondary
              school administrators, teachers, and students.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
            {homepage.services.map((service, index) => {
              const Icon = SERVICE_ICONS[index % SERVICE_ICONS.length];
              const colSpan =
                index < 2 ? 'lg:col-span-3' : 'lg:col-span-2';
              return (
                <div
                  key={service.title}
                  className={`${colSpan} bg-[#F5F8FC] border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5 hover:border-[#1769AA]/60 transition-colors`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#123B72] text-white">
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="text-xs font-medium text-[#1769AA]">
                        0{index + 1} · {service.highlight}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-[#123B72]">
                      {service.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 lg:py-20 bg-[#F5F8FC] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-xs font-semibold tracking-widest text-[#D4AF37] uppercase">
                Why Choose Us
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#123B72] text-balance">
                Dependable Assessment Infrastructure for Schools
              </h2>
              <p className="text-slate-600 text-base leading-relaxed">
                Every workflow is structured so school principals, examination
                officers, and secondary school students can focus on academic
                excellence without technical friction.
              </p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {homepage.whyChooseUs.map((point, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-3.5"
                >
                  <CheckCircle2 className="w-5 h-5 text-[#20C4D8] shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-[#1E293B] leading-relaxed">
                    {point}
                  </p>
                </div>
              ))}
              <div className="bg-[#123B72] text-white rounded-xl p-5 flex items-start gap-3.5">
                <ShieldCheck className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <p className="text-sm font-medium leading-relaxed">
                  Controlled administrator access and locked examination
                  submissions protect assessment credibility.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call-to-Action Section */}
      <section className="py-16 lg:py-20 bg-[#123B72] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-balance">
            {homepage.ctaHeading}
          </h2>
          <p className="text-base sm:text-lg text-slate-200 max-w-2xl mx-auto leading-relaxed">
            {homepage.ctaText}
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-[#E83E8C] text-white font-semibold text-sm tracking-wide hover:bg-[#d1327c] transition-colors whitespace-nowrap shrink-0"
            >
              CONTACT US
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/cbt/portal"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg border border-[#D4AF37] text-[#D4AF37] font-semibold text-sm tracking-wide hover:bg-[#D4AF37] hover:text-[#123B72] transition-colors whitespace-nowrap shrink-0"
            >
              ENTER CBT EXAMINATION
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
