import nodemailer from 'nodemailer';

export interface ContactEnquiryEmailPayload {
  fullName: string;
  organizationName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  recipientEmail?: string;
}

export interface EmailDispatchResult {
  delivered: boolean;
  mode: 'smtp' | 'resend' | 'stored_only';
  recipientEmail: string;
}

const DEFAULT_RECIPIENT = 'jaimangoldenlitetechltd@gmail.com';

function stripHeaderBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendContactEnquiryEmail(
  payload: ContactEnquiryEmailPayload
): Promise<EmailDispatchResult> {
  const envRecipient = process.env.CONTACT_RECIPIENT_EMAIL?.trim();
  const recipientEmail =
    envRecipient && envRecipient.includes('@')
      ? envRecipient
      : payload.recipientEmail &&
          payload.recipientEmail.includes('@') &&
          !payload.recipientEmail.startsWith('[')
        ? payload.recipientEmail.trim()
        : DEFAULT_RECIPIENT;

  const cleanSubject = stripHeaderBreaks(payload.subject).slice(0, 160);
  const cleanName = stripHeaderBreaks(payload.fullName).slice(0, 120);
  const cleanOrg = stripHeaderBreaks(payload.organizationName).slice(0, 160);
  const cleanEmail = stripHeaderBreaks(payload.email).slice(0, 160);
  const cleanPhone = stripHeaderBreaks(payload.phone).slice(0, 40);
  const cleanMessage = payload.message.trim().slice(0, 4000);

  const emailSubject = `[Website Enquiry] ${cleanSubject} — ${cleanOrg}`;
  const textBody = [
    'JAIMAN GOLDENLITE TECH LTD — New Website Contact Enquiry',
    '',
    `Full Name: ${cleanName}`,
    `School / Organization: ${cleanOrg}`,
    `Email Address: ${cleanEmail}`,
    `Phone Number: ${cleanPhone}`,
    `Subject: ${cleanSubject}`,
    '',
    'Message:',
    cleanMessage,
  ].join('\n');

  const htmlBody = `
    <div style="font-family: Poppins, Arial, sans-serif; color: #1E293B; max-width: 640px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #123B72; color: #FFFFFF; padding: 20px 24px;">
        <p style="margin: 0; font-size: 12px; letter-spacing: 0.08em; color: #D4AF37; font-weight: 600;">JAIMAN GOLDENLITE TECH LTD</p>
        <h2 style="margin: 6px 0 0; font-size: 18px;">New Website Contact Enquiry</h2>
      </div>
      <div style="padding: 24px; background-color: #FFFFFF;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #64748B; width: 170px;">Full Name</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(cleanName)}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">School / Organization</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(cleanOrg)}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Email Address</td><td style="padding: 6px 0;">${escapeHtml(cleanEmail)}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Phone Number</td><td style="padding: 6px 0;">${escapeHtml(cleanPhone)}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748B;">Subject</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(cleanSubject)}</td></tr>
        </table>
        <div style="margin-top: 20px; padding: 16px; background-color: #F5F8FC; border-radius: 8px; border: 1px solid #E2E8F0;">
          <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #123B72; text-transform: uppercase;">Message</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(cleanMessage)}</p>
        </div>
      </div>
    </div>
  `;

  // Option 1: SMTP delivery via Nodemailer (e.g., Gmail App Password or custom SMTP)
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  if (smtpUser && smtpPass) {
    try {
      const smtpHost = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
      const smtpPort = Number(process.env.SMTP_PORT) || 465;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"JAIMAN GOLDENLITE TECH LTD Website" <${smtpUser}>`,
        to: recipientEmail,
        replyTo: cleanEmail,
        subject: emailSubject,
        text: textBody,
        html: htmlBody,
      });

      return { delivered: true, mode: 'smtp', recipientEmail };
    } catch (error) {
      console.error('SMTP contact enquiry delivery failed:', error);
    }
  }

  // Option 2: Resend API if configured
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    try {
      const fromAddress =
        process.env.RESEND_FROM_EMAIL?.trim() ||
        'JAIMAN GOLDENLITE TECH LTD <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [recipientEmail],
          reply_to: cleanEmail,
          subject: emailSubject,
          text: textBody,
          html: htmlBody,
        }),
      });

      if (res.ok) {
        return { delivered: true, mode: 'resend', recipientEmail };
      }
      console.error('Resend API contact enquiry delivery failed:', res.status);
    } catch (error) {
      console.error('Resend contact enquiry delivery error:', error);
    }
  }

  return { delivered: false, mode: 'stored_only', recipientEmail };
}
