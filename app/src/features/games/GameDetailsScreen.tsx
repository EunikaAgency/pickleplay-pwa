import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { CourtIllustration } from '../../shared/components/ui/CourtIllustration';
import { DuprExplainerSheet } from '../../shared/components/ui/DuprExplainerSheet';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import type { Navigate } from '../../shared/lib/navigation';

interface GameDetailsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
  /** Soft auth gate — returns false (and prompts sign-up) for guests. */
  onRequireAuth?: (intent: string) => boolean;
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

export function GameDetailsScreen({ onNavigate, onBack, onRequireAuth }: GameDetailsScreenProps) {
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [duprOpen, setDuprOpen] = useState(false);

  const handleJoin = () => {
    if (joined || joining) return;
    // Browsing the game is free; committing to it requires an account.
    if (onRequireAuth && !onRequireAuth('join this game')) return;
    setJoining(true);
    setTimeout(() => {
      setJoining(false);
      setJoined(true);
    }, 900);
  };

  return (
    <DemoBranch
      loading={
        <div className="scroll safe-top safe-bottom px-4">
          <LoadingSkeleton variant="block" count={1} />
          <div className="mt-3">
            <LoadingSkeleton variant="card" count={3} />
          </div>
        </div>
      }
      error={
        <div className="scroll safe-top safe-bottom">
          <ErrorState
            title="Couldn't load this game"
            message="We couldn't fetch this game's details. Pull down to retry."
            onRetry={() => {}}
          />
        </div>
      }
      empty={
        <div className="scroll safe-top safe-bottom">
          <EmptyState
            icon="paddle"
            title="This game is no longer available"
            description="The organizer may have cancelled or filled all the spots."
            action={{ label: 'Find another game', onPress: () => onNavigate('games') }}
          />
        </div>
      }
    >
    <div className="scroll pb-[130px]">
      <div className="detail-hero">
        <div className="img bg-[linear-gradient(135deg,#0040e0_0%,#6c83ff_60%,#a5b9ff_100%)]" />
        <div className="absolute -right-7 top-[60px] opacity-85 [transform:rotate(-12deg)_scale(1.1)]">
          <CourtIllustration width={240} />
        </div>
        <div className="grad" />
        <div className="top-controls">
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <Icon name="back" size={18} />
          </button>
          <div className="flex gap-2">
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
              className="tag lime cursor-pointer inline-flex items-center gap-1"
              onClick={() => setDuprOpen(true)}
            >
              3.0–3.5 <Icon name="help" size={11} />
            </button>
            <span className="tag">Beginners welcome</span>
            <span className="tag">Doubles</span>
          </div>
          <h1>Saturday Morning Mix-In</h1>
          <div className="mt-2.5 flex items-center gap-3 text-[13px] opacity-95">
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" size={14} /> Sat · 9:00 AM
            </span>
            <span className="inline-flex items-center gap-1">
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
              <span className="text-[var(--primary)]">•</span>{' '}
              <span className="text-[11px] text-[var(--muted)] font-bold">Verified</span>
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
          <div className="t-eyebrow mb-1.5">About this game</div>
          <p>Ready to shake off the week? Our Saturday Mix-In is high energy and a great way to meet new partners. 4 courts reserved for 3 hours of non-stop pickleball.</p>
          <p>We rotate every 15 minutes so you get to play with a variety of styles. Good music, plenty of water breaks, very supportive crew.</p>
        </div>

        <div className="mb-[18px]">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="t-eyebrow">Players</div>
              <div className="hd-3 mt-1">8 going · 4 spots open</div>
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
                <div className="name text-[var(--muted)]!">Open</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="t-eyebrow mb-2.5">Game chat · 3 messages</div>
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
          <div className="flex gap-2.5 mt-3.5">
            <input
              type="text"
              placeholder="Type a message…"
              className="flex-1 h-11 px-3.5 rounded-[14px] bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] outline-none text-[var(--ink)]"
            />
            <button
              aria-label="Send"
              className="w-11 h-11 rounded-[14px] bg-[var(--lime)] text-[var(--lime-ink)] flex items-center justify-center"
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
              <span className="inline-flex animate-spin">
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
    </DemoBranch>
  );
}
