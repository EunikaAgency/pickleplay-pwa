import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { BottomSheet } from '../../../shared/components/ui/BottomSheet';
import { OwnerSection } from '../components/OwnerSection';
import { OwnerStat } from '../components/OwnerStat';
import { getVenueBookings, listVenueMembers, addVenueMember, removeVenueMember, searchPlayers, type ApiBooking, type ApiPlayer, type VenueMember, type OwnerVenueDetail } from '../../../shared/lib/api';
import type { Navigate } from '../../../shared/lib/navigation';

interface MembersTabProps {
  venueId: string;
  venue: OwnerVenueDetail;
  onNavigate: Navigate;
}

// The venue's public link — the owner's custom booking slug, else the system
// slug — deep-links to the court page where players book and join the membership
// (matches BookingLinkShare).
function inviteLinkFor(venue: OwnerVenueDetail): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const slug = (venue.bookingSlug && String(venue.bookingSlug)) || venue.slug || venue.id || '';
  return `${origin}/venues/${slug}`;
}

// A compact "invite link" control for the section header — shares (or copies) the
// venue's public link so the owner can invite players to join the membership.
function InviteLink({ venue }: { venue: OwnerVenueDetail }) {
  const [copied, setCopied] = useState(false);
  const link = inviteLinkFor(venue);

  const onClick = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: venue.displayName || 'Join us on PickleBallers',
          text: `Become a member at ${venue.displayName || 'our venue'} on PickleBallers`,
          url: link,
        });
        return;
      } catch {
        /* user dismissed the share sheet — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Share invite link"
      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-[var(--surface-2)] text-[var(--primary)] font-bold text-[12px]"
    >
      <Icon name={copied ? 'check' : 'link'} size={14} />
      {copied ? 'Copied' : 'Invite link'}
    </button>
  );
}

// Friendly label for a stored membership tier (the plan id the player chose, or a
// free-text tier the owner set). Kept local so the owner slice doesn't import the
// player-side membership plans.
const PLAN_LABELS: Record<string, string> = { monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual' };
function planLabel(tier: string | null | undefined): string {
  if (!tier) return 'Member';
  return PLAN_LABELS[tier] ?? tier;
}

function sinceLabel(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

// A candidate the owner can manually grant a membership to — someone who has
// booked/played here but isn't a member yet. Built from the bookings inbox; only
// platform players (a real account) can carry a membership, so off-app manual
// customers and blocked slots are skipped.
interface Candidate {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  visits: number;
}
function buildCandidates(bookings: ApiBooking[]): Candidate[] {
  const map = new Map<string, Candidate>();
  for (const b of bookings) {
    if (b.bookingType === 'blocked' || b.bookingType === 'manual') continue;
    if (!b.userId || b.status === 'cancelled') continue;
    const key = String(b.userId);
    const c = map.get(key) || { userId: key, name: b.userName?.trim() || 'Player', avatarUrl: b.userAvatarUrl, visits: 0 };
    c.visits += 1;
    map.set(key, c);
  }
  return [...map.values()].sort((a, b) => b.visits - a.visits);
}

// Members tab: the venue's actual members — players who availed a membership
// (via the venue's "Join Membership" flow) plus anyone the owner added by hand.
// Member pricing (Venue.memberDiscountPercent) applies to them. This is NOT the
// rolled-up community of everyone who's booked or played — booking a court does
// not make someone a member.
export function MembersTab({ venueId, venue }: MembersTabProps) {
  const [members, setMembers] = useState<VenueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<string | null>(null); // userId mid-mutation

  // Candidate pool for the manual "Add member" picker — lazy-loaded when opened.
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [bookingsLoaded, setBookingsLoaded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Search — lets the owner find any player (not just past visitors) to add.
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ApiPlayer[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const discount = Number(venue.memberDiscountPercent) || 0;

  const loadMembers = () => {
    setLoading(true);
    setError(false);
    listVenueMembers(venueId)
      .then((rows) => { setMembers(rows); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    let cancelled = false;
    listVenueMembers(venueId)
      .then((rows) => { if (!cancelled) { setMembers(rows); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [venueId]);

  // Fetch the candidate pool only when the owner first opens "Add member".
  useEffect(() => {
    if (!addOpen || bookingsLoaded) return;
    let cancelled = false;
    getVenueBookings(venueId)
      .then((d) => { if (!cancelled) setBookings(d); })
      .catch(() => { /* the sheet just shows the invite-link fallback */ })
      .finally(() => { if (!cancelled) setBookingsLoaded(true); });
    return () => { cancelled = true; };
  }, [addOpen, venueId, bookingsLoaded]);

  const memberUserIds = useMemo(() => new Set(members.map((m) => String(m.userId))), [members]);
  const candidates = useMemo(
    () => buildCandidates(bookings).filter((c) => !memberUserIds.has(c.userId)),
    [bookings, memberUserIds],
  );

  // Debounced search — lets the owner find any player (not just past visitors).
  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      const trimmed = q.trim();
      if (!trimmed) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }
      setSearchLoading(true);
      searchTimer.current = setTimeout(async () => {
        try {
          const rows = await searchPlayers(trimmed);
          setSearchResults(rows.filter((p) => !memberUserIds.has(p.id)));
        } catch {
          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
      }, 350);
    },
    [memberUserIds],
  );

  // Clear search state when the sheet closes so it resets on reopen.
  const closeAddSheet = () => {
    setAddOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchLoading(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
  };

  const addMember = async (userId: string) => {
    setPending(userId);
    try {
      await addVenueMember(venueId, userId);
      // Refetch to get the identity-enriched row; the picker recomputes and drops them.
      const rows = await listVenueMembers(venueId);
      setMembers(rows);
    } catch {
      /* leave the list as-is on failure (e.g. already a member) */
    } finally {
      setPending(null);
    }
  };

  const removeMember = async (userId: string) => {
    setPending(userId);
    const prev = members;
    setMembers((ms) => ms.filter((m) => String(m.userId) !== userId)); // optimistic
    try {
      await removeVenueMember(venueId, userId);
    } catch {
      setMembers(prev); // restore on failure
    } finally {
      setPending(null);
    }
  };

  const addMemberBtn = (
    <button
      type="button"
      onClick={() => setAddOpen(true)}
      className="mt-3 w-full flex items-center justify-center gap-2 h-11 rounded-2xl bg-[var(--ink)] text-white font-heading font-bold text-[14px]"
    >
      <Icon name="add" size={18} /> Add member
    </button>
  );

  const addSheet = (
    <BottomSheet
      open={addOpen}
      onClose={closeAddSheet}
      title="Add a member"
      subtitle="Search any player by name, or pick from past visitors below."
    >
      {/* ── Search ─────────────────────────────────────────── */}
      <div className="px-5 pb-1">
        <div className="flex items-center gap-2 px-3 h-10 rounded-xl bg-[var(--surface-2)]">
          <Icon name="search" size={18} className="text-[var(--muted)] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search players by name…"
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)]"
          />
          {searchLoading && (
            <span className="shrink-0 w-4 h-4 border-2 border-[var(--muted)] border-t-transparent rounded-full animate-spin" />
          )}
          {searchQuery && !searchLoading && (
            <button type="button" onClick={() => handleSearch('')} className="shrink-0 text-[var(--muted)]">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Results ────────────────────────────────────────── */}
      {searchQuery ? (
        searchLoading ? (
          <div className="px-5 py-6 t-sm text-center">Searching…</div>
        ) : searchResults.length === 0 ? (
          <div className="px-5 py-6 t-sm text-center text-[var(--muted)]">
            No players found for "{searchQuery}". Try a different name.
          </div>
        ) : (
          <div className="px-3 pb-3 space-y-1">
            {searchResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addMember(p.id)}
                disabled={pending === p.id}
                className="w-full flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                <Avatar name={p.displayName} src={p.avatarUrl} size={38} className="shrink-0" />
                <div className="min-w-0 flex-1 text-left">
                  <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{p.displayName}</div>
                  {p.skillLevelLabel && (
                    <div className="t-sm truncate">{p.skillLevelLabel}</div>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 px-3 h-8 rounded-full bg-[var(--primary)] text-white font-bold text-[12px] shrink-0">
                  <Icon name="add" size={14} /> Add
                </span>
              </button>
            ))}
          </div>
        )
      ) : (
        /* ── Past-visitor candidates (no search) ──────────── */
        !bookingsLoaded ? (
          <div className="px-5 py-6 t-sm text-center">Loading players…</div>
        ) : candidates.length === 0 ? (
          <div className="px-5 py-6 t-sm text-center text-[var(--muted)]">
            No one to add yet — everyone who's played here is already a member. Search above or share your
            invite link so more players can join.
          </div>
        ) : (
          <div className="px-3 pb-3 space-y-1">
            {candidates.map((c) => (
              <button
                key={c.userId}
                type="button"
                onClick={() => addMember(c.userId)}
                disabled={pending === c.userId}
                className="w-full flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                <Avatar name={c.name} src={c.avatarUrl} size={38} className="shrink-0" />
                <div className="min-w-0 flex-1 text-left">
                  <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{c.name}</div>
                  <div className="t-sm truncate">{c.visits} booking{c.visits === 1 ? '' : 's'} here</div>
                </div>
                <span className="inline-flex items-center gap-1 px-3 h-8 rounded-full bg-[var(--primary)] text-white font-bold text-[12px] shrink-0">
                  <Icon name="add" size={14} /> Add
                </span>
              </button>
            ))}
          </div>
        )
      )}
    </BottomSheet>
  );

  if (loading) return <div className="t-sm py-2">Loading members…</div>;
  if (error) {
    return (
      <div className="t-sm text-[var(--coral)]">
        Couldn't load members. <button type="button" className="underline font-bold" onClick={loadMembers}>Retry</button>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <OwnerSection
        title="Members"
        icon="group"
        description="Players who've joined your venue's membership."
        action={<InviteLink venue={venue} />}
      >
        <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">
          No members yet. When a player joins your membership from your venue's page, they'll show up here.
          Booking a court or playing a game doesn't make someone a member.
        </div>
        {addMemberBtn}
        {addSheet}
      </OwnerSection>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <OwnerStat label="Members" value={members.length} icon="group" tone="primary" />
        <OwnerStat label="Member rate" value={discount > 0 ? `${discount}% off` : 'Not set'} icon="sell" tone="lime" />
      </div>

      <OwnerSection
        title="Members"
        icon="group"
        description={`${members.length} ${members.length === 1 ? 'player has' : 'players have'} joined your membership.`}
        action={<InviteLink venue={venue} />}
      >
        <div className="space-y-1">
          {members.map((m) => {
            const name = m.displayName?.trim() || m.email || 'Member';
            const userId = String(m.userId);
            return (
              <div key={m.id} className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl hover:bg-[var(--surface-2)]">
                <Avatar name={name} src={m.avatarUrl} size={38} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[14px] text-[var(--ink)] truncate">{name}</span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)] shrink-0">
                      <Icon name="star" size={10} /> {planLabel(m.tier)}
                    </span>
                  </div>
                  <div className="t-sm truncate">
                    Member{sinceLabel(m.createdAt) ? ` since ${sinceLabel(m.createdAt)}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeMember(userId)}
                  disabled={pending === userId}
                  aria-label={`Remove ${name} from members`}
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[var(--muted)] bg-[var(--surface-2)] disabled:opacity-50"
                >
                  <Icon name="person_remove" size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="t-sm text-[var(--muted)] mt-3">
          <Icon name="info" size={13} className="inline mr-1" />
          {discount > 0
            ? <>Members get <strong className="text-[var(--ink)]">{discount}% off</strong> at checkout. Players join from your venue's page; adjust the rate on the Listing tab.</>
            : <>Players join your membership from your venue's page. Set a member discount on the Listing tab to give members a special rate.</>}
        </div>

        {addMemberBtn}
        {addSheet}
      </OwnerSection>
    </div>
  );
}
