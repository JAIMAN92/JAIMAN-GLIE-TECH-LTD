import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { useSiteData } from '../context/SiteContext.tsx';
import { Navbar } from './Navbar.tsx';
import { Footer } from './Footer.tsx';
import { FloatingWhatsAppButton } from './FloatingWhatsAppButton.tsx';

interface PublicLayoutProps {
  pageKey?: 'home' | 'about' | 'cbt' | 'contact' | 'vision';
  children: React.ReactNode;
}

export function PublicLayout({ pageKey = 'home', children }: PublicLayoutProps) {
  const navigate = useNavigate();
  const { siteData } = useSiteData();
  const visibleAnnouncements = siteData.announcements.filter(
    (a) => a.isActive && (a.targetPage === 'all' || a.targetPage === pageKey)
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        navigate('/admin/login');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F8FC] text-[#1E293B]">
      {visibleAnnouncements.length > 0 && (
        <div className="bg-[#123B72] text-white border-b border-[#D4AF37]/30 px-4 py-2 text-xs sm:text-sm no-print">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2.5 text-center">
            <Megaphone className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <p className="font-medium">
              <span className="text-[#D4AF37] font-semibold mr-1.5">
                {visibleAnnouncements[0].title}:
              </span>
              {visibleAnnouncements[0].message}
            </p>
          </div>
        </div>
      )}
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <FloatingWhatsAppButton />
    </div>
  );
}
