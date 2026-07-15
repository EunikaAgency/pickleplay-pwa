import fs from 'fs';
import path from 'path';

// Resolved once against the process CWD (api/), matching the serveStatic mounts
// in index.ts (/images/* → ./uploads/images/*, /uploads/* → ./uploads/*).
const UPLOADS_ROOT = path.resolve('uploads');
const IMG_EXT_RE = /\.(jpe?g|png)$/i;

// url → resolved url. One fs.stat per distinct image URL, then O(1).
const cache = new Map<string, string>();

/**
 * Rewrite a local image URL to its `.webp` sibling when one exists on disk.
 *
 * Why a distinct `.webp` URL instead of `Vary: Accept` content-negotiation on
 * the original URL: Cloudflare sits in front of this API and ignores
 * `Vary: Accept` (it only varies on Accept-Encoding), so it caches a single
 * variant per URL — a cached JPEG then gets served to WebP-capable browsers.
 * Serving WebP under its own URL sidesteps that: each URL is one variant the CDN
 * caches correctly. WebP is ~universally supported, so this is safe.
 *
 * External/absolute URLs, non-image paths, and images without a converted
 * sibling pass through unchanged.
 */
export function toWebpUrl(url?: string | null): string {
  if (!url) return url ?? '';
  const cached = cache.get(url);
  if (cached !== undefined) return cached;

  let out = url;
  if ((url.startsWith('/images/') || url.startsWith('/uploads/')) && IMG_EXT_RE.test(url)) {
    const rel = url.startsWith('/images/') ? path.join('uploads', url) : url.replace(/^\/+/, '');
    const disk = path.resolve(rel);
    // Confine to the uploads dir — never let a crafted `..` path escape it.
    if (disk === UPLOADS_ROOT || disk.startsWith(UPLOADS_ROOT + path.sep)) {
      try {
        if (fs.statSync(disk.replace(IMG_EXT_RE, '.webp')).isFile()) {
          out = url.replace(IMG_EXT_RE, '.webp');
        }
      } catch {
        /* no sibling .webp → keep the original URL */
      }
    }
  }

  cache.set(url, out);
  return out;
}
