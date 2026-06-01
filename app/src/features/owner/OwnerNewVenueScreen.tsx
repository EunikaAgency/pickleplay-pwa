import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { FormField } from '../../shared/components/forms/FormField';
import { FormSelect } from '../../shared/components/forms/FormSelect';
import { useForm } from '../../shared/hooks/useForm';
import { OwnerSection } from './OwnerSection';
import { createVenue, fetchCities, ApiError, type ApiCity } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerNewVenueScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

const IO_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'both', label: 'Both' },
];

export function OwnerNewVenueScreen({ onNavigate, onBack }: OwnerNewVenueScreenProps) {
  const [cities, setCities] = useState<ApiCity[]>([]);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchCities()
      .then((c) => { if (!cancelled) setCities(c); })
      .catch(() => { /* cities optional; the form still works without them */ });
    return () => {
      cancelled = true;
    };
  }, []);

  const form = useForm({
    initial: {
      displayName: '',
      oneLineSummary: '',
      description: '',
      cityId: '',
      area: '',
      fullAddress: '',
      indoorOutdoor: '',
      courtCount: '',
      surfaceType: '',
      priceFrom: '',
      phone: '',
      email: '',
      website: '',
      bookingUrl: '',
    },
    validators: {
      displayName: (v) => (!String(v ?? '').trim() || String(v).trim().length < 2 ? 'Please enter a venue name (at least 2 characters).' : undefined),
    },
    onSubmit: async (vals) => {
      setErrMsg('');
      // Only send filled fields; the API treats empty strings as unset.
      const body: Record<string, string> = {};
      for (const [k, v] of Object.entries(vals)) {
        const trimmed = String(v ?? '').trim();
        if (trimmed !== '') body[k] = trimmed;
      }
      try {
        const venue = await createVenue(body);
        const slug = venue?.slug;
        onNavigate('owner-venue', { id: slug || String(venue?.id ?? '') });
      } catch (err) {
        setErrMsg(
          err instanceof ApiError && err.status === 401
            ? 'Your session expired — sign in again.'
            : err instanceof ApiError && err.status === 400
              ? 'Some fields are invalid. Check the form and try again.'
              : 'Could not create the venue. Try again in a moment.',
        );
      }
    },
  });

  const cityOptions = [
    { value: '', label: 'Select a city (optional)' },
    ...cities.map((c) => ({ value: c.id, label: c.region ? `${c.name} · ${c.region}` : c.name })),
  ];

  const bind = (k: keyof typeof form.values) => ({
    value: form.values[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => form.setField(k, e.target.value),
  });

  return (
    <div className="scroll safe-top safe-bottom px-5">
      <ScreenHeader onBack={onBack} backIcon="close" eyebrow="Owner console" title="Create a new venue" subtitle="Only the name is required — fill in the rest on the editor after." />

      <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-[var(--primary-tint)] px-4 py-3">
        <Icon name="help" size={18} className="shrink-0 text-[var(--primary)] mt-0.5" />
        <p className="text-[13px] text-[var(--ink-2)]">Already in our directory? Find and claim it from the Courts tab instead, to avoid a duplicate listing.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.submit();
        }}
        className="space-y-4"
      >
        <OwnerSection title="Basics" icon="edit">
          <div className="space-y-3.5">
            <FormField
              label="Venue name"
              required
              placeholder="e.g. Smash City Pickleball"
              maxLength={200}
              {...bind('displayName')}
              onBlur={() => form.setTouched('displayName')}
              error={form.touched.displayName ? form.errors.displayName : undefined}
            />
            <FormField label="One-line summary" placeholder="A short hook shown in search results" maxLength={255} {...bind('oneLineSummary')} />
            <div className="field p-0!">
              <label className="lbl">Description</label>
              <textarea className="control" rows={4} value={form.values.description} onChange={(e) => form.setField('description', e.target.value)} />
            </div>
          </div>
        </OwnerSection>

        <OwnerSection title="Location" icon="location" description="You can drop a precise map pin later, on the Location tab.">
          <div className="space-y-3.5">
            <FormSelect label="City" options={cityOptions} {...bind('cityId')} />
            <FormField label="Area / district" placeholder="e.g. Makati" maxLength={100} {...bind('area')} />
            <FormField label="Full address" placeholder="Street, building, city" {...bind('fullAddress')} />
          </div>
        </OwnerSection>

        <OwnerSection title="Courts & basics" icon="paddle">
          <div className="grid grid-cols-2 gap-3">
            <FormSelect label="Indoor / outdoor" options={IO_OPTIONS} {...bind('indoorOutdoor')} />
            <FormField label="Court count" type="number" min={0} {...bind('courtCount')} />
            <FormField label="Surface type" placeholder="hard, wood…" maxLength={50} {...bind('surfaceType')} />
            <FormField label="Price from (PHP)" placeholder="200" {...bind('priceFrom')} />
          </div>
        </OwnerSection>

        <OwnerSection title="Contact" icon="message">
          <div className="space-y-3.5">
            <FormField label="Phone" maxLength={20} {...bind('phone')} />
            <FormField label="Email" type="email" maxLength={255} {...bind('email')} />
            <FormField label="Website" placeholder="https://" {...bind('website')} />
            <FormField label="Booking link" placeholder="https://" {...bind('bookingUrl')} />
          </div>
        </OwnerSection>

        {errMsg && <div className="t-sm text-[var(--coral)] font-bold text-center">{errMsg}</div>}
        <Button type="submit" fullWidth disabled={form.isSubmitting}>
          {form.isSubmitting ? 'Creating…' : 'Create venue'}
        </Button>
      </form>
    </div>
  );
}
