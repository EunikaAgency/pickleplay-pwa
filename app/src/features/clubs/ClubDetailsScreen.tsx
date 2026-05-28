import { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { Avatar } from '../components/ui/Avatar';
import { Segmented } from '../components/ui/Segmented';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { useDemoState } from '../lib/demoState';

interface ClubDetailsScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  onBack: () => void;
  clubId?: string;
}

type ClubTab = 'about' | 'members' | 'events' | 'chat';

const MEMBERS = [
  { name: 'Mike R.',   role: 'Admin',     v: 'lime' as const },
  { name: 'Sarah K.',  role: 'Moderator', v: 'blue' as const },
  { name: 'Alex T.',   role: 'Member',    v: 'coral' as const },
  { name: 'Jordan P.', role: 'Member',    v: 'blue' as const },
  { name: 'Casey W.',  role: 'Member',    v: 'lime' as const },
];

const CHAT = [
  { sender: 'Mike R.',  body: "Who's in for Saturday morning?",   time: '10:32 AM', isMe: false, v: 'lime' as const },
  { sender: 'Sarah K.', body: "I'm there! Bringing a guest too.",  time: '10:35 AM', isMe: false, v: 'blue' as const },
  { sender: 'Me',       body: 'Count me in! Can we do doubles?',    time: '10:38 AM', isMe: true,  v: 'lime' as const },
  { sender: 'Mike R.',  body: "Absolutely. I'll set up the rotation.", time: '10:40 AM', isMe: false, v: 'lime' as const },
];

const EVENTS = [
  { title: 'Saturday Mix-In',        date: 'Sat, Oct 14 · 9:00 AM',  spots: '8/12',  day: 'SAT', num: '14', thumb: 'lime'  as const },
  { title: 'Weekly Doubles League',  date: 'Tue, Oct 17 · 6:30 PM',  spots: '14/16', day: 'TUE', num: '17', thumb: 'blue'  as const },
  { title: 'Beginner Clinic',        date: 'Sun, Oct 22 · 2:00 PM',  spots: '4/8',   day: 'SUN', num: '22', thumb: 'coral' as const },
];

export function ClubDetailsScreen({ onBack, onNavigate }: ClubDetailsScreenProps) {
  const [tab, setTab] = useState<ClubTab>('about');
  const [message, setMessage] = useState('');
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
          title="Couldn't load this club"
          message="We couldn't fetch the club page. Pull down to retry."
          onRetry={() => {}}
        />
      </div>
    );
  }
  if (demoState === 'empty') {
    return (
      <div className="scroll safe-top safe-bottom">
        <EmptyState
          icon="groups"
          title="This club isn't accepting new members"
          description="Try browsing other clubs in your area."
        />
      </div>
    );
  }

  return (
    <div className="scroll" style={{ paddingBottom: 30 }}>
      <div className="detail-hero" style={{ height: 260 }}>
        <div className="img" style={{ background: 'linear-gradient(135deg, #0035be 0%, #4d6dff 100%)' }} />
        <div className="grad" />
        <div className="top-controls">
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <Icon name="back" size={18} />
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="icon-btn" aria-label="Share">
              <Icon name="share" size={16} />
            </button>
            <button className="icon-btn" aria-label="Message">
              <Icon name="message" size={16} />
            </button>
          </div>
        </div>
        <div className="info">
          <div className="tag-row">
            <span className="tag lime">Competitive</span>
            <span className="tag">128 members</span>
          </div>
          <h1>Neon Smashers</h1>
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.95 }}>
            Downtown Austin · 4.8 ★
          </div>
        </div>
      </div>

      <div className="detail-body">
        <button className="btn-primary" style={{ margin: '0 0 14px', width: '100%' }}>
          <Icon name="check" size={16} /> Joined
        </button>

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'about', label: 'About' },
            { value: 'members', label: 'Members' },
            { value: 'events', label: 'Events' },
            { value: 'chat', label: 'Chat' },
          ]}
        />

        <div style={{ marginTop: 16 }}>
          {tab === 'about' && (
            <>
              <div className="about-card">
                <div className="t-eyebrow" style={{ marginBottom: 6 }}>About</div>
                <p>Austin's most active pickleball community. We host weekly competitive and casual games across downtown courts. All skill levels welcome.</p>
              </div>
              <div className="about-card">
                <div className="t-eyebrow" style={{ marginBottom: 6 }}>Rules</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {['Be respectful and supportive of all players', 'RSVP at least 2 hours before events', 'Bring water and wear court shoes'].map((r) => (
                    <li key={r} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: 'var(--ink-2)' }}>
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 6,
                          background: 'var(--lime-soft)',
                          color: 'var(--lime-ink)',
                          flexShrink: 0,
                          marginTop: 2,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="check" size={11} />
                      </span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {tab === 'members' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {MEMBERS.map((m) => (
                <div key={m.name} className="organizer" style={{ margin: 0 }}>
                  <Avatar name={m.name} size={40} variant={m.v} />
                  <div className="meta">
                    <div className="role">{m.role}</div>
                    <div className="name">{m.name}</div>
                  </div>
                  <Icon name="chevron" size={16} style={{ color: 'var(--surface-3)' }} />
                </div>
              ))}
            </div>
          )}

          {tab === 'events' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {EVENTS.map((e) => (
                <button key={e.title} className="game-row" onClick={() => onNavigate('game-details', { id: '1' })}>
                  <div className={`thumb ${e.thumb}`}>
                    <span className="day">{e.day}</span>
                    <span className="num">{e.num}</span>
                  </div>
                  <div className="body">
                    <div className="title">{e.title}</div>
                    <div className="meta">
                      <span className="m"><Icon name="clock" size={11} />{e.date}</span>
                      <span className="m"><Icon name="paddle" size={11} />{e.spots}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {tab === 'chat' && (
            <>
              <div className="chat-list">
                {CHAT.map((msg, i) => (
                  <div key={i} className={`chat-msg ${msg.isMe ? '' : 'organizer'}`} style={{ flexDirection: msg.isMe ? 'row-reverse' : 'row' }}>
                    <Avatar name={msg.sender === 'Me' ? 'Riley' : msg.sender} size={32} variant={msg.v} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.isMe ? 'flex-end' : 'flex-start' }}>
                      <div className="by">{msg.sender} · {msg.time}</div>
                      <div className="bubble">{msg.body}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
