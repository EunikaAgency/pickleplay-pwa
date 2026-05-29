import { Icon } from '../../shared/components/ui/Icon';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { PeopleIllustration } from '../../shared/components/ui/CourtIllustration';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import type { Navigate } from '../../shared/lib/navigation';

interface ClubsScreenProps {
  onNavigate: Navigate;
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
  return (
    <div className="scroll safe-top safe-bottom">
      <div className="app-header">
        <div>
          <div className="greet-name">Clubs</div>
          <div className="greet-sub">Find your people</div>
        </div>
        <button
          onClick={() => onNavigate('create-club')}
          className="h-10 px-3.5 rounded-xl bg-[var(--ink)] text-white text-[13px] font-bold flex items-center gap-1.5"
        >
          <Icon name="plus" size={14} /> New
        </button>
      </div>

      <div className="searchbar">
        <Icon name="search" size={16} />
        <input placeholder="Search clubs by name or tag…" />
      </div>

      <DemoBranch
        loading={
          <div className="section mt-4!">
            <LoadingSkeleton variant="card" count={4} />
          </div>
        }
        error={
          <ErrorState
            title="Couldn't load clubs"
            message="We couldn't reach the clubs directory. Pull down to retry."
            onRetry={() => {}}
          />
        }
        empty={
          <EmptyState
            icon="groups"
            title="No clubs in your city yet"
            description="Be the first to start a community — PickleBallers grows when locals organize regular play."
            action={{ label: 'Start a club', onPress: () => onNavigate('create-club') }}
          />
        }
      >
        <>
          {/* My clubs */}
          <div className="section">
            <div className="section-head">
              <div>
                <div className="t-eyebrow">My clubs</div>
                <div className="hd-2 mt-1">You're a member of 2</div>
              </div>
              <button className="more">All</button>
            </div>
            <div className="clubs-grid flex flex-col gap-2.5">
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
                  <Icon name="chevron" size={18} className="text-[var(--surface-3)]" />
                </button>
              ))}
            </div>
          </div>

          {/* Featured */}
          <div className="section">
            <div className="section-head">
              <div>
                <div className="t-eyebrow">Featured</div>
                <div className="hd-2 mt-1">Largest community in town</div>
              </div>
            </div>
            <button
              className="featured-club border-none cursor-pointer"
              onClick={() => onNavigate('club-details', { id: 'kk' })}
            >
              <div className="glyph">K</div>
              <div className="absolute -right-5 top-2.5">
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
              <span className="absolute right-4 bottom-4 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-[11px] font-bold tracking-wide">
                View club <Icon name="chevron" size={12} />
              </span>
            </button>
          </div>

          {/* Discover */}
          <div className="section">
            <div className="section-head">
              <div>
                <div className="t-eyebrow">Discover</div>
                <div className="hd-2 mt-1">Clubs near you</div>
              </div>
            </div>
            <div className="clubs-grid flex flex-col gap-2.5">
              {DISCOVER.map((c) => (
                <button key={c.id} className="game-row" onClick={() => onNavigate('club-details', { id: c.id })}>
                  <div
                    className="thumb text-white flex items-center justify-center"
                    style={{ background: c.img }}
                  >
                    <Icon name="groups" size={28} />
                  </div>
                  <div className="body">
                    <div className="title">{c.name}</div>
                    <div className="meta">
                      <span className="m">
                        <Icon name="star" size={11} className="text-[#c89000]" />
                        {c.rating}
                      </span>
                      <span className="m">
                        <Icon name="location" size={11} />
                        {c.dist}
                      </span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {c.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[var(--surface-2)] text-[var(--ink-2)]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Icon name="chevron" size={18} className="text-[var(--surface-3)] shrink-0 ml-1" />
                </button>
              ))}
            </div>
          </div>

          {/* Start a club CTA */}
          <div className="section">
            <button
              className="featured-club border-none cursor-pointer bg-[linear-gradient(135deg,var(--lime-soft),var(--lime))]! text-[var(--lime-ink)]!"
              onClick={() => onNavigate('create-club')}
            >
              <span className="eyebrow bg-[var(--ink)]! text-white!">
                START YOUR OWN
              </span>
              <h3 className="text-[var(--lime-ink)]!">Can't find your crew?</h3>
              <p className="text-[rgba(42,55,0,0.7)]!">Start a club, invite friends, and own your weekly mixer.</p>
            </button>
          </div>
        </>
      </DemoBranch>
    </div>
  );
}
