import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Segmented } from '../../shared/components/ui/Segmented';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import { Button } from '../../shared/components/ui/Button';
import type { Navigate } from '../../shared/lib/navigation';

interface ClubDetailsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
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
            title="Couldn't load this club"
            message="We couldn't fetch the club page. Pull down to retry."
            onRetry={() => {}}
          />
        </div>
      }
      empty={
        <div className="scroll safe-top safe-bottom">
          <EmptyState
            icon="groups"
            title="This club isn't accepting new members"
            description="Try browsing other clubs in your area."
          />
        </div>
      }
    >
    <div className="scroll pb-[30px]">
      <div className="detail-hero h-[260px]!">
        <div className="img bg-[linear-gradient(135deg,#0035be_0%,#4d6dff_100%)]" />
        <div className="grad" />
        <div className="top-controls">
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <Icon name="back" size={18} />
          </button>
          <div className="flex gap-2">
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
          <div className="mt-2.5 text-[13px] opacity-95">
            Downtown Austin · 4.8 ★
          </div>
        </div>
      </div>

      <div className="detail-body">
        <Button fullWidth className="mb-3.5">
          <Icon name="check" size={16} /> Joined
        </Button>

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

        <div className="mt-4">
          {tab === 'about' && (
            <>
              <div className="about-card">
                <div className="t-eyebrow mb-1.5">About</div>
                <p>Austin's most active pickleball community. We host weekly competitive and casual games across downtown courts. All skill levels welcome.</p>
              </div>
              <div className="about-card">
                <div className="t-eyebrow mb-1.5">Rules</div>
                <ul className="list-none p-0 m-0 flex flex-col gap-2">
                  {['Be respectful and supportive of all players', 'RSVP at least 2 hours before events', 'Bring water and wear court shoes'].map((r) => (
                    <li key={r} className="flex items-start gap-2 text-[14px] text-[var(--ink-2)]">
                      <span className="w-[18px] h-[18px] rounded-md bg-[var(--lime-soft)] text-[var(--lime-ink)] shrink-0 mt-0.5 inline-flex items-center justify-center">
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
            <div className="flex flex-col gap-2.5">
              {MEMBERS.map((m) => (
                <div key={m.name} className="organizer m-0!">
                  <Avatar name={m.name} size={40} variant={m.v} />
                  <div className="meta">
                    <div className="role">{m.role}</div>
                    <div className="name">{m.name}</div>
                  </div>
                  <Icon name="chevron" size={16} className="text-[var(--surface-3)]" />
                </div>
              ))}
            </div>
          )}

          {tab === 'events' && (
            <div className="flex flex-col gap-2.5">
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
                  <div key={i} className={`chat-msg ${msg.isMe ? 'flex-row-reverse' : 'flex-row'} ${msg.isMe ? '' : 'organizer'}`}>
                    <Avatar name={msg.sender === 'Me' ? 'Riley' : msg.sender} size={32} variant={msg.v} />
                    <div className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                      <div className="by">{msg.sender} · {msg.time}</div>
                      <div className="bubble">{msg.body}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2.5 mt-3.5">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
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
            </>
          )}
        </div>
      </div>
    </div>
    </DemoBranch>
  );
}
