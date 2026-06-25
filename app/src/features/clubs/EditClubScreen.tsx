import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { getClub, updateClub, uploadClubMedia, apiImageUrl, type ApiClub } from '../../shared/lib/api';

interface EditClubScreenProps {
  clubId: string;
  onBack: () => void;
}

/**
 * Host-only club editor (reached from the club detail ⋯ menu, next to Delete).
 * Loads the club, prefills name/description/visibility, and saves via
 * `PATCH /clubs/:id`. On success we just `onBack()` — the URL-routed nav remounts
 * the club detail screen, which refetches the updated club.
 */
export function EditClubScreen({ clubId, onBack }: EditClubScreenProps) {
  const [status, setStatus] = useState<'loading' | 'error' | 'notfound' | 'forbidden' | 'ready'>('loading');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [coverUrl, setCoverUrl] = useState<string | null>(null); // existing saved cover (raw url)
  const [coverFile, setCoverFile] = useState<File | null>(null); // newly picked, uploaded on save
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [memberLimit, setMemberLimit] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickCover = (file: File | null | undefined) => {
    if (!file) return;
    setCoverFile(file);
    setCoverPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  };
  const removeCover = () => {
    setCoverFile(null);
    setCoverPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setCoverUrl(null);
  };

  useEffect(() => {
    let alive = true;
    getClub(clubId)
      .then((c: ApiClub) => {
        if (!alive) return;
        if (!c.isHost) { setStatus('forbidden'); return; }
        setName(c.name);
        setDescription(c.description ?? '');
        setVisibility(c.visibility);
        setCoverUrl(c.coverImageUrl ?? null);
        setMemberLimit(c.joinLimit != null ? String(c.joinLimit) : '');
        setStatus('ready');
      })
      .catch((e) => {
        if (!alive) return;
        setStatus(e && /404|not found/i.test(String(e.message)) ? 'notfound' : 'error');
      });
    return () => { alive = false; };
  }, [clubId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      let coverImageUrl = coverUrl; // keep existing unless changed/removed
      if (coverFile) {
        const url = await uploadClubMedia(clubId, coverFile);
        if (url) coverImageUrl = url;
      }
      const limit = parseInt(memberLimit, 10);
      await updateClub(clubId, {
        name: name.trim(),
        description: description.trim(),
        visibility,
        coverImageUrl: coverImageUrl ?? '', // '' clears the cover server-side
        joinLimit: memberLimit.trim() === '' ? null : (Number.isFinite(limit) && limit > 0 ? limit : null),
      });
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your changes. Please try again.');
      setSaving(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="scroll safe-top safe-bottom px-4">
        <LoadingSkeleton variant="block" count={1} />
        <div className="mt-3"><LoadingSkeleton variant="card" count={3} /></div>
      </div>
    );
  }
  if (status === 'notfound') {
    return <div className="scroll safe-top safe-bottom"><EmptyState icon="groups" title="Club not found" description="This club may have been removed." action={{ label: 'Back', onPress: onBack }} /></div>;
  }
  if (status === 'forbidden') {
    return <div className="scroll safe-top safe-bottom"><EmptyState icon="lock" title="You can't edit this club" description="Only the club host can edit its details." action={{ label: 'Back', onPress: onBack }} /></div>;
  }
  if (status === 'error') {
    return <div className="scroll safe-top safe-bottom"><ErrorState title="Couldn't load this club" message="We couldn't fetch the club to edit. Tap to retry." onRetry={() => { setStatus('loading'); }} /></div>;
  }

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} backIcon="back" eyebrow="Edit club" title="Club details" />

      <form onSubmit={handleSubmit}>
        <div className="field">
          <div className="lbl">Club name</div>
          <input className="control" placeholder="e.g. Neon Smashers" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        </div>

        <div className="field">
          <div className="lbl">Description</div>
          <textarea className="control" rows={4} placeholder="What's your club about?" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
        </div>

        <div className="field">
          <div className="lbl">Visibility</div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={`time-pick ${visibility === 'public' ? 'active' : ''}`} onClick={() => setVisibility('public')}>🌍 Public</button>
            <button type="button" className={`time-pick ${visibility === 'private' ? 'active' : ''}`} onClick={() => setVisibility('private')}>🔒 Private</button>
          </div>
          <div className="t-sm mt-2 px-1">
            {visibility === 'public' ? 'Anyone can find and join this club.' : 'People request to join; you approve them.'}
          </div>
        </div>

        <div className="field">
          <div className="lbl">Cover photo</div>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => { pickCover(e.target.files?.[0]); e.target.value = ''; }} />
          {(coverPreview || coverUrl) ? (
            <div className="relative">
              <img src={coverPreview ?? apiImageUrl(coverUrl)} alt="" className="w-full h-36 object-cover rounded-xl" />
              <div className="absolute bottom-2 right-2 flex gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 rounded-lg bg-black/55 text-white text-[12px] font-bold">Change</button>
                <button type="button" onClick={removeCover} className="px-3 py-1.5 rounded-lg bg-black/55 text-white text-[12px] font-bold">Remove</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-24 rounded-xl border border-dashed border-[var(--field-border)] text-[var(--muted)] text-[13px] font-semibold">+ Add a cover photo</button>
          )}
        </div>

        <div className="field">
          <div className="lbl">Member limit</div>
          <input className="control" type="number" inputMode="numeric" min={1} placeholder="No limit" value={memberLimit} onChange={(e) => setMemberLimit(e.target.value)} />
          <div className="t-sm mt-2 px-1">Leave blank for unlimited members.</div>
        </div>

        {error && <div className="px-5 mt-3 t-sm text-[var(--coral)] font-bold">{error}</div>}

        <div className="app-action-bar">
          <Button type="submit" fullWidth disabled={!name.trim() || saving}>
            {saving ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={16} /></span> Saving…</> : <><Icon name="check" size={18} /> Save changes</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
