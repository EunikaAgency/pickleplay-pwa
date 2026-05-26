import { useState, type FormEvent } from 'react';
import { Icon } from '../components/ui/Icon';
import { FormField } from '../components/forms/FormField';
import { FormTierPicker } from '../components/forms/FormTierPicker';
import { useForm } from '../hooks/useForm';
import { tierForDupr, type SkillTier } from '../lib/skillTiers';

interface EditProfileScreenProps {
  onBack: () => void;
}

export function EditProfileScreen({ onBack }: EditProfileScreenProps) {
  const [saved, setSaved] = useState(false);

  const form = useForm({
    initial: {
      firstName: 'Riley',
      lastName: 'Pickler',
      bio: 'The dink master.',
      location: 'Austin, TX',
      tier: tierForDupr(3.5).id as SkillTier['id'],
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
    <div className="scroll" style={{ paddingBottom: 100, paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
      <div style={{ padding: '4px 20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="back" size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="t-eyebrow">Profile</div>
          <div className="hd-2" style={{ marginTop: 2 }}>Edit your profile</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 18 }}>
        <div className="avatar-xl" style={{ width: 96, height: 96 }}>
          <div>RP</div>
          <button
            type="button"
            aria-label="Change photo"
            style={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              width: 36,
              height: 36,
              borderRadius: 999,
              background: 'var(--ink)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid var(--surface)',
            }}
          >
            <Icon name="camera" size={16} />
          </button>
        </div>
        <button type="button" style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
          Change photo
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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

        <button
          type="submit"
          disabled={!form.isValid}
          className="btn-primary"
          style={{ width: 'calc(100% - 40px)' }}
        >
          {saved ? (
            <>
              <Icon name="check" size={18} /> Saved!
            </>
          ) : (
            'Save changes'
          )}
        </button>
      </form>
    </div>
  );
}
