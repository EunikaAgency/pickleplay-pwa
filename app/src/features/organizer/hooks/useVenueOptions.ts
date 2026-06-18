import { useEffect, useState } from 'react';
import { listVenues } from '../../../shared/lib/api';

export interface VenueOption { value: string; label: string }

/** Loads a flat list of venue options for the organizer pickers (create series,
 *  venue request). Fetches one large page — enough for a dropdown. */
export function useVenueOptions() {
  const [options, setOptions] = useState<VenueOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listVenues({ pageSize: 100 })
      .then((page) => {
        if (!alive) return;
        setOptions(page.items.map((v) => ({ value: v.id, label: v.displayName })));
      })
      .catch(() => { if (alive) setOptions([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return { options, loading };
}
