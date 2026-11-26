import React, { useEffect, useState } from 'react';

function getInitials(name: string, code?: string): string {
  const cleanCode = (code || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  if (cleanCode.length >= 2) {
    return cleanCode.slice(0, 2).toUpperCase();
  }
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return (words[0] || 'SC').slice(0, 2).toUpperCase();
}

export function SchoolLogoMark({
  name,
  logoUrl,
  code,
  size = 'sm',
}: {
  name: string;
  logoUrl?: string | null;
  code?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [logoUrl]);

  const sizeClass =
    size === 'xs'
      ? 'w-5 h-5 text-[9px] rounded'
      : size === 'sm'
        ? 'w-7 h-7 text-[10px] rounded-md'
        : size === 'md'
          ? 'w-9 h-9 text-xs rounded-lg'
          : 'w-12 h-12 text-sm rounded-xl';

  const cleanLogo = (logoUrl || '').trim();
  if (cleanLogo && !imgFailed) {
    return (
      <span
        className={`${sizeClass} inline-flex items-center justify-center shrink-0 overflow-hidden bg-white border border-slate-200 p-0.5`}
      >
        <img
          src={cleanLogo}
          alt={`${name} logo`}
          className="w-full h-full object-contain"
          onError={() => setImgFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} inline-flex items-center justify-center shrink-0 bg-[#F5F8FC] border border-slate-200 font-display font-bold text-[#123B72] select-none`}
    >
      {getInitials(name, code)}
    </span>
  );
}

export function SchoolNameBadge({
  name,
  logoUrl,
  code,
  subtitle,
  size = 'sm',
  nameClassName = 'font-semibold text-[#123B72]',
  showFallback = true,
}: {
  name: string;
  logoUrl?: string | null;
  code?: string;
  subtitle?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  nameClassName?: string;
  showFallback?: boolean;
}) {
  const hasLogo = Boolean((logoUrl || '').trim());

  return (
    <div className="inline-flex items-center gap-2.5 min-w-0">
      {(hasLogo || showFallback) && (
        <SchoolLogoMark name={name} logoUrl={logoUrl} code={code} size={size} />
      )}
      <div className="min-w-0">
        <p className={`${nameClassName} truncate`}>{name}</p>
        {subtitle && (
          <p className="font-mono-tabular text-xs text-slate-500 truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
