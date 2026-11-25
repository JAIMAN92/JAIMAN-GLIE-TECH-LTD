import React, { useEffect, useState } from 'react';
import { CheckCircle2, Plus, Trash2, Save } from 'lucide-react';
import { useSiteData } from '../../context/SiteContext.tsx';
import type {
  AboutContent,
  BrandingSettings,
  ContactSettings,
  HomepageContent,
  NavigationSettings,
  VisionContent,
} from '../../shared/types.ts';

interface AnnouncementItem {
  id: number;
  title: string;
  message: string;
  targetPage: string;
  isActive: boolean;
}

export function AdminWebsiteSection({
  token,
  mode,
}: {
  token: string;
  mode: 'management' | 'settings';
}) {
  const { siteData, refreshSiteData } = useSiteData();

  const [tab, setTab] = useState<string>(
    mode === 'management' ? 'homepage' : 'branding'
  );

  useEffect(() => {
    setTab(mode === 'management' ? 'homepage' : 'branding');
  }, [mode]);

  const [homepage, setHomepage] = useState<HomepageContent>(siteData.homepage);
  const [about, setAbout] = useState<AboutContent>(siteData.about);
  const [vision, setVision] = useState<VisionContent>(siteData.vision);
  const [navigation, setNavigation] = useState<NavigationSettings>(
    siteData.navigation
  );
  const [branding, setBranding] = useState<BrandingSettings>(siteData.branding);
  const [contact, setContact] = useState<ContactSettings>(siteData.contact);

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnMsg, setNewAnnMsg] = useState('');
  const [newAnnTarget, setNewAnnTarget] = useState('all');

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setHomepage(siteData.homepage);
    setAbout(siteData.about);
    setVision(siteData.vision);
    setNavigation(siteData.navigation);
    setBranding(siteData.branding);
    setContact(siteData.contact);
  }, [siteData]);

  const loadAnnouncements = async () => {
    try {
      const res = await fetch('/api/admin/announcements', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setAnnouncements(json.announcements || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (mode === 'management') {
      loadAnnouncements();
    }
  }, [mode]);

  const saveSection = async (sectionKey: string, content: unknown) => {
    setSaving(true);
    setStatusMsg('');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/site-settings/${sectionKey}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || 'Failed to save changes.');
      } else {
        await refreshSiteData();
        setStatusMsg(`Saved ${sectionKey} changes to the live website.`);
      }
    } catch {
      setErrorMsg('Network error while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newAnnTitle,
          message: newAnnMsg,
          targetPage: newAnnTarget,
          isActive: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || 'Unable to create announcement.');
      } else {
        setNewAnnTitle('');
        setNewAnnMsg('');
        await loadAnnouncements();
        await refreshSiteData();
        setStatusMsg('Announcement published.');
      }
    } catch {
      setErrorMsg('Network error creating announcement.');
    }
  };

  const toggleAnnouncement = async (item: AnnouncementItem) => {
    await fetch(`/api/admin/announcements/${item.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    await loadAnnouncements();
    await refreshSiteData();
  };

  const deleteAnnouncement = async (id: number) => {
    await fetch(`/api/admin/announcements/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadAnnouncements();
    await refreshSiteData();
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400 * 1024) {
      setErrorMsg('Logo image file must be under 400KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBranding((prev) => ({ ...prev, logoImageUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const managementTabs = [
    { id: 'homepage', label: 'Homepage' },
    { id: 'about', label: 'About Us' },
    { id: 'vision', label: 'Vision & Mission' },
    { id: 'announcements', label: 'Announcements' },
    { id: 'navigation', label: 'Navigation Visibility' },
  ];

  const settingsTabs = [
    { id: 'branding', label: 'Branding, Logo & Colours' },
    { id: 'contact', label: 'Contact & Social Links' },
  ];

  const activeTabs = mode === 'management' ? managementTabs : settingsTabs;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-[#123B72]">
          {mode === 'management' ? 'Website Management' : 'Website Settings'}
        </h2>
        <p className="text-sm text-slate-600">
          {mode === 'management'
            ? 'Edit public page copy, manage announcements, and control navigation visibility.'
            : 'Update company branding, logo, brand colour palette, contact details, and footer copy.'}
        </p>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {activeTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setStatusMsg('');
              setErrorMsg('');
            }}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'bg-[#123B72] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {errorMsg}
        </div>
      )}

      {/* HOMEPAGE EDITOR */}
      {tab === 'homepage' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              Hero Main Heading
            </label>
            <input
              type="text"
              value={homepage.heroHeading}
              onChange={(e) =>
                setHomepage({ ...homepage, heroHeading: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              Hero Supporting Text
            </label>
            <textarea
              rows={3}
              value={homepage.heroSubheading}
              onChange={(e) =>
                setHomepage({ ...homepage, heroSubheading: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                About Preview Title
              </label>
              <input
                type="text"
                value={homepage.aboutPreviewTitle}
                onChange={(e) =>
                  setHomepage({
                    ...homepage,
                    aboutPreviewTitle: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                CTA Section Heading
              </label>
              <input
                type="text"
                value={homepage.ctaHeading}
                onChange={(e) =>
                  setHomepage({ ...homepage, ctaHeading: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              About Preview Body
            </label>
            <textarea
              rows={3}
              value={homepage.aboutPreviewBody}
              onChange={(e) =>
                setHomepage({ ...homepage, aboutPreviewBody: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              CTA Supporting Text
            </label>
            <input
              type="text"
              value={homepage.ctaText}
              onChange={(e) =>
                setHomepage({ ...homepage, ctaText: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => saveSection('homepage', homepage)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#123B72] text-white text-sm font-semibold hover:bg-[#1769AA] disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Homepage Content'}
          </button>
        </div>
      )}

      {/* ABOUT US EDITOR */}
      {tab === 'about' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              Who We Are
            </label>
            <textarea
              rows={4}
              value={about.whoWeAre}
              onChange={(e) => setAbout({ ...about, whoWeAre: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              What We Do Introduction
            </label>
            <textarea
              rows={2}
              value={about.whatWeDoIntro}
              onChange={(e) =>
                setAbout({ ...about, whatWeDoIntro: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              Commitment Title
            </label>
            <input
              type="text"
              value={about.commitmentTitle}
              onChange={(e) =>
                setAbout({ ...about, commitmentTitle: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              Commitment Statement
            </label>
            <textarea
              rows={3}
              value={about.commitmentBody}
              onChange={(e) =>
                setAbout({ ...about, commitmentBody: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => saveSection('about', about)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#123B72] text-white text-sm font-semibold hover:bg-[#1769AA] disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save About Us Content'}
          </button>
        </div>
      )}

      {/* VISION EDITOR */}
      {tab === 'vision' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              Main Vision Heading
            </label>
            <input
              type="text"
              value={vision.mainHeading}
              onChange={(e) =>
                setVision({ ...vision, mainHeading: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              Our Vision Statement
            </label>
            <textarea
              rows={3}
              value={vision.visionStatement}
              onChange={(e) =>
                setVision({ ...vision, visionStatement: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              Our Mission Statement
            </label>
            <textarea
              rows={3}
              value={vision.missionStatement}
              onChange={(e) =>
                setVision({ ...vision, missionStatement: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              Our Goals (one per line)
            </label>
            <textarea
              rows={6}
              value={vision.goals.join('\n')}
              onChange={(e) =>
                setVision({
                  ...vision,
                  goals: e.target.value.split('\n').filter((g) => g.trim()),
                })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              Future Commitment Closing Text
            </label>
            <textarea
              rows={3}
              value={vision.futureCommitmentBody}
              onChange={(e) =>
                setVision({ ...vision, futureCommitmentBody: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => saveSection('vision', vision)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#123B72] text-white text-sm font-semibold hover:bg-[#1769AA] disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Vision & Mission'}
          </button>
        </div>
      )}

      {/* ANNOUNCEMENTS */}
      {tab === 'announcements' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddAnnouncement}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h3 className="font-display text-base font-bold text-[#123B72]">
              Publish Website Announcement
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={newAnnTitle}
                  onChange={(e) => setNewAnnTitle(e.target.value)}
                  placeholder="e.g. 2026 First Term CBT Schedule"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Target Page
                </label>
                <select
                  value={newAnnTarget}
                  onChange={(e) => setNewAnnTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  <option value="all">All Public Pages</option>
                  <option value="home">Homepage Only</option>
                  <option value="cbt">CBT Page Only</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Announcement Message
              </label>
              <input
                type="text"
                required
                value={newAnnMsg}
                onChange={(e) => setNewAnnMsg(e.target.value)}
                placeholder="Write a concise notice for schools and students..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#E83E8C] text-white text-sm font-semibold hover:bg-[#d1327c]"
            >
              <Plus className="w-4 h-4" />
              Publish Announcement
            </button>
          </form>

          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
            {announcements.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                No announcements created yet.
              </p>
            ) : (
              announcements.map((a) => (
                <div
                  key={a.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-[#123B72] text-sm">
                      {a.title}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        · {a.targetPage} · {a.isActive ? 'Visible' : 'Hidden'}
                      </span>
                    </p>
                    <p className="text-sm text-slate-600">{a.message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleAnnouncement(a)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-50"
                    >
                      {a.isActive ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAnnouncement(a.id)}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                      title="Delete announcement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* NAVIGATION VISIBILITY */}
      {tab === 'navigation' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <h3 className="font-display text-base font-bold text-[#123B72]">
            Manage Public Navigation Links
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                { key: 'showHome', label: 'Show HOME link' },
                { key: 'showAbout', label: 'Show ABOUT US link' },
                { key: 'showCbt', label: 'Show CBT link' },
                { key: 'showContact', label: 'Show CONTACT link' },
                { key: 'showVision', label: 'Show VISION link' },
              ] as const
            ).map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-3 p-3.5 rounded-lg border border-slate-200 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={navigation[item.key]}
                  onChange={(e) =>
                    setNavigation({
                      ...navigation,
                      [item.key]: e.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-[#123B72]"
                />
                <span className="text-sm font-medium text-[#1E293B]">
                  {item.label}
                </span>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => saveSection('navigation', navigation)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#123B72] text-white text-sm font-semibold hover:bg-[#1769AA] disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            Save Navigation Settings
          </button>
        </div>
      )}

      {/* BRANDING, LOGO, COLOURS & FOOTER */}
      {tab === 'branding' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={branding.companyName}
                onChange={(e) =>
                  setBranding({ ...branding, companyName: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Navbar Logo Text
              </label>
              <input
                type="text"
                value={branding.logoText}
                onChange={(e) =>
                  setBranding({ ...branding, logoText: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              Official Logo Image (Optional URL or Upload)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={branding.logoImageUrl}
                onChange={(e) =>
                  setBranding({ ...branding, logoImageUrl: e.target.value })
                }
                placeholder="Leave blank to use geometric JG brand crest"
                className="flex-1 min-w-[220px] px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
              <label className="px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer hover:bg-slate-50">
                Upload Logo File
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileUpload}
                  className="hidden"
                />
              </label>
              {branding.logoImageUrl && (
                <button
                  type="button"
                  onClick={() => setBranding({ ...branding, logoImageUrl: '' })}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Reset to Default Crest
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(
              [
                { key: 'deepBlue', label: 'Deep Blue' },
                { key: 'professionalBlue', label: 'Blue' },
                { key: 'pink', label: 'Pink Accent' },
                { key: 'gold', label: 'Gold' },
                { key: 'cyan', label: 'Cyan' },
              ] as const
            ).map((c) => (
              <div
                key={c.key}
                className="p-3 rounded-lg border border-slate-200 space-y-1.5"
              >
                <label className="block text-xs font-medium text-slate-600">
                  {c.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={branding[c.key]}
                    onChange={(e) =>
                      setBranding({ ...branding, [c.key]: e.target.value })
                    }
                    className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                  />
                  <span className="font-mono-tabular text-xs text-slate-700">
                    {branding[c.key]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              Brand Message
            </label>
            <input
              type="text"
              value={branding.brandMessage}
              onChange={(e) =>
                setBranding({ ...branding, brandMessage: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Footer Description
              </label>
              <textarea
                rows={2}
                value={branding.footerDescription}
                onChange={(e) =>
                  setBranding({
                    ...branding,
                    footerDescription: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Copyright Notice
              </label>
              <input
                type="text"
                value={branding.copyrightText}
                onChange={(e) =>
                  setBranding({ ...branding, copyrightText: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => saveSection('branding', branding)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#123B72] text-white text-sm font-semibold hover:bg-[#1769AA] disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            Save Branding & Colours
          </button>
        </div>
      )}

      {/* CONTACT INFO & SOCIAL LINKS */}
      {tab === 'contact' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Official Phone Number
              </label>
              <input
                type="text"
                value={contact.phonePlaceholder}
                onChange={(e) =>
                  setContact({ ...contact, phonePlaceholder: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Official Email Address
              </label>
              <input
                type="text"
                value={contact.emailPlaceholder}
                onChange={(e) =>
                  setContact({ ...contact, emailPlaceholder: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              Official Office Address
            </label>
            <input
              type="text"
              value={contact.officeAddressPlaceholder}
              onChange={(e) =>
                setContact({
                  ...contact,
                  officeAddressPlaceholder: e.target.value,
                })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              WhatsApp Link (https://wa.me/...)
            </label>
            <input
              type="url"
              value={contact.whatsappPlaceholder}
              onChange={(e) =>
                setContact({ ...contact, whatsappPlaceholder: e.target.value })
              }
              placeholder="https://wa.me/234..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Facebook URL
              </label>
              <input
                type="url"
                value={contact.facebookUrl}
                onChange={(e) =>
                  setContact({ ...contact, facebookUrl: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Instagram URL
              </label>
              <input
                type="url"
                value={contact.instagramUrl}
                onChange={(e) =>
                  setContact({ ...contact, instagramUrl: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                LinkedIn URL
              </label>
              <input
                type="url"
                value={contact.linkedinUrl}
                onChange={(e) =>
                  setContact({ ...contact, linkedinUrl: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                X (Twitter) URL
              </label>
              <input
                type="url"
                value={contact.xUrl}
                onChange={(e) =>
                  setContact({ ...contact, xUrl: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => saveSection('contact', contact)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#123B72] text-white text-sm font-semibold hover:bg-[#1769AA] disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            Save Contact Information
          </button>
        </div>
      )}
    </div>
  );
}
