import type { ApiCoach, ApiCoachService, CoachBookingStatus } from '../../shared/lib/api';

/** Currency symbol for the coach's price currency (PHP is the only seeded one). */
export function currencySymbol(code?: string | null): string {
  switch ((code || 'PHP').toUpperCase()) {
    case 'PHP': return '₱';
    case 'USD': return '$';
    case 'EUR': return '€';
    default: return `${code} `;
  }
}

export function money(amount: number, currency?: string | null): string {
  return `${currencySymbol(currency)}${amount.toLocaleString('en-PH')}`;
}

/** Headline hourly rate, falling back to the generic `rateFrom` import field. */
export function coachRate(coach: Pick<ApiCoach, 'pricePrivatePerHour' | 'priceCurrency'> & { rateFrom?: number | null }): string {
  const rate = coach.pricePrivatePerHour ?? coach.rateFrom;
  if (!rate) return '—';
  return money(rate, coach.priceCurrency);
}

/** Where the coach works. Imported rows use `location`; self-created ones `cityPrimary`. */
export function coachLocation(coach: Pick<ApiCoach, 'cityPrimary' | 'location'>): string {
  return coach.cityPrimary || coach.location || '';
}

export function serviceLabel(service: ApiCoachService): string {
  return service.name || (service.durationMinutes ? `${service.durationMinutes}-min session` : 'Session');
}

export function serviceDuration(service: ApiCoachService): string {
  const m = service.durationMinutes;
  if (!m) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

/** Status chip copy + token colour for a coaching session. */
export function coachBookingChip(status: CoachBookingStatus): { label: string; color: string } {
  switch (status) {
    case 'pending':   return { label: 'Awaiting coach', color: 'var(--amber, #F59E0B)' };
    case 'confirmed': return { label: 'Confirmed', color: 'var(--primary)' };
    case 'declined':  return { label: 'Declined', color: 'var(--coral)' };
    case 'cancelled': return { label: 'Cancelled', color: 'var(--muted)' };
    case 'completed': return { label: 'Completed', color: 'var(--muted)' };
  }
}

/** "Mon, 14 Jul · 09:00" */
export function sessionWhen(date: string, startTime: string): string {
  const d = new Date(`${date}T00:00:00`);
  const day = d.toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} · ${startTime}`;
}
