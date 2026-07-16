import { apiImageUrl, type FeedAttachment } from '../../shared/lib/api';

/**
 * Renders a post/comment's uploaded photos + GIFs. One image fills the width; two
 * or more tile into a square-ish grid. GIFs render exactly like photos (they're
 * animated image files — no separate player).
 */
export function FeedMedia({ media, compact }: { media: FeedAttachment[]; compact?: boolean }) {
  if (!media.length) return null;
  const cols = media.length === 1 ? 1 : 2;
  return (
    <div
      className={`${compact ? 'mt-1.5' : 'mt-2.5'} grid gap-1.5 rounded-2xl overflow-hidden`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {media.map((m, i) => (
        <figure key={`${m.url}-${i}`} className="relative m-0 w-full h-full">
          <img
            src={apiImageUrl(m.url)}
            alt={m.title || (m.type === 'gif' ? 'GIF' : 'Photo')}
            loading="lazy"
            className="w-full h-full object-cover border border-[var(--border)]"
            style={{ maxHeight: media.length === 1 ? 420 : 220, aspectRatio: media.length === 1 ? undefined : '1 / 1' }}
          />
          {m.title && (
            <figcaption className="absolute inset-x-0 bottom-0 px-2.5 py-1.5 text-[12px] font-semibold text-white bg-gradient-to-t from-black/70 to-transparent line-clamp-2">
              {m.title}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
