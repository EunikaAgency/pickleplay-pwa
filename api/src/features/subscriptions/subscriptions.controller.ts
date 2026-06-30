import { z } from 'zod';
import { Subscription } from './subscriptions.model.js';

const subscribeSchema = z.object({
  email: z.string().email(),
  source: z.string().max(50).optional(),
});

export async function subscribe(c: any) {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = subscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
  }
  const body = parsed.data;

  const existing = await Subscription.findOne({ email: body.email }).lean();
  if (existing) {
    if (existing.status === 'active') {
      return c.json({ error: { code: 'CONFLICT', message: 'Email is already subscribed' } }, 409);
    }
    const result = await Subscription.findByIdAndUpdate(existing._id, { status: 'active', unsubscribedAt: null }, { new: true }).lean();
    return c.json({ data: { ...result, id: result!._id } });
  }

  const result = await Subscription.create({ email: body.email, source: body.source || null });
  return c.json({ data: result.toObject() }, 201);
}

export async function unsubscribe(c: any) {
  const email = c.req.query('email');
  if (!email) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Email query parameter required' } }, 400);
  }

  const existing = await Subscription.findOne({ email }).lean();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } }, 404);
  }

  await Subscription.findByIdAndUpdate(existing._id, { status: 'unsubscribed', unsubscribedAt: new Date() });
  return c.json({ data: { message: 'Unsubscribed successfully' } });
}
