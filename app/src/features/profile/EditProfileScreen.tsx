import { useState, type FormEvent } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { FormField } from '../../shared/components/forms/FormField';
import { FormTierPicker } from '../../shared/components/forms/FormTierPicker';
import { useForm } from '../../shared/hooks/useForm';
import { tierForDupr, type SkillTier } from '../../shared/lib/skillTiers';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { Button } from '../../shared/components/ui/Button';
import { getInitials } from '../../shared/lib/initials';
import { useAuthStore } from '../../shared/lib/authStore';

interface EditProfileScreenProps {
  onBack: () => void;
}

export function EditProfileScreen({ onBack }: EditProfileScreenProps) {
  const currentUser = useAuthStore((s) => s.user);
  const [saved, setSaved] = useState(false);

  const nameParts = (currentUser?.displayName ?? '').trim().split(/\s+/).filter(Boolean);
  const initialTier = currentUser?.skillLevel != null ? tierForDupr(currentUser.skillLevel).id : 'solid';

  const form = useForm({
    initial: {
      firstName: currentUser?.firstName?.trim() || nameParts[0] || '',
      lastName: nameParts.slice(1).join(' '),
      bio: currentUser?.bio ?? '',
      location: '',
      tier: initialTier as SkillTier['id'],
    },
    validators: {
      firstName: (v) => (!v || !(v as string).trim() ? 'First name is required.' : undefined),
      lastName: (v) => (!v || !(v as string).trim() ? 'Last name is required.' : undefined),
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.isValid) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} eyebrow="Profile" title="Edit your profile" />

      <div className="flex flex-col items-center mb-[18px]">
        <div className="avatar-xl w-24 h-24 overflow-hidden">
          {currentUser?.avatarUrl ? (
            <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div>{getInitials(currentUser?.displayName) || '··'}</div>
          )}
          <button
            type="button"
            aria-label="Change photo"
            className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[var(--ink)] text-white flex items-center justify-center border-[3px] border-[var(--surface)]"
          >
            <Icon name="camera" size={16} />
          </button>
        </div>
        <button type="button" className="mt-2.5 text-[12px] font-bold text-[var(--primary)]">
          Change photo
        </button>
      </div>

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
            label="Location"
            value={form.values.location}
            onChange={(e) => form.setField('location', e.target.value)}
            leadingIcon="location"
            placeholder="City or zip"
          />
        </div>

        <div className="field">
          <FormTierPicker
            label="Skill level"
            value={form.values.tier}
            onChange={(tier) => form.setField('tier', tier)}
          />
        </div>

        <div className="px-5 mt-4">
          <Button type="submit" fullWidth disabled={!form.isValid}>
            {saved ? (
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
