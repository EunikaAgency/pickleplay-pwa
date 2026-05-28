import { Icon } from '../components/ui/Icon';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { useDemoState } from '../lib/demoState';

interface CourtDetailsScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  onBack: () => void;
  courtId?: string;
}

export function CourtDetailsScreen({ onNavigate, onBack }: CourtDetailsScreenProps) {
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
          title="Couldn't load this court"
          message="We couldn't reach the court directory. Try again in a moment."
          onRetry={() => {}}
        />
      </div>
    );
  }
  if (demoState === 'empty') {
    return (
      <div className="scroll safe-top safe-bottom">
        <EmptyState
          icon="location"
          title="This court is closed"
          description="It may be temporarily unavailable. Try a different court nearby."
          action={{ label: 'Find another court', onPress: () => onNavigate('nearby') }}
        />
      </div>
    );
  }

  return (
    <div className="scroll" style={{ paddingBottom: 30 }}>
      <div className="detail-hero">
        <div
          className="img"
          style={{
            background: 'linear-gradient(135deg, #4d6dff 0%, #0040e0 60%, #0035be 100%)',
          }}
        />
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
            <span className="tag lime">Indoor</span>
            <span className="tag">6 courts</span>
            <span className="tag">Public</span>
          </div>
          <h1>Austin Smash Center</h1>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, opacity: 0.95 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="star" size={14} /> 4.9
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
          <div className="t-eyebrow" style={{ marginBottom: 6 }}>About this venue</div>
          <p>Premier indoor pickleball center with six pro courts, a small pro shop, and a coffee bar. Reservations recommended on weekends.</p>
        </div>

        <div className="section" style={{ marginTop: 0, padding: 0 }}>
          <div className="section-head" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="hd-2">Amenities</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {['Restrooms', 'Pro Shop', 'Coffee Bar', 'Lighted', 'Water', 'Seating'].map((a) => (
              <div
                key={a}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--surface)',
                  border: '0.5px solid var(--hairline)',
                  borderRadius: 14,
                  padding: '10px 12px',
                  fontSize: 13,
                  color: 'var(--ink-2)',
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 8,
                    background: 'var(--lime-soft)',
                    color: 'var(--lime-ink)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="check" size={12} />
                </span>
                {a}
              </div>
            ))}
          </div>
        </div>

        <div className="section" style={{ padding: 0 }}>
          <div className="section-head" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div>
              <div className="t-eyebrow">Games this week</div>
              <div className="hd-2" style={{ marginTop: 4 }}>Drop in or RSVP</div>
            </div>
            <button className="more" onClick={() => onNavigate('games')}>All</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                <div className="rsvp" style={{ background: 'var(--primary-tint)', color: 'var(--primary)', boxShadow: 'none' }}>
                  <Icon name="chevron" size={16} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
