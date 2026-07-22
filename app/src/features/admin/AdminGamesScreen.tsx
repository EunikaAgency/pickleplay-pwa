import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminScreen, AdminFilters, AdminRow, AdminTag, AdminStates, type LoadState } from './AdminScaffold';
import { listGames, type ApiGame } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

type GameFilter = 'published' | 'all' | 'cancelled';

const STATUS_COLOR: Record<string, string> = {
  published: 'var(--lime-ink)',
  draft: 'var(--muted)',
  cancelled: 'var(--coral)',
  completed: 'var(--blue)',
};

/**
 * Admin console: games across the platform (the website's Manage Games page,
 * wired to live data instead of its dummy table). Rows are read-only — no tap
 * action. Gated by `admin.access`.
 */
export function AdminGamesScreen({ onNavigate }: Props) {
  const [games, setGames] = useState<ApiGame[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [filter, setFilter] = useState<GameFilter>('published');
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState('loading');
    try {
      const rows = await listGames({ status: filter === 'all' ? undefined : filter, pageSize: 100 });
      if (id !== reqId.current) return;
      setGames(rows);
      setState('idle');
    } catch {
      if (id === reqId.current) setState('error');
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  return (
    <AdminScreen onBack={() => onNavigate('admin-hub')} title="Games" subtitle={`${games.length} games · Published and cancelled games across the platform.`} onRefresh={() => void load()}>
      <AdminFilters<GameFilter>
        value={filter}
        onChange={setFilter}
        filters={[
          { value: 'published', label: 'Published' },
          { value: 'all', label: 'All' },
          { value: 'cancelled', label: 'Cancelled' },
        ]}
      />
      <AdminStates
        state={state}
        isEmpty={games.length === 0}
        emptyIcon="sports_tennis"
        emptyTitle="No games"
        emptyDescription="No games match this filter."
      >
        <div className="space-y-3 pb-6">
          {games.map((g) => {
            const s = g.status || 'published';
            return (
              <div key={g.id}>
                <AdminRow
                  icon="sports_tennis"
                  title={g.title || 'Untitled game'}
                  subtitle={[g.whenLabel || g.date, g.timeLabel, g.skillLabel].filter(Boolean).join(' · ') || '—'}
                  meta={
                    <div className="flex flex-col items-end gap-1">
                      <AdminTag label={s} color={STATUS_COLOR[s] || 'var(--muted)'} />
                      {g.participantCount != null && (
                        <span className="t-sm tabular-nums">
                          {g.participantCount}{g.capacity ? `/${g.capacity}` : ''} joined
                        </span>
                      )}
                    </div>
                  }
                />
              </div>
            );
          })}
        </div>
      </AdminStates>
    </AdminScreen>
  );
}
