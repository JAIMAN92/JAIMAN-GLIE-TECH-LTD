import { useSiteData } from '../context/SiteContext.tsx';

interface BrandLogoProps {
  compact?: boolean;
  lightText?: boolean;
}

export function BrandLogo({ compact = false, lightText = false }: BrandLogoProps) {
  const { siteData } = useSiteData();
  const { branding } = siteData;

  const safeLogoSrc = (() => {
    const raw = (branding.logoImageUrl || '').trim();
    if (!raw) return '';
    if (
      /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(raw)
    ) {
      return raw;
    }
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString();
      }
      return '';
    } catch {
      return '';
    }
  })();

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      {safeLogoSrc ? (
        <img
          src={safeLogoSrc}
          alt={branding.companyName}
          referrerPolicy="no-referrer"
          className="h-9 w-9 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shrink-0"
        />
      ) : (
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="shrink-0"
        >
          <rect
            width="36"
            height="36"
            rx="8"
            fill="var(--brand-deep-blue)"
          />
          <path
            d="M7 9H29V11.5H7V9Z"
            fill="var(--brand-gold)"
          />
          <path
            d="M14.5 15V22.5C14.5 24.433 12.933 26 11 26C9.6 26 8.5 25.2 8 24.2"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M27.5 18.5C26.7 16.4 24.8 15 22.5 15C19.462 15 17 17.462 17 20.5C17 23.538 19.462 26 22.5 26C25.2 26 27.4 24.1 27.8 21.5H22.8"
            stroke="var(--brand-cyan)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="29" cy="26" r="2.2" fill="var(--brand-pink)" />
        </svg>
      )}
      <span
        className={`font-display font-bold tracking-tight whitespace-nowrap shrink-0 ${
          compact ? 'text-sm sm:text-base' : 'text-sm sm:text-base lg:text-[17px]'
        } ${lightText ? 'text-white' : 'text-[#123B72]'}`}
      >
        {branding.logoText || branding.companyName}
      </span>
    </span>
  );
}
