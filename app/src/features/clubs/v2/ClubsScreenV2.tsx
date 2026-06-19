import { useEffect, useMemo, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { listClubs, joinClub, type ApiClub } from '../../../shared/lib/api';
import { getInitials } from '../../../shared/lib/initials';

type Filter = 'all' | 'mine';

export function ClubsScreenV2(chrome: V2ScreenChrome) {
  const { onNavigate, requireAuth, isLoggedIn } = chrome;
  const [all, setAll] = useState<ApiClub[]>([]);
  const [mine, setMine] = useState<ApiClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [joined, setJoined] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    // loading starts true; re-runs only if the auth state flips.
    Promise.all([
      listClubs().catch(() => []),
      isLoggedIn ? listClubs({ mine: true }).catch(() => []) : Promise.resolve([]),
    ])
      .then(([a, m]) => { if (alive) { setAll(a); setMine(m); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isLoggedIn]);

  const match = (c: ApiClub) => {
    const q = query.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q);
  };
  const myClubs = useMemo(() => mine.filter(match), [mine, query]); // eslint-disable-line react-hooks/exhaustive-deps
  const discover = useMemo(
    () => all.filter((c) => !c.isMember && match(c)),
    [all, query], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const featured = discover[0] ?? null;
  const nearby = discover.slice(1, 7);

  const open = (c: ApiClub) => onNavigate('club-details', { id: c.slug || c.id });
  const doJoin = (c: ApiClub) => {
    if (!requireAuth('join this club')) return;
    setJoined((prev) => new Set(prev).add(c.id));
    joinClub(c.id).catch(() => setJoined((prev) => { const n = new Set(prev); n.delete(c.id); return n; }));
  };
  const joinLabel = (c: ApiClub) => (joined.has(c.id) ? (c.visibility === 'private' ? 'Requested' : 'Joined') : 'Join');

  const clubCard = (c: ApiClub) => (
    <div key={c.id} className="club-card" role="button" onClick={() => open(c)}>
      <div className="club-icon lime" aria-hidden="true">{getInitials(c.name)}</div>
      <div className="club-info">
        <div className="club-name">{c.name}</div>
        <div className="club-meta">
          <span className="tag">{c.visibility === 'private' ? 'Private' : 'Public'}</span>
          {c.postCount > 0 && <span className="event-badge">{c.postCount} posts</span>}
        </div>
        <div className="club-members">{c.memberCount} member{c.memberCount === 1 ? '' : 's'}</div>
      </div>
    </div>
  );

  return (
    <V2Shell screen="v2-clubs" chrome={chrome}>
      <div className="page-content">
        {/* Section heading + descriptive subheading (mirrors the Games section) */}
        <div className="clubs-intro">
          <h1 className="clubs-heading">Clubs</h1>
          <p className="clubs-subheading">Join a community, share posts, and meet players near you.</p>
        </div>

        {/* Search */}
        <div className="search-wrap">
          <div className="search-bar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input type="search" placeholder="Find a club…" aria-label="Search clubs" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        {/* Filter chips */}
        <div className="filter-row" role="group" aria-label="Filter clubs">
          <button className={`filter-chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`filter-chip${filter === 'mine' ? ' active' : ''}`} onClick={() => setFilter('mine')}>My Clubs</button>
        </div>

        {loading ? (
          <p className="club-members" style={{ padding: '20px 4px' }}>Loading clubs…</p>
        ) : (
          <>
            {/* MY CLUBS */}
            {(filter === 'mine' || myClubs.length > 0) && (
              <>
                <div className="section-header">
                  <h2 className="section-title">My Clubs</h2>
                </div>
                {myClubs.length > 0 ? (
                  myClubs.map(clubCard)
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">🏆</div>
                    <p>{isLoggedIn ? "You haven't joined any clubs yet." : 'Sign in to see your clubs.'}</p>
                  </div>
                )}
              </>
            )}

            {/* CREATE CLUB STRIP */}
            <div className="create-club-strip" role="button" onClick={() => onNavigate('create-club')}>
              <div className="create-icon-circle" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </div>
              <div className="create-text">
                <strong>Start a New Club</strong>
                <span>Build your own community of players</span>
              </div>
            </div>

            {/* DISCOVER */}
            {filter === 'all' && featured && (
              <>
                <div className="section-header" style={{ paddingTop: 4 }}>
                  <h2 className="section-title">Discover Nearby</h2>
                </div>
                <div className="featured-card" role="button" onClick={() => open(featured)}>
                  <div className="featured-img-placeholder" style={{ position: 'relative' }}>
                    <div className="featured-label" aria-label="Featured Club">⭐ Featured Club</div>
                  </div>
                  <div className="featured-content">
                    <div className="featured-tags">
                      <span className="featured-tag">{featured.visibility === 'private' ? 'Private' : 'Public'}</span>
                      {featured.visibility === 'public' && <span className="featured-tag open">Open Enrollment</span>}
                    </div>
                    <div className="featured-name">{featured.name}</div>
                    {featured.description && <div className="featured-desc">{featured.description}</div>}
                    <div className="featured-stats">
                      <div className="featured-stat">{featured.memberCount} members</div>
                      <div className="featured-stat">{featured.postCount} posts</div>
                    </div>
                    <button className="join-btn" onClick={(e) => { e.stopPropagation(); doJoin(featured); }}>{joinLabel(featured)}</button>
                  </div>
                </div>
              </>
            )}

            {filter === 'all' && nearby.length > 0 && (
              <>
                <div className="section-header">
                  <h2 className="section-title">More Nearby</h2>
                </div>
                <div className="nearby-scroll" aria-label="Nearby clubs">
                  {nearby.map((c) => (
                    <div key={c.id} className="nearby-card" role="button" onClick={() => open(c)}>
                      <div className="nearby-icon" style={{ background: '#E1E8FF' }}>{getInitials(c.name)}</div>
                      <div className="nearby-card-name">{c.name}</div>
                      <div className="nearby-card-meta">{c.memberCount} members</div>
                      <button className="join-sm-btn" onClick={(e) => { e.stopPropagation(); doJoin(c); }}>{joinLabel(c)}</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {filter === 'all' && !featured && myClubs.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <p>No clubs found{query ? ` for “${query}”` : ''}.</p>
              </div>
            )}
          </>
        )}

        <div style={{ height: 20 }} />
      </div>
    </V2Shell>
  );
}
