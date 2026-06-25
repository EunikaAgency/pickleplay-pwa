import { useEffect, useState } from 'react';
import { V2Shell, type V2ScreenChrome } from '../../../shared/components/layout/V2Chrome';
import { V2Skeleton } from '../../../shared/components/ui/V2Skeleton';
import { listClubs, joinClub, type ApiClub } from '../../../shared/lib/api';
import { getInitials } from '../../../shared/lib/initials';

type Filter = 'all' | 'mine';

export function ClubsScreenV2(chrome: V2ScreenChrome) {
  const { onNavigate, requireAuth, isLoggedIn } = chrome;
  const [all, setAll] = useState<ApiClub[]>([]);
  const [mine, setMine] = useState<ApiClub[]>([]);
  const [allCursor, setAllCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [joined, setJoined] = useState<Set<string>>(new Set());

  // Debounce the search box so each keystroke doesn't fire a request.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch the directory + my clubs, searched server-side (so matches aren't
  // capped to the first page). Re-runs when auth state or the query changes.
  useEffect(() => {
    let alive = true;
    // `loading` stays true only for the first paint (skeleton); on a search
    // re-run we update results in place rather than flashing the skeleton.
    const search = debouncedQuery || undefined;
    Promise.all([
      listClubs({ search }).catch(() => ({ items: [], cursor: null })),
      isLoggedIn ? listClubs({ mine: true, search }).catch(() => ({ items: [], cursor: null })) : Promise.resolve({ items: [], cursor: null }),
    ])
      .then(([a, m]) => {
        if (!alive) return;
        setAll(a.items);
        setAllCursor(a.cursor);
        setMine(m.items);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isLoggedIn, debouncedQuery]);

  const loadMore = () => {
    if (!allCursor || loadingMore) return;
    setLoadingMore(true);
    listClubs({ search: debouncedQuery || undefined, cursor: allCursor })
      .then((page) => { setAll((prev) => [...prev, ...page.items]); setAllCursor(page.cursor); })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const myClubs = mine;
  const discover = all.filter((c) => !c.isMember);
  const featured = discover[0] ?? null;
  const nearby = discover.slice(1);

  const open = (c: ApiClub) => onNavigate('club-details', { id: c.slug || c.id });
  const doJoin = (c: ApiClub) => {
    if (!requireAuth('join this club')) return;
    setJoined((prev) => new Set(prev).add(c.id));
    joinClub(c.id)
      .then((res) => {
        // Public clubs join immediately → move the club into My Clubs and out of
        // Discover (which filters on isMember). Private clubs stay "Requested".
        if (res.status === 'member') {
          const joinedClub = { ...c, isMember: true, memberCount: c.memberCount + 1 };
          setAll((prev) => prev.map((x) => (x.id === c.id ? joinedClub : x)));
          setMine((prev) => (prev.some((x) => x.id === c.id) ? prev : [joinedClub, ...prev]));
        }
      })
      .catch(() => setJoined((prev) => { const n = new Set(prev); n.delete(c.id); return n; }));
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
          <V2Skeleton variant="club-list" count={5} />
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

            {/* Reach clubs beyond the first page (search is server-side, so it spans all pages). */}
            {filter === 'all' && allCursor && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                <button className="filter-chip" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
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
