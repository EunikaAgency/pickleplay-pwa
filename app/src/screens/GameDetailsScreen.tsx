import { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { Avatar } from '../components/ui/Avatar';
import { CourtIllustration } from '../components/ui/CourtIllustration';
import { DuprExplainerSheet } from '../components/ui/DuprExplainerSheet';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { useDemoState } from '../lib/demoState';

interface GameDetailsScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  onBack: () => void;
  gameId?: string;
}

const PLAYERS = [
  { name: 'Coach Mike', v: 'lime' as const },
  { name: 'Sarah K',    v: 'blue' as const },
  { name: 'Alex T',     v: 'coral' as const },
  { name: 'Jordan M',   v: 'blue' as const },
  { name: 'Taylor R',   v: 'lime' as const },
  { name: 'Casey L',    v: 'blue' as const },
  { name: 'Morgan P',   v: 'coral' as const },
  { name: 'You',        v: 'lime' as const, you: true },
];

export function GameDetailsScreen({ onNavigate, onBack }: GameDetailsScreenProps) {
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [duprOpen, setDuprOpen] = useState(false);
  const { state: demoState } = useDemoState();

  if (demoState === 'loading') {
    return (
      <div className="scroll safe-top safe-bottom" style={{ padding: '0 16px' }}>
        <LoadingSkeleton variant="block" count={1} />
        <div style={{ marginTop: 12 }}>
          <LoadingSkeleton variant="card" count={3} />
        </div>
      </div>
    );
  }
  if (demoState === 'error') {
    return (
      <div className="scroll safe-top safe-bottom">
        <ErrorState
          title="Couldn't load this game"
          message="We couldn't fetch this game's details. Pull down to retry."
          onRetry={() => {}}
        />
      </div>
    );
  }
  if (demoState === 'empty') {
    return (
      <div className="scroll safe-top safe-bottom">
        <EmptyState
          icon="paddle"
          title="This game is no longer available"
          description="The organizer may have cancelled or filled all the spots."
          action={{ label: 'Find another game', onPress: () => onNavigate('games') }}
        />
      </div>
    );
  }

  const handleJoin = () => {
    if (joined || joining) return;
    setJoining(true);
    setTimeout(() => {
      setJoining(false);
      setJoined(true);
    }, 900);
  };

  return (
    <div className="scroll" style={{ paddingBottom: 130 }}>
      <div className="detail-hero">
        <div className="img" style={{ background: 'linear-gradient(135deg, #0040e0 0%, #6c83ff 60%, #a5b9ff 100%)' }} />
        <div
          style={{
            position: 'absolute',
            right: -30,
            top: 60,
            opacity: 0.85,
            transform: 'rotate(-12deg) scale(1.1)',
          }}
        >
          <CourtIllustration width={240} />
        </div>
        <div className="grad" />
        <div className="top-controls">
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <Icon name="back" size={18} />
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="icon-btn" aria-label="Share">
              <Icon name="share" size={16} />
            </button>
            <button className="icon-btn" aria-label="Save">
              <Icon name="heart_o" size={16} />
            </button>
          </div>
        </div>
        <div className="info">
          <div className="tag-row">
            <button
              type="button"
              className="tag lime"
              onClick={() => setDuprOpen(true)}
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              3.0–3.5 <Icon name="help" size={11} />
            </button>
            <span className="tag">Beginners welcome</span>
            <span className="tag">Doubles</span>
          </div>
          <h1>Saturday Morning Mix-In</h1>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, opacity: 0.95 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="clock" size={14} /> Sat · 9:00 AM
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="location" size={14} /> Riverside
            </span>
          </div>
        </div>
      </div>

      <div className="detail-body">
        <div className="kv-grid">
          <div className="kv">
            <div className="eyebrow">Format</div>
            <div className="val">Doubles</div>
          </div>
          <div className="kv">
            <div className="eyebrow">Skill</div>
            <div className="val">2.5–3.5</div>
          </div>
          <div className="kv">
            <div className="eyebrow">Spots</div>
            <div className="val lime">4 left</div>
          </div>
        </div>

        <div className="organizer">
          <Avatar name="Coach Mike" size={48} variant="lime" />
          <div className="meta">
            <div className="role">Hosted by</div>
            <div className="name">
              Coach Mike{' '}
              <span style={{ color: 'var(--primary)' }}>•</span>{' '}
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>Verified</span>
            </div>
          </div>
          <div className="actions">
            <button className="icon-btn" aria-label="Message organizer">
              <Icon name="message" size={16} />
            </button>
          </div>
        </div>

        <div className="location-card">
          <div className="map-preview">
            <div className="pin">
              <Icon name="location" size={16} />
            </div>
          </div>
          <div className="map-info">
            <div className="text">
              <div className="name">Riverside Courts</div>
              <div className="addr">1200 Willow St, Austin, TX · 1.2 mi</div>
            </div>
            <button className="directions" aria-label="Get directions">
              <Icon name="directions" size={18} />
            </button>
          </div>
        </div>

        <div className="about-card">
          <div className="t-eyebrow" style={{ marginBottom: 6 }}>About this game</div>
          <p>Ready to shake off the week? Our Saturday Mix-In is high energy and a great way to meet new partners. 4 courts reserved for 3 hours of non-stop pickleball.</p>
          <p>We rotate every 15 minutes so you get to play with a variety of styles. Good music, plenty of water breaks, very supportive crew.</p>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div className="t-eyebrow">Players</div>
              <div className="hd-3" style={{ marginTop: 4 }}>8 going · 4 spots open</div>
            </div>
            <button className="more" onClick={() => onNavigate('invite-players', { id: 'g1' })}>Invite</button>
          </div>
          <div className="players-grid">
            {PLAYERS.map((p) => (
              <div key={p.name} className="player">
                <Avatar name={p.name} size={56} variant={p.v} />
                <div className="name">{p.you ? 'You' : p.name.split(' ')[0]}</div>
              </div>
            ))}
            {[1, 2, 3, 4].map((i) => (
              <div key={`e${i}`} className="player empty">
                <Avatar size={56} />
                <div className="name" style={{ color: 'var(--muted)' }}>Open</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="t-eyebrow" style={{ marginBottom: 10 }}>Game chat · 3 messages</div>
          <div className="chat-list">
            <div className="chat-msg organizer">
              <Avatar name="Coach Mike" size={32} variant="lime" />
              <div>
                <div className="by">Coach Mike · 10:32 AM</div>
                <div className="bubble">Hey everyone! Bring water — it's gonna be hot. We start sharp at 9 ⏰</div>
              </div>
            </div>
            <div className="chat-msg">
              <Avatar name="Sarah K" size={32} />
              <div>
                <div className="by">Sarah K · 10:45 AM</div>
                <div className="bubble">Will do! Still rotating every 15 min?</div>
              </div>
            </div>
            <div className="chat-msg organizer">
              <Avatar name="Coach Mike" size={32} variant="lime" />
              <div>
                <div className="by">Coach Mike · 10:50 AM</div>
                <div className="bubble">Yep! Standard round robin — everyone plays with everyone 🎾</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <input
              type="text"
              placeholder="Type a message…"
              style={{
                flex: 1,
                height: 44,
                padding: '0 14px',
                background: 'var(--surface)',
                border: '0.5px solid var(--hairline)',
                borderRadius: 14,
                outline: 'none',
                color: 'var(--ink)',
              }}
            />
            <button
              aria-label="Send"
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'var(--lime)',
                color: 'var(--lime-ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="send" size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="sticky-cta">
        <div className="price">
          <div className="eyebrow">Per person</div>
          <div className="amount">$12</div>
        </div>
        <button
          className={`btn-join ${joined ? 'joined' : ''}`}
          onClick={handleJoin}
          disabled={joining || joined}
        >
          {joining ? (
            <>
              <span style={{ display: 'inline-flex', animation: 'spin 1s linear infinite' }}>
                <Icon name="spinner" size={18} />
              </span>
              Joining…
            </>
          ) : joined ? (
            <>
              <Icon name="check" size={16} />
              You're in!
            </>
          ) : (
            <>
              <Icon name="bolt" size={16} />
              Join Game
            </>
          )}
        </button>
      </div>

      <DuprExplainerSheet open={duprOpen} onClose={() => setDuprOpen(false)} />
    </div>
  );
}
