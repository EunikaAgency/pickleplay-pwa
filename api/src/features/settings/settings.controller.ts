import { z } from 'zod';
import { AppSettings } from './settings.model.js';
import { hasPermission } from '../../shared/lib/permissions.js';
import { sendEmail } from '../../shared/lib/gmail.js';
import {
  welcomeEmail,
  passwordResetEmail,
  passwordChangedEmail,
  emailVerificationEmail,
  bookingConfirmedReceipt,
  bookingRequestedReceipt,
  bookingApprovedReceipt,
  paymentReceipt,
  cancellationReceipt,
  membershipReceipt,
} from '../../shared/lib/email-templates.js';

// The canonical Stripe-style demo card. Surfaced to clients so the app/web
// checkout can pre-fill it when test mode is on. It is never charged.
const TEST_CARD = { number: '4242 4242 4242 4242', expiry: '12/34', cvc: '123' } as const;

/** Read (creating on first access) the singleton settings document. */
async function getSingleton() {
  return AppSettings.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global', paymentTestMode: true } },
    { new: true, upsert: true },
  ).lean();
}

/**
 * Server-side source of truth for "are we in payment test mode?". Imported by
 * the payments checkout handler so both frontends honour the same flag.
 */
export async function isPaymentTestMode(): Promise<boolean> {
  const s = await getSingleton();
  return s?.paymentTestMode ?? true;
}

/** Server-side service-fee percentage (defaults to 7). Imported by callers that
 *  need to compute or validate the fee outside the public settings read. */
export async function getServiceFeePercent(): Promise<number> {
  const s = await getSingleton();
  return s?.serviceFeePercent ?? 7;
}

function publicShape(s: { paymentTestMode?: boolean; serviceFeePercent?: number; emailBccEnabled?: boolean; emailBccAddress?: string } | null) {
  return {
    paymentTestMode: s?.paymentTestMode ?? true,
    serviceFeePercent: s?.serviceFeePercent ?? 7,
    testCard: TEST_CARD,
    emailBccEnabled: s?.emailBccEnabled ?? false,
    emailBccAddress: s?.emailBccAddress ?? 'info@eunika.agency',
  };
}

/** Server-side: should we BCC transactional emails? Imported by the mailer. */
export async function getEmailBcc(): Promise<{ enabled: boolean; address: string } | null> {
  const s = await getSingleton();
  if (s?.emailBccEnabled) {
    return { enabled: true, address: s.emailBccAddress || 'info@eunika.agency' };
  }
  return null;
}

/** Public read — any client (app/web checkout) needs to know test vs live and the fee. */
export async function getSettings(c: any) {
  const s = await getSingleton();
  return c.json({ data: publicShape(s) });
}

const updateSchema = z.object({
  paymentTestMode: z.boolean().optional(),
  serviceFeePercent: z.number().min(0).max(100).optional(),
  emailBccEnabled: z.boolean().optional(),
  emailBccAddress: z.string().email().max(255).optional(),
});

/** Admin-only write of the payment mode + service fee. */
export async function updateSettings(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'admin.settings.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Settings permission required' } }, 403);
  }
  const body = updateSchema.parse(await c.req.json());
  const update: Record<string, unknown> = { updatedBy: user.sub };
  if (body.paymentTestMode !== undefined) update.paymentTestMode = body.paymentTestMode;
  if (body.serviceFeePercent !== undefined) update.serviceFeePercent = body.serviceFeePercent;
  if (body.emailBccEnabled !== undefined) update.emailBccEnabled = body.emailBccEnabled;
  if (body.emailBccAddress !== undefined) update.emailBccAddress = body.emailBccAddress;
  const s = await AppSettings.findOneAndUpdate(
    { key: 'global' },
    update,
    { new: true, upsert: true },
  ).lean();
  return c.json({ data: publicShape(s) });
}

// ── Test Email Tool ──────────────────────────────────────────────────────────

/** Template keys the admin can select in the test-email tool. */
const TEMPLATE_KEYS = [
  'welcome',
  'password-reset',
  'password-changed',
  'email-verification',
  'booking-confirmed',
  'booking-requested',
  'booking-approved',
  'payment-receipt',
  'cancellation',
  'membership',
] as const;

type TemplateKey = (typeof TEMPLATE_KEYS)[number];

const testEmailSchema = z.object({
  email: z.string().email(),
  templates: z.array(z.enum(TEMPLATE_KEYS)).min(1),
});

/**
 * Build a sample payload for each template so the admin can preview the real
 * rendered email in their inbox.
 */
function buildSample(key: TemplateKey): { subject: string; html: string; text: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const fmtTime = (d: Date) => d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });

  switch (key) {
    case 'welcome': {
      const r = welcomeEmail({ name: 'Juan Dela Cruz', role: 'player' });
      return { subject: '[TEST] Welcome to PickleBallers!', ...r };
    }
    case 'password-reset': {
      const r = passwordResetEmail('https://pickleballer-pwa.eunika.xyz/reset-password?token=SAMPLE_TOKEN');
      return { subject: '[TEST] Reset your password', ...r };
    }
    case 'password-changed': {
      const r = passwordChangedEmail();
      return { subject: '[TEST] Your password has been changed', ...r };
    }
    case 'email-verification': {
      const r = emailVerificationEmail('https://pickleballer-pwa.eunika.xyz/verify?token=SAMPLE_TOKEN');
      return { subject: '[TEST] Verify your email', ...r };
    }
    case 'booking-confirmed': {
      const d = new Date(now.getTime() + 7 * 86400000);
      const r = bookingConfirmedReceipt({
        receipt: 'RCPT-TEST-001', venue: 'The Dink Lab', court: 'Court A',
        date: fmt(d), start: fmtTime(d), end: fmtTime(new Date(d.getTime() + 7200000)), hours: 2,
        rate: '₱400', subtotal: '₱800.00', fee: '₱56.00', total: '₱856.00', method: 'Visa ···· 4242',
      });
      return { subject: '[TEST] Booking confirmed — RCPT-TEST-001', ...r };
    }
    case 'booking-requested': {
      const d = new Date(now.getTime() + 7 * 86400000);
      const r = bookingRequestedReceipt({
        receipt: 'RCPT-TEST-002', venue: 'The Dink Lab', court: 'Court B',
        date: fmt(d), start: fmtTime(d), end: fmtTime(new Date(d.getTime() + 3600000)), hours: 1,
        rate: '₱400', estimatedTotal: '₱400.00',
      });
      return { subject: '[TEST] Booking request sent — RCPT-TEST-002', ...r };
    }
    case 'booking-approved': {
      const d = new Date(now.getTime() + 7 * 86400000);
      const deadline = new Date(now.getTime() + 86400000);
      const r = bookingApprovedReceipt({
        receipt: 'RCPT-TEST-003', venue: 'The Dink Lab', court: 'Court C',
        date: fmt(d), start: fmtTime(d), end: fmtTime(new Date(d.getTime() + 5400000)),
        total: '₱600.00', deadline: fmtTime(deadline),
        payUrl: 'https://pickleballer-pwa.eunika.xyz/bookings/TEST003/pay',
      });
      return { subject: '[TEST] Booking approved — RCPT-TEST-003', ...r };
    }
    case 'payment-receipt': {
      const r = paymentReceipt({
        receipt: 'PAY-TEST-001', bookingRef: 'RCPT-TEST-001', venue: 'The Dink Lab',
        date: fmt(now), time: `${fmtTime(now)} – ${fmtTime(new Date(now.getTime() + 7200000))}`,
        subtotal: '₱800.00', fee: '₱56.00', vat: '₱102.72', total: '₱958.72',
        method: 'Visa ···· 4242', paidAt: now.toLocaleString('en-PH'),
      });
      return { subject: '[TEST] Payment receipt — PAY-TEST-001', ...r };
    }
    case 'cancellation': {
      const r = cancellationReceipt({
        receipt: 'RCPT-TEST-004', venue: 'The Dink Lab',
        date: fmt(new Date(now.getTime() + 7 * 86400000)),
        time: `${fmtTime(new Date(now.getTime() + 7 * 86400000))} – ${fmtTime(new Date(now.getTime() + 7 * 86400000 + 3600000))}`,
        refund: '₱400.00', refundStatus: 'Processing',
        cancelledAt: now.toLocaleString('en-PH'),
      });
      return { subject: '[TEST] Booking cancelled — RCPT-TEST-004', ...r };
    }
    case 'membership': {
      const r = membershipReceipt({
        receipt: 'MEM-TEST-001', venue: 'The Dink Lab', plan: 'Monthly Basic',
        cycle: 'Monthly', amount: '₱1,200.00',
        nextBilling: fmt(new Date(now.getTime() + 30 * 86400000)),
        benefits: ['Unlimited open play', 'Priority court booking', '10% off pro shop'],
        method: 'Visa ···· 4242',
      });
      return { subject: '[TEST] Membership confirmed — MEM-TEST-001', ...r };
    }
  }
}

/** Admin-only: send sample emails for the selected templates to a test address. */
export async function sendTestEmail(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'admin.settings.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Settings permission required' } }, 403);
  }

  const body = testEmailSchema.parse(await c.req.json());

  const results: { template: string; messageId: string }[] = [];
  const errors: { template: string; error: string }[] = [];

  for (const key of body.templates) {
    try {
      const { subject, html, text } = buildSample(key);
      const { messageId } = await sendEmail({ to: body.email, subject, body: text, html });
      results.push({ template: key, messageId });
    } catch (err) {
      errors.push({ template: key, error: (err as Error).message });
    }
  }

  const status = errors.length === 0 ? 'ok'
    : results.length === 0 ? 'error'
    : 'partial';

  return c.json({ data: { status, sent: results, errors } });
}
