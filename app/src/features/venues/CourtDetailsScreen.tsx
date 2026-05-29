import { Icon } from '../../shared/components/ui/Icon';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { DemoBranch } from '../../shared/components/ui/DemoBranch';
import type { Navigate } from '../../shared/lib/navigation';

interface CourtDetailsScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

export function CourtDetailsScreen({ onNavigate, onBack }: CourtDetailsScreenProps) {
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
            title="Couldn't load this court"
            message="We couldn't reach the court directory. Try again in a moment."
            onRetry={() => {}}
          />
        </div>
      }
      empty={
        <div className="scroll safe-top safe-bottom">
          <EmptyState
            icon="location"
            title="This court is closed"
            description="It may be temporarily unavailable. Try a different court nearby."
            action={{ label: 'Find another court', onPress: () => onNavigate('nearby') }}
          />
        </div>
      }
    >
    <div className="scroll pb-[30px]">
      <div className="detail-hero">
        <div className="img bg-[linear-gradient(135deg,#4d6dff_0%,#0040e0_60%,#0035be_100%)]" />
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
            <span className="tag lime">Indoor</span>
            <span className="tag">6 courts</span>
            <span className="tag">Public</span>
          </div>
          <h1>Austin Smash Center</h1>
          <div className="mt-2.5 flex items-center gap-3 text-[13px] opacity-95">
            <span className="inline-flex items-center gap-1">
              <Icon name="star" size={14} /> 4.9
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="location" size={14} /> 1200 Willow St · 0.8 mi
            </span>
          </div>
        </div>
      </div>

      <div className="detail-body">
        <div className="kv-grid">
          <div className="kv">
            <div className="eyebrow">Courts</div>
            <div className="val">6</div>
          </div>
          <div className="kv">
            <div className="eyebrow">Surface</div>
            <div className="val">Acrylic</div>
          </div>
          <div className="kv">
            <div className="eyebrow">Hours</div>
            <div className="val lime">Open</div>
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
              <div className="name">Austin Smash Center</div>
              <div className="addr">1200 Willow St, Austin, TX</div>
            </div>
            <button className="directions" aria-label="Get directions" onClick={() => window.open('https://maps.google.com', '_blank')}>
              <Icon name="directions" size={18} />
            </button>
          </div>
        </div>

        <div className="about-card">
          <div className="t-eyebrow mb-1.5">About this venue</div>
          <p>Premier indoor pickleball center with six pro courts, a small pro shop, and a coffee bar. Reservations recommended on weekends.</p>
        </div>

        <div className="section mt-0! p-0!">
          <div className="section-head px-0">
            <div className="hd-2">Amenities</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {['Restrooms', 'Pro Shop', 'Coffee Bar', 'Lighted', 'Water', 'Seating'].map((a) => (
              <div
                key={a}
                className="flex items-center gap-2 bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] rounded-[14px] px-3 py-2.5 text-[13px] text-[var(--ink-2)] font-semibold"
              >
                <span className="w-[22px] h-[22px] rounded-lg bg-[var(--lime-soft)] text-[var(--lime-ink)] inline-flex items-center justify-center">
                  <Icon name="check" size={12} />
                </span>
                {a}
              </div>
            ))}
          </div>
        </div>

        <div className="section p-0!">
          <div className="section-head px-0">
            <div>
              <div className="t-eyebrow">Games this week</div>
              <div className="hd-2 mt-1">Drop in or RSVP</div>
            </div>
            <button className="more" onClick={() => onNavigate('games')}>All</button>
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              { day: 'TOM', num: '14', title: 'Morning Doubles Mixer', time: '9:00 AM', loc: '4 spots left' },
              { day: 'SAT', num: '15', title: 'Saturday Mix-In',        time: '9:00 AM', loc: '8 spots left' },
              { day: 'SUN', num: '16', title: 'Beginner Clinic',        time: '2:00 PM', loc: '2 spots left' },
            ].map((g) => (
              <button
                key={g.title}
                className="game-row"
                onClick={() => onNavigate('game-details', { id: '1' })}
              >
                <div className="thumb lime">
                  <span className="day">{g.day}</span>
                  <span className="num">{g.num}</span>
                </div>
                <div className="body">
                  <div className="title">{g.title}</div>
                  <div className="meta">
                    <span className="m"><Icon name="clock" size={11} />{g.time}</span>
                    <span className="m"><Icon name="paddle" size={11} />{g.loc}</span>
                  </div>
                </div>
                <div className="rsvp bg-[var(--primary-tint)]! text-[var(--primary)]! shadow-none!">
                  <Icon name="chevron" size={16} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
    </DemoBranch>
  );
}
