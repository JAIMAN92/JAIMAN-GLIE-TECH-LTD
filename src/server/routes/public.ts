import { Router } from 'express';
import { asc, desc, eq } from 'drizzle-orm';
import { db, getDatabaseUrl, withDbRetry } from '../../db/index.ts';
import {
  announcements,
  classArms,
  contactEnquiries,
  siteSettings,
} from '../../db/schema.ts';
import {
  DEFAULT_ABOUT,
  DEFAULT_BRANDING,
  DEFAULT_CONTACT,
  DEFAULT_HOMEPAGE,
  DEFAULT_NAVIGATION,
  DEFAULT_VISION,
} from '../../shared/defaults.ts';
import { isValidEmail } from '../crypto.ts';
import { sendContactEnquiryEmail } from '../email.ts';
import { ensureSeeded } from '../seed.ts';
import { getSupabaseAdmin } from '../supabase.ts';

const router = Router();

// Simple in-memory IP rate limiter for public contact form (max 5 submissions per 15 mins)
const contactRateMap = new Map<string, number[]>();

router.get('/site-data', async (_req, res) => {
  try {
    let rows = await withDbRetry(() => db.select().from(siteSettings));
    if (rows.length < 6) {
      await ensureSeeded();
      rows = await withDbRetry(() => db.select().from(siteSettings));
    }

    const activeAnnouncements = await withDbRetry(() =>
      db
        .select()
        .from(announcements)
        .where(eq(announcements.isActive, true))
        .orderBy(desc(announcements.createdAt))
    );

    const activeClassArms = await withDbRetry(() =>
      db
        .select({
          id: classArms.id,
          classLevel: classArms.classLevel,
          armName: classArms.armName,
          displayName: classArms.displayName,
        })
        .from(classArms)
        .where(eq(classArms.isActive, true))
        .orderBy(asc(classArms.classLevel), asc(classArms.armName))
    );

    // Deduplicate classLevel + armName pairs for clean public display
    const seenClassArm = new Set<string>();
    const uniqueClassArms = activeClassArms.filter((item) => {
      const key = `${item.classLevel.toUpperCase()}::${item.armName.toUpperCase()}`;
      if (seenClassArm.has(key)) return false;
      seenClassArm.add(key);
      return true;
    });

    const map = new Map<string, unknown>();
    for (const row of rows) {
      map.set(row.sectionKey, row.content);
    }

    res.json({
      homepage: map.get('homepage') ?? DEFAULT_HOMEPAGE,
      about: map.get('about') ?? DEFAULT_ABOUT,
      vision: map.get('vision') ?? DEFAULT_VISION,
      branding: map.get('branding') ?? DEFAULT_BRANDING,
      contact: map.get('contact') ?? DEFAULT_CONTACT,
      navigation: map.get('navigation') ?? DEFAULT_NAVIGATION,
      announcements: activeAnnouncements,
      classArms: uniqueClassArms,
    });
  } catch (error) {
    console.error('Failed to load site data:', error);
    res.status(500).json({ error: 'Unable to load website content.' });
  }
});

router.post('/contact', async (req, res) => {
  try {
    const {
      fullName,
      organizationName,
      email,
      phone,
      subject,
      message,
      website_url, // Honeypot field (must be empty)
    } = req.body ?? {};

    // Silent anti-spam honeypot check
    if (typeof website_url === 'string' && website_url.trim().length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Thank you. Your enquiry has been received.',
      });
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const now = Date.now();
    const recent = (contactRateMap.get(ip) ?? []).filter(
      (ts) => now - ts < 15 * 60 * 1000
    );
    if (recent.length >= 5) {
      return res.status(429).json({
        error:
          'Too many enquiries sent recently. Please wait a few minutes before submitting again.',
      });
    }

    if (
      typeof fullName !== 'string' ||
      fullName.trim().length < 2 ||
      typeof organizationName !== 'string' ||
      organizationName.trim().length < 2 ||
      typeof email !== 'string' ||
      !isValidEmail(email) ||
      typeof phone !== 'string' ||
      phone.trim().length < 6 ||
      typeof subject !== 'string' ||
      subject.trim().length < 3 ||
      typeof message !== 'string' ||
      message.trim().length < 10
    ) {
      return res.status(400).json({
        error:
          'Please complete all required fields with a valid email address, phone number, and message (at least 10 characters).',
      });
    }

    const cleanFullName = fullName.trim().slice(0, 120);
    const cleanOrg = organizationName.trim().slice(0, 160);
    const cleanEmail = email.trim().toLowerCase().slice(0, 160);
    const cleanPhone = phone.trim().slice(0, 40);
    const cleanSubject = subject.trim().slice(0, 200);
    const cleanMessage = message.trim().slice(0, 4000);

    await db.insert(contactEnquiries).values({
      fullName: cleanFullName,
      organizationName: cleanOrg,
      email: cleanEmail,
      phone: cleanPhone,
      subject: cleanSubject,
      message: cleanMessage,
      ipAddress: ip.slice(0, 64),
    });

    if (!getDatabaseUrl()) {
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        const { error: sbError } = await supabaseAdmin
          .from('contact_enquiries')
          .insert({
            full_name: cleanFullName,
            organization_name: cleanOrg,
            email: cleanEmail,
            phone: cleanPhone,
            subject: cleanSubject,
            message: cleanMessage,
            ip_address: ip.slice(0, 64),
          });
        if (sbError) {
          console.warn('Supabase contact enquiry sync skipped:', sbError.message);
        }
      }
    }

    const [contactSettingRow] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.sectionKey, 'contact'))
      .limit(1);
    const configuredEmail = (
      contactSettingRow?.content as { emailPlaceholder?: string } | undefined
    )?.emailPlaceholder;

    const emailResult = await sendContactEnquiryEmail({
      fullName: cleanFullName,
      organizationName: cleanOrg,
      email: cleanEmail,
      phone: cleanPhone,
      subject: cleanSubject,
      message: cleanMessage,
      recipientEmail: configuredEmail,
    });

    recent.push(now);
    contactRateMap.set(ip, recent);

    res.status(201).json({
      success: true,
      emailDelivered: emailResult.delivered,
      recipientEmail: emailResult.recipientEmail,
      message: emailResult.delivered
        ? `Thank you for contacting JAIMAN GOLDENLITE TECH LTD. Your enquiry has been sent to ${emailResult.recipientEmail} and recorded for our team.`
        : `Thank you for contacting JAIMAN GOLDENLITE TECH LTD. Your enquiry has been saved for ${emailResult.recipientEmail} and our team will respond shortly.`,
    });
  } catch (error) {
    console.error('Contact enquiry submission error:', error);
    res.status(500).json({
      error: 'Unable to submit your message right now. Please try again later.',
    });
  }
});

export default router;
