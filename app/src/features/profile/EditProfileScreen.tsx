import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { FormField } from '../../shared/components/forms/FormField';
import { FormTierPicker } from '../../shared/components/forms/FormTierPicker';
import { AvatarCropper } from '../../shared/components/ui/AvatarCropper';
import { useForm } from '../../shared/hooks/useForm';
import { duprForTier, skillTiers, tierForDupr, type SkillTier } from '../../shared/lib/skillTiers';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { Button } from '../../shared/components/ui/Button';
import { getInitials } from '../../shared/lib/initials';
import { ApiError, uploadAvatar } from '../../shared/lib/api';
import { userHasPermission } from '../../shared/lib/permissions';
import { useAuthStore } from '../../shared/lib/authStore';

interface EditProfileScreenProps {
  onBack: () => void;
}

export function EditProfileScreen({ onBack }: EditProfileScreenProps) {
  const currentUser = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Header is flat at the top; its hairline + shadow only appear once content
  // scrolls underneath it (standard app-bar behaviour).
  const [scrolled, setScrolled] = useState(false);

  // Photo change: pick a file → crop to a circle (Croppie) → upload → PATCH /me.
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const pickPhoto = () => fileRef.current?.click();
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (f) { setPhotoError(null); setCropFile(f); }
  };
  const onCropped = async (blob: Blob) => {
    if (!currentUser?.id) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const file = new File([blob], 'avatar.png', { type: 'image/png' });
      const url = await uploadAvatar(currentUser.id, file);
      if (!url) throw new Error('Upload failed');
      await updateProfile({ avatarUrl: url });
      setCropFile(null);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not update your photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const nameParts = (currentUser?.displayName ?? '').trim().split(/\s+/).filter(Boolean);
  const initialTier = currentUser?.skillLevel != null ? tierForDupr(currentUser.skillLevel).id : 'solid';

  // Skill level (DUPR) is a player/coach attribute — owners, organizers, and
  // admins don't play, so the picker is hidden for them (and never saved).
  const showSkillLevel =
    !userHasPermission(currentUser, 'owner.access') &&
    !userHasPermission(currentUser, 'organizer.access') &&
    !userHasPermission(currentUser, 'admin.access');

  const form = useForm({
    initial: {
      firstName: currentUser?.firstName?.trim() || nameParts[0] || '',
      lastName: nameParts.slice(1).join(' '),
      bio: currentUser?.bio ?? '',
      address1: currentUser?.address1 ?? '',
      address2: currentUser?.address2 ?? '',
      city: currentUser?.city ?? '',
      province: currentUser?.province ?? '',
      zipcode: currentUser?.zipcode ?? '',
      tier: initialTier as SkillTier['id'],
    },
    validators: {
      firstName: (v) => (!v || !(v as string).trim() ? 'First name is required.' : undefined),
      lastName: (v) => (!v || !(v as string).trim() ? 'Last name is required.' : undefined),
    },
  });

  // On a cold load (deep link or reload) the session is still being restored
  // when useForm captures its initial values, so every field would render
  // blank. Re-seed once the account lands — `reset()` reads the latest
  // `initial`. Without this, saving from a cold-loaded form would overwrite the
  // stored bio and address with empty strings.
  const seededFromAccount = useRef(!!currentUser);
  const resetForm = form.reset;
  useEffect(() => {
    if (seededFromAccount.current || !currentUser) return;
    seededFromAccount.current = true;
    resetForm();
  }, [currentUser, resetForm]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.isValid || saving) return;
    setError(null);
    setSaving(true);
    const firstName = form.values.firstName.trim();
    const lastName = form.values.lastName.trim();
    const tierName = skillTiers.find((t) => t.id === form.values.tier)?.name;
    try {
      await updateProfile({
        firstName,
        lastName,
        // Keep the visible name in sync with the edited first/last name.
        displayName: `${firstName} ${lastName}`.trim(),
        bio: form.values.bio.trim(),
        address1: form.values.address1.trim(),
        address2: form.values.address2.trim(),
        city: form.values.city.trim(),
        province: form.values.province.trim(),
        zipcode: form.values.zipcode.trim(),
        // Only players/coaches carry a skill level — don't write one for others.
        ...(showSkillLevel
          ? { skillLevel: String(duprForTier(form.values.tier)), skillLevelLabel: tierName }
          : {}),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scroll pb-[100px]" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 2)}>
      {/* Sticky header: this screen has no bottom nav, so the header stays
          pinned. It carries the safe-area inset so its background covers the
          notch, and only gains a hairline + shadow once the page is scrolled. */}
      <div
        className={`sticky top-0 z-20 safe-top bg-[var(--surface)] transition-shadow duration-200 ${
          scrolled ? 'border-b border-[var(--field-border)] shadow-[0_2px_6px_-2px_rgba(15,23,42,0.12)]' : ''
        }`}
      >
        <ScreenHeader onBack={onBack} eyebrow="Profile" title="Edit your profile" />
      </div>

      <div className="flex flex-col items-center mt-6 mb-[18px]">
        <div className="avatar-xl w-24 h-24 overflow-hidden">
          {currentUser?.avatarUrl ? (
            <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div>{getInitials(currentUser?.displayName) || '··'}</div>
          )}
        </div>
        <button type="button" onClick={pickPhoto} disabled={photoBusy} className="mt-2.5 text-[12px] font-bold text-[var(--primary)] disabled:opacity-50">
          {photoBusy ? 'Updating…' : 'Change photo'}
        </button>
        {photoError && <div className="mt-1 text-[12px] font-semibold text-[var(--coral)]">{photoError}</div>}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
      </div>

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          busy={photoBusy}
          onCancel={() => setCropFile(null)}
          onCropped={onCropped}
        />
      )}

      <form onSubmit={handleSubmit}>
        <div className="field grid grid-cols-2 gap-2.5">
          <FormField
            label="First name"
            value={form.values.firstName}
            onChange={(e) => form.setField('firstName', e.target.value)}
            onBlur={() => form.setTouched('firstName')}
            error={form.touched.firstName ? form.errors.firstName : undefined}
            required
          />
          <FormField
            label="Last name"
            value={form.values.lastName}
            onChange={(e) => form.setField('lastName', e.target.value)}
            onBlur={() => form.setTouched('lastName')}
            error={form.touched.lastName ? form.errors.lastName : undefined}
            required
          />
        </div>

        <div className="field">
          <FormField
            label="Bio"
            value={form.values.bio}
            onChange={(e) => form.setField('bio', e.target.value)}
            placeholder="A short tagline…"
            hint="Shown on your profile."
          />
        </div>

        <div className="field">
          <FormField
            label="Email"
            value={currentUser?.email ?? ''}
            disabled
            hint="Contact support to change your email."
            trailingSlot={<span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] bg-[var(--surface)] border border-[var(--hairline)] rounded-full px-2 py-0.5 select-none">Read-only</span>}
          />
        </div>

        <div className="field">
          <FormField
            label="Address line 1"
            value={form.values.address1}
            onChange={(e) => form.setField('address1', e.target.value)}
            leadingIcon="location"
            placeholder="House / street"
          />
        </div>

        <div className="field">
          <FormField
            label="Address line 2"
            value={form.values.address2}
            onChange={(e) => form.setField('address2', e.target.value)}
            placeholder="Barangay, unit, landmark (optional)"
          />
        </div>

        <div className="field grid grid-cols-2 gap-2.5">
          <FormField
            label="City"
            value={form.values.city}
            onChange={(e) => form.setField('city', e.target.value)}
            placeholder="e.g. Tanza"
          />
          <FormField
            label="Province"
            value={form.values.province}
            onChange={(e) => form.setField('province', e.target.value)}
            placeholder="e.g. Cavite"
          />
        </div>

        <div className="field">
          <FormField
            label="Zip code"
            value={form.values.zipcode}
            onChange={(e) => form.setField('zipcode', e.target.value)}
            inputMode="numeric"
            placeholder="e.g. 4108"
          />
        </div>

        {showSkillLevel && (
          <div className="field">
            <FormTierPicker
              label="Skill level"
              value={form.values.tier}
              onChange={(tier) => form.setField('tier', tier)}
            />
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mx-5 mt-4 flex items-center gap-2 rounded-xl bg-[var(--coral-soft)] px-3 py-2.5 text-[13px] font-semibold text-[var(--coral)]"
          >
            <span className="flex-none w-5 h-5 rounded-full bg-[var(--coral)] text-white font-heading text-[13px] leading-none flex items-center justify-center">
              !
            </span>
            {error}
          </div>
        )}

        <div className="px-5 mt-4">
          <Button type="submit" fullWidth disabled={!form.isValid || saving}>
            {saving ? (
              <>
                <span className="inline-flex animate-spin">
                  <Icon name="spinner" size={18} />
                </span>
                Saving…
              </>
            ) : saved ? (
              <>
                <Icon name="check" size={18} /> Saved!
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
