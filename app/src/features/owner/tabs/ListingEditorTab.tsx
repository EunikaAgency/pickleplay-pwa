import { useState, useRef } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Button } from '../../../shared/components/ui/Button';
import { Toast } from '../../../shared/components/ui/Toast';
import { Chip } from '../../../shared/components/ui/Chip';
import { FormField } from '../../../shared/components/forms/FormField';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import { OwnerSection } from '../components/OwnerSection';
import { BookingLinkShare } from '../components/BookingLinkShare';
import { updateVenue, checkBookingSlug, deleteVenue, ApiError, type OwnerVenueDetail, type BookingSlugCheck, type PaymentOption } from '../../../shared/lib/api';

interface ListingEditorTabProps {
  venue: OwnerVenueDetail;
  venueId: string;
  reload: () => void;
  /** Called after the venue is deleted, so the screen can leave the editor. */
  onDeleted?: () => void;
}

// Amenity booleans. Keys match the API venue document (and the web ListingEditor).
const AMENITIES: { key: keyof OwnerVenueDetail; label: string }[] = [
  { key: 'hasCourtRental', label: 'Court rental' },
  { key: 'hasOpenPlay', label: 'Open play' },
  { key: 'hasCoaching', label: 'Coaching' },
  { key: 'isBeginnerFriendly', label: 'Beginner friendly' },
  { key: 'hasParking', label: 'Parking' },
  { key: 'hasToilets', label: 'Toilets' },
  { key: 'hasShowers', label: 'Showers' },
  { key: 'hasFoodBeverage', label: 'Food & beverage' },
  { key: 'hasAc', label: 'Air conditioning' },
  { key: 'hasLighting', label: 'Lighting' },
  { key: 'hasSeating', label: 'Seating' },
  { key: 'hasPaddleRental', label: 'Paddle rental' },
  { key: 'hasProShop', label: 'Pro shop' },
];

const IO_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'both', label: 'Both' },
];

// How long a player has to pay after the owner approves a request-to-book.
const PAY_WINDOW_OPTIONS = [
  { value: '1', label: '1 hour' },
  { value: '12', label: '12 hours' },
  { value: '24', label: '24 hours' },
  { value: '48', label: '48 hours' },
  { value: '72', label: '72 hours' },
];

const str = (v: unknown) => (v == null ? '' : String(v));

// Live slug normalization for the custom booking-link field — mirrors the
// server's normalization so the preview matches what gets stored.
const normalizeSlug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/g, '').slice(0, 60);

// A chip list you can add to / remove from — the app analog of the web TagInput.
function TagField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div className="field p-0!">
      <label className="lbl">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.length === 0 && <span className="t-sm">None yet.</span>}
        {value.map((t) => (
          <span key={t} className="chip active gap-1.5">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="control"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add and press Enter"
        />
        <button
          type="button"
          onClick={add}
          className="px-4 rounded-2xl bg-[var(--surface-2)] text-[var(--primary)] font-bold text-[13px] shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function ListingEditorTab({ venue, venueId, reload, onDeleted }: ListingEditorTabProps) {
  const [form, setForm] = useState({
    displayName: str(venue.displayName),
    oneLineSummary: str(venue.oneLineSummary),
    description: str(venue.description),
    indoorOutdoor: str(venue.indoorOutdoor),
    surfaceType: str(venue.surfaceType),
    phone: str(venue.phonePrimary ?? venue.phone),
    email: str(venue.email),
    website: str(venue.website),
    priceFrom: str(venue.priceFrom),
    peakPrice: str(venue.peakPrice),
    offPeakPrice: str(venue.offPeakPrice),
    openPlayPrice: str(venue.openPlayPrice),
    equipmentRentalPrice: str(venue.equipmentRentalPrice),
    // Day-based pricing — flat weekend/holiday hourly overrides.
    weekendPrice: str(venue.weekendPrice),
    holidayPrice: str(venue.holidayPrice),
    // Member pricing — % off the resolved rate for venue members.
    memberDiscountPercent: str(venue.memberDiscountPercent || ''),
    // Per-player surcharge — ₱ per extra player + the included headcount.
    perPlayerFee: str(venue.perPlayerFee || ''),
    perPlayerFeeThreshold: str(venue.perPlayerFeeThreshold ?? 1),
    priceNotes: str(venue.priceNotes),
    pricingTaxLabel: str(venue.pricingTaxLabel ?? 'VAT inclusive'),
  });
  // Holiday dates (YYYY-MM-DD) for holiday pricing — managed as a small date list.
  const [holidayDates, setHolidayDates] = useState<string[]>(venue.holidayDates ?? []);
  const [holidayDraft, setHolidayDraft] = useState('');
  // Cancellation & refund policy — owner-configurable per venue.
  const [cancelWindow, setCancelWindow] = useState(str(venue.cancellationWindowHours ?? 24));
  const [refundPct, setRefundPct] = useState(str(venue.refundPercent ?? 100));
  const [noShowFee, setNoShowFee] = useState(str(venue.noShowFee ?? 0));
  const [amenities, setAmenities] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(AMENITIES.map((a) => [a.key as string, Boolean(venue[a.key])] as [string, boolean])),
  );
  const [chips, setChips] = useState({
    amenityChips: venue.amenityChips ?? [],
    thingsToKnow: venue.thingsToKnow ?? [],
  });
  // "Best for" / "What players like" are platform-curated from real venue data +
  // editorial (not owner-typed claims) — shown read-only here. See the API's
  // computeVenueHighlights; the owner shapes them by keeping amenities/details accurate.
  const curated = venue.curatedHighlights ?? { bestFor: [], whatPlayersLike: [] };
  // Booking policy: require-approval (request-to-book) + the per-venue pay-window.
  const [requireApproval, setRequireApproval] = useState<boolean>(Boolean(venue.requireBookingApproval));
  const [payWindow, setPayWindow] = useState<string>(str(venue.bookingPayWindowHours || 24));
  // Payment options offered at checkout (deposit / full / pay-at-venue) + deposit size.
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>(
    (venue.paymentOptions ?? ['full']).filter((o): o is PaymentOption => o === 'full' || o === 'deposit' || o === 'pay_at_venue'),
  );
  const [depositPercent, setDepositPercent] = useState<string>(str(venue.depositPercent ?? 50));
  const togglePaymentOption = (opt: PaymentOption) => {
    setStatus('idle');
    setPaymentOptions((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
  };
  // Auto-generated booking link: the system builds …/venues/<slug>; the owner can
  // optionally vanity-name it with a custom slug (saved as `bookingSlug`).
  const [customSlug, setCustomSlug] = useState<string>(str(venue.bookingSlug));
  const [slugError, setSlugError] = useState<string | null>(null);
  // Live availability check while typing the custom slug (debounced).
  const [slugCheck, setSlugCheck] = useState<BookingSlugCheck | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // Delete flow: a two-step confirm so it isn't a single mis-tap.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const onDelete = async () => {
    setDeleting(true);
    setDeleteError(false);
    try {
      await deleteVenue(venueId);
      onDeleted?.();
    } catch {
      setDeleteError(true);
      setDeleting(false);
    }
  };

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setStatus('idle');
  };

  // Debounced availability check for the custom slug, fired from the input's change
  // handler (a debounce timer + a request id that guards against stale responses).
  const savedSlug = str(venue.bookingSlug);
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slugReqId = useRef(0);

  const onSlugChange = (raw: string) => {
    const next = normalizeSlug(raw);
    setCustomSlug(next);
    setSlugError(null);
    setStatus('idle');
    if (slugTimer.current) clearTimeout(slugTimer.current);
    const slug = next.trim();
    // Blank → falls back to the system slug; unchanged → already ours: no check.
    if (!slug || slug === savedSlug) {
      setSlugCheck(null);
      setSlugChecking(false);
      return;
    }
    setSlugChecking(true);
    const reqId = ++slugReqId.current;
    slugTimer.current = setTimeout(async () => {
      try {
        const res = await checkBookingSlug(venueId, slug);
        if (reqId === slugReqId.current) setSlugCheck(res);
      } catch {
        if (reqId === slugReqId.current) setSlugCheck(null);
      } finally {
        if (reqId === slugReqId.current) setSlugChecking(false);
      }
    }, 400);
  };

  // Don't let Save go through with a known-bad slug (it would 409 the WHOLE save,
  // dropping the rest of the form too). Empty / current / available are all fine.
  const slugBlocked = customSlug.trim() !== '' && customSlug.trim() !== savedSlug
    && (slugCheck?.status === 'taken' || slugCheck?.status === 'invalid');

  const onSave = async () => {
    setStatus('saving');
    setSlugError(null);
    try {
      // courtCount is intentionally NOT sent — the API derives it from the
      // courts managed on the Courts tab. `bookingSlug` is the optional custom
      // booking-link slug (empty string clears it back to the system slug).
      await updateVenue(venueId, {
        ...form, ...chips, ...amenities,
        // Pricing rules — coerce the numeric ones; blank clears them (→ 0 / unset).
        memberDiscountPercent: Number(form.memberDiscountPercent) || 0,
        perPlayerFee: Number(form.perPlayerFee) || 0,
        perPlayerFeeThreshold: Number(form.perPlayerFeeThreshold) || 1,
        holidayDates,
        bookingSlug: customSlug.trim(),
        requireBookingApproval: requireApproval,
        bookingPayWindowHours: Number(payWindow) || 24,
        // Always keep at least full-pay; default-fall-back if the owner cleared all.
        paymentOptions: paymentOptions.length ? paymentOptions : ['full'],
        depositPercent: Number(depositPercent) || 50,
        cancellationWindowHours: Number(cancelWindow) || 24,
        refundPercent: Number(refundPct) ?? 100,
        noShowFee: Number(noShowFee) || 0,
      });
      setStatus('saved');
      reload();
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2200);
    } catch (err) {
      // Surface a specific message when the chosen custom link collides or is invalid.
      if (err instanceof ApiError && (err.code === 'SLUG_TAKEN' || err.code === 'INVALID_SLUG')) {
        setSlugError(err.message);
      }
      setStatus('error');
    }
  };

  return (
    <div className="space-y-4">
      <OwnerSection title="Identity" icon="edit" description="How your venue appears across PickleBallers.">
        <div className="space-y-3.5">
          <FormField label="Venue name" value={form.displayName} maxLength={200} onChange={(e) => set('displayName')(e.target.value)} />
          <FormField
            label="One-line summary"
            hint="A short hook shown in search results."
            value={form.oneLineSummary}
            maxLength={255}
            onChange={(e) => set('oneLineSummary')(e.target.value)}
          />
          <div className="field p-0!">
            <label className="lbl">Description</label>
            <textarea className="control" rows={5} value={form.description} onChange={(e) => set('description')(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormSelect label="Indoor / outdoor" options={IO_OPTIONS} value={form.indoorOutdoor} onChange={(e) => set('indoorOutdoor')(e.target.value)} />
            <FormField label="Surface type" placeholder="hard, wood…" value={form.surfaceType} maxLength={50} onChange={(e) => set('surfaceType')(e.target.value)} />
          </div>
          <div className="field p-0!">
            <label className="lbl">Court count</label>
            <div className="control flex items-center text-[var(--muted)]">
              {Number(venue.courtCount) || 0} {Number(venue.courtCount) === 1 ? 'court' : 'courts'} · managed on the Courts tab
            </div>
          </div>
        </div>
      </OwnerSection>

      <OwnerSection title="Contact & booking" icon="message">
        <div className="space-y-3.5">
          <FormField label="Phone" value={form.phone} maxLength={20} onChange={(e) => set('phone')(e.target.value)} />
          <FormField label="Email" type="email" value={form.email} maxLength={255} onChange={(e) => set('email')(e.target.value)} />
          <FormField label="Website" placeholder="https://" value={form.website} onChange={(e) => set('website')(e.target.value)} />

          {/* Auto-generated booking link — the system builds it from the venue slug;
              the owner shares it and players reserve courts here. No free-text URL. */}
          <div className="field p-0!">
            <label className="lbl">Booking link</label>
            <div className="t-sm text-[var(--muted)] mb-2">
              Generated automatically by PickleBallers — share it and players book your courts here.
            </div>
            <BookingLinkShare venue={venue} />

            {/* Optional custom slug for a tidier, branded link — checked live as you type. */}
            <label className="lbl mt-3.5">Custom link <span className="text-[var(--muted)] font-normal">(optional)</span></label>
            <div className={`flex items-stretch rounded-2xl border-[0.5px] bg-[var(--surface)] overflow-hidden ${slugBlocked ? 'border-[var(--coral)]' : slugCheck?.status === 'available' ? 'border-[var(--lime-ink)]' : 'border-[var(--hairline)]'}`}>
              <span className="flex items-center pl-3.5 pr-1 text-[13px] text-[var(--muted)] whitespace-nowrap">/venues/</span>
              <input
                className="flex-1 min-w-0 bg-transparent py-2.5 pr-2 text-[14px] text-[var(--ink)] outline-none"
                value={customSlug}
                onChange={(e) => onSlugChange(e.target.value)}
                placeholder={venue.slug}
                maxLength={60}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {customSlug.trim() !== '' && customSlug.trim() !== savedSlug && (
                <span className="flex items-center pr-3 pl-1 shrink-0">
                  {slugChecking ? (
                    <span className="inline-flex animate-spin text-[var(--muted)]"><Icon name="spinner" size={15} /></span>
                  ) : slugCheck?.status === 'available' ? (
                    <Icon name="check" size={16} className="text-[var(--lime-ink)]" />
                  ) : (slugCheck?.status === 'taken' || slugCheck?.status === 'invalid') ? (
                    <Icon name="close" size={15} className="text-[var(--coral)]" />
                  ) : null}
                </span>
              )}
            </div>
            {/* Status line: live feedback so the owner never guesses if a link is free. */}
            {slugChecking ? (
              <div className="t-sm text-[var(--muted)] mt-1">Checking availability…</div>
            ) : customSlug.trim() === '' ? (
              <div className="t-sm text-[var(--muted)] mt-1">Leave blank to use the automatic link.</div>
            ) : customSlug.trim() === savedSlug ? (
              <div className="t-sm text-[var(--muted)] mt-1">This is your current link.</div>
            ) : slugCheck?.status === 'available' ? (
              <div className="t-sm font-bold mt-1 text-[var(--lime-ink)]">Available — this link is free.</div>
            ) : slugCheck?.status === 'taken' ? (
              <div className="t-sm text-[var(--coral)] font-bold mt-1">Already taken — try another.</div>
            ) : slugCheck?.status === 'invalid' ? (
              <div className="t-sm text-[var(--coral)] font-bold mt-1">Use letters, numbers and hyphens.</div>
            ) : (
              <div className="t-sm text-[var(--muted)] mt-1">Leave blank to use the automatic link.</div>
            )}
            {slugError && <div className="t-sm text-[var(--coral)] font-bold mt-1">{slugError}</div>}
          </div>
        </div>
      </OwnerSection>

      <OwnerSection title="Booking policy" icon="calendar" description="Decide whether bookings are accepted automatically or after your review.">
        <Chip
          selected={requireApproval}
          onClick={() => { setRequireApproval((v) => !v); setStatus('idle'); }}
        >
          {requireApproval && <Icon name="check" size={12} />}
          Require my approval for bookings
        </Chip>
        <div className="t-sm mt-2 text-[var(--muted)]">
          {requireApproval
            ? 'Players send a request; you approve it, then they pay within the window to confirm.'
            : 'Bookings are confirmed instantly when a player books and pays.'}
        </div>
        {requireApproval && (
          <div className="field p-0! mt-3.5">
            <FormSelect
              label="Players must pay within"
              options={PAY_WINDOW_OPTIONS}
              value={payWindow}
              onChange={(e) => { setPayWindow(e.target.value); setStatus('idle'); }}
            />
          </div>
        )}

        {/* Payment options offered at checkout (instant-book). */}
        {!requireApproval && (
          <div className="mt-4 pt-4 border-t-[0.5px] border-[var(--hairline)]">
            <div className="lbl">Payment options at checkout</div>
            <div className="flex flex-wrap gap-2">
              {([
                { id: 'full', label: 'Pay in full' },
                { id: 'deposit', label: 'Deposit' },
                { id: 'pay_at_venue', label: 'Pay at venue' },
              ] as { id: PaymentOption; label: string }[]).map((o) => (
                <Chip key={o.id} selected={paymentOptions.includes(o.id)} onClick={() => togglePaymentOption(o.id)}>
                  {paymentOptions.includes(o.id) && <Icon name="check" size={12} />} {o.label}
                </Chip>
              ))}
            </div>
            <div className="t-sm mt-2 text-[var(--muted)]">
              Players choose one of these when they book. Full-payment always applies if you pick none.
            </div>
            {paymentOptions.includes('deposit') && (
              <div className="field p-0! mt-3">
                <FormField
                  label="Deposit (% of total)"
                  hint="How much the player pays online now; the rest is collected at the venue."
                  value={depositPercent}
                  inputMode="numeric"
                  onChange={(e) => { setDepositPercent(e.target.value.replace(/[^\d]/g, '')); setStatus('idle'); }}
                />
              </div>
            )}
          </div>
        )}
      </OwnerSection>

      <OwnerSection title="Pricing" icon="bolt" description="Display pricing in PHP — shown on your public page, not charged.">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="From" placeholder="200" value={form.priceFrom} onChange={(e) => set('priceFrom')(e.target.value)} />
          <FormField label="Peak" value={form.peakPrice} onChange={(e) => set('peakPrice')(e.target.value)} />
          <FormField label="Off-peak" value={form.offPeakPrice} onChange={(e) => set('offPeakPrice')(e.target.value)} />
          <FormField label="Open play" value={form.openPlayPrice} onChange={(e) => set('openPlayPrice')(e.target.value)} />
          <FormField label="Equipment rental" value={form.equipmentRentalPrice} onChange={(e) => set('equipmentRentalPrice')(e.target.value)} />
        </div>
        <div className="field p-0! mt-3.5">
          <label className="lbl">Pricing notes</label>
          <textarea className="control" rows={2} value={form.priceNotes} onChange={(e) => set('priceNotes')(e.target.value)} />
        </div>
        <div className="field p-0! mt-3.5">
          <FormField
            label="Tax label"
            hint='Shown next to prices: e.g. "VAT inclusive", "VAT exclusive", or "Tax included".'
            value={form.pricingTaxLabel}
            maxLength={40}
            onChange={(e) => set('pricingTaxLabel')(e.target.value)}
          />
        </div>
      </OwnerSection>

      <OwnerSection title="Day-based pricing" icon="calendar" description="Charge a different hourly rate on weekends and holidays. Leave blank to use the base rate. (Your per-time hours pricing on the Courts tab, when set, takes priority.)">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Weekend rate (₱/hr)" hint="Applied on Saturdays & Sundays." value={form.weekendPrice} inputMode="decimal" onChange={(e) => set('weekendPrice')(e.target.value.replace(/[^\d.]/g, ''))} />
          <FormField label="Holiday rate (₱/hr)" hint="Applied on the holiday dates below." value={form.holidayPrice} inputMode="decimal" onChange={(e) => set('holidayPrice')(e.target.value.replace(/[^\d.]/g, ''))} />
        </div>
        <div className="field p-0! mt-3.5">
          <label className="lbl">Holiday dates</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {holidayDates.length === 0 && <span className="t-sm">None yet.</span>}
            {[...holidayDates].sort().map((d) => (
              <span key={d} className="chip active gap-1.5">
                {d}
                <button type="button" onClick={() => { setHolidayDates((xs) => xs.filter((x) => x !== d)); setStatus('idle'); }} aria-label={`Remove ${d}`}>
                  <Icon name="close" size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="date" className="control" value={holidayDraft} onChange={(e) => setHolidayDraft(e.target.value)} aria-label="Holiday date" />
            <button
              type="button"
              onClick={() => { if (holidayDraft && !holidayDates.includes(holidayDraft)) { setHolidayDates((xs) => [...xs, holidayDraft]); setStatus('idle'); } setHolidayDraft(''); }}
              className="px-4 rounded-2xl bg-[var(--surface-2)] text-[var(--primary)] font-bold text-[13px] shrink-0"
            >
              Add
            </button>
          </div>
        </div>
      </OwnerSection>

      <OwnerSection title="Member pricing" icon="star" description="Give your venue members a discount. Add members from the Membership tab; the discount applies automatically at checkout for them.">
        <FormField
          label="Member discount (%)"
          hint="Percent off the booking rate for venue members. 0 = no member discount."
          value={form.memberDiscountPercent}
          inputMode="numeric"
          onChange={(e) => set('memberDiscountPercent')(e.target.value.replace(/[^\d]/g, ''))}
        />
      </OwnerSection>

      <OwnerSection title="Per-player surcharge" icon="groups" description="Charge a base court rate plus a fee per extra player (e.g. ₱800 base + ₱100 per extra head). Leave the fee blank for flat court pricing.">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Fee per extra player (₱)" value={form.perPlayerFee} inputMode="decimal" onChange={(e) => set('perPlayerFee')(e.target.value.replace(/[^\d.]/g, ''))} />
          <FormField label="Players included" hint="Heads covered by the base rate before the fee applies." value={form.perPlayerFeeThreshold} inputMode="numeric" onChange={(e) => set('perPlayerFeeThreshold')(e.target.value.replace(/[^\d]/g, ''))} />
        </div>
        {(Number(form.perPlayerFee) || 0) > 0 && (
          <p className="t-sm text-[var(--muted)] mt-2">
            Players past <strong className="text-[var(--ink)]">{Number(form.perPlayerFeeThreshold) || 1}</strong> are charged an extra <strong className="text-[var(--ink)]">₱{Number(form.perPlayerFee).toLocaleString()}</strong> each.
          </p>
        )}
      </OwnerSection>

      <OwnerSection title="Cancellation & refund policy" icon="close" description="Set the rules players see before booking. The platform enforces these automatically.">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Cancel window (hrs)"
            hint="Hours before booking start where free cancellation is allowed."
            value={cancelWindow}
            inputMode="numeric"
            onChange={(e) => { setCancelWindow(e.target.value.replace(/[^\d]/g, '')); setStatus('idle'); }}
          />
          <FormField
            label="Refund %"
            hint="Percent refunded if cancelled within the window."
            value={refundPct}
            inputMode="numeric"
            onChange={(e) => { setRefundPct(e.target.value.replace(/[^\d]/g, '')); setStatus('idle'); }}
          />
        </div>
        <div className="field p-0! mt-3">
          <FormField
            label="No-show fee (₱)"
            hint="Extra charge on top of lost payment when a player doesn't show. 0 = no extra fee."
            value={noShowFee}
            inputMode="decimal"
            onChange={(e) => { setNoShowFee(e.target.value.replace(/[^\d.]/g, '')); setStatus('idle'); }}
          />
          <p className="t-sm text-[var(--muted)] mt-2">
            Current policy: players who cancel <strong className="text-[var(--ink)]">{cancelWindow || '24'} hours</strong> ahead get <strong className="text-[var(--ink)]">{refundPct || '100'}%</strong> back.
            {(Number(noShowFee) || 0) > 0 ? <> No-shows are charged an extra <strong className="text-[var(--ink)]">₱{Number(noShowFee).toLocaleString()}</strong>.</> : ' No-shows forfeit their payment.'}
          </p>
        </div>
      </OwnerSection>

      <OwnerSection title="Amenities" icon="check" description="Tap what your venue offers.">
        <div className="flex flex-wrap gap-2">
          {AMENITIES.map((a) => {
            const on = amenities[a.key as string];
            return (
              <Chip
                key={a.key as string}
                selected={on}
                onClick={() => {
                  setAmenities((m) => ({ ...m, [a.key as string]: !m[a.key as string] }));
                  setStatus('idle');
                }}
              >
                {on && <Icon name="check" size={12} />}
                {a.label}
              </Chip>
            );
          })}
        </div>
      </OwnerSection>

      <OwnerSection title="Highlights" icon="star" description="Curated by PickleBallers from real activity and your venue details — not editable here.">
        <div className="space-y-3.5">
          <div className="rounded-xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-3.5">
            <div className="text-[12px] text-[var(--ink-2)] leading-snug">
              “Best for” and “What players like” are generated from your amenities, ratings and booking activity — so players see verified strengths, not marketing claims. Keep your amenities and details accurate to shape them.
            </div>
            {curated.bestFor.length > 0 && (
              <div className="mt-3">
                <div className="t-eyebrow mb-1.5">Best for</div>
                <div className="flex flex-wrap gap-1.5">
                  {curated.bestFor.map((h) => (
                    <span key={h} className="inline-flex items-center rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] px-2.5 py-1 text-[12px] font-semibold">{h}</span>
                  ))}
                </div>
              </div>
            )}
            {curated.whatPlayersLike.length > 0 && (
              <div className="mt-3">
                <div className="t-eyebrow mb-1.5">What players like</div>
                <div className="flex flex-wrap gap-1.5">
                  {curated.whatPlayersLike.map((h) => (
                    <span key={h} className="inline-flex items-center rounded-full bg-[var(--bg)] border-[0.5px] border-[var(--hairline)] text-[var(--ink-2)] px-2.5 py-1 text-[12px] font-semibold">{h}</span>
                  ))}
                </div>
              </div>
            )}
            {curated.bestFor.length === 0 && curated.whatPlayersLike.length === 0 && (
              <div className="mt-2.5 text-[12px] text-[var(--muted)]">No highlights yet — add amenities and details above and they’ll appear as your venue fills out.</div>
            )}
          </div>
          <TagField label="Amenity chips" value={chips.amenityChips} onChange={(v) => { setChips((c) => ({ ...c, amenityChips: v })); setStatus('idle'); }} />
          <TagField label="Things to know" value={chips.thingsToKnow} onChange={(v) => { setChips((c) => ({ ...c, thingsToKnow: v })); setStatus('idle'); }} />
        </div>
      </OwnerSection>

      {status === 'error' && <div className="t-sm text-[var(--coral)] font-bold text-center">Couldn't save. Try again.</div>}
      {slugBlocked && <div className="t-sm text-[var(--coral)] font-bold text-center">Pick a free custom link before saving.</div>}
      <Button fullWidth onClick={onSave} disabled={status === 'saving' || slugBlocked}>
        {status === 'saving' ? 'Saving…' : status === 'saved' ? <><Icon name="check" size={18} /> Saved</> : 'Save changes'}
      </Button>

      <OwnerSection title="Danger zone" icon="close" description="Deleting removes this venue and its listing. This can't be undone.">
        {confirmDelete ? (
          <div className="rounded-xl bg-[var(--coral-soft)] p-3.5">
            <div className="text-[13px] font-bold text-[var(--ink)]">Delete “{venue.displayName || 'this venue'}”?</div>
            <div className="text-[12px] text-[var(--ink-2)] mt-0.5">
              It will be removed from your venues and stop accepting bookings. This can’t be undone.
            </div>
            {deleteError && <div className="t-sm text-[var(--coral)] font-bold mt-2">Couldn’t delete it. Try again.</div>}
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 h-11 rounded-xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] text-[var(--ink)] font-heading font-semibold text-[13px] disabled:opacity-50"
              >
                Keep venue
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="flex-1 h-11 rounded-xl bg-[var(--coral)] text-white font-heading font-bold text-[13px] flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleting
                  ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={15} /></span> Deleting…</>
                  : <>Yes, delete it</>}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setConfirmDelete(true); setDeleteError(false); }}
            className="w-full h-11 rounded-xl bg-[var(--coral)]/12 text-[var(--coral)] font-heading font-bold text-[14px] flex items-center justify-center gap-1.5"
          >
            <Icon name="close" size={16} /> Delete venue
          </button>
        )}
      </OwnerSection>

      <Toast message="Listing saved" show={status === 'saved'} />
    </div>
  );
}
