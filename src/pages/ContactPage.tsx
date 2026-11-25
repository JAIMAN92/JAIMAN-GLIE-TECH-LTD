import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
} from 'lucide-react';
import { useSiteData } from '../context/SiteContext.tsx';
import { PublicLayout } from '../components/PublicLayout.tsx';

export function ContactPage() {
  const { siteData } = useSiteData();
  const { contact } = siteData;

  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fallbackMailtoUrl, setFallbackMailtoUrl] = useState('');
  const [recipientEmail, setRecipientEmail] = useState(
    'jaimangoldenlitetechltd@gmail.com'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setFallbackMailtoUrl('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (
      fullName.trim().length < 2 ||
      organizationName.trim().length < 2 ||
      !emailRegex.test(email.trim()) ||
      phone.trim().length < 6 ||
      subject.trim().length < 3 ||
      message.trim().length < 10
    ) {
      setErrorMsg(
        'Please complete all required fields with a valid email address, phone number, and message (minimum 10 characters).'
      );
      return;
    }

    const submittedSnapshot = {
      fullName: fullName.trim(),
      organizationName: organizationName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      subject: subject.trim(),
      message: message.trim(),
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...submittedSnapshot,
          website_url: honeypot,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Unable to send your message.');
      } else {
        const targetEmail =
          typeof data.recipientEmail === 'string' &&
          data.recipientEmail.includes('@')
            ? data.recipientEmail
            : 'jaimangoldenlitetechltd@gmail.com';
        setRecipientEmail(targetEmail);
        setSuccessMsg(
          data.message ||
            `Your enquiry has been submitted successfully for ${targetEmail}.`
        );

        if (!data.emailDelivered) {
          const mailtoSubject = encodeURIComponent(
            `[Website Enquiry] ${submittedSnapshot.subject} — ${submittedSnapshot.organizationName}`
          );
          const mailtoBody = encodeURIComponent(
            [
              `Full Name: ${submittedSnapshot.fullName}`,
              `School / Organization: ${submittedSnapshot.organizationName}`,
              `Email Address: ${submittedSnapshot.email}`,
              `Phone Number: ${submittedSnapshot.phone}`,
              '',
              'Message:',
              submittedSnapshot.message,
            ].join('\n')
          );
          setFallbackMailtoUrl(
            `mailto:${targetEmail}?subject=${mailtoSubject}&body=${mailtoBody}`
          );
        }

        setFullName('');
        setOrganizationName('');
        setEmail('');
        setPhone('');
        setSubject('');
        setMessage('');
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const safeExternalUrl = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString();
      }
      return null;
    } catch {
      return null;
    }
  };

  const whatsappHref = safeExternalUrl(contact.whatsappPlaceholder);

  const socialLinks = [
    { label: 'Facebook', url: safeExternalUrl(contact.facebookUrl) },
    { label: 'Instagram', url: safeExternalUrl(contact.instagramUrl) },
    { label: 'LinkedIn', url: safeExternalUrl(contact.linkedinUrl) },
    { label: 'X (Twitter)', url: safeExternalUrl(contact.xUrl) },
  ].filter((s): s is { label: string; url: string } => Boolean(s.url));

  return (
    <PublicLayout pageKey="contact">
      {/* Header */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18 space-y-4">
          <p className="text-xs font-semibold tracking-widest text-[#E83E8C] uppercase">
            Contact Us
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#123B72] max-w-4xl text-balance leading-tight">
            {contact.heading}
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
            {contact.supportingText}
          </p>
        </div>
      </section>

      {/* Form & Contact Info */}
      <section className="py-14 lg:py-18 bg-[#F5F8FC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Contact Form */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold text-[#123B72] mb-6">
              Send an Enquiry
            </h2>

            {errorMsg && (
              <div
                role="alert"
                className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="mb-6 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm space-y-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-700" />
                  <span>{successMsg}</span>
                </div>
                {fallbackMailtoUrl && (
                  <div className="pl-7">
                    <a
                      href={fallbackMailtoUrl}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#123B72] hover:text-[#1769AA] underline underline-offset-4"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Also send directly via your email app to {recipientEmail}
                    </a>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Anti-spam honeypot field */}
              <div className="hidden" aria-hidden="true">
                <label htmlFor="website_url">Website URL</label>
                <input
                  id="website_url"
                  name="website_url"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-sm font-medium text-[#1E293B] mb-1.5"
                  >
                    Full Name <span className="text-[#E83E8C]">*</span>
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1769AA] focus:border-[#1769AA]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="organizationName"
                    className="block text-sm font-medium text-[#1E293B] mb-1.5"
                  >
                    School / Organization Name{' '}
                    <span className="text-[#E83E8C]">*</span>
                  </label>
                  <input
                    id="organizationName"
                    type="text"
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="Enter school or organization"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1769AA] focus:border-[#1769AA]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-[#1E293B] mb-1.5"
                  >
                    Email Address <span className="text-[#E83E8C]">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@school.edu.ng"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1769AA] focus:border-[#1769AA]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-[#1E293B] mb-1.5"
                  >
                    Phone Number <span className="text-[#E83E8C]">*</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1769AA] focus:border-[#1769AA]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="subject"
                  className="block text-sm font-medium text-[#1E293B] mb-1.5"
                >
                  Subject of Enquiry <span className="text-[#E83E8C]">*</span>
                </label>
                <input
                  id="subject"
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., School CBT Onboarding, Demonstration Request"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1769AA] focus:border-[#1769AA]"
                />
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-[#1E293B] mb-1.5"
                >
                  Message <span className="text-[#E83E8C]">*</span>
                </label>
                <textarea
                  id="message"
                  rows={5}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us about your school's examination needs..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1769AA] focus:border-[#1769AA]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg bg-[#E83E8C] text-white font-semibold text-sm tracking-wide hover:bg-[#d1327c] disabled:opacity-60 transition-colors"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'SUBMITTING...' : 'SUBMIT MESSAGE'}
              </button>
            </form>
          </div>

          {/* Official Contact Placeholders (Editable in Admin Settings) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#123B72] text-white rounded-xl p-6 sm:p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-widest text-[#D4AF37] uppercase">
                  Official Channels
                </p>
                <h2 className="font-display text-xl font-bold">
                  Contact Information
                </h2>
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-[#E83E8C] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-300">Official Phone Number</p>
                    {contact.phonePlaceholder &&
                    !contact.phonePlaceholder.startsWith('[') ? (
                      <a
                        href={`tel:${contact.phonePlaceholder.replace(/[^\d+]/g, '')}`}
                        className="font-medium text-white hover:text-[#20C4D8] transition-colors break-words"
                      >
                        {contact.phonePlaceholder}
                      </a>
                    ) : (
                      <p className="font-medium text-white break-words">
                        {contact.phonePlaceholder}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-[#20C4D8] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-300">Official Email Address</p>
                    {contact.emailPlaceholder &&
                    contact.emailPlaceholder.includes('@') &&
                    !contact.emailPlaceholder.startsWith('[') ? (
                      <a
                        href={`mailto:${contact.emailPlaceholder.trim()}`}
                        className="font-medium text-white hover:text-[#20C4D8] transition-colors break-all"
                      >
                        {contact.emailPlaceholder}
                      </a>
                    ) : (
                      <p className="font-medium text-white break-words">
                        {contact.emailPlaceholder}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-300">Location</p>
                    <p className="font-medium text-white break-words">
                      {contact.officeAddressPlaceholder}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-[#20C4D8] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-300">WhatsApp Contact</p>
                    {whatsappHref ? (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#20C4D8] hover:underline"
                      >
                        Chat via WhatsApp
                      </a>
                    ) : (
                      <p className="font-medium text-slate-200">
                        [WhatsApp Contact Link — Editable in Admin Settings]
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-white/15 space-y-2.5">
                <p className="text-xs font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#D4AF37]" />
                  Social Media Channels
                </p>
                {socialLinks.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {socialLinks.map((s) => (
                      <a
                        key={s.label}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-white hover:bg-white/20 transition-colors"
                      >
                        {s.label}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-300">
                    [Social Media Links — Editable in Admin Website Settings]
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
