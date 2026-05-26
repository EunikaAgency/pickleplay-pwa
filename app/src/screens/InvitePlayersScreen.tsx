import { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { Avatar } from '../components/ui/Avatar';
import { Toast } from '../components/ui/Toast';
import { DuprExplainerSheet } from '../components/ui/DuprExplainerSheet';
import { tierForDupr } from '../lib/skillTiers';

interface InvitePlayersScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  onBack: () => void;
  gameId?: string;
}

const SUGGESTED = [
  { name: 'Sarah K.',   skill: '3.0', v: 'blue'  as const },
  { name: 'Mike R.',    skill: '4.5', v: 'lime'  as const },
  { name: 'Alex T.',    skill: '2.5', v: 'coral' as const },
  { name: 'Jordan P.',  skill: '4.0', v: 'lime'  as const },
  { name: 'Casey W.',   skill: '3.5', v: 'blue'  as const },
];

export function InvitePlayersScreen({ onNavigate, onBack }: InvitePlayersScreenProps) {
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [duprOpen, setDuprOpen] = useState(false);
  const link = 'pickleballers.app/game/7xk9m2';

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
      <div
        className="scroll safe-top safe-bottom"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 999,
            background: 'var(--lime)',
            color: 'var(--lime-ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
            boxShadow: 'var(--shadow-fab)',
          }}
        >
          <Icon name="send" size={36} />
        </div>
        <h2 className="hd-1" style={{ marginBottom: 6 }}>Invites sent!</h2>
        <p className="t-sm" style={{ maxWidth: 320 }}>
          {invited.size} player{invited.size !== 1 ? 's' : ''} invited. They'll get a notification.
        </p>
        <button
          className="btn-primary"
          style={{ marginTop: 22, width: '100%', maxWidth: 360 }}
          onClick={() => onNavigate('game-details', { id: 'new' })}
        >
          View game
        </button>
      </div>
    );
  }

  return (
    <div className="scroll" style={{ paddingBottom: 100, paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
      <div style={{ padding: '4px 20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="back" size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="t-eyebrow">Invite players</div>
          <div className="hd-2" style={{ marginTop: 2 }}>Saturday Morning Mix-In</div>
        </div>
      </div>

      <div className="section" style={{ marginTop: 4 }}>
        <div className="section-head">
          <div className="hd-3">Share link</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={link}
            readOnly
            style={{
              flex: 1,
              height: 44,
              padding: '0 14px',
              background: 'var(--surface)',
              border: '0.5px solid var(--hairline)',
              borderRadius: 14,
              color: 'var(--ink)',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <button
            onClick={copy}
            aria-label="Copy link"
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'var(--ink)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SUGGESTED.map((p) => {
            const sel = invited.has(p.name);
            return (
              <button
                key={p.name}
                className="organizer"
                style={{ margin: 0 }}
                onClick={() => toggle(p.name)}
              >
                <Avatar name={p.name} size={40} variant={p.v} />
                <div className="meta">
                  <div className="role">DUPR {p.skill}</div>
                  <div className="name">{p.name}</div>
                  <div className="t-sm" style={{ marginTop: 2 }}>{tierForDupr(Number(p.skill)).name}</div>
                </div>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    border: sel ? 'none' : '2px solid var(--surface-3)',
                    background: sel ? 'var(--lime)' : 'transparent',
                    color: 'var(--lime-ink)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {sel && <Icon name="check" size={14} />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '12px 20px calc(20px + env(safe-area-inset-bottom))',
          background: 'var(--bg)',
          borderTop: '0.5px solid var(--hairline)',
          maxWidth: 480,
          margin: '0 auto',
          display: 'flex',
          gap: 10,
        }}
      >
        <button className="btn-primary outline" style={{ margin: 0, width: '100%', flex: 1 }} onClick={onBack}>
          Skip
        </button>
        <button
          className="btn-primary"
          style={{ margin: 0, width: '100%', flex: 2 }}
          onClick={() => setSent(true)}
          disabled={invited.size === 0}
        >
          Send {invited.size > 0 && `(${invited.size})`} <Icon name="send" size={16} />
        </button>
      </div>

      <Toast message={toast.message} show={toast.show} />
      <DuprExplainerSheet open={duprOpen} onClose={() => setDuprOpen(false)} />
    </div>
  );
}
