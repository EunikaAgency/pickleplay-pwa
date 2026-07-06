import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { Toast } from '../../shared/components/ui/Toast';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import { tierForDupr } from '../../shared/lib/skillTiers';
import { searchPlayers, inviteToGame, type ApiPlayer } from '../../shared/lib/api';

interface InvitePlayersSheetProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
}

const VARIANTS = ['blue', 'lime', 'coral'] as const;
const variantFor = (id: string) => VARIANTS[(id.charCodeAt(id.length - 1) || 0) % VARIANTS.length];

export function InvitePlayersSheet({ open, onClose, gameId }: InvitePlayersSheetProps) {
  const user = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const canInvite = isLoggedIn && userHasPermission(user, 'player.games.invite');

  // Reset state when sheet opens
  const prevOpenRef = useRef(open);
  if (open !== prevOpenRef.current) {
    prevOpenRef.current = open;
    if (open) {
      // state resets handled via the key below; this is a controlled reset trigger
    }
  }

  const [selected, setSelected] = useState<Map<string, ApiPlayer>>(new Map());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState({ show: false, message: '' });

  // Reset all state when sheet opens/closes
  const openKeyRef = useRef(open);
  useEffect(() => {
    if (open && !openKeyRef.current) {
      // Sheet just opened — reset
      setSelected(new Map());
      setQuery('');
      setResults([]);
      setSearching(false);
      setSearched(false);
      setSending(false);
      setSent(false);
      setSentCount(0);
      setError(null);
    }
    openKeyRef.current = open;
  }, [open]);

  // Debounced player search
  const reqId = useRef(0);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const found = await searchPlayers(q);
        if (id === reqId.current) {
          setResults(found);
          setSearched(true);
        }
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const toggle = (p: ApiPlayer) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.set(p.id, p);
      return next;
    });
  };

  const sendInvites = async () => {
    if (selected.size === 0 || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await inviteToGame(gameId, [...selected.keys()]);
      setSentCount(res.invited || selected.size);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send invites. Try again.');
    } finally {
      setSending(false);
    }
  };

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2000);
  };

  const selectedExtras = [...selected.values()].filter((p) => !results.some((r) => r.id === p.id));

  return (
    <>
      <BottomSheet
        open={open}
        onClose={() => { onClose(); }}
        title={sent ? 'Invites sent!' : 'Invite players'}
        subtitle={sent ? `${sentCount} player${sentCount !== 1 ? 's' : ''} invited` : 'Search and invite players to join'}
      >
        {!canInvite ? (
          <div className="px-4 pb-4 text-center">
            <p className="text-[13px] text-[var(--muted)]">You don't have permission to invite players.</p>
          </div>
        ) : sent ? (
          <div className="px-4 pb-4 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-[var(--lime)] flex items-center justify-center">
              <Icon name="check" size={24} />
            </div>
            <p className="text-[13px] text-[var(--muted)] text-center">
              They'll get a notification and can join from the invite.
            </p>
            <button
              type="button"
              className="text-[14px] font-bold text-[var(--primary)] active:opacity-70"
              onClick={() => {
                setSent(false);
                setSelected(new Map());
              }}
            >
              Invite more
            </button>
          </div>
        ) : (
          <div className="px-4 pb-2">
            {/* Search */}
            <div className="relative mb-3">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                <Icon name="search" size={18} />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search players by name"
                autoFocus
                className="w-full h-11 pl-10 pr-3.5 rounded-2xl bg-[var(--surface-2)] border-[0.5px] border-[var(--hairline)] text-[var(--ink)] text-[15px] outline-none"
              />
            </div>

            <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto">
              {/* Already selected players not in current results */}
              {selectedExtras.map((p) => (
                <PlayerRow key={p.id} player={p} selected onToggle={() => toggle(p)} />
              ))}

              {searching && <LoadingSkeleton variant="list-row" count={3} />}

              {!searching && results.map((p) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  selected={selected.has(p.id)}
                  onToggle={() => toggle(p)}
                />
              ))}

              {!searching && searched && results.length === 0 && (
                <p className="text-[13px] text-[var(--muted)] text-center py-4">
                  No players found for "{query.trim()}".
                </p>
              )}

              {!searching && !searched && selectedExtras.length === 0 && (
                <p className="text-[13px] text-[var(--muted)] text-center py-4">
                  Search for players to invite.
                </p>
              )}
            </div>

            {error && (
              <p className="text-[13px] text-[var(--coral)] text-center mt-3">{error}</p>
            )}

            {/* Send button */}
            <button
              type="button"
              disabled={selected.size === 0 || sending}
              onClick={sendInvites}
              className="w-full mt-3 h-11 rounded-2xl bg-[var(--lime)] text-[var(--on-accent)] font-bold text-[15px] flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-40"
            >
              {sending ? (
                <><span className="inline-flex animate-spin"><Icon name="spinner" size={18} /></span> Sending…</>
              ) : (
                <>Send {selected.size > 0 ? `(${selected.size})` : 'invites'} <Icon name="send" size={16} /></>
              )}
            </button>
          </div>
        )}
      </BottomSheet>
      <Toast message={toast.message} show={toast.show} />
    </>
  );
}

function PlayerRow({ player: p, selected, onToggle }: { player: ApiPlayer; selected: boolean; onToggle: () => void }) {
  const tier = p.skillLevel != null ? tierForDupr(p.skillLevel) : null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left bg-[var(--surface-2)] active:opacity-80"
    >
      <Avatar src={p.avatarUrl} name={p.displayName} size={36} variant={variantFor(p.id)} />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold text-[var(--ink)] truncate">{p.displayName}</div>
        <div className="text-[11px] text-[var(--muted)]">
          {p.skillLevelLabel || (p.skillLevel != null ? `DUPR ${p.skillLevel}` : 'Player')}
          {tier && ` · ${tier.name}`}
        </div>
      </div>
      <span
        className={`shrink-0 w-[24px] h-[24px] rounded-lg inline-flex items-center justify-center text-[var(--on-accent)] ${
          selected ? 'bg-[var(--lime)]' : 'bg-transparent border-2 border-[var(--surface-3)]'
        }`}
      >
        {selected && <Icon name="check" size={13} />}
      </span>
    </button>
  );
}
