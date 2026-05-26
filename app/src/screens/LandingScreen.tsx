import { Icon } from '../components/ui/Icon';
import { CourtIllustration } from '../components/ui/CourtIllustration';

interface LandingScreenProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const FEATURES = [
  {
    icon: 'paddle',
    title: 'Skill-matched games',
    body: 'Filter by DUPR range so the rally lasts longer than the warm-up — beginner to 4.0+.',
  },
  {
    icon: 'groups',
    title: 'Friendly local players',
    body: 'Verified organizers, player profiles, and a community-first vibe.',
  },
  {
    icon: 'location',
    title: 'Courts in your pocket',
    body: 'Every court near you with amenities, photos, ratings, and walking distance.',
  },
];

const STEPS = [
  { number: '1', title: 'Tell us where you play', body: 'Set your home court and skill level. 30 seconds.' },
  { number: '2', title: "Browse tonight's games", body: 'Open games within 10 miles, filtered by date and level.' },
  { number: '3', title: 'Tap to join', body: 'Reserve a spot, message the organizer, show up ready.' },
];

export function LandingScreen({ onGetStarted, onSignIn }: LandingScreenProps) {
  return (
    <div
      className="scroll"
      style={{
        background:
          'radial-gradient(900px 500px at 10% -10%, rgba(0,64,224,0.18), transparent 60%), radial-gradient(700px 400px at 100% 100%, rgba(193,241,0,0.25), transparent 60%), var(--bg)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'calc(16px + env(safe-area-inset-top)) 20px 12px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(246,247,251,0.85)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'var(--lime)',
              color: 'var(--lime-ink)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="paddle" size={18} />
          </span>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, color: 'var(--ink)' }}>
            PickleBallers
          </span>
        </div>
        <button onClick={onSignIn} style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
          Sign in
        </button>
      </header>

      <section style={{ padding: '20px 20px 8px' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: 999,
            background: 'var(--lime-soft)',
            color: 'var(--lime-ink)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          For recreational players
        </span>
        <h1 className="hd-display" style={{ marginTop: 12, fontSize: 32, lineHeight: 1.1 }}>
          Find your next pickleball game in two taps.
        </h1>
        <p className="t-body" style={{ marginTop: 12 }}>
          Discover open games near you, meet players at your skill level, and turn your local courts into a community.
        </p>

        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn-primary" style={{ margin: 0, width: '100%' }} onClick={onGetStarted}>
            Get started — it's free <Icon name="forward" size={16} />
          </button>
          <button className="btn-primary outline" style={{ margin: 0, width: '100%' }} onClick={onSignIn}>
            I have an account
          </button>
        </div>
        <p className="t-sm" style={{ marginTop: 10 }}>No credit card. Works on iOS, Android, and the web.</p>
      </section>

      {/* Hero visual */}
      <section style={{ position: 'relative', margin: '24px 16px 0', borderRadius: 28, overflow: 'hidden', minHeight: 220, background: 'linear-gradient(135deg, var(--primary) 0%, #6c83ff 100%)', boxShadow: 'var(--shadow-pop)' }}>
        <div style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.95 }}>
          <CourtIllustration width={200} />
        </div>
        <div style={{ position: 'relative', padding: 20, color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-flex', width: 8, height: 8, borderRadius: 999, background: '#ff5a4d', boxShadow: '0 0 0 4px rgba(255,90,77,0.25)' }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.9 }}>
              Live in 12 cities
            </span>
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 24, marginTop: 10, maxWidth: '70%' }}>
            Tonight: 12 open games near you
          </h2>
          <p style={{ marginTop: 8, fontSize: 13, opacity: 0.9, maxWidth: '70%' }}>
            From beginner mix-ins to competitive doubles.
          </p>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '32px 16px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <span className="t-eyebrow">Why PickleBallers</span>
          <h2 className="hd-1" style={{ marginTop: 6 }}>Everything you need to play more.</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: 'var(--surface)',
                border: '0.5px solid var(--hairline)',
                borderRadius: 18,
                padding: 16,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: 'var(--lime-soft)',
                  color: 'var(--lime-ink)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={f.icon} size={20} />
              </div>
              <h3 className="hd-3" style={{ marginTop: 10 }}>{f.title}</h3>
              <p className="t-sm" style={{ marginTop: 4 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '32px 16px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <span className="t-eyebrow">How it works</span>
          <h2 className="hd-1" style={{ marginTop: 6 }}>Get into a game tonight.</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STEPS.map((s) => (
            <div
              key={s.number}
              style={{
                background: 'var(--surface)',
                border: '0.5px solid var(--hairline)',
                borderRadius: 18,
                padding: 16,
                display: 'flex',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: 'var(--ink)',
                  color: 'white',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {s.number}
              </div>
              <div>
                <h3 className="hd-3">{s.title}</h3>
                <p className="t-sm" style={{ marginTop: 4 }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '36px 16px 24px' }}>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 24,
            background: 'linear-gradient(135deg, var(--primary) 0%, #6c83ff 90%)',
            color: 'white',
            padding: '24px 20px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22 }}>Ready to hit the courts?</h2>
          <p style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>Beginners welcome — no commitment.</p>
          <button
            className="btn-primary"
            style={{ margin: '14px auto 0', width: 'auto', padding: '0 24px' }}
            onClick={onGetStarted}
          >
            Get started <Icon name="forward" size={16} />
          </button>
        </div>
      </section>

      <footer style={{ padding: '8px 20px 32px', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>
        <p style={{ fontWeight: 700, letterSpacing: 0.4 }}>FIND GAMES · MEET PLAYERS · PLAY PICKLEBALL</p>
      </footer>
    </div>
  );
}
