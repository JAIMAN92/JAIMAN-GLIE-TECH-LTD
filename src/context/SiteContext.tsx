import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  DEFAULT_ABOUT,
  DEFAULT_BRANDING,
  DEFAULT_CONTACT,
  DEFAULT_HOMEPAGE,
  DEFAULT_NAVIGATION,
  DEFAULT_VISION,
} from '../shared/defaults.ts';
import type { SiteData } from '../shared/types.ts';

interface SiteContextValue {
  siteData: SiteData;
  loading: boolean;
  refreshSiteData: () => Promise<void>;
}

const initialSiteData: SiteData = {
  homepage: DEFAULT_HOMEPAGE,
  about: DEFAULT_ABOUT,
  vision: DEFAULT_VISION,
  branding: DEFAULT_BRANDING,
  contact: DEFAULT_CONTACT,
  navigation: DEFAULT_NAVIGATION,
  announcements: [],
  classArms: [],
};

const SiteContext = createContext<SiteContextValue>({
  siteData: initialSiteData,
  loading: true,
  refreshSiteData: async () => {},
});

function getSafeLogoUrl(rawUrl?: string): string {
  const raw = (rawUrl || '').trim();
  if (!raw) return '';
  if (
    /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(
      raw
    )
  ) {
    return raw;
  }
  if (raw.startsWith('/') && !raw.startsWith('//')) {
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
}

function buildBrandCrestSvgDataUrl(branding: SiteData['branding']): string {
  const safeHex = (val: string | undefined, fallback: string) =>
    /^#[0-9a-fA-F]{3,8}$/.test((val || '').trim()) ? val!.trim() : fallback;

  const deepBlue = safeHex(branding.deepBlue, '#123B72');
  const gold = safeHex(branding.gold, '#D4AF37');
  const cyan = safeHex(branding.cyan, '#20C4D8');
  const pink = safeHex(branding.pink, '#E83E8C');

  const svg = `<svg width="64" height="64" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="36" height="36" rx="8" fill="${deepBlue}"/><path d="M7 9H29V11.5H7V9Z" fill="${gold}"/><path d="M14.5 15V22.5C14.5 24.433 12.933 26 11 26C9.6 26 8.5 25.2 8 24.2" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/><path d="M27.5 18.5C26.7 16.4 24.8 15 22.5 15C19.462 15 17 17.462 17 20.5C17 23.538 19.462 26 22.5 26C25.2 26 27.4 24.1 27.8 21.5H22.8" stroke="${cyan}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="29" cy="26" r="2.2" fill="${pink}"/></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function applyBrandVariables(data: SiteData) {
  const root = document.documentElement;
  const b = data.branding;
  if (b.deepBlue) root.style.setProperty('--brand-deep-blue', b.deepBlue);
  if (b.professionalBlue)
    root.style.setProperty('--brand-blue', b.professionalBlue);
  if (b.pink) root.style.setProperty('--brand-pink', b.pink);
  if (b.gold) root.style.setProperty('--brand-gold', b.gold);
  if (b.cyan) root.style.setProperty('--brand-cyan', b.cyan);

  const customLogo = getSafeLogoUrl(b.logoImageUrl);
  const iconHref = customLogo || buildBrandCrestSvgDataUrl(b);
  const iconType = customLogo
    ? customLogo.startsWith('data:image/png') || /\.png(\?|$)/i.test(customLogo)
      ? 'image/png'
      : customLogo.startsWith('data:image/jpeg') || /\.jpe?g(\?|$)/i.test(customLogo)
        ? 'image/jpeg'
        : customLogo.startsWith('data:image/webp') || /\.webp(\?|$)/i.test(customLogo)
          ? 'image/webp'
          : customLogo.startsWith('data:image/svg+xml') || /\.svg(\?|$)/i.test(customLogo)
            ? 'image/svg+xml'
            : ''
    : 'image/svg+xml';

  const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];
  rels.forEach((rel) => {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    if (iconType && rel !== 'apple-touch-icon') {
      link.type = iconType;
    } else if (!iconType && rel !== 'apple-touch-icon') {
      link.removeAttribute('type');
    }
    link.href = iconHref;
  });
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [siteData, setSiteData] = useState<SiteData>(initialSiteData);
  const [loading, setLoading] = useState(true);

  const refreshSiteData = useCallback(async () => {
    try {
      const res = await fetch('/api/public/site-data');
      if (res.ok) {
        const json = (await res.json()) as SiteData;
        setSiteData(json);
        applyBrandVariables(json);
      }
    } catch (err) {
      console.error('Unable to refresh site data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    applyBrandVariables(initialSiteData);
    refreshSiteData();
  }, [refreshSiteData]);

  return (
    <SiteContext.Provider value={{ siteData, loading, refreshSiteData }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSiteData() {
  return useContext(SiteContext);
}
