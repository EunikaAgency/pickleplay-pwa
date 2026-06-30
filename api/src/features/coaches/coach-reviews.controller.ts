import { CoachReview } from './coach-reviews.model.js';

export async function updateCoachReview(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const allowed: Record<string, unknown> = {};
  if (body.rating !== undefined) allowed.rating = body.rating;
  if (body.text !== undefined) allowed.text = body.text;
  if (!Object.keys(allowed).length) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'No valid fields' } }, 400);
  }
  const result = await CoachReview.findOneAndUpdate({ _id: id, userId: user.sub }, allowed, { new: true }).lean();
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'Review not found' } }, 404);
  return c.json({ data: { ...result, id: result._id } });
}

export async function deleteCoachReview(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const result = await CoachReview.findOneAndDelete({ _id: id, userId: user.sub });
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'Review not found' } }, 404);
  return c.json({ data: { message: 'Review deleted' } });
}
