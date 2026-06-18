import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Toast } from '../../shared/components/ui/Toast';
import { DuprExplainerSheet } from '../../shared/components/ui/DuprExplainerSheet';
import { CompletionScreen } from '../../shared/components/ui/CompletionScreen';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { Button } from '../../shared/components/ui/Button';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import type { Navigate } from '../../shared/lib/navigation';
import { tierForDupr } from '../../shared/lib/skillTiers';
import { searchPlayers, inviteToGame, type ApiPlayer } from '../../shared/lib/api';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';

interface InvitePlayersScreenProps {
  gameId: string;
  onNavigate: Navigate;
  onBack: () => void;
}

const VARIANTS = ['blue', 'lime', 'coral'] as const;
const variantFor = (id: string) => VARIANTS[(id.charCodeAt(id.length - 1) || 0) % VARIANTS.length];

export function InvitePlayersScreen({ gameId, onNavigate, onBack }: InvitePlayersScreenProps) {
  const user = useAuthStore((s) => s.user);
  const canInvite = userHasPermission(user, 'player.games.invite');

  // Selected players kept by id → player so names survive across searches.
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
  const [duprOpen, setDuprOpen] = useState(false);
  const link = `pickleballers.app/game/${gameId}`;

  // Debounced people search. A blank query clears the results.
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* ignore */
    }
    setToast({ show: true, message: 'Share link copied' });
    setTimeout(() => setToast({ show: false, message: '' }), 2000);
  };

  const send = async () => {
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

  if (sent) {
    return (
      <CompletionScreen
        icon="send"
        iconSize={36}
        title="Invites sent!"
        description={`${sentCount} player${sentCount !== 1 ? 's' : ''} invited. They'll get a notification.`}
        actions={[{ label: 'View game', onClick: () => onNavigate('game-details', { id: gameId }) }]}
      />
    );
  }

  const renderRow = (p: ApiPlayer) => {
    const sel = selected.has(p.id);
    const tier = p.skillLevel != null ? tierForDupr(p.skillLevel) : null;
    return (
      <button key={p.id} className="organizer m-0!" onClick={() => toggle(p)}>
        <Avatar src={p.avatarUrl} name={p.displayName} size={40} variant={variantFor(p.id)} />
        <div className="meta">
          <div className="role">{p.skillLevelLabel || (p.skillLevel != null ? `DUPR ${p.skillLevel}` : 'Player')}</div>
          <div className="name">{p.displayName}</div>
          {tier && <div className="t-sm mt-0.5">{tier.name}</div>}
        </div>
        <span
          className={`w-[26px] h-[26px] rounded-lg inline-flex items-center justify-center text-[var(--lime-ink)] ${
            sel ? 'bg-[var(--lime)]' : 'bg-transparent border-2 border-[var(--surface-3)]'
          }`}
        >
          {sel && <Icon name="check" size={14} />}
        </span>
      </button>
    );
  };

  // Selected players that aren't in the current result list, shown above results
  // so the running selection stays visible while searching for more.
  const selectedExtras = [...selected.values()].filter((p) => !results.some((r) => r.id === p.id));

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} eyebrow="Invite players" title="Share your game" />

      <div className="section mt-1!">
        <div className="section-head">
          <div className="hd-3">Share link</div>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={link}
            readOnly
            className="flex-1 h-11 px-3.5 rounded-[14px] bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] text-[var(--ink)] text-[16px] outline-none"
          />
          <button
            onClick={copy}
            aria-label="Copy link"
            className="w-11 h-11 rounded-[14px] bg-[var(--ink)] text-white flex items-center justify-center"
          >
            <Icon name="share" size={16} />
          </button>
        </div>
      </div>

      {canInvite && (
        <div className="section">
          <div className="section-head">
            <div className="hd-2">Invite players</div>
            <button className="more" onClick={() => setDuprOpen(true)}>
              About DUPR
            </button>
          </div>

          <div className="relative mb-2.5">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              <Icon name="search" size={18} />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search players by name"
              className="w-full h-11 pl-10 pr-3.5 rounded-[14px] bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] text-[var(--ink)] text-[16px] outline-none"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            {selectedExtras.map(renderRow)}

            {searching && <LoadingSkeleton variant="list-row" count={3} />}

            {!searching && results.map(renderRow)}

            {!searching && searched && results.length === 0 && (
              <div className="t-sm py-3 text-center">
                No players found for "{query.trim()}".
              </div>
            )}

            {!searching && !searched && selectedExtras.length === 0 && (
              <div className="t-sm py-3 text-center">
                Search for players to invite, or share the link above.
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="section">
          <div className="t-sm text-[var(--coral)] text-center">{error}</div>
        </div>
      )}

      <div className="app-action-bar flex gap-2.5">
        <Button variant="outline" fullWidth className="flex-1" onClick={onBack}>
          {canInvite ? 'Skip' : 'Done'}
        </Button>
        {canInvite && (
          <Button
            fullWidth
            className="flex-[2]"
            onClick={send}
            disabled={selected.size === 0 || sending}
          >
            {sending ? 'Sending…' : <>Send {selected.size > 0 && `(${selected.size})`} <Icon name="send" size={16} /></>}
          </Button>
        )}
      </div>

      <Toast message={toast.message} show={toast.show} />
      <DuprExplainerSheet open={duprOpen} onClose={() => setDuprOpen(false)} />
    </div>
  );
}
