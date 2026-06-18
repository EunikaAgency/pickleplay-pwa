import { useEffect, useState } from 'react';
import {
  listMyTournaments, getMyOpenPlay, listRosters, getMyVenueRequests,
} from '../../../shared/lib/api';

export interface OrganizerHubCounts {
  tournaments: number;
  activeTournaments: number;
  series: number;
  upcomingSessions: number;
  rosters: number;
  pendingRequests: number;
}

/** Aggregates the headline counts shown on the organizer hub cards. Best-effort:
 *  each source fails independently to 0 so one dead endpoint doesn't blank the
 *  whole hub. Parallels owner/hooks/useOwnerDashboard. */
export function useOrganizerHub(reloadKey = 0) {
  const [counts, setCounts] = useState<OrganizerHubCounts>({
    tournaments: 0, activeTournaments: 0, series: 0, upcomingSessions: 0, rosters: 0, pendingRequests: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.allSettled([listMyTournaments(), getMyOpenPlay(), listRosters(), getMyVenueRequests()])
      .then(([t, op, r, vr]) => {
        if (!alive) return;
        const tournaments = t.status === 'fulfilled' ? t.value : [];
        const openPlay = op.status === 'fulfilled' ? op.value : { series: [], sessions: [] };
        const rosters = r.status === 'fulfilled' ? r.value : [];
        const requests = vr.status === 'fulfilled' ? vr.value : [];
        setCounts({
          tournaments: tournaments.length,
          activeTournaments: tournaments.filter((x) =>
            ['registration_open', 'ongoing', 'approved'].includes(x.status)).length,
          series: openPlay.series.length,
          upcomingSessions: openPlay.sessions.filter((s) => s.status !== 'cancelled').length,
          rosters: rosters.length,
          pendingRequests: requests.filter((x) => x.status === 'pending').length,
        });
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  return { counts, loading };
}
