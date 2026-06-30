import { z } from 'zod';
import { Tag } from './tags.model.js';

const listTagsQuery = z.object({ type: z.string().optional() });

export async function listTags(c: any) {
  const { type } = listTagsQuery.parse(c.req.query());
  const filter = type ? { tagType: type } : {};
  const rows = await Tag.find(filter).sort({ displayName: 1 }).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}
