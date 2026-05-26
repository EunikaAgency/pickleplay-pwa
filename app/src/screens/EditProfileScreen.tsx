import { useState, type FormEvent } from 'react';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/forms/FormField';
import { FormTierPicker } from '../components/forms/FormTierPicker';
import { useForm } from '../hooks/useForm';
import { tierForDupr, type SkillTier } from '../lib/skillTiers';

interface EditProfileScreenProps {
  onBack: () => void;
}

export function EditProfileScreen(_props: EditProfileScreenProps) {
  const [saved, setSaved] = useState(false);
  const cardShadow = { boxShadow: 'var(--shadow-card)' } as const;

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
    <div className="flex w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="scrollbar-none overflow-y-auto flex-1">
        <main className="mx-auto max-w-xl px-5 pt-6 pb-28 space-y-8">

          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-surface-container-lowest" style={cardShadow}>
                <img
                  alt=""
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuC11Czoun2_lIi5sXUquwWrSH9zQHexFqKo-X4CDjUV4W0TL7Ht5NjTuHGxtUiIqAsPIlsUb6NFVrceAQUSshEaH2IvKc_VsIiCR3LjB3A1DBte9odfpGMbbh_Uts7mH-Cxzz2Xzpqx3BxZ7-TABXizUiXu13rRrLReBp2MpFNulK6pmDY5PFVwtMF3Bi904yH8k5L1bA7mpL9m42zbY-I9vMb3NYQo2KN7JxG9_ja4VPZJ1D0cBRvZLqConIzBzpJMdRFigaCD"
                />
              </div>
              <button
                type="button"
                aria-label="Change photo"
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shadow-md active:scale-90 transition-all"
              >
                <Icon name="edit" size={18} />
              </button>
            </div>
            <span className="text-label-sm text-primary font-bold">Change Photo</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
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

            <FormField
              label="Bio"
              value={form.values.bio}
              onChange={(e) => form.setField('bio', e.target.value)}
              placeholder="A short tagline…"
              hint="Shown on your profile."
              inputClassName="italic"
            />

            <FormField
              label="Location"
              value={form.values.location}
              onChange={(e) => form.setField('location', e.target.value)}
              leadingIcon="location_on"
              placeholder="City or zip code"
            />

            <FormTierPicker
              label="Skill level"
              value={form.values.tier}
              onChange={(tier) => form.setField('tier', tier)}
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={!form.isValid}
              className={saved ? 'bg-secondary text-white' : ''}
            >
              {saved ? (
                <>
                  <Icon name="check_circle" size={20} filled />
                  Saved!
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </form>

        </main>
      </div>
    </div>
  );
}
