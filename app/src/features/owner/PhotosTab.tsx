import { useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { OwnerSection } from './OwnerSection';
import { uploadVenueMedia, ApiError, type OwnerVenueDetail } from '../../shared/lib/api';

interface PhotosTabProps {
  venue: OwnerVenueDetail;
  venueId: string;
  reload: () => void;
}

// Photo management is partly blocked on the API: there's no owner endpoint to set
// the hero, reorder, or delete gallery images. So this shows current photos and
// supports uploading new ones, with an honest notice about the gap (same as web).
export function PhotosTab({ venue, venueId, reload }: PhotosTabProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const hero = venue.image || null;
  const gallery = venue.gallery ?? [];

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('uploading');
    setErrMsg('');
    try {
      const media = await uploadVenueMedia(venueId, file);
      if (media?.url) setUploads((u) => [media.url as string, ...u]);
      setStatus('done');
      reload();
    } catch (err) {
      setStatus('error');
      setErrMsg(err instanceof ApiError && err.status === 413 ? 'That file is too large (max 10MB).' : 'Upload failed. Try again.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <OwnerSection title="Hero photo" icon="camera" description="The main image on your public listing.">
        {hero ? (
          <img src={hero} alt="" className="h-48 w-full rounded-xl object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <div className="flex h-36 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--muted)]">
            <Icon name="camera" size={36} />
          </div>
        )}
      </OwnerSection>

      <OwnerSection title="Gallery" icon="layers" description={`${gallery.length} photo${gallery.length === 1 ? '' : 's'} on your listing`}>
        {gallery.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">No gallery photos yet.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {gallery.map((src) => (
              <img key={src} src={src} alt="" className="aspect-video w-full rounded-xl object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            ))}
          </div>
        )}
      </OwnerSection>

      <OwnerSection title="Upload photos" icon="plus">
        <div className="rounded-xl border-2 border-dashed border-[var(--hairline)] p-6 text-center">
          <Icon name="camera" size={32} className="text-[var(--muted)] mx-auto" />
          <div className="mt-2 t-sm">JPEG, PNG, WebP, GIF or AVIF · up to 10MB</div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" id="owner-photo-upload" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={status === 'uploading'}
            className="mt-3 h-11 px-5 rounded-2xl bg-[var(--primary)] text-white font-heading font-semibold text-[15px] disabled:opacity-60"
          >
            {status === 'uploading' ? 'Uploading…' : 'Choose a photo'}
          </button>
          {status === 'error' && <div className="mt-2 t-sm text-[var(--coral)] font-bold">{errMsg}</div>}
        </div>

        {uploads.length > 0 && (
          <div className="mt-4">
            <div className="t-eyebrow">Uploaded this session</div>
            <div className="mt-2 grid grid-cols-3 gap-2.5">
              {uploads.map((src) => (
                <img key={src} src={src} alt="" className="aspect-video w-full rounded-xl object-cover" />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--lime-soft)] px-4 py-3 text-[12px] text-[var(--lime-ink)]">
          <Icon name="help" size={16} className="shrink-0 mt-0.5" />
          <span>
            Uploaded photos are saved to your media library. Setting a new hero image, reordering, or removing gallery
            photos isn't available yet — that's on the roadmap. Need a change now? Contact the PickleBallers team.
          </span>
        </div>
      </OwnerSection>
    </div>
  );
}
