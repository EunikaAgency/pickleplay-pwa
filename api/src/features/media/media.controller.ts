import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Media } from './media.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(process.env.MEDIA_PATH || path.join(__dirname, '../../../uploads'));
const MAX_SIZE = parseInt(process.env.MEDIA_MAX_SIZE || '10485760', 10);
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const CDN_URL = process.env.CDN_URL || '';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const uploadQuery = z.object({
  ownerType: z.enum(['venue', 'court', 'coach', 'tournament', 'event', 'post', 'user', 'review', 'club', 'claim']).optional(),
  ownerId: z.string().optional(),
});

export async function uploadMedia(c: any) {
  const user = c.get('user');
  const query = uploadQuery.parse(c.req.query());

  const formData = await c.req.raw.formData().catch(() => null);
  if (!formData) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid form data' } }, 400);
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'No file provided (field name: "file")' } }, 400);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({
      error: { code: 'INVALID_FILE_TYPE', message: `File type "${file.type}" not allowed. Accepted: ${ALLOWED_TYPES.join(', ')}` },
    }, 400);
  }

  if (file.size > MAX_SIZE) {
    return c.json({
      error: { code: 'FILE_TOO_LARGE', message: `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum of ${(MAX_SIZE / 1024 / 1024).toFixed(1)}MB` },
    }, 413);
  }

  const ext = path.extname(file.name) || '.jpg';
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filepath, buffer);

  const url = CDN_URL ? `${CDN_URL.replace(/\/$/, '')}/uploads/${filename}` : `/uploads/${filename}`;

  const result = await Media.create({
    ownerType: query.ownerType || null,
    ownerId: query.ownerId || null,
    url,
    altText: file.name,
    isPrimary: false,
    uploadedBy: user.sub,
    width: null,
    height: null,
    fileSize: buffer.length,
    mimeType: file.type,
  });

  return c.json({ data: result.toObject() }, 201);
}

export async function getMedia(c: any) {
  const id = c.req.param('id');
  const row = await Media.findById(id).lean();
  if (!row) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Media not found' } }, 404);
  }
  return c.json({ data: { ...row, id: row._id } });
}
