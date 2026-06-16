import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Chip } from '../../../shared/components/ui/Chip';
import { OwnerSection } from '../components/OwnerSection';
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

interface CourtsEditorTabProps {
  venueId: string;
  reload: () => void;
}

function CourtRow({ court, onSaved, onDeleted }: { court: OwnerCourt; onSaved: (c: OwnerCourt) => void; onDeleted: (id: string) => void }) {
  const id = entityId(court);
  const [courtNumber, setCourtNumber] = useState(court.courtNumber || '');
  const [surfaceType, setSurfaceType] = useState(court.surfaceType || '');
  const [indoor, setIndoor] = useState(!!court.indoor);
  const [isActive, setIsActive] = useState(court.isActive !== false);
  const [mainImageUrl, setMainImageUrl] = useState(court.mainImageUrl || '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [busy, setBusy] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [photoErr, setPhotoErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    setStatus('saving');
    try {
      const updated = await updateCourt(id, { courtNumber, surfaceType: surfaceType || undefined, indoor, isActive, mainImageUrl });
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

  const remove = async () => {
    setBusy(true);
    try {
      await deleteCourt(id);
      onDeleted(id);
    } catch {
      setBusy(false);
    }
  };

  const dirty = courtNumber !== (court.courtNumber || '') || surfaceType !== (court.surfaceType || '') || indoor !== !!court.indoor || isActive !== (court.isActive !== false) || mainImageUrl !== (court.mainImageUrl || '');

  return (
    <div className="rounded-xl border-[0.5px] border-[var(--hairline)] p-3 space-y-3">
      <div className="flex items-start gap-3">
        <div className="field p-0! shrink-0">
          <label className="lbl">Photo</label>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={photoStatus === 'uploading'}
            aria-label={`Set photo for court ${courtNumber}`}
            className="relative h-16 w-16 overflow-hidden rounded-xl bg-[var(--surface-2)] flex items-center justify-center text-[var(--muted)] disabled:opacity-60"
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
        <div className="flex-1 flex gap-3">
        <div className="field p-0! w-20">
          <label className="lbl">Court #</label>
          <input className="control" value={courtNumber} maxLength={10} onChange={(e) => { setCourtNumber(e.target.value); setStatus('idle'); }} />
        </div>
        <div className="field p-0! flex-1">
          <label className="lbl">Surface</label>
          <input className="control" value={surfaceType} maxLength={50} onChange={(e) => { setSurfaceType(e.target.value); setStatus('idle'); }} placeholder="hard, wood…" />
        </div>
        </div>
      </div>
      {photoStatus === 'error' && <div className="t-sm text-[var(--coral)] font-bold">{photoErr}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <Chip selected={indoor} onClick={() => { setIndoor((v) => !v); setStatus('idle'); }}>{indoor && <Icon name="check" size={12} />} Indoor</Chip>
        <Chip selected={isActive} onClick={() => { setIsActive((v) => !v); setStatus('idle'); }}>{isActive && <Icon name="check" size={12} />} Active</Chip>
        <div className="flex-1" />
        {dirty && (
          <button type="button" onClick={save} disabled={status === 'saving'} className="h-10 px-4 rounded-2xl bg-[var(--primary)] text-white font-bold text-[13px] disabled:opacity-60">
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save'}
          </button>
        )}
        <button type="button" onClick={remove} disabled={busy} aria-label={`Delete court ${courtNumber}`} className="w-10 h-10 rounded-2xl flex items-center justify-center text-[var(--muted)] hover:text-[var(--coral)] disabled:opacity-50">
          <Icon name="close" size={18} />
        </button>
      </div>
      {status === 'error' && <div className="t-sm text-[var(--coral)] font-bold">Couldn't save. Try again.</div>}
    </div>
  );
}

export function CourtsEditorTab({ venueId, reload }: CourtsEditorTabProps) {
  const [courts, setCourts] = useState<OwnerCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [newNumber, setNewNumber] = useState('');
  const [newSurface, setNewSurface] = useState('');
  const [newIndoor, setNewIndoor] = useState(false);
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

  const onAdd = async () => {
    if (!newNumber.trim()) return;
    setAddStatus('saving');
    try {
      const created = await createCourt(venueId, { courtNumber: newNumber.trim(), surfaceType: newSurface || undefined, indoor: newIndoor });
      setCourts((c) => [...c, created]);
      setNewNumber('');
      setNewSurface('');
      setNewIndoor(false);
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
    <div className="space-y-4">
      <OwnerSection title="Add a court" icon="plus">
        <div className="flex gap-3 mb-3">
          <div className="field p-0! w-24">
            <label className="lbl">Court #</label>
            <input className="control" value={newNumber} maxLength={10} onChange={(e) => setNewNumber(e.target.value)} placeholder="1" />
          </div>
          <div className="field p-0! flex-1">
            <label className="lbl">Surface</label>
            <input className="control" value={newSurface} maxLength={50} onChange={(e) => setNewSurface(e.target.value)} placeholder="hard, wood…" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Chip selected={newIndoor} onClick={() => setNewIndoor((v) => !v)}>{newIndoor && <Icon name="check" size={12} />} Indoor</Chip>
          <div className="flex-1" />
          <button type="button" onClick={onAdd} disabled={!newNumber.trim() || addStatus === 'saving'} className="h-12 px-5 rounded-2xl bg-[var(--primary)] text-white font-heading font-semibold text-[15px] disabled:opacity-60">
            {addStatus === 'saving' ? 'Adding…' : 'Add court'}
          </button>
        </div>
        {addStatus === 'error' && <div className="t-sm text-[var(--coral)] font-bold mt-2">Couldn't add. Try again.</div>}
      </OwnerSection>

      <OwnerSection title="Courts" icon="paddle" description={loading ? 'Loading…' : `${courts.length} court${courts.length === 1 ? '' : 's'}`}>
        {error ? (
          <div className="t-sm text-[var(--coral)]">Couldn't load courts.</div>
        ) : loading ? (
          <div className="t-sm">Loading courts…</div>
        ) : courts.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">No courts yet. Add your first court above so players know your capacity.</div>
        ) : (
          <div className="space-y-3">
            {courts.map((c) => (
              <CourtRow key={entityId(c)} court={c} onSaved={onSaved} onDeleted={onDeleted} />
            ))}
          </div>
        )}
      </OwnerSection>
    </div>
  );
}
