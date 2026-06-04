import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Toast } from '../../shared/components/ui/Toast';
import { DuprExplainerSheet } from '../../shared/components/ui/DuprExplainerSheet';
import { CompletionScreen } from '../../shared/components/ui/CompletionScreen';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { Button } from '../../shared/components/ui/Button';
import type { Navigate } from '../../shared/lib/navigation';
import { tierForDupr } from '../../shared/lib/skillTiers';

interface InvitePlayersScreenProps {
  gameId: string;
  onNavigate: Navigate;
  onBack: () => void;
}

const SUGGESTED = [
  { name: 'Sarah K.',   skill: '3.0', v: 'blue'  as const },
  { name: 'Mike R.',    skill: '4.5', v: 'lime'  as const },
  { name: 'Alex T.',    skill: '2.5', v: 'coral' as const },
  { name: 'Jordan P.',  skill: '4.0', v: 'lime'  as const },
  { name: 'Casey W.',   skill: '3.5', v: 'blue'  as const },
];

export function InvitePlayersScreen({ gameId, onNavigate, onBack }: InvitePlayersScreenProps) {
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [duprOpen, setDuprOpen] = useState(false);
  const link = `pickleballers.app/game/${gameId}`;

  const toggle = (name: string) => {
    setInvited((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
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

  if (sent) {
    return (
      <CompletionScreen
        icon="send"
        iconSize={36}
        title="Invites sent!"
        description={`${invited.size} player${invited.size !== 1 ? 's' : ''} invited. They'll get a notification.`}
        actions={[{ label: 'View game', onClick: () => onNavigate('game-details', { id: gameId }) }]}
      />
    );
  }

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

      <div className="section">
        <div className="section-head">
          <div className="hd-2">Suggested players</div>
          <button className="more" onClick={() => setDuprOpen(true)}>
            About DUPR
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {SUGGESTED.map((p) => {
            const sel = invited.has(p.name);
            return (
              <button
                key={p.name}
                className="organizer m-0!"
                onClick={() => toggle(p.name)}
              >
                <Avatar name={p.name} size={40} variant={p.v} />
                <div className="meta">
                  <div className="role">DUPR {p.skill}</div>
                  <div className="name">{p.name}</div>
                  <div className="t-sm mt-0.5">{tierForDupr(Number(p.skill)).name}</div>
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
          })}
        </div>
      </div>

      <div className="app-action-bar flex gap-2.5">
        <Button variant="outline" fullWidth className="flex-1" onClick={onBack}>
          Skip
        </Button>
        <Button
          fullWidth
          className="flex-[2]"
          onClick={() => setSent(true)}
          disabled={invited.size === 0}
        >
          Send {invited.size > 0 && `(${invited.size})`} <Icon name="send" size={16} />
        </Button>
      </div>

      <Toast message={toast.message} show={toast.show} />
      <DuprExplainerSheet open={duprOpen} onClose={() => setDuprOpen(false)} />
    </div>
  );
}
