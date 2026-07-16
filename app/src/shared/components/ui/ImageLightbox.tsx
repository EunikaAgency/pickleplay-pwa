import { useEffect, useState } from 'react';
import { Icon } from './Icon';

interface ImageLightboxProps {
  /** Absolute image URLs (already wrapped with apiImageUrl). */
  images: string[];
  /** Index of the image to open at. */
  startIndex?: number;
  onClose: () => void;
}

/**
 * Full-screen image preview. Tap the backdrop or ✕ to close; with multiple
 * images, ‹ › (and ←/→ keys) page between them. Mirrors the club-feed lightbox
 * but shared so any feed/post surface can reuse it.
 */
export function ImageLightbox({ images, startIndex = 0, onClose }: ImageLightboxProps) {
  const [i, setI] = useState(startIndex);
  const many = images.length > 1;
  const go = (d: number) => setI((prev) => (prev + d + images.length) % images.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (many && e.key === 'ArrowLeft') go(-1);
      else if (many && e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [many, images.length]);

  if (!images.length) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      // stopPropagation: the lightbox may be mounted inside a clickable post card
      // (the feed list), so a backdrop tap must not also open the post permalink.
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-[calc(12px+env(safe-area-inset-top))] right-4 w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center"
      >
        <Icon name="close" size={20} />
      </button>

      {many && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center"
          >
            <Icon name="back" size={22} />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center"
          >
            <Icon name="forward" size={22} />
          </button>
          <div className="absolute bottom-[calc(16px+env(safe-area-inset-bottom))] left-0 right-0 text-center text-white/80 text-[13px] font-semibold">
            {i + 1} / {images.length}
          </div>
        </>
      )}

      <img
        src={images[i]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-lg"
      />
    </div>
  );
}
