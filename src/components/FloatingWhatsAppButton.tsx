import { useSiteData } from '../context/SiteContext.tsx';

const FALLBACK_WHATSAPP_URL = 'https://wa.me/2348066445275';

function buildSafeWhatsAppUrl(rawUrl: string): string {
  const defaultMessage =
    'Hello JAIMAN GOLDENLITE TECH LTD, I would like to enquire about your CBT solutions.';

  const parseSafe = (candidate: string): URL | null => {
    const trimmed = candidate.trim();
    if (!trimmed) return null;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };

  const targetUrl =
    parseSafe(rawUrl) ?? new URL(FALLBACK_WHATSAPP_URL);

  if (!targetUrl.searchParams.has('text')) {
    targetUrl.searchParams.set('text', defaultMessage);
  }
  return targetUrl.toString();
}

export function FloatingWhatsAppButton() {
  const { siteData } = useSiteData();
  const href = buildSafeWhatsAppUrl(siteData.contact.whatsappPlaceholder);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with JAIMAN GOLDENLITE TECH LTD on WhatsApp (+2348066445275)"
      title="Chat on WhatsApp (08066445275)"
      className="fixed bottom-5 right-5 z-40 no-print inline-flex items-center gap-2.5 h-12 px-4 sm:px-5 rounded-full bg-[#25D366] hover:bg-[#1EBE5D] text-white font-semibold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123B72] focus-visible:ring-offset-2 whitespace-nowrap shrink-0"
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-5 h-5 shrink-0"
        aria-hidden="true"
      >
        <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.49 0 .14 5.35.14 11.92c0 2.1.55 4.15 1.59 5.96L0 24l6.29-1.65a11.87 11.87 0 0 0 5.77 1.47h.01c6.57 0 11.92-5.35 11.92-11.92 0-3.18-1.24-6.17-3.47-8.42ZM12.06 21.8h-.01a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.73.98 1-3.64-.24-.37a9.86 9.86 0 0 1-1.52-5.26C2.17 6.46 6.6 2.03 12.06 2.03c2.64 0 5.12 1.03 6.98 2.9a9.8 9.8 0 0 1 2.9 6.98c0 5.46-4.44 9.89-9.88 9.89Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.8.37-.27.3-1.05 1.03-1.05 2.5s1.07 2.9 1.22 3.1c.15.2 2.11 3.22 5.11 4.52.71.31 1.27.49 1.71.63.72.23 1.37.2 1.89.12.58-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35Z" />
      </svg>
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
