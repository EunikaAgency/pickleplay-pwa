import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PeopleIllustration } from '../components/ui/CourtIllustration';
import { useDemoState } from '../lib/demoState';

interface ClubsScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  onBack?: () => void;
}

const MY = [
  { id: '1', name: 'Neon Smashers',    icon: 'bolt',    bg: 'lime', meta: '24 members · 3 events this week' },
  { id: '2', name: 'Downtown Volleys', icon: 'groups',  bg: 'blue', meta: '42 members · social club' },
] as const;

const DISCOVER = [
  { id: '3', name: 'Paddle Pirates', rating: 4.9, dist: '1.2 mi', tags: ['Morning Play', 'Beginner'], img: 'linear-gradient(135deg, #cf3000, #ff7355)' },
  { id: '4', name: 'The Dink Den',    rating: 4.7, dist: '0.5 mi', tags: ['Indoor', 'All Levels'],    img: 'linear-gradient(135deg, #c1f100, #abd600)' },
  { id: '5', name: 'Ace Alliance',    rating: 5.0, dist: '2.4 mi', tags: ['Night Play'],              img: 'linear-gradient(135deg, #1a1d24, #404756)' },
] as const;

export function ClubsScreen({ onNavigate }: ClubsScreenProps) {
  const { state: demoState } = useDemoState();

  return (
    <div className="scroll safe-top safe-bottom">
      <div className="app-header">
        <div>
          <div className="greet-name">Clubs</div>
          <div className="greet-sub">Find your people</div>
        </div>
        <button
          onClick={() => onNavigate('create-club')}
          style={{
            height: 40,
            padding: '0 14px',
            borderRadius: 12,
            background: 'var(--ink)',
            color: 'white',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon name="plus" size={14} /> New
        </button>
      </div>

      <div className="searchbar">
        <Icon name="search" size={16} />
        <input placeholder="Search clubs by name or tag…" />
      </div>

      {demoState === 'loading' ? (
        <div className="section" style={{ marginTop: 16 }}>
          <LoadingSkeleton variant="card" count={4} />
        </div>
      ) : demoState === 'error' ? (
        <ErrorState
          title="Couldn't load clubs"
          message="We couldn't reach the clubs directory. Pull down to retry."
          onRetry={() => {}}
        />
      ) : demoState === 'empty' ? (
        <EmptyState
          icon="groups"
          title="No clubs in your city yet"
          description="Be the first to start a community — PickleBallers grows when locals organize regular play."
          action={{ label: 'Start a club', onPress: () => onNavigate('create-club') }}
        />
      ) : (
        <>
          {/* My clubs */}
          <div className="section">
            <div className="section-head">
              <div>
                <div className="t-eyebrow">My clubs</div>
                <div className="hd-2" style={{ marginTop: 4 }}>
                  You're a member of 2
                </div>
              </div>
              <button className="more">All</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {MY.map((c) => (
                <button
                  key={c.id}
                  className="club-card"
                  onClick={() => onNavigate('club-details', { id: c.id })}
                >
                  <div className={`icon-circle ${c.bg}`}>
                    <Icon name={c.icon} size={22} />
                  </div>
                  <div className="body">
                    <div className="name">{c.name}</div>
                    <div className="meta">
                      <Icon name="groups" size={12} />
                      {c.meta}
                    </div>
                  </div>
                  <Icon name="chevron" size={18} style={{ color: 'var(--surface-3)' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Featured */}
          <div className="section">
            <div className="section-head">
              <div>
                <div className="t-eyebrow">Featured</div>
                <div className="hd-2" style={{ marginTop: 4 }}>
                  Largest community in town
                </div>
              </div>
            </div>
            <button
              className="featured-club"
              onClick={() => onNavigate('club-details', { id: 'kk' })}
              style={{ border: 'none', cursor: 'pointer' }}
            >
              <div className="glyph">K</div>
              <div style={{ position: 'absolute', right: -20, top: 10 }}>
                <PeopleIllustration width={150} opacity={0.55} />
              </div>
              <span className="eyebrow">FEATURED · 312 MEMBERS</span>
              <h3>The Kitchen Kings</h3>
              <p>Competitive & casual play, 12 courts, pro coaches and weekly mixers.</p>
              <div className="stats">
                <div className="s">
                  <div className="n">12</div>
                  <div className="l">Courts</div>
                </div>
                <div className="s">
                  <div className="n">8</div>
                  <div className="l">Events/wk</div>
                </div>
                <div className="s">
                  <div className="n">4.9</div>
                  <div className="l">Rating</div>
                </div>
              </div>
            </button>
          </div>

          {/* Discover */}
          <div className="section">
            <div className="section-head">
              <div>
                <div className="t-eyebrow">Discover</div>
                <div className="hd-2" style={{ marginTop: 4 }}>
                  Clubs near you
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DISCOVER.map((c) => (
                <button key={c.id} className="game-row" onClick={() => onNavigate('club-details', { id: c.id })}>
                  <div
                    className="thumb"
                    style={{ background: c.img, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="groups" size={28} />
                  </div>
                  <div className="body">
                    <div className="title">{c.name}</div>
                    <div className="meta">
                      <span className="m">
                        <Icon name="star" size={11} style={{ color: '#c89000' }} />
                        {c.rating}
                      </span>
                      <span className="m">
                        <Icon name="location" size={11} />
                        {c.dist}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      {c.tags.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 6,
                            background: 'var(--surface-2)',
                            color: 'var(--ink-2)',
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div
                    className="rsvp"
                    style={{ background: 'var(--primary-tint)', color: 'var(--primary)', boxShadow: 'none' }}
                  >
                    <Icon name="plus" size={16} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Start a club CTA */}
          <div className="section">
            <button
              className="featured-club"
              onClick={() => onNavigate('create-club')}
              style={{
                background: 'linear-gradient(135deg, var(--lime-soft), var(--lime))',
                color: 'var(--lime-ink)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span className="eyebrow" style={{ background: 'var(--ink)', color: 'white' }}>
                START YOUR OWN
              </span>
              <h3 style={{ color: 'var(--lime-ink)' }}>Can't find your crew?</h3>
              <p style={{ color: 'rgba(42,55,0,0.7)' }}>Start a club, invite friends, and own your weekly mixer.</p>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
