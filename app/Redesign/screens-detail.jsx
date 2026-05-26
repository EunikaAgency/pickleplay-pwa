// PickleBallers — detail / overlay screens
// GameDetailsScreen (slide-in fullscreen)
// CreateGameSheet, NotificationsSheet, FiltersSheet (slide-up sheets)

// ═══════════════ GAME DETAILS ═══════════════
function GameDetailsScreen({ open, onClose, onJoined }) {
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);

  const handleJoin = () => {
    if (joined || joining) return;
    setJoining(true);
    setTimeout(() => {
      setJoining(false);
      setJoined(true);
      onJoined && onJoined();
    }, 900);
  };

  // reset state when closed
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => { setJoined(false); setJoining(false); }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <div className={`detail-screen ${open ? 'open' : ''}`}>
      <div className="scroll" style={{ paddingBottom: 100 }}>
        {/* Hero */}
        <div className="detail-hero">
          <div className="img" style={{
            background: 'linear-gradient(135deg, #0040e0 0%, #6c83ff 60%, #a5b9ff 100%)',
          }}/>
          {/* Decorative court */}
          <div style={{ position: 'absolute', right: -30, top: 60, opacity: 0.85, transform: 'rotate(-12deg) scale(1.1)' }}>
            <CourtIllustration width={240} />
          </div>
          <div className="grad" />
          <div className="top-controls">
            <button className="icon-btn" onClick={onClose} aria-label="Back">
              <Icon name="back" size={18} />
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="icon-btn"><Icon name="share" size={16} /></button>
              <button className="icon-btn"><Icon name="heart_o" size={16} /></button>
            </div>
          </div>
          <div className="info">
            <div className="tag-row">
              <span className="tag lime">3.0–3.5</span>
              <span className="tag">Beginners welcome</span>
              <span className="tag">Doubles</span>
            </div>
            <h1>Saturday Morning Mix-In</h1>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, opacity: 0.95 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="clock" size={14}/> Sat · 9:00 AM</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="location" size={14}/> Riverside</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="detail-body">
          {/* Key facts */}
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

          {/* Organizer */}
          <div className="organizer">
            <Avatar name="Coach Mike" size={48} variant="lime" />
            <div className="meta">
              <div className="role">Hosted by</div>
              <div className="name">Coach Mike <span style={{ color: 'var(--primary)' }}>•</span> <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>Verified</span></div>
            </div>
            <div className="actions">
              <button className="icon-btn"><Icon name="message" size={16} /></button>
            </div>
          </div>

          {/* Location card */}
          <div className="location-card">
            <div className="map-preview">
              <div className="pin"><Icon name="location" size={16} /></div>
            </div>
            <div className="map-info">
              <div className="text">
                <div className="name">Riverside Courts</div>
                <div className="addr">1200 Willow St, Austin, TX · 1.2 mi</div>
              </div>
              <button className="directions"><Icon name="directions" size={18} /></button>
            </div>
          </div>

          {/* About */}
          <div className="about-card">
            <div className="t-eyebrow" style={{ marginBottom: 6 }}>About this game</div>
            <p>Ready to shake off the week? Our Saturday Mix-In is high energy and a great way to meet new partners. 4 courts reserved for 3 hours of non-stop pickleball.</p>
            <p>We rotate every 15 minutes so you get to play with a variety of styles. Good music, plenty of water breaks, very supportive crew.</p>
          </div>

          {/* Players */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div className="t-eyebrow">Players</div>
                <div className="h-3" style={{ marginTop: 4 }}>8 going · 4 spots open</div>
              </div>
              <button className="more" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>Invite</button>
            </div>
            <div className="players-grid">
              {[
                { name: 'Coach Mike', i: 'CM', v: 'lime' },
                { name: 'Sarah K',    i: 'SK', v: '' },
                { name: 'Alex T',     i: 'AT', v: 'coral' },
                { name: 'Jordan M',   i: 'JM', v: '' },
                { name: 'Taylor R',   i: 'TR', v: 'lime' },
                { name: 'Casey L',    i: 'CL', v: '' },
                { name: 'Morgan P',   i: 'MP', v: 'coral' },
                { name: 'Riley',      i: 'YOU', v: 'lime', you: true },
              ].map(p => (
                <div key={p.name} className="player">
                  <Avatar name={p.name} size={56} variant={p.v || 'blue'} />
                  <div className="name">{p.you ? 'You' : p.name.split(' ')[0]}</div>
                </div>
              ))}
              {[1, 2, 3, 4].map(i => (
                <div key={'e' + i} className="player empty">
                  <Avatar name="" size={56} />
                  <div className="name" style={{ color: 'var(--muted)' }}>Open</div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
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
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
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
              <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20" strokeLinecap="round"/>
              </svg>
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
    </div>
  );
}

// ═══════════════ CREATE GAME SHEET ═══════════════
function CreateGameSheet({ open, onClose, onCreate }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    type: 'doubles',
    skill: '3.0',
    when: 'tonight',
    time: '6:30 PM',
    court: 'Riverside Courts',
    spots: 4,
  });

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setStep(0), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  const totalSteps = 3;
  const next = () => step < totalSteps - 1 ? setStep(s => s + 1) : finish();
  const back = () => step > 0 ? setStep(s => s - 1) : onClose();
  const finish = () => { onCreate && onCreate(data); onClose(); };

  const titleByStep = ['What kind of game?', 'When are you playing?', 'Where & who?'];

  return (
    <React.Fragment>
      <div className={`sheet-backdrop ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`sheet ${open ? 'open' : ''}`} style={{ height: '82%' }}>
        <div className="sheet-handle" />

        {/* Header */}
        <div style={{ padding: '4px 20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={back}
            style={{
              width: 32, height: 32, borderRadius: 50, background: 'var(--surface-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name={step === 0 ? 'close' : 'back'} size={16} />
          </button>
          <div style={{ flex: 1 }}>
            <div className="t-eyebrow">Step {step + 1} of {totalSteps}</div>
            <div className="h-2" style={{ marginTop: 2 }}>{titleByStep[step]}</div>
          </div>
        </div>

        {/* Progress */}
        <div style={{ padding: '0 20px 12px' }}>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${((step + 1) / totalSteps) * 100}%`,
              background: 'var(--lime)',
              transition: 'width .3s ease',
              borderRadius: 2,
            }}/>
          </div>
        </div>

        <div className="sheet-body">
          {step === 0 && (
            <div>
              <div className="field">
                <div className="lbl">Game type</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { v: 'singles', label: 'Singles', sub: '1 vs 1' },
                    { v: 'doubles', label: 'Doubles', sub: '2 vs 2' },
                    { v: 'open',    label: 'Open',    sub: 'Mix-in' },
                  ].map(o => (
                    <button
                      key={o.v}
                      className={`time-pick ${data.type === o.v ? 'active' : ''}`}
                      onClick={() => setData(d => ({ ...d, type: o.v }))}
                      style={{ flexDirection: 'column', padding: 14, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <div>{o.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>{o.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <div className="lbl">Skill level (DUPR)</div>
                <div className="time-grid">
                  {['Beginner','2.5–3.0','3.0–3.5','3.5–4.0','4.0+','Open'].map(s => (
                    <button
                      key={s}
                      className={`time-pick ${data.skill === s ? 'active' : ''}`}
                      onClick={() => setData(d => ({ ...d, skill: s }))}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <div className="lbl">Game name (optional)</div>
                <input className="control" placeholder="e.g. Friday Night Dinks" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="field">
                <div className="lbl">When</div>
                <div className="time-grid">
                  {[
                    'Tonight','Tomorrow','This weekend',
                    'Next week','Custom','Recurring',
                  ].map(s => (
                    <button
                      key={s}
                      className={`time-pick ${data.when === s.toLowerCase().replace(' ','') ? 'active' : ''}`}
                      onClick={() => setData(d => ({ ...d, when: s.toLowerCase().replace(' ','') }))}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <div className="lbl">Start time</div>
                <div className="time-grid">
                  {['5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM','7:30 PM'].map(t => (
                    <button
                      key={t}
                      className={`time-pick ${data.time === t ? 'active' : ''}`}
                      onClick={() => setData(d => ({ ...d, time: t }))}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <div className="lbl">Duration</div>
                <div style={{ padding: '0 0' }}>
                  <div className="time-grid">
                    {['1 hr','1.5 hr','2 hr','3 hr'].map(d => (
                      <button key={d} className={`time-pick ${d === '2 hr' ? 'active' : ''}`}>{d}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="field">
                <div className="lbl">Court</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { name: 'Riverside Courts', meta: '1.2 mi · Public' },
                    { name: 'Central Hub',      meta: '0.8 mi · Indoor' },
                    { name: 'The Pickle Lodge', meta: '4.1 mi · Club' },
                  ].map(c => (
                    <button
                      key={c.name}
                      className="time-pick"
                      onClick={() => setData(d => ({ ...d, court: c.name }))}
                      style={{
                        textAlign: 'left',
                        background: data.court === c.name ? 'var(--ink)' : 'var(--surface)',
                        color: data.court === c.name ? 'white' : 'var(--ink)',
                        padding: '14px 16px',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}
                    >
                      <Icon name="location" size={18} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                        <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>{c.meta}</div>
                      </div>
                      {data.court === c.name && <Icon name="check" size={16} />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <div className="lbl">Spots available · {data.spots}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => setData(d => ({ ...d, spots: Math.max(2, d.spots - 1) }))}
                    style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface)', border: '0.5px solid var(--hairline)' }}
                  >
                    <Icon name="close" size={14} />
                  </button>
                  <div style={{
                    flex: 1, textAlign: 'center',
                    fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 28,
                  }}>{data.spots}</div>
                  <button
                    onClick={() => setData(d => ({ ...d, spots: Math.min(16, d.spots + 1) }))}
                    style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--ink)', color: 'white' }}
                  >
                    <Icon name="plus" size={14} />
                  </button>
                </div>
              </div>

              <div className="field">
                <div className="lbl">Visibility</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button className="time-pick active">🌍 Public</button>
                  <button className="time-pick">🔒 Invite only</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px 20px',
          borderTop: '0.5px solid var(--hairline)',
          background: 'var(--bg)',
          flexShrink: 0,
        }}>
          <button
            onClick={next}
            style={{
              width: '100%', height: 52,
              background: 'var(--lime)', color: 'var(--lime-ink)',
              borderRadius: 16,
              fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 8px 22px -6px rgba(193,241,0,0.5)',
            }}
          >
            {step === totalSteps - 1 ? <><Icon name="bolt" size={18} /> Post game</> : <>Continue <Icon name="forward" size={16} /></>}
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

// ═══════════════ NOTIFICATIONS SHEET ═══════════════
function NotificationsSheet({ open, onClose }) {
  const items = [
    { icon: 'check',    bg: 'lime',  unread: true,  text: <><strong>Sarah K</strong> joined your <strong>Saturday Mix-In</strong></>,   time: '2m ago' },
    { icon: 'message',  bg: 'blue',  unread: true,  text: <><strong>Coach Mike</strong> sent a message in <strong>Game chat</strong></>, time: '12m ago' },
    { icon: 'paddle',   bg: 'lime',  unread: true,  text: <>New game at <strong>Riverside</strong> matches your skill</>,                time: '34m ago' },
    { icon: 'fire',     bg: 'coral', unread: false, text: <>You're on a <strong>4-game win streak!</strong></>,                          time: '2h ago' },
    { icon: 'star',     bg: 'blue',  unread: false, text: <><strong>Alex T</strong> rated your game 5 stars</>,                          time: 'Yesterday' },
    { icon: 'groups',   bg: 'lime',  unread: false, text: <><strong>Neon Smashers</strong> posted a new weekly event</>,                 time: '2 days ago' },
  ];

  return (
    <React.Fragment>
      <div className={`sheet-backdrop ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`sheet ${open ? 'open' : ''}`} style={{ height: '88%' }}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div>
            <h2>Notifications</h2>
            <div className="t-sm">3 unread</div>
          </div>
          <button className="close" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <div className="scroll-x" style={{ padding: '12px 20px 8px', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {['All','Mentions','Games','Clubs'].map((c, i) => (
            <button key={c} className={`chip ${i === 0 ? 'active' : ''}`}>{c}</button>
          ))}
        </div>

        <div className="sheet-body" style={{ padding: 0 }}>
          {items.map((n, i) => (
            <div key={i} className={`notif ${n.unread ? 'unread' : ''}`}>
              <div className={`ic ${n.bg}`}><Icon name={n.icon} size={18} /></div>
              <div className="body">
                <div className="head">{n.text}</div>
                <div className="time">{n.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}

// ═══════════════ FILTERS SHEET ═══════════════
function FiltersSheet({ open, onClose }) {
  const [skill, setSkill] = useState('3.0–3.5');
  const [distance, setDistance] = useState(5);
  const [when, setWhen] = useState('any');

  return (
    <React.Fragment>
      <div className={`sheet-backdrop ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`sheet ${open ? 'open' : ''}`} style={{ height: '74%' }}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div>
            <h2>Filter games</h2>
            <div className="t-sm">Find your perfect match</div>
          </div>
          <button className="close" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div className="sheet-body">
          <div className="field">
            <div className="lbl">When</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['any','tonight','tomorrow','weekend','next-week'].map(o => (
                <button key={o} className={`chip ${when === o ? 'active' : ''}`} onClick={() => setWhen(o)}>
                  {o[0].toUpperCase() + o.slice(1).replace('-',' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="lbl">Your skill level</div>
            <div className="time-grid">
              {['Any','Beginner','2.5–3.0','3.0–3.5','3.5–4.0','4.0+'].map(s => (
                <button
                  key={s}
                  className={`time-pick ${skill === s ? 'active' : ''}`}
                  onClick={() => setSkill(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="lbl">Max distance · {distance} mi</div>
            <input
              type="range" min="1" max="25" value={distance}
              onChange={e => setDistance(+e.target.value)}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>
              <span>1 mi</span><span>25 mi</span>
            </div>
          </div>

          <div className="field">
            <div className="lbl">Game type</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Doubles','Singles','Open Play'].map(t => (
                <button key={t} className={t === 'Doubles' ? 'chip active' : 'chip'}>{t}</button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="lbl">Features</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Beginner friendly','Indoor','Has openings','Verified host','Free'].map(t => (
                <button key={t} className="chip">{t}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px 20px',
          borderTop: '0.5px solid var(--hairline)',
          background: 'var(--bg)',
          display: 'flex', gap: 10,
          flexShrink: 0,
        }}>
          <button
            style={{
              flex: 1, height: 50,
              background: 'var(--surface)',
              border: '0.5px solid var(--hairline)',
              borderRadius: 14,
              fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15,
              color: 'var(--ink-2)',
            }}
          >
            Reset
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 2, height: 50,
              background: 'var(--ink)', color: 'white',
              borderRadius: 14,
              fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            Show 24 games
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { GameDetailsScreen, CreateGameSheet, NotificationsSheet, FiltersSheet });
