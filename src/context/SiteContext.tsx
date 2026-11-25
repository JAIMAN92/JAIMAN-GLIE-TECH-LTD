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

function applyBrandVariables(data: SiteData) {
  const root = document.documentElement;
  const b = data.branding;
  if (b.deepBlue) root.style.setProperty('--brand-deep-blue', b.deepBlue);
  if (b.professionalBlue)
    root.style.setProperty('--brand-blue', b.professionalBlue);
  if (b.pink) root.style.setProperty('--brand-pink', b.pink);
  if (b.gold) root.style.setProperty('--brand-gold', b.gold);
  if (b.cyan) root.style.setProperty('--brand-cyan', b.cyan);
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
