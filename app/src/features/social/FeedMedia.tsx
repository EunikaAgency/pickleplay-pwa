import { useState } from 'react';
import { apiImageUrl, type FeedAttachment } from '../../shared/lib/api';
import { ImageLightbox } from '../../shared/components/ui/ImageLightbox';

/**
 * Renders a post/comment's uploaded photos + GIFs. One image fills the width; two
 * or more tile into a square-ish grid. GIFs render exactly like photos (they're
 * animated image files — no separate player). Tapping any image opens a
 * full-screen preview (lightbox) with ‹ › paging between the post's images.
 */
export function FeedMedia({ media, compact }: { media: FeedAttachment[]; compact?: boolean }) {
  const [preview, setPreview] = useState<number | null>(null);
  if (!media.length) return null;
  const cols = media.length === 1 ? 1 : 2;
  const urls = media.map((m) => apiImageUrl(m.url));

  return (
    <>
      <div
        className={`${compact ? 'mt-1.5' : 'mt-2.5'} grid gap-1.5 rounded-2xl overflow-hidden`}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {media.map((m, i) => (
          <figure key={`${m.url}-${i}`} className="relative m-0 w-full h-full">
            {/* stopPropagation so tapping the image previews it instead of opening the post permalink. */}
            <button
              type="button"
              aria-label={m.type === 'gif' ? 'View GIF' : 'View photo'}
              onClick={(e) => { e.stopPropagation(); setPreview(i); }}
              className="block w-full h-full"
            >
              <img
                src={urls[i]}
                alt={m.title || (m.type === 'gif' ? 'GIF' : 'Photo')}
                loading="lazy"
                className="w-full h-full object-cover border border-[var(--border)]"
                style={{ maxHeight: media.length === 1 ? 420 : 220, aspectRatio: media.length === 1 ? undefined : '1 / 1' }}
              />
            </button>
            {m.title && (
              <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 px-2.5 py-1.5 text-[12px] font-semibold text-white bg-gradient-to-t from-black/70 to-transparent line-clamp-2">
                {m.title}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {preview != null && (
        <ImageLightbox images={urls} startIndex={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
}
