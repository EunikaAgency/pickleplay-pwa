import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Chip } from '../../../shared/components/ui/Chip';
import { Segmented } from '../../../shared/components/ui/Segmented';
import {
  listCourts,
  createCourt,
  updateCourt,
  deleteCourt,
  uploadCourtMedia,
  apiImageUrl,
  entityId,
  ApiError,
  type OwnerCourt,
} from '../../../shared/lib/api';
import { WeeklyHoursEditor } from '../components/WeeklyHoursEditor';

interface CourtsEditorTabProps {
  venueId: string;
  reload: () => void;
}

// Compare two photo-gallery arrays for the dirty check.
const sameUrls = (a: string[], b: string[]) => a.length === b.length && a.every((u, i) => u === b[i]);

const MAX_GALLERY = 8;

// Multi-sport: the sport a court is set up for. Unset on a court → Pickleball
// (the product default), so the picker always shows a selection.
const DEFAULT_SPORT = 'Pickleball';
const SPORTS = [DEFAULT_SPORT, 'Tennis', 'Badminton', 'Padel', 'Basketball', 'Volleyball'];

// Court-profile pickers — single-choice chips (tap again to clear), stored as
// the chosen string so the value still reads well on the public court page.
const FLOOR_TYPES = ['Wood', 'Professional'];
const BALL_TYPES = ['Indoor', 'Outdoor'];

/** Map a boolean "requires approval" toggle to the court's stored approvalMode. */
const toMode = (on: boolean) => on ? 'manual' : 'auto';
const fromMode = (m?: string | null) => m === 'manual';

// `flat` renders the editor always-expanded with no collapse header (used when
// the row is embedded on its own, e.g. inside the court detail popup) — Delete
// moves into the footer since the header (which normally holds it) is gone.
export function CourtRow({ court, onSaved, onDeleted, flat = false }: { court: OwnerCourt; onSaved: (c: OwnerCourt) => void; onDeleted: (id: string) => void; flat?: boolean }) {
  const id = entityId(court);
  // The court number is auto-assigned and never edited here — it's only the
  // stable id bookings reference + the fallback label for an unnamed court.
  const courtNumber = court.courtNumber || '';
  const [courtName, setCourtName] = useState(court.courtName || '');
  const [description, setDescription] = useState(court.description || '');
  const [surfaceType, setSurfaceType] = useState(court.surfaceType || '');
  const [indoor, setIndoor] = useState(!!court.indoor);
  const [isActive, setIsActive] = useState(court.isActive !== false);
  // Multi-sport + half-court config (see the "Court configuration" block below).
  const [sport, setSport] = useState(court.sport || DEFAULT_SPORT);
  const [isSplittable, setIsSplittable] = useState(!!court.isSplittable);
  const [splitCount, setSplitCount] = useState(court.splitCount ?? 2);
  // Per-court booking policy: approval override + a turnover gap between bookings.
  const [requiresApproval, setRequiresApproval] = useState(fromMode(court.approvalMode));
  const [turnoverMinutes, setTurnoverMinutes] = useState(court.turnoverMinutes ? String(court.turnoverMinutes) : '');
  // ── Court features ── owner-described physical attributes shown on the court page.
  const [hasAircon, setHasAircon] = useState(!!court.hasAircon);
  const [highCeiling, setHighCeiling] = useState(!!court.highCeiling);
  const [hasRefreshmentStand, setHasRefreshmentStand] = useState(!!court.hasRefreshmentStand);
  const [spaceAroundCourt, setSpaceAroundCourt] = useState(court.spaceAroundCourt || '');
  const [floorType, setFloorType] = useState(court.floorType || '');
  const [ballType, setBallType] = useState(court.ballType || '');
  const [mainImageUrl, setMainImageUrl] = useState(court.mainImageUrl || '');
  const [gallery, setGallery] = useState<string[]>(court.galleryImageUrls ?? []);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [busy, setBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');
  const [photoStatus, setPhotoStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [photoErr, setPhotoErr] = useState('');
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // In `flat` mode the editor is always open (no collapse header).
  const isOpen = flat || expanded;
  // Which tab of the expanded editor is showing. Defaults to the details form;
  // the Hours tab mounts its editor lazily (see below).
  const [tab, setTab] = useState<'info' | 'gallery'>('info');
  // The gallery photo currently open in the full-screen preview (null = closed).
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    setStatus('saving');
    try {
      // Blank rate clears the override (null) → this court falls back to the venue rate.
      const updated = await updateCourt(id, {
        courtName: courtName.trim(),
        description: description.trim(),
        surfaceType: surfaceType || undefined,
        indoor,
        isActive,
        sport,
        isSplittable,
        splitCount,
        approvalMode: toMode(requiresApproval),
        turnoverMinutes: turnoverMinutes.trim() === '' ? 0 : Number(turnoverMinutes),
        hasAircon,
        highCeiling,
        hasRefreshmentStand,
        spaceAroundCourt: spaceAroundCourt.trim(),
        floorType,
        ballType,
        mainImageUrl,
        galleryImageUrls: gallery,
      });
      setStatus('saved');
      onSaved(updated);
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1800);
    } catch {
      setStatus('error');
    }
  };

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoStatus('uploading');
    setPhotoErr('');
    try {
      const media = await uploadCourtMedia(id, file);
      if (media?.url) { setMainImageUrl(media.url); setStatus('idle'); }
      setPhotoStatus('idle');
    } catch (err) {
      setPhotoStatus('error');
      setPhotoErr(err instanceof ApiError && err.status === 413 ? 'That file is too large (max 10MB).' : 'Upload failed. Try again.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Gallery photos beyond the cover — upload each picked file and append its URL.
  const onPickGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_GALLERY - gallery.length);
    if (files.length === 0) return;
    setGalleryBusy(true);
    setPhotoErr('');
    try {
      for (const file of files) {
        const media = await uploadCourtMedia(id, file);
        const url = media?.url;
        if (url) { setGallery((g) => (g.length < MAX_GALLERY ? [...g, url] : g)); setStatus('idle'); }
      }
    } catch (err) {
      setPhotoStatus('error');
      setPhotoErr(err instanceof ApiError && err.status === 413 ? 'That file is too large (max 10MB).' : 'Upload failed. Try again.');
    } finally {
      setGalleryBusy(false);
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const removeGalleryPhoto = (url: string) => { setGallery((g) => g.filter((u) => u !== url)); setStatus('idle'); };

  const remove = async () => {
    setBusy(true);
    setDeleteErr('');
    try {
      await deleteCourt(id);
      onDeleted(id);
    } catch (err) {
      // The API blocks deleting a court that still has current/upcoming bookings
      // (409 COURT_HAS_BOOKINGS) so they aren't orphaned — surface that message
      // instead of silently no-op'ing.
      setDeleteErr(
        err instanceof ApiError && err.message ? err.message : 'Could not delete this court. Try again.',
      );
      setBusy(false);
    }
  };

  const dirty =
    courtName !== (court.courtName || '') ||
    description !== (court.description || '') ||
    surfaceType !== (court.surfaceType || '') ||
    indoor !== !!court.indoor ||
    isActive !== (court.isActive !== false) ||
    sport !== (court.sport || DEFAULT_SPORT) ||
    isSplittable !== !!court.isSplittable ||
    splitCount !== (court.splitCount ?? 2) ||
    requiresApproval !== fromMode(court.approvalMode) ||
    turnoverMinutes !== (court.turnoverMinutes ? String(court.turnoverMinutes) : '') ||
    hasAircon !== !!court.hasAircon ||
    highCeiling !== !!court.highCeiling ||
    hasRefreshmentStand !== !!court.hasRefreshmentStand ||
    spaceAroundCourt !== (court.spaceAroundCourt || '') ||
    floorType !== (court.floorType || '') ||
    ballType !== (court.ballType || '') ||
    mainImageUrl !== (court.mainImageUrl || '') ||
    !sameUrls(gallery, court.galleryImageUrls ?? []);

  // Collapsed-row summary (what the owner sees before expanding). Sport shows
  // only when it isn't the default, so single-sport venues stay uncluttered.
  const summary = [sport && sport !== DEFAULT_SPORT ? sport : null, indoor ? 'Indoor' : null, surfaceType || null].filter(Boolean).join(' · ');

  return (
    <>
    <div className={flat ? '' : 'card'}>
      {/* Header — always visible; tap to expand the editor (accordion). Uses the
          shared .card style (visible border + shadow) so each court reads as a
          clearly separate card, matching the "Add a court" card above. Hidden in
          `flat` mode (the embedding surface provides its own title/close). */}
      {!flat && (
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex-1 min-w-0 flex items-center gap-3 p-3 text-left"
        >
          <div className="h-11 w-11 rounded-[10px] overflow-hidden bg-[var(--surface-2)] shrink-0 flex items-center justify-center">
            {mainImageUrl ? (
              <img src={apiImageUrl(mainImageUrl)} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <span className="font-heading font-bold text-[var(--primary)] text-[15px]">{courtNumber}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[14px] text-[var(--ink)] truncate flex items-center gap-2">
              {courtName || `Court ${courtNumber}`}
              {!isActive && <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)] bg-[var(--surface-2)] rounded px-1.5 py-0.5">Hidden</span>}
            </div>
            <div className="t-sm text-[var(--muted)] truncate">{summary || 'Tap to add photos, hours & details'}</div>
          </div>
          {dirty && <span className="w-2 h-2 rounded-full bg-[var(--coral)] shrink-0" title="Unsaved changes" />}
          <Icon name="chevron" size={16} className={`text-[var(--muted)] shrink-0 ${expanded ? 'rotate-90 transition-transform' : 'transition-transform'}`} />
        </button>
        {/* Delete lives in the header (a clear, labeled action) only while the card
            is open — so the collapsed list stays a clean, scannable set of rows. */}
        {expanded && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            aria-label={`Delete court ${courtNumber}`}
            className="shrink-0 mr-3 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-[13px] font-bold text-[var(--coral)] border-[0.5px] border-[var(--hairline)] hover:border-[var(--coral)] disabled:opacity-50"
          >
            <Icon name="trash" size={15} /> {busy ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
      )}

      {isOpen && (
      <div className={`pb-3 pt-3 space-y-3 ${flat ? '' : 'px-3 border-t-[0.5px] border-[var(--hairline)]'}`}>
      <Segmented
        options={[
          { value: 'info', label: 'Court Info' },
          { value: 'gallery', label: 'Gallery' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* ── Court Information ── thumbnail, name, rate, surface, description + flags */}
      {tab === 'info' && (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="field p-0! shrink-0">
            <label className="lbl">Thumbnail</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={photoStatus === 'uploading'}
              aria-label={`Set thumbnail for court ${courtNumber}`}
              className="relative h-28 w-28 overflow-hidden rounded-[8px] border border-[var(--muted)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--muted)] disabled:opacity-60"
            >
              {mainImageUrl ? (
                <img src={apiImageUrl(mainImageUrl)} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <Icon name="camera" size={22} />
              )}
              {photoStatus === 'uploading' && <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-[10px] font-bold">…</span>}
            </button>
            {mainImageUrl && photoStatus !== 'uploading' && (
              <button type="button" onClick={() => { setMainImageUrl(''); setStatus('idle'); }} className="mt-1 t-sm text-[var(--muted)] hover:text-[var(--coral)] font-semibold">Remove</button>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="field p-0!">
              <label className="lbl">Name <span className="text-[var(--muted)] font-semibold">· Court {courtNumber}</span></label>
              <input className="control" value={courtName} maxLength={120} onChange={(e) => { setCourtName(e.target.value); setStatus('idle'); }} placeholder={`Court ${courtNumber}`} />
            </div>
            <div className="field p-0! flex-1 min-w-0">
                <label className="lbl">Surface</label>
                <input className="control" value={surfaceType} maxLength={50} onChange={(e) => { setSurfaceType(e.target.value); setStatus('idle'); }} placeholder="hard, wood…" />
              </div>
          </div>
        </div>
        {photoStatus === 'error' && <div className="t-sm text-[var(--coral)] font-bold">{photoErr}</div>}

        <div className="field p-0!">
          <label className="lbl">Description (optional)</label>
          <textarea className="control min-h-[64px] py-2 leading-snug" value={description} maxLength={1000} rows={2} onChange={(e) => { setDescription(e.target.value); setStatus('idle'); }} placeholder="What makes this court worth booking — lighting, view, net quality…" />
        </div>

        <div className="field p-0!">
          <label className="lbl">Court type</label>
          <div className="flex flex-wrap items-center gap-2">
            <Chip selected={indoor} onClick={() => { setIndoor(true); setStatus('idle'); }}>{indoor && <Icon name="check" size={12} />} Indoor</Chip>
            <Chip selected={!indoor} onClick={() => { setIndoor(false); setStatus('idle'); }}>{!indoor && <Icon name="check" size={12} />} Outdoor</Chip>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip selected={isActive} onClick={() => { setIsActive((v) => !v); setStatus('idle'); }}>{isActive && <Icon name="check" size={12} />} Active</Chip>
        </div>

        {/* ── Court features ── owner-described physical attributes shown on the public
            court page. The thumbnail + gallery above are the "Picture" part of it. */}
        <div className="space-y-3 border-t-[0.5px] border-[var(--hairline)] pt-3">
          <label className="lbl">Features</label>
          <div className="flex flex-wrap items-center gap-2">
            <Chip selected={hasAircon} onClick={() => { setHasAircon((v) => !v); setStatus('idle'); }}>{hasAircon && <Icon name="check" size={12} />} Aircon</Chip>
            <Chip selected={highCeiling} onClick={() => { setHighCeiling((v) => !v); setStatus('idle'); }}>{highCeiling && <Icon name="check" size={12} />} High ceiling</Chip>
            <Chip selected={hasRefreshmentStand} onClick={() => { setHasRefreshmentStand((v) => !v); setStatus('idle'); }}>{hasRefreshmentStand && <Icon name="check" size={12} />} Refreshment stand</Chip>
          </div>
          <div className="field p-0!">
            <label className="lbl">Court floor</label>
            <div className="flex flex-wrap items-center gap-2">
              {FLOOR_TYPES.map((f) => (
                <Chip key={f} selected={floorType === f} onClick={() => { setFloorType((v) => (v === f ? '' : f)); setStatus('idle'); }}>
                  {floorType === f && <Icon name="check" size={12} />} {f}
                </Chip>
              ))}
            </div>
          </div>
          <div className="field p-0!">
            <label className="lbl">Ball type</label>
            <div className="flex flex-wrap items-center gap-2">
              {BALL_TYPES.map((b) => (
                <Chip key={b} selected={ballType === b} onClick={() => { setBallType((v) => (v === b ? '' : b)); setStatus('idle'); }}>
                  {ballType === b && <Icon name="check" size={12} />} {b}
                </Chip>
              ))}
            </div>
          </div>
          <div className="field p-0! w-40">
            <label className="lbl">Space around court</label>
            <input className="control" value={spaceAroundCourt} maxLength={30} onChange={(e) => { setSpaceAroundCourt(e.target.value); setStatus('idle'); }} placeholder="e.g. 3m" />
          </div>
        </div>

        {/* ── Court configuration ── which sport this court is set up for (multi-sport
            venues mix these), and whether it can be split into bookable half-courts. */}
        <div className="space-y-3 border-t-[0.5px] border-[var(--hairline)] pt-3">
          <div className="field p-0!">
            <label className="lbl">Sport</label>
            <div className="flex flex-wrap items-center gap-2">
              {SPORTS.map((s) => (
                <Chip key={s} selected={sport === s} onClick={() => { setSport(s); setStatus('idle'); }}>
                  {sport === s && <Icon name="check" size={12} />} {s}
                </Chip>
              ))}
            </div>
          </div>
          <div className="field p-0!">
            <div className="flex flex-wrap items-center gap-2">
              <Chip selected={isSplittable} onClick={() => { setIsSplittable((v) => !v); setStatus('idle'); }}>
                {isSplittable && <Icon name="check" size={12} />} Splittable into half-courts
              </Chip>
            </div>
            {isSplittable && (
              <div className="mt-2.5">
                <label className="lbl">Number of units</label>
                <Segmented
                  options={[{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]}
                  value={String(splitCount)}
                  onChange={(v) => { setSplitCount(Number(v)); setStatus('idle'); }}
                />
              </div>
            )}
            <p className="t-sm text-[var(--muted)] mt-1">Let this court be booked as separate half-courts.</p>
          </div>
        </div>

        {/* ── Booking policy ── per-court toggle, plus an optional turnover gap
            kept free between bookings on this court. */}
        <div className="space-y-3 bg-[var(--surface-2)] rounded-xl p-3">
          <div className="field p-0!">
            <label className="lbl">Booking approval</label>
            <div className="flex flex-wrap items-center gap-2">
              <Chip selected={requiresApproval} onClick={() => { setRequiresApproval((v) => !v); setStatus('idle'); }}>
                {requiresApproval && <Icon name="check" size={12} />}
                Require my approval
              </Chip>
            </div>
            <p className="t-sm text-[var(--muted)] mt-1">
              {requiresApproval
                ? 'You approve each booking on this court before the player pays.'
                : 'Bookings on this court confirm instantly.'}
            </p>
          </div>
          <div className="field p-0! w-40">
            <label className="lbl">Turnover gap (min)</label>
            <input
              className="control"
              inputMode="numeric"
              value={turnoverMinutes}
              maxLength={3}
              onChange={(e) => { setTurnoverMinutes(e.target.value.replace(/[^\d]/g, '')); setStatus('idle'); }}
              placeholder="0"
            />
            <p className="t-sm text-[var(--muted)] mt-1">Free time kept after each booking before the next can start.</p>
          </div>
        </div>
      </div>
      )}

      {/* ── Gallery ── additional photos beyond the cover thumbnail. A square
          grid; tap any photo to preview it full-screen, or ✕ to remove it. */}
      {tab === 'gallery' && (
      <div className="field p-0!">
        <label className="lbl">Photos {gallery.length > 0 && <span className="text-[var(--muted)] font-semibold">· {gallery.length}/{MAX_GALLERY}</span>}</label>
        <input ref={galleryRef} type="file" accept="image/*" multiple onChange={onPickGallery} className="hidden" />
        {gallery.length === 0 ? (
          // Empty state — one inviting drop-zone instead of a lone "+" square.
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={galleryBusy}
            aria-label={`Add photos to court ${courtNumber}`}
            className="w-full rounded-xl border border-dashed border-[var(--field-border)] bg-[var(--surface-2)] py-8 flex flex-col items-center justify-center gap-2 text-[var(--muted)] disabled:opacity-60"
          >
            <Icon name="camera" size={26} />
            <span className="t-sm font-semibold text-[var(--ink)]">{galleryBusy ? 'Uploading…' : 'Add photos'}</span>
            <span className="text-[11px]">Show off this court — up to {MAX_GALLERY} photos</span>
          </button>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {gallery.map((url) => (
              <div key={url} className="relative aspect-square">
                {/* Tap the photo → full-screen preview. */}
                <button
                  type="button"
                  onClick={() => setLightbox(apiImageUrl(url))}
                  aria-label="Preview photo"
                  className="block h-full w-full overflow-hidden rounded-xl border-[0.5px] border-[var(--hairline)] bg-[var(--surface-2)]"
                >
                  <img src={apiImageUrl(url)} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </button>
                {/* Remove — sits just outside the photo so it's never clipped. */}
                <button
                  type="button"
                  onClick={() => removeGalleryPhoto(url)}
                  aria-label="Remove photo"
                  className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full bg-[var(--ink)] text-white inline-flex items-center justify-center shadow-md ring-2 ring-[var(--surface)]"
                >
                  <Icon name="close" size={11} />
                </button>
              </div>
            ))}
            {gallery.length < MAX_GALLERY && (
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                disabled={galleryBusy}
                aria-label={`Add photos to court ${courtNumber}`}
                className="aspect-square rounded-xl border border-dashed border-[var(--field-border)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--muted)] disabled:opacity-60"
              >
                {galleryBusy ? <span className="text-[11px] font-bold">…</span> : <Icon name="plus" size={20} />}
              </button>
            )}
          </div>
        )}
        {photoStatus === 'error' && <div className="t-sm text-[var(--coral)] font-bold mt-2">{photoErr}</div>}
      </div>
      )}

      {/* Card-level Save — shown on any tab whenever there are unsaved changes.
          (Delete lives in the card header, except in `flat` mode where the header
          is hidden, so Delete is added to this footer instead.) */}
      {(dirty || flat) && (
        <div className="flex items-center gap-2 border-t-[0.5px] border-[var(--hairline)] pt-3">
          {flat && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              aria-label={`Delete court ${courtNumber}`}
              className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-2xl text-[13px] font-bold text-[var(--coral)] border-[0.5px] border-[var(--hairline)] hover:border-[var(--coral)] disabled:opacity-50"
            >
              <Icon name="trash" size={15} /> {busy ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <div className="flex-1" />
          {dirty && (
            <button type="button" onClick={save} disabled={status === 'saving'} className="h-10 px-4 rounded-2xl bg-[var(--primary)] text-white font-bold text-[13px] disabled:opacity-60">
              {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save'}
            </button>
          )}
        </div>
      )}
      {status === 'error' && <div className="t-sm text-[var(--coral)] font-bold">Couldn't save. Try again.</div>}
      {deleteErr && <div role="alert" className="t-sm text-[var(--coral)] font-bold mt-2">{deleteErr}</div>}
      </div>
      )}
    </div>

    {/* Full-screen photo preview — tap the backdrop or ✕ to close. */}
    {lightbox && (
      <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
        <button type="button" aria-label="Close preview" onClick={() => setLightbox(null)} className="absolute top-[calc(12px+env(safe-area-inset-top))] right-4 w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center">
          <Icon name="close" size={18} />
        </button>
        <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
      </div>
    )}
    </>
  );
}

export function CourtsEditorTab({ venueId, reload }: CourtsEditorTabProps) {
  const [courts, setCourts] = useState<OwnerCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [newName, setNewName] = useState('');
  const [newSurface, setNewSurface] = useState('');
  const [newIndoor, setNewIndoor] = useState(false);
  const [newSport, setNewSport] = useState(DEFAULT_SPORT);
  const [newRequiresApproval, setNewRequiresApproval] = useState(false);
  const [newTurnover, setNewTurnover] = useState('');
  // Court-profile attributes, settable at creation (mirrors the per-court editor).
  const [newHasAircon, setNewHasAircon] = useState(false);
  const [newHighCeiling, setNewHighCeiling] = useState(false);
  const [newHasRefreshmentStand, setNewHasRefreshmentStand] = useState(false);
  const [newSpaceAroundCourt, setNewSpaceAroundCourt] = useState('');
  const [newFloorType, setNewFloorType] = useState('');
  const [newBallType, setNewBallType] = useState('');
  const [addExpanded, setAddExpanded] = useState(false);
  const [addStatus, setAddStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;
    listCourts(venueId)
      .then((d) => {
        if (cancelled) return;
        setCourts(d);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  // The court number is the stable id bookings reference + the fallback label,
  // but it's fully auto — the owner never sees or types it. Always the next free
  // number so sequential adds don't collide.
  const nextNumber = Math.max(
    courts.reduce((m, c) => {
      const n = parseInt((c.courtNumber || '').replace(/\D/g, ''), 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0),
    courts.length,
  ) + 1;

  const onAdd = async () => {
    if (addStatus === 'saving') return;
    setAddStatus('saving');
    try {
      const created = await createCourt(venueId, { courtNumber: String(nextNumber), courtName: newName.trim() || undefined, surfaceType: newSurface || undefined, indoor: newIndoor, sport: newSport, approvalMode: toMode(newRequiresApproval), turnoverMinutes: newTurnover.trim() === '' ? 0 : Number(newTurnover), hasAircon: newHasAircon, highCeiling: newHighCeiling, hasRefreshmentStand: newHasRefreshmentStand, spaceAroundCourt: newSpaceAroundCourt.trim() || undefined, floorType: newFloorType || undefined, ballType: newBallType || undefined });
      setCourts((c) => [...c, created]);
      setNewName('');
      setNewSurface('');
      setNewIndoor(false);
      setNewSport(DEFAULT_SPORT);
      setNewRequiresApproval(false);
      setNewTurnover('');
      setNewHasAircon(false);
      setNewHighCeiling(false);
      setNewHasRefreshmentStand(false);
      setNewSpaceAroundCourt('');
      setNewFloorType('');
      setNewBallType('');
      setAddStatus('idle');
      reload();
    } catch {
      setAddStatus('error');
    }
  };

  const onSaved = (updated: OwnerCourt) => {
    setCourts((list) => list.map((c) => (entityId(c) === entityId(updated) ? { ...c, ...updated } : c)));
    reload();
  };
  const onDeleted = (id: string) => {
    setCourts((list) => list.filter((c) => entityId(c) !== id));
    reload();
  };

  return (
    <div className="courts-editor space-y-4">
      <div className="card">
        {/* Collapsible header — tap to expand the "Add a court" form. */}
        <button
          type="button"
          onClick={() => setAddExpanded((v) => !v)}
          aria-expanded={addExpanded}
          className="flex-1 min-w-0 flex items-center gap-3 p-3 text-left w-full"
        >
          <span className="w-8 h-8 rounded-[10px] bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <Icon name="plus" size={16} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[14px] text-[var(--ink)]">Add a court</div>
            <div className="t-sm text-[var(--muted)] truncate">Name it — it'll be "Court {nextNumber}" until you do.</div>
          </div>
          <Icon name="chevron" size={16} className={`text-[var(--muted)] shrink-0 ${addExpanded ? 'rotate-90 transition-transform' : 'transition-transform'}`} />
        </button>

        {addExpanded && (
        <div className="px-3 pb-3 pt-3 space-y-3 border-t-[0.5px] border-[var(--hairline)]">
        <div className="field p-0! mb-3">
          <label className="lbl">Name (optional)</label>
          <input className="control" value={newName} maxLength={120} onChange={(e) => setNewName(e.target.value)} placeholder={`e.g. Center Court (or leave blank for "Court ${nextNumber}")`} />
        </div>
        <div className="flex gap-3 mb-3">
          <div className="field p-0! flex-1">
            <label className="lbl">Surface</label>
            <input className="control" value={newSurface} maxLength={50} onChange={(e) => setNewSurface(e.target.value)} placeholder="hard, wood…" />
          </div>
        </div>
        <div className="field p-0! mb-3">
          <label className="lbl">Sport</label>
          <div className="flex flex-wrap items-center gap-2">
            {SPORTS.map((s) => (
              <Chip key={s} selected={newSport === s} onClick={() => setNewSport(s)}>
                {newSport === s && <Icon name="check" size={12} />} {s}
              </Chip>
            ))}
          </div>
        </div>
        <div className="field p-0! mb-3">
          <label className="lbl">Court type</label>
          <div className="flex flex-wrap items-center gap-2">
            <Chip selected={newIndoor} onClick={() => setNewIndoor(true)}>{newIndoor && <Icon name="check" size={12} />} Indoor</Chip>
            <Chip selected={!newIndoor} onClick={() => setNewIndoor(false)}>{!newIndoor && <Icon name="check" size={12} />} Outdoor</Chip>
          </div>
        </div>
        {/* ── Court features ── the same physical attributes the per-court editor
            exposes, so they can be set at creation instead of re-opening the court. */}
        <div className="field p-0! mb-3">
          <label className="lbl">Features</label>
          <div className="flex flex-wrap items-center gap-2">
            <Chip selected={newHasAircon} onClick={() => setNewHasAircon((v) => !v)}>{newHasAircon && <Icon name="check" size={12} />} Aircon</Chip>
            <Chip selected={newHighCeiling} onClick={() => setNewHighCeiling((v) => !v)}>{newHighCeiling && <Icon name="check" size={12} />} High ceiling</Chip>
            <Chip selected={newHasRefreshmentStand} onClick={() => setNewHasRefreshmentStand((v) => !v)}>{newHasRefreshmentStand && <Icon name="check" size={12} />} Refreshment stand</Chip>
          </div>
        </div>
        <div className="field p-0! mb-3">
          <label className="lbl">Court floor</label>
          <div className="flex flex-wrap items-center gap-2">
            {FLOOR_TYPES.map((f) => (
              <Chip key={f} selected={newFloorType === f} onClick={() => setNewFloorType((v) => (v === f ? '' : f))}>
                {newFloorType === f && <Icon name="check" size={12} />} {f}
              </Chip>
            ))}
          </div>
        </div>
        <div className="field p-0! mb-3">
          <label className="lbl">Ball type</label>
          <div className="flex flex-wrap items-center gap-2">
            {BALL_TYPES.map((b) => (
              <Chip key={b} selected={newBallType === b} onClick={() => setNewBallType((v) => (v === b ? '' : b))}>
                {newBallType === b && <Icon name="check" size={12} />} {b}
              </Chip>
            ))}
          </div>
        </div>
        <div className="field p-0! w-40 mb-3">
          <label className="lbl">Space around court</label>
          <input className="control" value={newSpaceAroundCourt} maxLength={30} onChange={(e) => setNewSpaceAroundCourt(e.target.value)} placeholder="e.g. 3m" />
        </div>
        {/* Per-court booking policy: a simple toggle — settable at creation. */}
        <div className="space-y-3 bg-[var(--surface-2)] rounded-xl p-3 mb-3">
          <div className="field p-0!">
            <label className="lbl">Booking approval</label>
            <div className="flex flex-wrap items-center gap-2">
              <Chip selected={newRequiresApproval} onClick={() => setNewRequiresApproval((v) => !v)}>
                {newRequiresApproval && <Icon name="check" size={12} />}
                Require my approval
              </Chip>
            </div>
            <p className="t-sm text-[var(--muted)] mt-1">
              {newRequiresApproval
                ? 'You approve each booking on this court before the player pays.'
                : 'Bookings on this court confirm instantly.'}
            </p>
          </div>
          <div className="field p-0! w-40">
            <label className="lbl">Turnover gap (min)</label>
            <input
              className="control"
              inputMode="numeric"
              value={newTurnover}
              maxLength={3}
              onChange={(e) => setNewTurnover(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="0"
            />
            <p className="t-sm text-[var(--muted)] mt-1">Free time kept after each booking before the next can start.</p>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onAdd} disabled={addStatus === 'saving'} className="h-12 px-5 rounded-2xl bg-[var(--primary)] text-white font-heading font-semibold text-[15px] disabled:opacity-60">
            {addStatus === 'saving' ? 'Adding…' : 'Add court'}
          </button>
        </div>
        {addStatus === 'error' && <div className="t-sm text-[var(--coral)] font-bold mt-2">Couldn't add. Try again.</div>}
        </div>
        )}
      </div>

      {/* Courts — a plain label, with each court as its own standalone accordion
          card (no longer nested inside one big "Courts" section card). */}
      <div>
        <div className="flex items-center gap-2.5 mb-2.5 px-1">
          <span className="w-8 h-8 rounded-[10px] bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <Icon name="paddle" size={16} />
          </span>
          <div className="hd-3">Courts</div>
          <span className="t-sm text-[var(--muted)] ml-auto">{loading ? 'Loading…' : `${courts.length} court${courts.length === 1 ? '' : 's'}`}</span>
        </div>
        {error ? (
          <div className="card p-4 t-sm text-[var(--coral)]">Couldn't load courts.</div>
        ) : loading ? (
          <div className="card p-4 t-sm">Loading courts…</div>
        ) : courts.length === 0 ? (
          <div className="card p-4 t-sm">No courts yet. Add your first court above so players know your capacity.</div>
        ) : (
          <div className="space-y-3">
            {courts.map((c) => (
              <CourtRow key={entityId(c)} court={c} onSaved={onSaved} onDeleted={onDeleted} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
