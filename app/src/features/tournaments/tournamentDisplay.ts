import type { ApiTournament, TournamentStatus } from '../../shared/lib/api';

/* Player-facing tournament formatters. Kept local to the tournaments slice so it
 * never cross-imports the organizer feature (the vertical-slice rule). */

// Statuses a player can discover on the Tournament tab (drafts / pending / cancelled
// are organizer-only and never surfaced here). `open`/`closed` are legacy seed
// statuses the API still exposes publicly.
export const PUBLIC_TOURNAMENT_STATUSES: TournamentStatus[] = ['approved', 'registration_open', 'open', 'ongoing', 'completed', 'closed'];

export interface StatusMeta {
  label: string;
  /** Visual variant — maps to a `.tt-chip--<tone>` class. */
  tone: 'open' | 'soon' | 'live' | 'done' | 'muted';
}

export function statusMeta(status: TournamentStatus): StatusMeta {
  switch (status) {
    case 'registration_open':
    case 'open': return { label: 'Registration open', tone: 'open' };
    case 'approved': return { label: 'Coming up', tone: 'soon' };
    case 'ongoing': return { label: 'In progress', tone: 'live' };
    case 'completed': return { label: 'Completed', tone: 'done' };
    case 'closed': return { label: 'Registration closed', tone: 'muted' };
    default: return { label: status.replace(/_/g, ' '), tone: 'muted' };
  }
}

const TYPE_LABELS: Record<string, string> = {
  singles: 'Singles', doubles: 'Doubles', mixed: 'Mixed doubles', team: 'Team event',
};
export function typeLabel(t: ApiTournament): string {
  const k = (t.tournamentType || '').toLowerCase();
  return TYPE_LABELS[k] || 'Tournament';
}

// Bracket/format value → friendly label (handles both the app's snake_case and
// the web's Title Case values).
export function formatLabel(format?: string): string {
  if (!format) return '';
  return format
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Peso amount. 0 / unset reads as "Free".
export function money(v?: number | string): string {
  const n = Number(v);
  if (!n || Number.isNaN(n)) return 'Free';
  return `₱${n.toLocaleString()}`;
}

// A YYYY-MM-DD (or ISO) date → "Sat, Jun 27". Returns '' when absent/unparseable.
export function prettyDate(d?: string): string {
  if (!d) return '';
  const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// "Sat, Jun 27 – Sun, Jun 28" (collapses to one date when start == end / no end).
export function dateRange(t: ApiTournament): string {
  const start = prettyDate(t.startDate);
  const end = t.endDate && t.endDate !== t.startDate ? prettyDate(t.endDate) : '';
  return [start, end].filter(Boolean).join(' – ') || 'Dates TBD';
}
