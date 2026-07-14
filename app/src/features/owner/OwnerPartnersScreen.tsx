import { useCallback, useEffect, useRef, useState } from 'react';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { Segmented } from '../../shared/components/ui/Segmented';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Toast } from '../../shared/components/ui/Toast';
import { KpiCard } from './components/KpiCard';
import {
  apiImageUrl,
  approveCoachApplication,
  approveOrganizerApplication,
  getOwnerPartners,
  rejectCoachApplication,
  rejectOrganizerApplication,
  removeCoachApplication,
  removeOrganizerApplication,
  startConversation,
  type ApiPartnerApplication,
  type PartnerStats,
  type OwnerPartnersFeed,
  type PartnerKind,
} from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerPartnersScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

type PartnerTab = 'all' | PartnerKind;

const TAB_OPTIONS: { value: PartnerTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'coach', label: 'Coaches' },
  { value: 'organizer', label: 'Organisers' },
];

const STATUS_CHIP: Record<ApiPartnerApplication['status'], { label: string; className: string }> = {
  pending: { label: 'Pending Review', className: 'bg-[#FFF3E0] text-[#E65100] border border-[#FFB74D]' },
  approved: { label: 'Approved', className: 'bg-[#E8F5E9] text-[#2E7D32] border border-[#81C784]' },
  rejected: { label: 'Rejected', className: 'bg-[#FFEBEE] text-[#C62828] border border-[#EF9A9A]' },
  removed: { label: 'Removed', className: 'bg-[#F5F5F5] text-[#9E9E9E] border border-[#E0E0E0]' },
};

const KIND_CHIP: Record<PartnerKind, { label: string; className: string }> = {
  coach: { label: 'Coach', className: 'bg-[#E3F2FD] text-[#1565C0]' },
  organizer: { label: 'Organiser', className: 'bg-[#EDE7F6] text-[#4527A0]' },
};

// ── Small inline SVG icons ──────────────────────────────────────────

function PinIco() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function AwardIco() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  );
}

function TargetIco() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function BriefcaseIco() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function CalendarIco() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// ── Rating stars ────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[#F59E0B]">
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name={i <= Math.round(rating) ? 'star' : 'star'} size={13} filled={i <= Math.round(rating)} />
      ))}
    </span>
  );
}

// Every stat on this screen comes from the API (`app.stats`), computed from the
// coach's profile, their completed lessons, and paid tournament entries.
//
// Until 2026-07-14 these were fabricated HERE from a hash of the partner's NAME
// — revenue, star rating, and even "PPR Certified" — and shown to the venue
// owner deciding whether to approve that partner. A stable hash made the numbers
// survive reloads, which is exactly what made them believable. If a stat is
// missing, render nothing. Never invent one.
// Tolerates null/undefined on purpose: a missing number must never white-screen
// the page. A stale server, a cached response, or a partner row from before the
// stats rollup existed should render ₱0, not take the whole screen down.
const peso = (n: number | null | undefined) => '₱' + (n ?? 0).toLocaleString();

/** Stats for a partner whose row predates the server-side rollup. All empty — we
 *  show nothing rather than guess. */
const NO_STATS: PartnerStats = {
  specialty: null, certification: null, rating: null,
  reviewCount: 0, sessions: null, eventCount: null, revenue: 0,
};

function sinceLabel(app: ApiPartnerApplication): string {
  return app.createdAt
    ? new Date(app.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';
}

// ── Card component ──────────────────────────────────────────────────

function PartnerCard({
  app,
  coverage,
  venueCount,
  totalVenues,
  busy,
  canDecide,
  canMessage,
  onDecide,
  onMessage,
}: {
  app: ApiPartnerApplication;
  coverage: string;
  venueCount: number;
  totalVenues: number;
  busy: boolean;
  canDecide: boolean;
  canMessage: boolean;
  onDecide: (action: 'approve' | 'reject' | 'remove') => void;
  onMessage: () => void;
}) {
  const statusChip = STATUS_CHIP[app.status];
  const kindChip = KIND_CHIP[app.kind];
  const isCoach = app.kind === 'coach';

  // Real, server-computed stats. Any of these may be null — show nothing then.
  const { specialty, certification, eventCount, rating, reviewCount, sessions, revenue } = app.stats ?? NO_STATS;
  const since = sinceLabel(app);

  return (
    <div className="rounded-xl border border-[var(--field-border)] bg-[var(--surface)] shadow-sm flex flex-col">
      {/* Top: avatar + name + role + status */}
      <div className="flex items-start justify-between gap-3 p-4 pb-0">
        <div className="flex items-start gap-3 min-w-0">
          <div className="relative shrink-0">
            <Avatar src={apiImageUrl(app.applicant.avatar)} name={app.applicant.name} size={40} />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-[#4CAF50]" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{app.applicant.name}</div>
            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${kindChip.className}`}>
              {kindChip.label}
            </span>
          </div>
        </div>
        <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusChip.className}`}>
          {statusChip.label}
        </span>
      </div>

      {/* Info rows — pending only shows real data (no demo stats) */}
      <div className="px-4 mt-3 space-y-2">
        <div className="flex items-start gap-2 text-[12px] text-[var(--ink-2)]">
          <span className="mt-0.5 shrink-0"><PinIco /></span>
          <div className="min-w-0">
            <span className="text-[var(--muted)]">{venueCount === 1 ? 'Venue: ' : 'Venues: '}</span>
            <span className="font-medium">{coverage}</span>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">{venueCount} of {totalVenues} venues</div>
          </div>
        </div>
        {app.status === 'pending' ? (
          <div className="flex items-center gap-2 text-[12px] text-[var(--ink-2)]">
            <CalendarIco />
            <span className="text-[var(--muted)]">Applied:</span>
            <span className="font-medium">{since}</span>
          </div>
        ) : isCoach ? (
          <>
            {specialty && (
              <div className="flex items-center gap-2 text-[12px] text-[var(--ink-2)]">
                <TargetIco />
                <span className="text-[var(--muted)]">Specialty:</span>
                <span className="font-medium">{specialty}</span>
              </div>
            )}
            {certification && (
              <div className="flex items-center gap-2 text-[12px] text-[var(--ink-2)]">
                <AwardIco />
                <span className="text-[var(--muted)]">Level:</span>
                <span className="font-medium">{certification}</span>
              </div>
            )}
          </>
        ) : (
          <>
            {specialty && (
              <div className="flex items-center gap-2 text-[12px] text-[var(--ink-2)]">
                <BriefcaseIco />
                <span className="text-[var(--muted)]">Focus:</span>
                <span className="font-medium">{specialty}</span>
              </div>
            )}
            {eventCount !== null && (
              <div className="flex items-center gap-2 text-[12px] text-[var(--ink-2)]">
                <CalendarIco />
                <span className="text-[var(--muted)]">Events:</span>
                <span className="font-medium">
                  {eventCount === 0 ? 'None yet' : `${eventCount} ${eventCount === 1 ? 'event' : 'events'} organised`}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Rating — only once someone has actually reviewed them */}
      {app.status !== 'pending' && rating !== null && (
        <div className="flex items-center gap-1.5 px-4 mt-3">
          <Stars rating={rating} />
          <span className="text-[12px] font-semibold text-[var(--ink-2)]">{rating}</span>
          <span className="text-[11px] text-[var(--muted)]">
            ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
          </span>
        </div>
      )}

      {/* Stats — real figures only; ₱0 until they've earned something */}
      {app.status !== 'pending' && (
        <>
          <div className="mx-4 mt-3 border-t border-[var(--field-border)]" />
          {isCoach ? (
            <div className="grid grid-cols-3 gap-2 px-4 py-3">
              <div className="text-center">
                <div className="text-[15px] font-bold text-[var(--ink)]">{sessions ?? '—'}</div>
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-wide">Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-bold text-[#F59E0B]">{peso(revenue)}</div>
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-wide">Revenue</div>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-bold text-[var(--ink)]">{since}</div>
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-wide">Since</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 px-4 py-3">
              <div className="text-center">
                <div className="text-[15px] font-bold text-[#F59E0B]">{peso(revenue)}</div>
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-wide">Revenue</div>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-bold text-[var(--ink)]">{since}</div>
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-wide">Since</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Buttons */}
      <div className="px-4 pb-4 mt-auto">
        {app.status === 'pending' && canDecide ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide('approve')}
              className="h-9 rounded-lg bg-[var(--primary)] text-white font-bold text-[12px] active:scale-95 transition-transform disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide('reject')}
              className="h-9 rounded-lg bg-[#FFEBEE] border border-[#EF9A9A] text-[#C62828] font-bold text-[12px] hover:bg-[#FFCDD2] active:scale-95 transition-all disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        ) : app.status === 'approved' && canDecide ? (
          <div className="grid grid-cols-2 gap-2">
            {canMessage && (
              <button
                type="button"
                disabled={busy}
                onClick={onMessage}
                className="h-9 rounded-lg border border-[var(--field-border)] bg-[var(--surface-2)] text-[var(--ink)] font-semibold text-[12px] active:scale-95 transition-transform disabled:opacity-50"
              >
                Message
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide('remove')}
              className="h-9 rounded-lg bg-[#FFEBEE] border border-[#EF9A9A] text-[#C62828] font-semibold text-[12px] hover:bg-[#FFCDD2] active:scale-95 transition-all disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ) : canMessage ? (
          <button
            type="button"
            disabled={busy}
            onClick={onMessage}
            className="h-9 w-full rounded-lg border border-[var(--field-border)] bg-[var(--surface-2)] text-[var(--ink)] font-semibold text-[12px] active:scale-95 transition-transform disabled:opacity-50"
          >
            Message
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Main screen ─────────────────────────────────────────────────────

export function OwnerPartnersScreen({ onNavigate, onBack }: OwnerPartnersScreenProps) {
  const user = useAuthStore((s) => s.user);
  const canCoaches = userHasPermission(user, 'owner.coaches.manage');
  const canOrganizers = userHasPermission(user, 'owner.tournaments.manage');
  const canMessage = userHasPermission(user, 'user.messages.send');

  const [feed, setFeed] = useState<OwnerPartnersFeed | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [tab, setTab] = useState<PartnerTab>('all');
  const [search, setSearch] = useState('');
  const [venueId, setVenueId] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  // In-app confirm popup (replaces window.confirm for reject / remove).
  const [confirm, setConfirm] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const load = useCallback(async (initial = false, vid = '') => {
    if (initial) setStatus('loading');
    try {
      setFeed(await getOwnerPartners(vid || undefined));
      setStatus('ready');
    } catch {
      if (initial) setStatus('error');
    }
  }, []);

  useEffect(() => { void load(true); }, [load]);

  const handleVenueChange = (vid: string) => {
    setVenueId(vid);
    void load(false, vid);
  };

  const decide = async (app: ApiPartnerApplication, action: 'approve' | 'reject' | 'remove') => {
    setActingId(app.id);
    try {
      const fn = app.kind === 'coach'
        ? (action === 'approve' ? approveCoachApplication : action === 'reject' ? rejectCoachApplication : removeCoachApplication)
        : (action === 'approve' ? approveOrganizerApplication : action === 'reject' ? rejectOrganizerApplication : removeOrganizerApplication);
      await fn(app.id);
      await load();
      showToast(action === 'approve' ? `${app.applicant.name} approved` : action === 'reject' ? 'Application rejected' : `${app.applicant.name} removed`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setActingId(null);
    }
  };

  // Reject / single-remove now confirm via an in-app popup instead of window.confirm.
  const requestDecide = (app: ApiPartnerApplication, action: 'approve' | 'reject' | 'remove') => {
    if (action === 'approve') { void decide(app, action); return; }
    const kindLabel = KIND_CHIP[app.kind].label.toLowerCase();
    setConfirm({
      title: action === 'reject' ? 'Reject application?' : 'Remove partner?',
      message: action === 'reject'
        ? `Reject ${app.applicant.name}'s application?`
        : `Remove ${app.applicant.name} as a ${kindLabel} at ${app.venue?.name ?? 'this venue'}?`,
      confirmLabel: action === 'reject' ? 'Reject' : 'Remove',
      onConfirm: () => decide(app, action),
    });
  };

  // Group-level remove: revokes the partner's approved grant at EVERY venue.
  const removeAll = async (apps: ApiPartnerApplication[]) => {
    const approved = apps.filter((a) => a.status === 'approved');
    if (!approved.length) return;
    const who = approved[0].applicant.name;
    setActingId(approved[0].id);
    try {
      for (const a of approved) {
        const fn = a.kind === 'coach' ? removeCoachApplication : removeOrganizerApplication;
        await fn(a.id);
      }
      await load();
      showToast(`${who} removed`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setActingId(null);
    }
  };

  const requestRemoveAll = (apps: ApiPartnerApplication[]) => {
    const approved = apps.filter((a) => a.status === 'approved');
    if (!approved.length) return;
    const who = approved[0].applicant.name;
    const kindLabel = KIND_CHIP[approved[0].kind].label.toLowerCase();
    setConfirm({
      title: 'Remove partner?',
      message: `Remove ${who} as a ${kindLabel} from all ${approved.length} venue${approved.length === 1 ? '' : 's'}?`,
      confirmLabel: 'Remove',
      onConfirm: () => removeAll(apps),
    });
  };

  const message = async (app: ApiPartnerApplication) => {
    setActingId(app.id);
    try {
      const conv = await startConversation(app.applicant.userId);
      onNavigate('chat', { id: conv.id, name: app.applicant.name });
    } catch {
      showToast("Couldn't open the conversation");
    } finally {
      setActingId(null);
    }
  };

  const partners = feed?.partners ?? [];
  const q = search.trim().toLowerCase();
  const visible = partners.filter((p) =>
    (tab === 'all' || p.kind === tab)
    && (!q || p.applicant.name.toLowerCase().includes(q) || (p.venue?.name ?? '').toLowerCase().includes(q)),
  );

  // One card per PERSON per kind (not per venue application) — matching the
  // KPI counts. A pending application anywhere makes the card "Pending Review"
  // (Approve/Reject act on that application); otherwise the newest approved
  // application represents the partner.
  const groupMap = new Map<string, ApiPartnerApplication[]>();
  for (const p of visible) {
    const k = `${p.kind}|${p.applicant.userId}`;
    if (!groupMap.has(k)) groupMap.set(k, []);
    groupMap.get(k)!.push(p);
  }
  const groups = [...groupMap.entries()]
    .map(([key, apps]) => {
      const pending = apps.find((a) => a.status === 'pending');
      const rep = pending ?? apps.find((a) => a.status === 'approved') ?? apps[0];
      return { key, apps, rep, pending };
    })
    // A fully removed/rejected partner (no pending or approved application
    // left) drops off the list entirely.
    .filter((g) => g.rep.status === 'pending' || g.rep.status === 'approved');

  const canDecide = (kind: PartnerKind) => (kind === 'coach' ? canCoaches : canOrganizers);

  // Coverage: "All Venues" if the partner is at every owner venue, otherwise a
  // comma-separated list of the venues they're at.
  const totalVenues = feed?.venues?.length ?? 0;
  const venueNamesByUser = new Map<string, string[]>();
  for (const p of partners) {
    if (!venueNamesByUser.has(p.applicant.userId)) venueNamesByUser.set(p.applicant.userId, []);
    const name = p.venue?.name;
    if (name && !venueNamesByUser.get(p.applicant.userId)!.includes(name)) {
      venueNamesByUser.get(p.applicant.userId)!.push(name);
    }
  }
  const coverageFor = (app: ApiPartnerApplication) => {
    const names = venueNamesByUser.get(app.applicant.userId) ?? [];
    if (names.length === 0) return app.venue?.name ?? '—';
    return names.length >= totalVenues ? 'All Venues' : names.join(', ');
  };
  const venueCountFor = (app: ApiPartnerApplication) =>
    venueNamesByUser.get(app.applicant.userId)?.length ?? (app.venue ? 1 : 0);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {(feed?.venues?.length ?? 0) > 1 && (
        <select
          id="partner-venue"
          value={venueId}
          onChange={(e) => handleVenueChange(e.target.value)}
          className="h-9 max-w-[200px] rounded-full bg-[var(--surface)] border border-[var(--field-border)] px-3 text-[13px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--primary)]"
        >
          <option value="">All venues</option>
          {feed?.venues.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={() => showToast('Partner invites are coming soon')}
        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[var(--primary)] text-white font-bold text-[13px] active:scale-95 transition-transform whitespace-nowrap"
      >
        <Icon name="plus" size={15} /> Invite Partner
      </button>
    </div>
  );

  const header = (
    <ScreenHeader
      onBack={onBack}
      eyebrow="Owner console"
      title="Partners"
      subtitle="Coaches & organisers at your venues"
      action={<div className="hidden sm:flex sm:items-center sm:gap-2">{toolbar}</div>}
    />
  );

  if (status === 'loading') {
    return <div className="scroll safe-top safe-bottom">{header}<div className="px-5"><LoadingSkeleton variant="card" count={4} /></div></div>;
  }
  if (status === 'error') {
    return <div className="scroll safe-top safe-bottom">{header}<div className="px-5"><ErrorState title="Couldn't load partners" message="We couldn't reach your venues. Tap to retry." onRetry={() => void load(true)} /></div></div>;
  }

  // The server owns the revenue rollup — it counts each distinct approved
  // partner once and only from real earnings. Don't recompute it here.
  const kpis = feed?.kpis ?? { activeCoaches: 0, activeOrganizers: 0, pendingReview: 0, partnerRevenue: 0 };

  return (
    <div className="scroll safe-top safe-bottom">
      {header}
      <div className="px-5 space-y-4 pb-6">

        {/* Toolbar: mobile-only */}
        <div className="sm:hidden">{toolbar}</div>

        {/* KPI summary cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard label="Active coaches" value={String(kpis.activeCoaches)} icon="school" tone="primary" sub="Approved at your venues" />
          <KpiCard label="Active organisers" value={String(kpis.activeOrganizers)} icon="trophy" tone="blue" sub="Approved at your venues" />
          <KpiCard label="Pending review" value={String(kpis.pendingReview)} icon="hourglass_top" tone="coral" sub="Awaiting your decision" />
          <KpiCard label="Partner revenue" value={peso(kpis.partnerRevenue)} icon="payments" tone="lime" sub="From completed lessons & paid entries" />
        </div>

        {/* Kind tabs + search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Segmented className="sm:min-w-[280px]" value={tab} onChange={setTab} options={TAB_OPTIONS} />
          <div className="relative flex-1 min-w-0">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or venue"
              aria-label="Search partners"
              className="w-full h-9 pl-9 pr-3 rounded-full bg-[var(--surface)] border border-[var(--field-border)] text-[13px] font-semibold text-[var(--ink)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--primary)]"
            />
          </div>
        </div>

        {/* Partner cards — pending reviews first, divider, then approved. */}
        {groups.length === 0 ? (
          tab === 'organizer' ? (
            <EmptyState icon="trophy" title="No organiser applications yet" description="Organisers will be able to apply to run events at your venues — their applications will land here for review." />
          ) : (
            <EmptyState icon="groups" title={q ? 'No matches' : 'No partner applications yet'} description={q ? 'Try a different name or venue.' : 'When a player applies to coach or organise at one of your venues, the application shows up here.'} />
          )
        ) : (() => {
          const pendingGroups = groups.filter((g) => g.rep.status === 'pending');
          const approvedGroups = groups.filter((g) => g.rep.status !== 'pending');
          const renderGrid = (list: typeof groups) => (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {list.map((g) => (
                <PartnerCard
                  key={g.key}
                  app={g.rep}
                  coverage={coverageFor(g.rep)}
                  venueCount={venueCountFor(g.rep)}
                  totalVenues={totalVenues}
                  busy={g.apps.some((a) => actingId === a.id)}
                  canDecide={canDecide(g.rep.kind)}
                  canMessage={canMessage}
                  onDecide={(action) => {
                    // Approve/Reject act on the pending application; Remove
                    // revokes the partner from every venue at once.
                    if (action === 'remove') { requestRemoveAll(g.apps); return; }
                    if (g.pending) { requestDecide(g.pending, action); }
                  }}
                  onMessage={() => { void message(g.rep); }}
                />
              ))}
            </div>
          );
          return (
            <>
              {pendingGroups.length > 0 && (
                <>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#E65100]">Pending review</div>
                  {renderGrid(pendingGroups)}
                  {approvedGroups.length > 0 && <hr className="border-[var(--field-border)]" />}
                </>
              )}
              {approvedGroups.length > 0 && (
                <>
                  {pendingGroups.length > 0 && (
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Approved</div>
                  )}
                  {renderGrid(approvedGroups)}
                </>
              )}
            </>
          );
        })()}
      </div>
      <Toast message={toast} show={!!toast} />

      {/* Confirm popup — replaces window.confirm for reject / remove actions. */}
      {confirm && (
        <div
          className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/45 px-6"
          role="alertdialog"
          aria-modal="true"
          aria-label={confirm.title}
          onClick={() => setConfirm(null)}
        >
          <div
            className="w-full max-w-[360px] rounded-[18px] bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-xl p-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#FFEBEE] text-[#C62828] mb-3">
              <Icon name="error" size={22} />
            </span>
            <div className="font-heading font-bold text-[16px] text-[var(--ink)]">{confirm.title}</div>
            <p className="text-[13px] text-[var(--muted)] mt-1">{confirm.message}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="h-10 rounded-full border border-[var(--field-border)] bg-[var(--surface-2)] text-[var(--ink)] font-bold text-[13px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { const fn = confirm.onConfirm; setConfirm(null); fn(); }}
                className="h-10 rounded-full bg-[#C62828] text-white font-bold text-[13px]"
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
