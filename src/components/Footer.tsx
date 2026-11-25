import { Link, useNavigate } from 'react-router-dom';
import { Mail, MapPin, Phone, ArrowUpRight } from 'lucide-react';
import { useSiteData } from '../context/SiteContext.tsx';
import { BrandLogo } from './BrandLogo.tsx';

export function Footer() {
  const navigate = useNavigate();
  const { siteData } = useSiteData();
  const { branding, contact } = siteData;

  return (
    <footer className="bg-[#123B72] text-white border-t border-[#1769AA]/30 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <BrandLogo lightText />
            <p className="text-sm text-slate-200 max-w-md leading-relaxed">
              {branding.footerDescription}
            </p>
            <p className="text-xs font-semibold tracking-wide text-[#D4AF37]">
              {branding.brandMessage}
            </p>
          </div>

          {/* Quick Navigation */}
          <div>
            <h3 className="font-display text-sm font-semibold tracking-wider text-[#20C4D8] mb-4">
              NAVIGATION
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-200">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/cbt" className="hover:text-white transition-colors">
                  CBT Solutions
                </Link>
              </li>
              <li>
                <Link
                  to="/cbt/portal"
                  className="inline-flex items-center gap-1 text-[#D4AF37] hover:text-white font-medium transition-colors"
                >
                  Enter CBT Examination
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </li>
              <li>
                <Link to="/vision" className="hover:text-white transition-colors">
                  Our Vision
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Summary */}
          <div>
            <h3 className="font-display text-sm font-semibold tracking-wider text-[#20C4D8] mb-4">
              CONTACT INFORMATION
            </h3>
            <ul className="space-y-3 text-sm text-slate-200">
              <li className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-[#E83E8C] shrink-0 mt-0.5" />
                {contact.phonePlaceholder &&
                !contact.phonePlaceholder.startsWith('[') ? (
                  <a
                    href={`tel:${contact.phonePlaceholder.replace(/[^\d+]/g, '')}`}
                    className="break-words hover:text-white transition-colors"
                  >
                    {contact.phonePlaceholder}
                  </a>
                ) : (
                  <span className="break-words">{contact.phonePlaceholder}</span>
                )}
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-[#20C4D8] shrink-0 mt-0.5" />
                {contact.emailPlaceholder &&
                contact.emailPlaceholder.includes('@') &&
                !contact.emailPlaceholder.startsWith('[') ? (
                  <a
                    href={`mailto:${contact.emailPlaceholder.trim()}`}
                    className="break-all hover:text-white transition-colors"
                  >
                    {contact.emailPlaceholder}
                  </a>
                ) : (
                  <span className="break-words">{contact.emailPlaceholder}</span>
                )}
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <span className="break-words">
                  {contact.officeAddressPlaceholder}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-300">
          <p
            onDoubleClick={() => navigate('/admin/login')}
            className="select-none"
          >
            {branding.copyrightText}
          </p>
          <div className="flex items-center gap-5">
            <Link to="/cbt/portal" className="hover:text-white transition-colors">
              CBT Portal
            </Link>
            <Link to="/vision" className="hover:text-white transition-colors">
              Vision & Mission
            </Link>
            <Link to="/contact" className="hover:text-white transition-colors">
              School Onboarding
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
