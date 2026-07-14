import { useEffect, useState } from 'react';
import { listVenues, listOwnerVenues } from '../../../shared/lib/api';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission } from '../../../shared/lib/permissions';

export interface VenueOption { value: string; label: string }

/**
 * Venue options for the organizer pickers (create series, venue request).
 *
 * Scoped to WHO IS ASKING. An organizer may run an event at any venue in the
 * directory (the owner approves it separately), so they get the whole list. A venue
 * owner may only run recurring Open Play at a venue they manage (§5.3) — offering
 * them all 100 venues would be offering 99 choices the server will refuse, so they
 * get their own. A user who is both keeps the full list: the organizer capability is
 * the broader one.
 */
export function useVenueOptions() {
  const user = useAuthStore((s) => s.user);
  const [options, setOptions] = useState<VenueOption[]>([]);
  const [loading, setLoading] = useState(true);

  const isOrganizer = userHasPermission(user, 'organizer.events.manage');
  const userId = user?.id ?? null;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const fetch = isOrganizer || !userId
      ? listVenues({ pageSize: 100 }).then((page) => page.items)
      : listOwnerVenues(userId);

    fetch
      .then((items) => {
        if (!alive) return;
        setOptions(items.map((v) => ({ value: v.id, label: v.displayName })));
      })
      .catch(() => { if (alive) setOptions([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isOrganizer, userId]);

  return { options, loading };
}
