import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/components/ui/Button';
import { Icon } from '../../../shared/components/ui/Icon';
import { ScreenHeader } from '../../../shared/components/ui/ScreenHeader';
import { FormField } from '../../../shared/components/forms/FormField';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import { createTournament, updateTournament, uploadTournamentMedia } from '../../../shared/lib/api';
import type { Navigate } from '../../../shared/lib/navigation';
import { OrganizerSection } from '../components/OrganizerSection';
import { todayYMD } from '../organizerDisplay';

interface CreateTournamentScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

const FORMAT_OPTIONS = [
  { value: 'single_elimination', label: 'Single elimination' },
  { value: 'double_elimination', label: 'Double elimination' },
  { value: 'round_robin', label: 'Round robin' },
  { value: 'pool_play', label: 'Pool play' },
];
const MATCH_FORMAT_OPTIONS = [
  { value: 'bo1', label: 'Best of 1' },
  { value: 'bo3', label: 'Best of 3' },
  { value: 'bo5', label: 'Best of 5' },
];
const TYPE_OPTIONS = [
  { value: 'doubles', label: 'Doubles' },
  { value: 'singles', label: 'Singles' },
  { value: 'mixed', label: 'Mixed doubles' },
];

const empty = {
  name: '', description: '', tournamentType: 'doubles', skillLevel: '',
  startDate: '', endDate: '', registrationOpenDate: '', registrationCloseDate: '',
  maxPlayers: '16', price: '0', courtsRequired: '2',
  format: 'single_elimination', matchFormat: 'bo3',
  organizerName: '', contactEmail: '',
};

export function CreateTournamentScreen({ onNavigate, onBack }: CreateTournamentScreenProps) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // Optional banner image. Picked locally and previewed; uploaded only after the
  // tournament is created (the media record needs the new tournament's id).
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Revoke the object URL when it changes / on unmount so we don't leak it.
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  const set = (k: keyof typeof empty) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!f) return;
    setImagePreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f); });
    setImageFile(f);
  };
  const clearImage = () => {
    setImagePreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setImageFile(null);
  };

  const submit = async () => {
    if (!form.name.trim()) { setError('Give the tournament a name.'); return; }
    if (!form.startDate || !form.endDate) { setError('Set the start and end dates.'); return; }
    setSaving(true);
    setError(null);
    try {
      const t = await createTournament({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        tournamentType: form.tournamentType,
        skillLevel: form.skillLevel.trim() || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        registrationOpenDate: form.registrationOpenDate || undefined,
        registrationCloseDate: form.registrationCloseDate || undefined,
        maxPlayers: Number(form.maxPlayers) || undefined,
        price: Number(form.price) || 0,
        courtsRequired: Number(form.courtsRequired) || 1,
        format: form.format,
        matchFormat: form.matchFormat,
        organizerName: form.organizerName.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
      });
      // The banner is optional: if its upload fails we still keep the created
      // tournament (the UI falls back to the trophy placeholder) rather than
      // failing the whole create.
      if (imageFile) {
        try {
          const url = await uploadTournamentMedia(t.id, imageFile);
          if (url) await updateTournament(t.id, { bannerUrl: url });
        } catch { /* non-fatal — tournament exists, banner just isn't set */ }
      }
      // Replace so backing out of the new tournament returns to the list, not the form.
      onNavigate('organizer-tournament', { id: t.id }, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the tournament.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scroll pb-[120px]" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 2)}>
      {/* Sticky header: this screen has no bottom nav, so the header stays pinned.
          It carries the safe-area inset so its background covers the notch, and
          only gains a hairline + shadow once the page is scrolled. */}
      <div
        className={`sticky top-0 z-20 safe-top bg-[var(--bg)] transition-shadow duration-200 ${
          scrolled ? 'border-b border-[var(--field-border)] shadow-[0_2px_6px_-2px_rgba(15,23,42,0.12)]' : ''
        }`}
      >
        <ScreenHeader onBack={onBack} title="New tournament" eyebrow="Create a draft" />
      </div>

      <div className="px-5 flex flex-col gap-4">
        <OrganizerSection title="Basics" icon="trophy">
          <div className="flex flex-col gap-3">
            <FormField label="Name" value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder="Summer Smash 2026" required />
            <FormField label="Description (optional)" value={form.description} onChange={(e) => set('description')(e.target.value)} placeholder="Open doubles, round of 16" />
            <div className="grid grid-cols-2 gap-3">
              <FormSelect label="Type" value={form.tournamentType} onChange={(e) => set('tournamentType')(e.target.value)} options={TYPE_OPTIONS} />
              <FormField label="Skill (optional)" value={form.skillLevel} onChange={(e) => set('skillLevel')(e.target.value)} placeholder="3.5+" />
            </div>
          </div>
        </OrganizerSection>

        <OrganizerSection title="Image (optional)" icon="image" description="A banner shown on the tournament card. Skip it and a trophy placeholder is used.">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
          {imagePreview ? (
            <div className="relative overflow-hidden rounded-[14px] aspect-[16/9] bg-[var(--surface-2)]">
              <img src={imagePreview} alt="Tournament banner preview" className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 p-2.5 flex gap-2 bg-gradient-to-t from-black/55 to-transparent">
                <button type="button" onClick={() => fileRef.current?.click()} className="flex-1 rounded-[10px] bg-white/90 py-2 text-[13px] font-bold text-[var(--ink)]">Change</button>
                <button type="button" onClick={clearImage} className="rounded-[10px] bg-white/90 px-3 py-2 text-[13px] font-bold text-[var(--coral)]">Remove</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full aspect-[16/9] rounded-[14px] border-2 border-dashed border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)] flex flex-col items-center justify-center gap-1.5"
            >
              <Icon name="add_photo_alternate" size={28} />
              <span className="text-[13px] font-bold">Add a banner image</span>
              <span className="text-[11px] opacity-70">Optional · 16:9 looks best</span>
            </button>
          )}
        </OrganizerSection>

        <OrganizerSection title="Schedule" icon="calendar">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Start date" type="date" min={todayYMD()} value={form.startDate} onChange={(e) => set('startDate')(e.target.value)} required />
              <FormField label="End date" type="date" min={form.startDate || todayYMD()} value={form.endDate} onChange={(e) => set('endDate')(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Reg. opens" type="date" value={form.registrationOpenDate} onChange={(e) => set('registrationOpenDate')(e.target.value)} />
              <FormField label="Reg. closes" type="date" value={form.registrationCloseDate} onChange={(e) => set('registrationCloseDate')(e.target.value)} />
            </div>
          </div>
        </OrganizerSection>

        <OrganizerSection title="Format & capacity" icon="layers">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormSelect label="Bracket" value={form.format} onChange={(e) => set('format')(e.target.value)} options={FORMAT_OPTIONS} />
              <FormSelect label="Matches" value={form.matchFormat} onChange={(e) => set('matchFormat')(e.target.value)} options={MATCH_FORMAT_OPTIONS} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Max players" type="number" inputMode="numeric" value={form.maxPlayers} onChange={(e) => set('maxPlayers')(e.target.value)} />
              <FormField label="Price" type="number" inputMode="numeric" value={form.price} onChange={(e) => set('price')(e.target.value)} />
              <FormField label="Courts" type="number" inputMode="numeric" value={form.courtsRequired} onChange={(e) => set('courtsRequired')(e.target.value)} />
            </div>
          </div>
        </OrganizerSection>

        <OrganizerSection title="Contact (optional)" icon="user">
          <div className="flex flex-col gap-3">
            <FormField label="Organizer name" value={form.organizerName} onChange={(e) => set('organizerName')(e.target.value)} />
            <FormField label="Contact email" type="email" value={form.contactEmail} onChange={(e) => set('contactEmail')(e.target.value)} />
          </div>
        </OrganizerSection>

        {error && <div className="text-[13px] font-semibold text-[var(--coral)]">{error}</div>}
        <Button fullWidth onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create draft'}</Button>
      </div>
    </div>
  );
}
