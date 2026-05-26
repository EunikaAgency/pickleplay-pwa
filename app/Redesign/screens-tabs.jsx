// PickleBallers — main tab screens
// HomeScreen, GamesScreen, MapScreen, ClubsScreen, ProfileScreen

const TONIGHT = [
  { id: 'g1', title: 'Friday Night Dinks', time: '6:30 PM', court: 'Riverside · 1.2 mi', tag: '3.0–3.5', img: 'linear-gradient(135deg, #0040e0 0%, #6c83ff 100%)', tagBg: 'rgba(255,255,255,0.92)', tagColor: '#0040e0' },
  { id: 'g2', title: 'Beginner Open Play', time: '7:00 PM', court: 'Central Hub · 0.8 mi', tag: 'Beginner', img: 'linear-gradient(135deg, #c1f100 0%, #a5d100 100%)', tagBg: '#001356', tagColor: '#fff' },
  { id: 'g3', title: 'Round Robin Mixer', time: '8:00 PM', court: 'Sky Courts · 2.4 mi', tag: 'Social', img: 'linear-gradient(135deg, #cf3000 0%, #ff7355 100%)', tagBg: 'rgba(255,255,255,0.92)', tagColor: '#cf3000' },
  { id: 'g4', title: 'Competitive 4.0+', time: '9:00 PM', court: 'The Kitchen · 3.5 mi', tag: '4.0+', img: 'linear-gradient(135deg, #1a1d24 0%, #404756 100%)', tagBg: '#c1f100', tagColor: '#001356' },
];

const CALENDAR = (() => {
  const today = new Date();
  const wdays = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i);
    return {
      wd: i === 0 ? 'TODAY' : wdays[d.getDay()],
      dn: d.getDate(),
      has: [0, 1, 3, 6, 8, 10].includes(i),
      key: i,
    };
  });
})();

// ═══════════════ HOME (Today) ═══════════════
function HomeScreen({ onOpenGame, onOpenNotifs, onTab }) {
  return (
    <div className="scroll safe-top safe-bottom">
      {/* Header */}
      <div className="app-header">
        <div>
          <div className="greet-name">Hey Riley 👋</div>
          <div className="greet-sub">12 open games near you tonight</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={onOpenNotifs}
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'var(--surface)', color: 'var(--ink-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-card)', border: '0.5px solid var(--hairline)',
              position: 'relative',
            }}
          >
            <Icon name="bell" size={18} />
            <span style={{
              position: 'absolute', top: 6, right: 6,
              width: 8, height: 8, borderRadius: 4,
              background: 'var(--coral)', border: '2px solid var(--surface)'
            }}/>
          </button>
          <div style={{ position: 'relative' }}>
            <Avatar name="Riley Pickler" size={40} />
          </div>
        </div>
      </div>

      {/* Now-card (your next game) */}
      <div className="section" style={{ marginTop: 16, padding: 0 }}>
        <button
          className="now-card"
          onClick={() => onOpenGame('g1')}
          style={{ width: 'calc(100% - 32px)', cursor: 'pointer', textAlign: 'left' }}
        >
          <div className="deco" />
          <div style={{ position: 'absolute', right: -10, bottom: -20, transform: 'rotate(-8deg)', opacity: 0.95, pointerEvents: 'none' }}>
            <CourtIllustration width={170} />
          </div>
          <div className="top-row" style={{ position: 'relative', zIndex: 2 }}>
            <span className="pill">NEXT GAME · IN 4H</span>
            <span className="live-dot" />
          </div>
          <div style={{ position: 'relative', zIndex: 2, maxWidth: '70%' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
              Saturday<br/>Morning Mix-In
            </div>
            <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="clock" size={14} /> 9:00 AM
              <span style={{ opacity: 0.5 }}>·</span>
              <Icon name="location" size={14} /> Riverside
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex' }}>
                {['Coach Mike','Sarah K','Alex T'].map((n, i) => (
                  <div key={n} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                    <Avatar name={n} variant={['','lime','coral'][i]} size={28} style={{ border: '2px solid white' }}/>
                  </div>
                ))}
                <div style={{
                  marginLeft: -10,
                  width: 28, height: 28, borderRadius: 14,
                  background: 'rgba(255,255,255,0.25)',
                  border: '2px solid white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: 'white',
                }}>+5</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9 }}>8/12 · 4 spots open</div>
            </div>
          </div>
        </button>
      </div>

      {/* Activity ticker */}
      <div className="activity" style={{ marginTop: 14 }}>
        <span className="live" />
        <div className="text"><strong>5 players</strong> just checked in at <strong>Riverside Courts</strong></div>
        <Icon name="chevron" size={16} style={{ color: 'var(--lime-ink)', opacity: 0.6 }} />
      </div>

      {/* Calendar strip */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="t-eyebrow">Your week</div>
            <div className="h-2" style={{ marginTop: 4 }}>Plan your play</div>
          </div>
          <button className="more" onClick={() => onTab('games')}>See schedule →</button>
        </div>
        <div className="cal-strip">
          {CALENDAR.map((d, i) => (
            <button key={d.key} className={`day ${i === 0 ? 'active' : ''} ${d.has ? 'has' : ''}`}>
              <span className="wd">{d.wd}</span>
              <span className="dn">{d.dn}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tonight rail */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="t-eyebrow">Tonight</div>
            <div className="h-2" style={{ marginTop: 4 }}>Hot near you</div>
          </div>
          <button className="more" onClick={() => onTab('games')}>All</button>
        </div>
        <div className="rail">
          {TONIGHT.map(g => (
            <button key={g.id} className="tonight-card" onClick={() => onOpenGame(g.id)}>
              <div className="img" style={{ background: g.img }}>
                <div className="overlay" />
                <span className="badge" style={{ background: g.tagBg, color: g.tagColor }}>{g.tag}</span>
                <span className="time">{g.time}</span>
              </div>
              <div className="body">
                <div className="title">{g.title}</div>
                <div className="meta"><Icon name="location" size={11} />{g.court}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* From your clubs */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="t-eyebrow">From your clubs</div>
            <div className="h-2" style={{ marginTop: 4 }}>Don't miss out</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GameRow
            day="SAT" num="14" thumb="lime"
            title="Neon Smashers · Weekly Doubles"
            time="6:30 PM" loc="Central Hub · 0.8 mi"
            onTap={() => onOpenGame('g5')}
          />
          <GameRow
            day="SUN" num="15" thumb="blue"
            title="Downtown Volleys · Social Mixer"
            time="4:00 PM" loc="Sky Courts · 2.4 mi"
            onTap={() => onOpenGame('g6')}
          />
        </div>
      </div>

      {/* Stats card */}
      <div className="section">
        <div style={{
          margin: 0,
          background: 'var(--ink)',
          color: 'white',
          borderRadius: 22,
          padding: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.1 }}>
            <Icon name="trophy" size={140} />
          </div>
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: 'var(--lime)', color: 'var(--lime-ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name="fire" size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6 }}>This week</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 19, marginTop: 2 }}>You're on a 4-game streak 🔥</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Win rate up 8% vs last week</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable: game row card (compact)
function GameRow({ day, num, thumb = 'lime', title, time, loc, joined = false, onTap, onRsvp }) {
  const [j, setJ] = useState(joined);
  const handleRsvp = (e) => {
    e.stopPropagation();
    setJ(!j);
    if (onRsvp) onRsvp(!j);
  };
  return (
    <div className="game-row" onClick={onTap} role="button" tabIndex={0} style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}>
      <div className={`thumb ${thumb}`}>
        <span className="day">{day}</span>
        <span className="num">{num}</span>
      </div>
      <div className="body">
        <div className="title">{title}</div>
        <div className="meta">
          <span className="m"><Icon name="clock" size={11} />{time}</span>
          <span className="m"><Icon name="location" size={11} />{loc}</span>
        </div>
      </div>
      <button className={`rsvp ${j ? 'joined' : ''}`} onClick={handleRsvp} aria-label="Join">
        <Icon name={j ? 'check' : 'plus'} size={18} />
      </button>
    </div>
  );
}

// ═══════════════ GAMES ═══════════════
function GamesScreen({ onOpenGame, onOpenFilters }) {
  const [view, setView] = useState('browse');
  const [activeDay, setActiveDay] = useState(0);
  const [activeChips, setActiveChips] = useState(new Set(['Tonight']));

  const toggleChip = (c) => {
    const next = new Set(activeChips);
    next.has(c) ? next.delete(c) : next.add(c);
    setActiveChips(next);
  };

  const games = view === 'mine'
    ? [
        { day: 'SAT', num: '14', thumb: 'lime',  title: 'Saturday Morning Mix-In',  time: '9:00 AM',  loc: 'Riverside · 1.2 mi', joined: true },
        { day: 'TUE', num: '17', thumb: 'blue',  title: 'Weekly Doubles League',    time: '6:30 PM',  loc: 'Central Hub · 0.8 mi', joined: true },
      ]
    : [
        { day: 'TODAY', num: '26', thumb: 'lime',  title: 'Rookie Rally Round',    time: '5:30 PM', loc: 'Central Hub · 1.2 mi' },
        { day: 'TODAY', num: '26', thumb: 'coral', title: 'Friday Night Dinks',    time: '6:30 PM', loc: 'Riverside · 1.2 mi' },
        { day: 'TODAY', num: '26', thumb: 'blue',  title: 'Beginner Open Play',    time: '7:00 PM', loc: 'Central Hub · 0.8 mi' },
        { day: 'TOM',   num: '27', thumb: 'lime',  title: 'Saturday Morning Mix',  time: '9:00 AM', loc: 'Riverside · 1.2 mi' },
        { day: 'SAT',   num: '28', thumb: 'coral', title: 'Competitive Singles',   time: '10:00 AM', loc: 'The Kitchen · 3.5 mi' },
        { day: 'SUN',   num: '29', thumb: 'blue',  title: 'Social Mixer & Drinks', time: '4:00 PM', loc: 'Sky Courts · 0.8 mi' },
      ];

  return (
    <div className="scroll safe-top safe-bottom">
      {/* Header */}
      <div className="app-header">
        <div>
          <div className="greet-name">Games</div>
          <div className="greet-sub">{games.length} games {view === 'mine' ? 'you joined' : 'this week'}</div>
        </div>
        <button
          onClick={onOpenFilters}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--surface)', color: 'var(--ink-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-card)', border: '0.5px solid var(--hairline)',
            position: 'relative',
          }}
        >
          <Icon name="sliders" size={18} />
          <span style={{
            position: 'absolute', top: 4, right: 4,
            background: 'var(--coral)', color: 'white',
            fontSize: 9, fontWeight: 800,
            minWidth: 14, height: 14,
            borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px',
            border: '2px solid var(--surface)',
          }}>2</span>
        </button>
      </div>

      {/* Search */}
      <div className="searchbar">
        <Icon name="search" size={16} />
        <input placeholder="Search games, courts, players…" />
        <button style={{ color: 'var(--primary)' }}><Icon name="mic" size={16} /></button>
      </div>

      {/* Segmented */}
      <div style={{ padding: '14px 16px 0' }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'browse', label: 'Browse' },
            { value: 'mine',   label: 'My Games' },
          ]}
        />
      </div>

      {/* Calendar strip */}
      <div className="section" style={{ marginTop: 16 }}>
        <div className="cal-strip">
          {CALENDAR.slice(0, 10).map((d, i) => (
            <button
              key={d.key}
              className={`day ${activeDay === i ? 'active' : ''} ${d.has ? 'has' : ''}`}
              onClick={() => setActiveDay(i)}
            >
              <span className="wd">{d.wd}</span>
              <span className="dn">{d.dn}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick chips */}
      <div className="section" style={{ marginTop: 14 }}>
        <div className="scroll-x" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 0 4px', margin: '0', scrollbarWidth: 'none' }}>
          {['Tonight','Beginner','3.0–3.5','Within 5 mi','Doubles'].map(c => (
            <button
              key={c}
              className={`chip ${activeChips.has(c) ? 'lime' : ''}`}
              onClick={() => toggleChip(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="section" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {games.map((g, i) => (
            <GameRow key={i} {...g} onTap={() => onOpenGame('g' + i)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ MAP (Courts) ═══════════════
function MapScreen({ onOpenCourt }) {
  const [active, setActive] = useState(2);
  const courts = [
    { name: 'Riverside Courts',    rating: 4.5, dist: '1.2 mi',  pos: { left: '22%', top: '38%' }, label: '4 open', tags: ['Lighted','Free'],     access: 'Public' },
    { name: 'Austin Smash Center', rating: 4.9, dist: '0.8 mi',  pos: { left: '42%', top: '52%' }, label: '$25/hr', tags: ['Indoor','Pro Shop'], access: 'Indoor' },
    { name: 'Central Hub',         rating: 4.3, dist: '0.5 mi',  pos: { left: '55%', top: '40%' }, label: 'Open',   tags: ['Indoor'],            access: 'Member' },
    { name: 'Zilker Park Courts',  rating: 4.7, dist: '2.4 mi',  pos: { left: '32%', top: '70%' }, label: 'Free',   tags: ['Lighted','Free'],    access: 'Public' },
    { name: 'The Pickle Lodge',    rating: 5.0, dist: '4.1 mi',  pos: { left: '70%', top: '62%' }, label: 'Club',   tags: ['Lounge'],            access: 'Club'   },
  ];

  return (
    <div className="map-screen">
      <div className="map-canvas">
        {/* Faux roads + features */}
        <div className="road" style={{ left: 0, top: '30%', width: '100%', height: 6 }} />
        <div className="road" style={{ left: 0, top: '60%', width: '100%', height: 4 }} />
        <div className="road" style={{ left: 0, top: '85%', width: '100%', height: 5 }} />
        <div className="road" style={{ left: '30%', top: 0, width: 4, height: '100%' }} />
        <div className="road" style={{ left: '65%', top: 0, width: 5, height: '100%' }} />
        <div className="park" style={{ left: '8%',  top: '50%', width: 100, height: 80 }} />
        <div className="park" style={{ left: '70%', top: '20%', width: 90,  height: 70 }} />
        <div className="water" style={{ left: '-10%', top: '20%', width: 160, height: 90 }} />
        <div className="water" style={{ left: '60%', top: '78%', width: 200, height: 80 }} />

        {/* Pins */}
        {courts.map((c, i) => (
          <button
            key={c.name}
            className={`map-pin ${i === active ? 'active' : ''}`}
            style={{ left: c.pos.left, top: c.pos.top }}
            onClick={() => setActive(i)}
          >
            <span className="pinwrap">
              <Icon name="paddle" size={12} />
              {c.label}
            </span>
          </button>
        ))}

        {/* You-are-here */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 18, height: 18,
          borderRadius: 50, background: '#3b82f6',
          border: '3px solid white',
          boxShadow: '0 0 0 4px rgba(59,130,246,0.25), 0 2px 8px rgba(0,0,0,0.2)',
        }} />
      </div>

      {/* Search */}
      <div className="map-search">
        <Icon name="search" size={16} />
        <span className="text">Find courts near you</span>
        <Avatar name="Riley Pickler" size={32} />
      </div>

      {/* Chip row */}
      <div className="map-chip-row">
        <button className="chip lime"><Icon name="paddle" size={12} /> Courts</button>
        <button className="chip">Games here</button>
        <button className="chip">Indoor</button>
        <button className="chip">Free</button>
        <button className="chip">Lighted</button>
      </div>

      {/* Locate */}
      <button className="locate-btn"><Icon name="navigate" size={18} /></button>

      {/* Bottom sheet */}
      <div className="map-sheet">
        <div className="handle" />
        <div className="head">
          <div>
            <div className="t-eyebrow">Nearby · {courts.length} courts</div>
            <div className="h-2" style={{ marginTop: 2 }}>Within 5 mi</div>
          </div>
          <button className="chip" style={{ background: 'var(--surface-2)' }}>
            <Icon name="sliders" size={12} /> Filter
          </button>
        </div>
        <div className="list">
          {courts.map((c, i) => (
            <button
              key={c.name}
              className="court-row"
              style={{
                background: i === active ? 'var(--lime-soft)' : 'var(--surface-2)',
                border: i === active ? '0.5px solid rgba(193,241,0,0.5)' : '0.5px solid transparent',
              }}
              onClick={() => { setActive(i); onOpenCourt && onOpenCourt(c.name); }}
            >
              <div className="img" style={{
                background: `linear-gradient(135deg, ${['#c1f100,#a5d100','#0040e0,#6c83ff','#cf3000,#ff7355','#abd600,#5b7400','#404756,#1a1d24'][i % 5].split(',').join(', ')})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
              }}>
                <Icon name="paddle" size={24} />
              </div>
              <div className="body">
                <div className="title">{c.name}</div>
                <div className="row1">
                  <Icon name="star" size={11} style={{ color: '#c89000' }} /> {c.rating}
                  <span style={{ opacity: 0.5 }}>·</span>
                  {c.dist}
                  <span style={{ opacity: 0.5 }}>·</span>
                  {c.access}
                </div>
                <div className="tags">
                  {c.tags.map(t => <span key={t} className="t">{t}</span>)}
                </div>
              </div>
              <div style={{
                width: 36, height: 36,
                borderRadius: 12,
                background: 'var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary)',
              }}>
                <Icon name="directions" size={14} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ CLUBS ═══════════════
function ClubsScreen({ onOpenClub }) {
  const my = [
    { name: 'Neon Smashers',    icon: 'bolt',    bg: 'lime',  meta: '24 members · 3 events this week' },
    { name: 'Downtown Volleys', icon: 'groups',  bg: 'blue',  meta: '42 members · social club' },
  ];
  const discover = [
    { name: 'Paddle Pirates',   rating: 4.9, dist: '1.2 mi', tags: ['Morning Play','Beginner'], img: 'linear-gradient(135deg, #cf3000, #ff7355)' },
    { name: 'The Dink Den',     rating: 4.7, dist: '0.5 mi', tags: ['Indoor','All Levels'],    img: 'linear-gradient(135deg, #c1f100, #abd600)' },
    { name: 'Ace Alliance',     rating: 5.0, dist: '2.4 mi', tags: ['Night Play'],             img: 'linear-gradient(135deg, #1a1d24, #404756)' },
  ];

  return (
    <div className="scroll safe-top safe-bottom">
      {/* Header */}
      <div className="app-header">
        <div>
          <div className="greet-name">Clubs</div>
          <div className="greet-sub">Find your people</div>
        </div>
        <button
          style={{
            height: 40, padding: '0 14px', borderRadius: 12,
            background: 'var(--ink)', color: 'white',
            fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Icon name="plus" size={14} /> New
        </button>
      </div>

      {/* Search */}
      <div className="searchbar">
        <Icon name="search" size={16} />
        <input placeholder="Search clubs by name or tag…" />
      </div>

      {/* My clubs */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="t-eyebrow">My clubs</div>
            <div className="h-2" style={{ marginTop: 4 }}>You're a member of 2</div>
          </div>
          <button className="more">All</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {my.map(c => (
            <button key={c.name} className="club-card" onClick={() => onOpenClub(c.name)} style={{ width: '100%', textAlign: 'left' }}>
              <div className={`icon-circle ${c.bg}`}>
                <Icon name={c.icon} size={22} />
              </div>
              <div className="body">
                <div className="name">{c.name}</div>
                <div className="meta"><Icon name="groups" size={12} />{c.meta}</div>
              </div>
              <Icon name="chevron" size={18} style={{ color: 'var(--surface-3)' }} />
            </button>
          ))}
        </div>
      </div>

      {/* Featured club */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="t-eyebrow">Featured</div>
            <div className="h-2" style={{ marginTop: 4 }}>Largest community in town</div>
          </div>
        </div>
        <button className="featured-club" onClick={() => onOpenClub('The Kitchen Kings')} style={{ width: 'calc(100% - 32px)', cursor: 'pointer', textAlign: 'left', border: 'none' }}>
          <div className="glyph">K</div>
          <div className="group-img"><PeopleIllustration width={150} opacity={0.55}/></div>
          <span className="eyebrow">FEATURED · 312 MEMBERS</span>
          <h3>The Kitchen Kings</h3>
          <p>Competitive & casual play, 12 courts, pro coaches and weekly mixers.</p>
          <div className="stats">
            <div className="s"><div className="n">12</div><div className="l">Courts</div></div>
            <div className="s"><div className="n">8</div><div className="l">Events/wk</div></div>
            <div className="s"><div className="n">4.9</div><div className="l">Rating</div></div>
          </div>
        </button>
      </div>

      {/* Discover */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="t-eyebrow">Discover</div>
            <div className="h-2" style={{ marginTop: 4 }}>Clubs near Austin</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {discover.map(c => (
            <button key={c.name} className="game-row" onClick={() => onOpenClub(c.name)} style={{ width: '100%', textAlign: 'left' }}>
              <div className="thumb" style={{ background: c.img, color: 'white' }}>
                <Icon name="groups" size={28} />
              </div>
              <div className="body">
                <div className="title">{c.name}</div>
                <div className="meta">
                  <span className="m"><Icon name="star" size={11} style={{ color: '#c89000' }} />{c.rating}</span>
                  <span className="m"><Icon name="location" size={11} />{c.dist}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {c.tags.map(t => (
                    <span key={t} style={{
                      fontSize: 10, fontWeight: 700,
                      padding: '2px 6px', borderRadius: 6,
                      background: 'var(--surface-2)', color: 'var(--ink-2)',
                    }}>{t}</span>
                  ))}
                </div>
              </div>
              <div className="rsvp" style={{ background: 'var(--primary-tint)', color: 'var(--primary)', boxShadow: 'none' }}>
                <Icon name="plus" size={16} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ PROFILE ═══════════════
function ProfileScreen({ onOpenSettings }) {
  // Win rate ring
  const pct = 66;
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div className="scroll safe-top safe-bottom">
      {/* Header (settings icon) */}
      <div className="app-header">
        <div className="greet-name">Profile</div>
        <button
          onClick={onOpenSettings}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--surface)', color: 'var(--ink-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-card)', border: '0.5px solid var(--hairline)',
          }}
        >
          <Icon name="settings" size={18} />
        </button>
      </div>

      <div className="profile-hero">
        <div className="avatar-xl">
          <div>RP</div>
          <span className="dupr-pill" style={{ position: 'absolute', bottom: -2, right: -2 }}>
            <Icon name="bolt" size={11} /> 3.5 DUPR
          </span>
        </div>
        <h2>Riley Pickler</h2>
        <div className="tier">SOLID PLAYER · 3.0–3.5 RANGE</div>
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>"The dink master 🥒"</div>
      </div>

      {/* Win-rate ring + stats */}
      <div className="ring-card">
        <div className="ring">
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8"/>
            <circle cx="48" cy="48" r={r} fill="none" stroke="var(--lime)" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
            />
          </svg>
          <div className="center">
            <div className="pct">{pct}%</div>
            <div className="lbl">Win rate</div>
          </div>
        </div>
        <div className="stats">
          <div className="row"><span className="l">Games played</span><span className="v">124</span></div>
          <div className="row"><span className="l">Wins</span><span className="v" style={{ color: '#5b7400' }}>82</span></div>
          <div className="row"><span className="l">Losses</span><span className="v" style={{ color: 'var(--coral)' }}>42</span></div>
          <div className="row"><span className="l">Current streak</span><span className="v">4 wins 🔥</span></div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="qa-row">
        {[
          { ic: 'calendar', label: 'Games',     color: 'var(--primary)' },
          { ic: 'heart',    label: 'Saved',     color: 'var(--coral)' },
          { ic: 'shield',   label: 'Verify',    color: '#5b7400' },
          { ic: 'help',     label: 'Help',      color: 'var(--ink-2)' },
        ].map(q => (
          <button key={q.label} className="qa">
            <div className="ic" style={{ color: q.color, background: q.color === 'var(--ink-2)' ? 'var(--surface-2)' : `color-mix(in oklab, ${q.color} 12%, transparent)` }}>
              <Icon name={q.ic} size={18} />
            </div>
            <div className="label">{q.label}</div>
          </button>
        ))}
      </div>

      {/* Achievements rail */}
      <div className="section">
        <div className="section-head">
          <div className="h-2">Recent achievements</div>
          <button className="more">All</button>
        </div>
        <div className="rail">
          {[
            { ic: 'trophy', label: 'First win',     color: '#c89000', bg: 'rgba(200,144,0,0.15)' },
            { ic: 'fire',   label: '5-streak',      color: 'var(--coral)', bg: 'var(--coral-soft)' },
            { ic: 'star',   label: 'Top 5 club',    color: 'var(--primary)', bg: 'var(--primary-tint)' },
            { ic: 'paddle', label: '100 games',     color: 'var(--lime-ink)', bg: 'var(--lime-soft)' },
          ].map(a => (
            <div key={a.label} style={{
              width: 110, padding: '14px 10px',
              background: 'var(--surface)', borderRadius: 16,
              border: '0.5px solid var(--hairline)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: a.bg, color: a.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={a.ic} size={22} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', textAlign: 'center' }}>{a.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings list */}
      <div className="section">
        <div className="set-list">
          {[
            { ic: 'user',     name: 'Account',          desc: 'Profile, email, password',  color: 'var(--primary)' },
            { ic: 'shield',   name: 'Privacy',          desc: 'Visibility & permissions',  color: '#5b7400' },
            { ic: 'bell',     name: 'Notifications',    desc: 'Push, email, in-app',       color: 'var(--coral)' },
            { ic: 'help',     name: 'Help & Support',   desc: 'Rules, FAQ, contact us',    color: 'var(--ink-2)' },
            { ic: 'logout',   name: 'Sign out',         desc: '',                          color: 'var(--coral)' },
          ].map(s => (
            <button key={s.name} className="row" style={{ width: '100%', textAlign: 'left' }}>
              <div className="ic" style={{ background: s.color }}><Icon name={s.ic} size={16} /></div>
              <div className="body">
                <div className="name">{s.name}</div>
                {s.desc && <div className="desc">{s.desc}</div>}
              </div>
              <Icon name="chevron" size={16} className="chev" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HomeScreen, GamesScreen, MapScreen, ClubsScreen, ProfileScreen, GameRow });
