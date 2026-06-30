import { z } from 'zod';
import { AppSettings } from './settings.model.js';
import { hasPermission } from '../../shared/lib/permissions.js';

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

function publicShape(s: { paymentTestMode?: boolean; serviceFeePercent?: number } | null) {
  return {
    paymentTestMode: s?.paymentTestMode ?? true,
    serviceFeePercent: s?.serviceFeePercent ?? 7,
    testCard: TEST_CARD,
  };
}

/** Public read — any client (app/web checkout) needs to know test vs live and the fee. */
export async function getSettings(c: any) {
  const s = await getSingleton();
  return c.json({ data: publicShape(s) });
}

const updateSchema = z.object({
  paymentTestMode: z.boolean().optional(),
  serviceFeePercent: z.number().min(0).max(100).optional(),
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
  const s = await AppSettings.findOneAndUpdate(
    { key: 'global' },
    update,
    { new: true, upsert: true },
  ).lean();
  return c.json({ data: publicShape(s) });
}
