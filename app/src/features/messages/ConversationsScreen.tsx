import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActionMenu } from '../../shared/components/ui/ActionMenu';
import { Avatar } from '../../shared/components/ui/Avatar';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { Icon } from '../../shared/components/ui/Icon';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { Toast } from '../../shared/components/ui/Toast';
import {
  listConversations,
  searchPlayers,
  getOwnerPlayerSuggestions,
  startConversation,
  deleteConversation,
  markConversationRead,
  markConversationUnread,
  reportConversation,
  apiImageUrl,
  type ApiConversationSummary,
  type ApiPlayer,
  type OwnerPlayerSuggestion,
} from '../../shared/lib/api';
import { onRealtime } from '../../shared/lib/realtimeBus';
import { REPORT_REASONS } from '../../shared/lib/reportReasons';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import type { Navigate } from '../../shared/lib/navigation';

interface ConversationsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

/** Strip notification-metadata prefixes that leak into lastBody so the
 *  conversation preview shows the actual message, not "chat Sender — msg".
 *  Only strips " — " when a notification prefix was removed, so normal
 *  messages like "Got it — see you there" are left intact. */
const NOTIF_TYPE_PREFIXES = [
  'chat', 'forum', 'message', 'alert', 'game_full', 'game_open',
  'venue_membership_invite', 'venue_membership_removed',
  'booking_pending_approval', 'booking_approved',
  'booking_request_reminder', 'booking_request_expired', 'booking_rejected',
  'booking_cancelled',
];
function cleanPreview(body: string): string {
  let s = body;
  let stripped = false;
  for (const p of NOTIF_TYPE_PREFIXES) {
    if (s.startsWith(p + ' ')) { s = s.slice(p.length + 1); stripped = true; break; }
  }
  if (stripped) {
    const dash = s.indexOf(' — ');
    if (dash !== -1) s = s.slice(dash + 3);
  }
  return s || body;
}

/** Short relative time for a conversation's last activity, or a booking's age. */
function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Short booking date: "Jun 30" or "Jun 30, 2026" for past years. */
function prettyBookingDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  if (Number.isNaN(d.getTime())) return dateStr;
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

/** "HH:MM" → "3:00 PM". */
function to12h(t?: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Consider a user "active" if their last activity was within this many minutes. */
const ACTIVE_WINDOW_MIN = 5;

function isActive(iso?: string | null): boolean {
  if (!iso) return false;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return false;
  return (Date.now() - ts) < ACTIVE_WINDOW_MIN * 60_000;
}

// ─── Realtime event types ───────────────────────────────────────

interface RealtimeConversationPreview {
  lastBody: string | null;
  lastSenderId: string | null;
  lastAt: string | null;
  lastDeletedBy: string | null;
  otherParticipant?: { id: string; displayName: string; avatarUrl: string | null } | null;
  contextType?: string | null;
  contextId?: string | null;
  unread?: number;
  /** Present on message.deleted — who deleted the message. */
  deletedBy?: string;
}

interface RealtimeMessagePayload {
  conversationId?: string;
  message?: unknown;
  conversation?: RealtimeConversationPreview;
}

interface RealtimeDeletePayload {
  conversationId?: string;
  messageId?: string;
  conversation?: RealtimeConversationPreview;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function realtimeMessagePayload(value: unknown): RealtimeMessagePayload | null {
  if (!isRecord(value)) return null;
  return {
    conversationId: typeof value.conversationId === 'string' ? value.conversationId : undefined,
    message: value.message,
    conversation: isRecord(value.conversation) ? (value.conversation as unknown as RealtimeConversationPreview) : undefined,
  };
}

function realtimeDeletePayload(value: unknown): RealtimeDeletePayload | null {
  if (!isRecord(value)) return null;
  return {
    conversationId: typeof value.conversationId === 'string' ? value.conversationId : undefined,
    messageId: typeof value.messageId === 'string' ? value.messageId : undefined,
    conversation: isRecord(value.conversation) ? (value.conversation as unknown as RealtimeConversationPreview) : undefined,
  };
}

// ─── Memoized conversation row ──────────────────────────────────

interface ConvRowProps {
  c: ApiConversationSummary;
  userId: string | undefined;
  onNavigate: Navigate;
  onRemove: (c: ApiConversationSummary) => void;
  onToggleRead: (c: ApiConversationSummary) => void;
  onReport: (c: ApiConversationSummary) => void;
}

const ConvRow = memo(function ConvRow({ c, userId, onNavigate, onRemove, onToggleRead, onReport }: ConvRowProps) {
  // For venue/booking conversations: the player sees venue name + image; whoever
  // works the venue (owner or staff) sees the player's name + avatar so they know
  // WHO messaged.
  const isVenueForPlayer = c.contextLabel && !c.viewerIsVenueSide;
  const name = isVenueForPlayer ? c.contextLabel! : (c.otherParticipant?.displayName ?? 'Player');
  const avatarSrc = isVenueForPlayer
    ? (c.contextImageUrl ? apiImageUrl(c.contextImageUrl) : null)
    : c.otherParticipant?.avatarUrl;
  const active = isActive(c.otherParticipant?.lastActiveAt);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{
        layout: { type: 'spring', stiffness: 500, damping: 50, mass: 0.7 },
        opacity: { duration: 0.2 },
      }}
      key={c.id}
      role="button"
      tabIndex={0}
      className="organizer m-0! cursor-pointer"
      onClick={() => onNavigate('chat', { id: c.id, name })}
      onKeyDown={(e) => { if (e.key === 'Enter') onNavigate('chat', { id: c.id, name }); }}
    >
      <div className="relative shrink-0">
        <Avatar src={avatarSrc} name={name} size={44} />
        {c.otherParticipant?.lastActiveAt != null && (
          <span className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-white ${active ? 'bg-[var(--lime)]' : 'bg-[var(--muted)]'}`} />
        )}
      </div>
      <div className="meta min-w-0">
        {/* Above the name: the player sees a generic Venue/Booking chip; the
            venue side (staff/owner) sees which venue this thread belongs to —
            small but readable, since they work many venues. */}
        {c.viewerIsVenueSide && c.contextLabel ? (
          <div className="flex items-center min-w-0" style={{ color: 'var(--muted)', marginBottom: 1, fontSize: 11, gap: 3 }}>
            <Icon name="sports_tennis" size={10} />
            <span className="truncate min-w-0">{c.contextLabel}</span>
          </div>
        ) : (c.contextType === 'venue' || c.contextType === 'booking') ? (
          <div className="truncate" style={{ color: 'var(--muted)', marginBottom: 1, fontSize: 11 }}>
            {c.contextType === 'venue' ? (
              <span className="inline-flex items-center" style={{ gap: 3 }}>
                <Icon name="sports_tennis" size={10} />
                Venue
              </span>
            ) : (
              <span className="inline-flex items-center" style={{ gap: 3 }}>
                <Icon name="event" size={10} />
                Booking
              </span>
            )}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <div className="name truncate">{name}</div>
          <div className="t-sm shrink-0">{timeAgo(c.lastAt)}</div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className={`t-sm truncate ${c.unread > 0 ? 'font-bold text-[var(--ink)]' : ''}`}>
            {c.lastDeletedBy
              ? (c.lastDeletedBy === userId
                ? 'You deleted a message'
                : `${c.otherParticipant?.displayName ?? 'Someone'} deleted a message`)
              : c.lastBody ? cleanPreview(c.lastBody) : 'No messages yet'}
          </div>
          {c.unread > 0 && (
            <motion.span
              key={`badge-${c.id}-${c.unread}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--coral)] text-white text-[11px] font-extrabold leading-5 text-center"
            >
              {c.unread > 9 ? '9+' : c.unread}
            </motion.span>
          )}
        </div>
      </div>
      <ActionMenu
        aria-label={`More actions for the conversation with ${name}`}
        actions={[
          {
            key: 'read',
            label: c.unread > 0 ? 'Mark as read' : 'Mark as unread',
            icon: c.unread > 0 ? 'check' : 'mail',
            onSelect: () => onToggleRead(c),
          },
          { key: 'report', label: 'Report conversation', icon: 'shield', onSelect: () => onReport(c) },
          { key: 'delete', label: 'Delete conversation', icon: 'trash', danger: true, onSelect: () => onRemove(c) },
        ]}
      />
    </motion.div>
  );
});

// ─── Source grouping ────────────────────────────────────────────

/** Canonical source keys — add new ones here to grow the sections. */
type ConversationSource = 'direct' | 'venue' | 'booking';

interface SourceDef {
  key: ConversationSource;
  label: string;
  icon: string;
  /** Determines which conversations belong in this section. */
  match: (c: ApiConversationSummary) => boolean;
}

/** Ordered source definitions. A section renders only when it has ≥1 conversation. */
const SOURCES: SourceDef[] = [
  {
    key: 'direct',
    label: 'Direct Messages',
    icon: 'chat',
    match: (c) => !c.contextType,
  },
  {
    key: 'venue',
    label: 'Venues',
    icon: 'sports_tennis',
    match: (c) => c.contextType === 'venue',
  },
  {
    key: 'booking',
    label: 'Bookings',
    icon: 'event',
    match: (c) => c.contextType === 'booking',
  },
];

/** Split a flat conversation list into ordered, non-empty sections sorted
 *  newest-first within each. */
function groupBySource(items: ApiConversationSummary[]) {
  return SOURCES
    .map((def) => ({
      ...def,
      items: items
        .filter(def.match)
        .sort((a, b) => new Date(b.lastAt ?? 0).getTime() - new Date(a.lastAt ?? 0).getTime()),
    }))
    .filter((g) => g.items.length > 0);
}

// ─── Screen ─────────────────────────────────────────────────────

export function ConversationsScreen({ onNavigate, onBack }: ConversationsScreenProps) {
  const user = useAuthStore((s) => s.user);
  const isOwner = userHasPermission(user, 'owner.access');
  // Staff sub-accounts work a venue's shared inbox, not a personal one — their
  // Messages are venue conversations only (no Direct Messages), shown under a
  // single "Venue" tab.
  const isStaff = user?.roleDefault === 'staff';
  const [items, setItems] = useState<ApiConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Which source is shown when the sections collapse into tabs (mobile only —
  // wider frames stack every section, so this only drives the phone layout).
  const [activeSource, setActiveSource] = useState<ConversationSource>('direct');

  // "New message": search any player by name and open (or create) a thread with
  // them — so you can message someone even if you've never met them in a game.
  const [composing, setComposing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [starting, setStarting] = useState(false);

  // Row ⋮ menu side-effects: the report reason picker + the confirmation toast.
  const [reportTarget, setReportTarget] = useState<ApiConversationSummary | null>(null);
  const [toast, setToast] = useState({ show: false, message: '' });
  const showToast = useCallback((message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2000);
  }, []);

  // Owner suggestion list: pre-fetched when the owner opens the compose screen
  // so they can browse players who've interacted with their venues without typing.
  const [suggestions, setSuggestions] = useState<OwnerPlayerSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const [prevReloadKey, setPrevReloadKey] = useState(reloadKey);
  if (reloadKey !== prevReloadKey) {
    setPrevReloadKey(reloadKey);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let alive = true;
    listConversations()
      .then((rows) => { if (alive) setItems(rows); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load messages.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  // ── Realtime: surgical conversation-list updates ──────────────
  // Instead of a full re-fetch on every event, we surgically update the
  // affected conversation in local state. The server now includes a
  // `conversation` preview payload in message.created / message.deleted
  // events so the list stays current with zero flicker.

  useEffect(() => {
    return onRealtime('message', (payload: unknown) => {
      const p = realtimeMessagePayload(payload);
      if (!p || !p.conversationId) return;
      const cid = p.conversationId; // narrowed to string

      setItems((prev) => {
        const idx = prev.findIndex((x) => x.id === cid);
        const conv = p.conversation;
        if (!conv) {
          // Fallback: no preview data — re-fetch the full list (shouldn't happen
          // with the updated server, but this guards old event shapes).
          setReloadKey((k) => k + 1);
          return prev;
        }

        if (idx === -1) {
          // Brand-new conversation — insert at the top with the preview data.
          const newItem: ApiConversationSummary = {
            id: cid,
            otherParticipant: conv.otherParticipant ?? null,
            lastBody: conv.lastBody,
            lastSenderId: conv.lastSenderId,
            lastDeletedBy: conv.lastDeletedBy,
            lastAt: conv.lastAt,
            unread: conv.unread ?? 1,
            contextType: conv.contextType ?? null,
            contextId: conv.contextId ?? null,
            contextLabel: null, // resolved server-side on the next full fetch
          };
          return [newItem, ...prev];
        }

        // Existing conversation — bump it to the top with updated preview.
        const existing = prev[idx];
        // Don't increment unread if this is our own message echoed back
        // (e.g. from another tab — the server only sends to the recipient,
        // but guard defensively).
        const isOwnMessage = conv.lastSenderId === user?.id;
        const unreadDelta = isOwnMessage ? 0 : (conv.unread ?? 1);
        const updated: ApiConversationSummary = {
          ...existing,
          lastBody: conv.lastBody ?? existing.lastBody,
          lastSenderId: conv.lastSenderId ?? existing.lastSenderId,
          lastAt: conv.lastAt ?? existing.lastAt,
          lastDeletedBy: conv.lastDeletedBy ?? null,
          unread: existing.unread + unreadDelta,
          // New conversation may carry fresher participant info.
          otherParticipant: conv.otherParticipant ?? existing.otherParticipant,
          contextType: conv.contextType ?? existing.contextType,
          contextId: conv.contextId ?? existing.contextId,
        };
        const rest = [...prev];
        rest.splice(idx, 1);
        return [updated, ...rest];
      });
    });
  }, [user?.id]);

  // A colleague opened or answered a thread in a venue inbox we share — it's
  // handled, so drop our unread badge for it (the server already cleared the
  // stored read mark for the whole venue side; this just avoids a refetch).
  useEffect(() => {
    return onRealtime('conversation.read', (payload: unknown) => {
      if (!isRecord(payload)) return;
      const cid = typeof payload.conversationId === 'string' ? payload.conversationId : null;
      if (!cid) return;
      setItems((prev) => prev.map((c) => (c.id === cid && c.unread > 0 ? { ...c, unread: 0 } : c)));
    });
  }, []);

  useEffect(() => {
    return onRealtime('message.deleted', (payload: unknown) => {
      const p = realtimeDeletePayload(payload);
      if (!p || !p.conversationId) return;

      setItems((prev) => {
        const idx = prev.findIndex((x) => x.id === p.conversationId);
        if (idx === -1) return prev;
        const conv = p.conversation;
        if (!conv) {
          setReloadKey((k) => k + 1);
          return prev;
        }
        const existing = prev[idx];
        const updated: ApiConversationSummary = {
          ...existing,
          lastBody: conv.lastBody ?? existing.lastBody,
          lastSenderId: conv.lastSenderId ?? existing.lastSenderId,
          lastAt: conv.lastAt ?? existing.lastAt,
          lastDeletedBy: conv.lastDeletedBy ?? existing.lastDeletedBy,
          // Don't change unread — a deletion doesn't affect it.
        };
        const rest = [...prev];
        rest.splice(idx, 1);
        // Keep the conversation at its current position (deletion doesn't
        // necessarily mean new activity worth surfacing top).
        rest.splice(0, 0, updated);
        return rest;
      });
    });
  }, []);

  // Debounced people search while composing. A blank/short query clears results.
  // Owners filter their pre-loaded suggestion list locally instead of hitting the
  // API again. Non-owners use the global searchPlayers.
  const reqId = useRef(0);
  useEffect(() => {
    if (!composing) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]); setSearched(false); setSearching(false);
      return;
    }
    // Owner path: filter the already-loaded suggestions by name.
    if (isOwner) {
      setSearching(true);
      const id = ++reqId.current;
      const t = setTimeout(() => {
        const lower = q.toLowerCase();
        const filtered = suggestions.filter((s) =>
          s.displayName.toLowerCase().includes(lower),
        );
        if (id === reqId.current) {
          setResults(filtered.map((s) => ({ id: s.id, displayName: s.displayName, avatarUrl: s.avatarUrl })));
          setSearched(true);
          setSearching(false);
        }
      }, 300);
      return () => clearTimeout(t);
    }
    // Non-owner path: global API search.
    setSearching(true);
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const found = await searchPlayers(q);
        if (id === reqId.current) { setResults(found); setSearched(true); }
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, composing, isOwner, suggestions]);

  const openCompose = () => {
    setComposing(true); setQuery(''); setResults([]); setSearched(false);
    // Owners: pre-load venue players so the suggestion list is ready right away.
    if (isOwner && user?.id) {
      setSuggestionsLoading(true);
      getOwnerPlayerSuggestions(user.id)
        .then((s) => setSuggestions(s))
        .catch(() => setSuggestions([]))
        .finally(() => setSuggestionsLoading(false));
    }
  };
  const closeCompose = () => {
    setComposing(false); setQuery(''); setResults([]); setSearched(false);
    setSuggestions([]); setSuggestionsLoading(false);
  };

  const removeConv = useCallback(async (c: ApiConversationSummary) => {
    if (!window.confirm('Delete this conversation? It will come back if they message you again.')) return;
    setItems((prev) => prev.filter((x) => x.id !== c.id)); // optimistic
    try {
      await deleteConversation(c.id);
    } catch {
      setReloadKey((k) => k + 1); // restore from server on failure
    }
  }, []);

  // Flip a thread's read state from the row's ⋮ menu. Optimistic: the badge
  // reacts immediately and we fall back to a re-fetch if the server disagrees.
  // "Unread" rewinds the read mark server-side, so the count it comes back with
  // is 1 (the last message from the other side), not the original tally.
  const toggleRead = useCallback(async (c: ApiConversationSummary) => {
    const wasUnread = c.unread > 0;
    setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread: wasUnread ? 0 : 1 } : x)));
    try {
      if (wasUnread) {
        await markConversationRead(c.id);
        showToast('Marked as read');
      } else {
        const res = await markConversationUnread(c.id);
        // No incoming message to be unread about (e.g. a thread only you wrote in).
        if (!res.unread) {
          setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)));
          showToast('Nothing to mark unread here');
        } else {
          showToast('Marked as unread');
        }
      }
    } catch {
      setReloadKey((k) => k + 1);
      showToast("Couldn't update this conversation");
    }
  }, [showToast]);

  // Reporting is two taps: the ⋮ menu opens the reason picker, picking a reason
  // submits it (same flow as reporting a feed post).
  const reportConv = useCallback((c: ApiConversationSummary) => setReportTarget(c), []);

  const submitReport = (reason: string) => {
    const target = reportTarget;
    setReportTarget(null);
    if (!target) return;
    showToast("Thanks — we'll take a look");
    reportConversation(target.id, reason).catch(() => showToast("Couldn't send that report"));
  };

  const startWith = async (p: ApiPlayer) => {
    if (starting) return;
    setStarting(true);
    try {
      const conv = await startConversation(p.id);
      closeCompose();
      onNavigate('chat', { id: conv.id, name: p.displayName });
    } catch {
      setStarting(false);
    }
  };

  // Start a direct conversation from an owner suggestion — no context attached.
  // Booking/venue scoping only applies when explicitly started from those surfaces
  // (e.g. "Message venue" button on CourtDetailsScreen).
  const startWithSuggestion = async (s: OwnerPlayerSuggestion) => {
    if (starting) return;
    setStarting(true);
    try {
      const conv = await startConversation(s.id);
      closeCompose();
      onNavigate('chat', { id: conv.id, name: s.displayName });
    } catch {
      setStarting(false);
    }
  };

  // The "Browse" list the owner sees before typing — players who've booked or
  // are members, with their most recent booking context displayed.
  const visibleSuggestions = isOwner
    ? (query.trim().length < 2 ? suggestions : suggestions.filter((s) =>
        s.displayName.toLowerCase().includes(query.trim().toLowerCase()),
      ))
    : [];

  if (composing) {
    const showOwnerSuggestions = isOwner && query.trim().length < 2;
    const showOwnerSearch = isOwner && query.trim().length >= 2;

    return (
      <div className="scroll pb-10 pt-[calc(20px+env(safe-area-inset-top))]">
        <ScreenHeader onBack={closeCompose} backIcon="close" title="New message" />
        <div className="section mt-1!">
          <div className="relative mb-3">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              <Icon name="search" size={18} />
            </span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isOwner ? 'Filter players by name…' : 'Search players by name…'}
              className="w-full h-12 rounded-[12px] bg-[var(--surface-2)] pl-10 pr-4 text-[15px] outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          {/* ── Owner: suggestion list before typing ── */}
          {showOwnerSuggestions && (
            suggestionsLoading ? (
              <LoadingSkeleton variant="list-row" count={5} />
            ) : suggestions.length === 0 ? (
              <EmptyState icon="users" title="No players yet" description="Players who book or join your venues will appear here." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {suggestions.map((s) => {
                  const bk = s.latestBooking;
                  const active = isActive(s.lastActiveAt);
                  return (
                    <button
                      key={s.id}
                      className="organizer m-0! disabled:opacity-50"
                      disabled={starting}
                      onClick={() => startWithSuggestion(s)}
                    >
                      <div className="relative shrink-0">
                        <Avatar src={s.avatarUrl} name={s.displayName} size={44} />
                        {s.lastActiveAt != null && (
                          <span className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-white ${active ? 'bg-[var(--lime)]' : 'bg-[var(--muted)]'}`} />
                        )}
                      </div>
                      <div className="meta min-w-0">
                        <div className="name truncate">{s.displayName}</div>
                        <div className="t-sm truncate">
                          {bk ? (
                            <span>
                              Booked {timeAgo(bk.createdAt)}
                              {bk.date ? ` · ${prettyBookingDate(bk.date)}` : ''}
                              {bk.startTime ? `, ${to12h(bk.startTime)}` : ''}
                            </span>
                          ) : (
                            'Member'
                          )}
                          {s.isMember && bk && (
                            <span className="inline-flex items-center gap-0.5 ml-1 text-[10px] font-bold uppercase tracking-wide px-1 py-0.5 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)]">
                              <Icon name="star" size={9} /> Member
                            </span>
                          )}
                        </div>
                      </div>
                      <Icon name="message" size={18} />
                    </button>
                  );
                })}
              </div>
            )
          )}

          {/* ── Owner: search filter results ── */}
          {showOwnerSearch && (
            searching ? (
              <LoadingSkeleton variant="list-row" count={4} />
            ) : visibleSuggestions.length === 0 ? (
              <EmptyState icon="search" title="No players found" description="Try a different name." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {visibleSuggestions.map((s) => {
                  const bk = s.latestBooking;
                  const active = isActive(s.lastActiveAt);
                  return (
                    <button
                      key={s.id}
                      className="organizer m-0! disabled:opacity-50"
                      disabled={starting}
                      onClick={() => startWithSuggestion(s)}
                    >
                      <div className="relative shrink-0">
                        <Avatar src={s.avatarUrl} name={s.displayName} size={44} />
                        {s.lastActiveAt != null && (
                          <span className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-white ${active ? 'bg-[var(--lime)]' : 'bg-[var(--muted)]'}`} />
                        )}
                      </div>
                      <div className="meta min-w-0">
                        <div className="name truncate">{s.displayName}</div>
                        <div className="t-sm truncate">
                          {bk ? (
                            <span>
                              Booked {timeAgo(bk.createdAt)}
                              {bk.date ? ` · ${prettyBookingDate(bk.date)}` : ''}
                              {bk.startTime ? `, ${to12h(bk.startTime)}` : ''}
                            </span>
                          ) : (
                            'Member'
                          )}
                          {s.isMember && bk && (
                            <span className="inline-flex items-center gap-0.5 ml-1 text-[10px] font-bold uppercase tracking-wide px-1 py-0.5 rounded-full bg-[var(--lime-soft)] text-[var(--lime-ink)]">
                              <Icon name="star" size={9} /> Member
                            </span>
                          )}
                        </div>
                      </div>
                      <Icon name="message" size={18} />
                    </button>
                  );
                })}
              </div>
            )
          )}

          {/* ── Non-owner: existing search flow ── */}
          {!isOwner && (
            query.trim().length < 2 ? (
              <p className="t-sm px-1">Type at least 2 letters to find a player.</p>
            ) : searching ? (
              <LoadingSkeleton variant="list-row" count={4} />
            ) : searched && results.length === 0 ? (
              <EmptyState icon="search" title="No players found" description="Try a different name." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {results.map((p) => {
                  const active = isActive(p.lastActiveAt);
                  return (
                  <button
                    key={p.id}
                    className="organizer m-0! disabled:opacity-50"
                    disabled={starting}
                    onClick={() => startWith(p)}
                  >
                    <div className="relative shrink-0">
                      <Avatar src={p.avatarUrl} name={p.displayName} size={44} />
                      {p.lastActiveAt != null && (
                        <span className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-white ${active ? 'bg-[var(--lime)]' : 'bg-[var(--muted)]'}`} />
                      )}
                    </div>
                    <div className="meta min-w-0">
                      <div className="name truncate">{p.displayName}</div>
                      <div className="t-sm truncate">
                        {p.skillLevel != null ? `DUPR ${p.skillLevel}` : p.skillLevelLabel ?? 'Player'}
                      </div>
                    </div>
                    <Icon name="message" size={18} />
                  </button>
                );
                })}
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="scroll pb-10 pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader
        onBack={onBack}
        title="Messages"
        action={isStaff ? undefined : (
          <button
            type="button"
            aria-label="New message"
            onClick={openCompose}
            className="w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center"
          >
            <Icon name="edit" size={18} />
          </button>
        )}
      />

      <div className="section mt-1!">
        {loading ? (
          <LoadingSkeleton variant="list-row" count={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : (() => {
          // Staff work the venue's shared inbox only — hide any personal DMs so
          // their Messages are venue conversations under a single "Venue" tab.
          const visibleItems = isStaff ? items.filter((c) => c.contextType === 'venue') : items;
          if (visibleItems.length === 0) {
            return (
              <EmptyState
                icon="chat"
                title="No messages yet"
                description={isStaff
                  ? 'Messages from players about your venue will show up here.'
                  : 'Tap the compose button to message any player — or use "Message organizer" on any game.'}
                action={isStaff ? undefined : { label: 'New message', onPress: openCompose }}
              />
            );
          }
          const groups = groupBySource(visibleItems);
          // The tab state can go stale if its section empties out — fall back
          // to the first available section so a tab is always selected.
          const activeKey = groups.some((g) => g.key === activeSource)
            ? activeSource
            : (groups[0]?.key ?? 'direct');
          return (
            <div className="flex flex-col" style={{ gap: 16 }}>
              {(groups.length >= 2 || isStaff) && (
                <div className="seg msg-tabs">
                  {groups.map((g) => {
                    const unread = g.items.reduce((n, c) => n + (c.unread > 0 ? c.unread : 0), 0);
                    return (
                      <button
                        key={g.key}
                        type="button"
                        className={g.key === activeKey ? 'active' : ''}
                        style={{ gap: 5 }}
                        onClick={() => setActiveSource(g.key)}
                      >
                        <span className="truncate">{g.label}</span>
                        {unread > 0 && (
                          <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--coral)] text-white text-[10px] font-extrabold leading-[18px] text-center">
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-col" style={{ gap: 24 }}>
                {groups.map((group) => (
                  <div
                    key={group.key}
                    className="msg-group flex flex-col"
                    data-active={group.key === activeKey ? 'true' : 'false'}
                    style={{ gap: 8 }}
                  >
                    <div className="msg-group-head">
                      <Icon name={group.icon} size={14} />
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                        {group.label}
                      </span>
                    </div>
                    <motion.div className="flex flex-col gap-2.5" layout>
                      <AnimatePresence mode="popLayout">
                        {group.items.map((c) => (
                          <ConvRow
                            key={c.id}
                            c={c}
                            userId={user?.id}
                            onNavigate={onNavigate}
                            onRemove={removeConv}
                            onToggleRead={toggleRead}
                            onReport={reportConv}
                          />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Report reason picker — opens after tapping "Report conversation". */}
      <BottomSheet
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        title="Report conversation"
        subtitle="Why are you reporting this conversation?"
      >
        <div className="flex flex-col gap-1 pb-2">
          {REPORT_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => submitReport(reason)}
              className="w-full flex items-center justify-between gap-2.5 px-2 py-3 text-left text-[15px] font-semibold text-[var(--ink)] active:bg-[var(--surface-2)] rounded-xl"
            >
              {reason}
              <Icon name="chevron" size={16} className="text-[var(--muted)] shrink-0" />
            </button>
          ))}
        </div>
      </BottomSheet>

      <Toast message={toast.message} show={toast.show} />
    </div>
  );
}
