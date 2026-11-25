import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useSiteData } from '../context/SiteContext.tsx';
import { BrandLogo } from './BrandLogo.tsx';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { siteData } = useSiteData();
  const nav = siteData.navigation;

  const links = [
    { to: '/', label: 'HOME', visible: nav.showHome },
    { to: '/about', label: 'ABOUT US', visible: nav.showAbout },
    { to: '/cbt', label: 'CBT', visible: nav.showCbt },
    { to: '/contact', label: 'CONTACT', visible: nav.showContact },
    { to: '/vision', label: 'VISION', visible: nav.showVision },
  ].filter((item) => item.visible);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          to="/"
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1769AA] rounded-lg"
          onClick={() => setMobileOpen(false)}
        >
          <BrandLogo />
        </Link>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7"
        >
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `relative py-5 text-xs font-semibold tracking-wider whitespace-nowrap shrink-0 transition-colors duration-150 ${
                  isActive
                    ? 'text-[#123B72] after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2.5px] after:bg-[#E83E8C]'
                    : 'text-slate-600 hover:text-[#1769AA]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Zone 3: Primary CBT Portal CTA & Mobile Menu toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/cbt/portal"
            className="hidden md:inline-flex items-center px-4 py-2 rounded-lg bg-[#E83E8C] text-white text-xs font-semibold tracking-wide hover:bg-[#d1327c] transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1769AA]"
          >
            CBT PORTAL
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-[#123B72] hover:bg-[#F5F8FC]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'bg-[#123B72] text-white'
                    : 'text-slate-700 hover:bg-[#F5F8FC] hover:text-[#123B72]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <Link
            to="/cbt/portal"
            onClick={() => setMobileOpen(false)}
            className="block mt-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-center bg-[#E83E8C] text-white"
          >
            ENTER CBT EXAMINATION
          </Link>
        </div>
      )}
    </header>
  );
}
