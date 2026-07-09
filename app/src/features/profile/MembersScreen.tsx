import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Icon } from '../../shared/components/ui/Icon';
import { useAuthStore } from '../../shared/lib/authStore';
import { useOwnerDashboard } from '../owner/hooks/useOwnerDashboard';
import { listVenueMembers, listSubscriptionPlans, type VenueMember, type ApiSubscriptionPlan } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

/* ─── Types ─────────────────────────────────────────────────── */

interface MemberRow {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  venueName: string;
  venueId: string;
  plan: string;
  status: string;
  joinedAt: string;
}

/* ─── Helpers ───────────────────────────────────────────────── */

function sinceLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function planLabel(tier: string | null | undefined): string {
  if (!tier) return 'Member';
  const key = tier.toLowerCase();
  if (key === 'monthly') return 'Monthly';
  if (key === 'quarterly') return 'Quarterly';
  if (key === 'annual') return 'Annual';
  if (key === 'weekly') return 'Weekly';
  if (/^[0-9a-fA-F]{24}$/.test(tier)) return 'Member';
  return tier;
}

function statusChip(status: string) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[var(--lime-soft)] text-[var(--lime-ink)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--lime)]" /> Active
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[var(--star-soft)] text-[var(--star-ink)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--star)]" /> Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[var(--surface-2)] text-[var(--muted)]">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)]" /> Inactive
    </span>
  );
}

/* ─── Skeletons ─────────────────────────────────────────────── */

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 animate-pulse">
          <div className="h-3 w-16 rounded-md bg-[var(--surface-2)] mb-2" />
          <div className="h-6 w-12 rounded-md bg-[var(--surface-2)] mb-1" />
          <div className="h-2.5 w-20 rounded-md bg-[var(--surface-2)]" />
        </div>
      ))}
    </div>
  );
}

function RowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3 px-3 rounded-xl animate-pulse">
          <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="h-3.5 w-1/3 rounded-md bg-[var(--surface-2)]" />
            <div className="h-2.5 w-1/2 rounded-md bg-[var(--surface-2)]" />
          </div>
          <div className="h-6 w-14 rounded-full bg-[var(--surface-2)] shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* ─── KPI Card ──────────────────────────────────────────────── */

function KpiCard({ label, value, sub, tone = 'neutral' }: {
  label: string; value: string | number; sub?: string; tone?: 'primary' | 'success' | 'warning';
}) {
  const c: Record<string, string> = { primary: 'var(--primary)', success: '#22C55E', warning: '#F97316', neutral: 'var(--ink-2)' };
  const bg: Record<string, string> = { primary: 'var(--primary-tint)', success: 'rgba(34,197,94,0.12)', warning: 'rgba(249,115,22,0.12)', neutral: 'var(--surface-2)' };
  return (
    <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4 shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-md">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">{label}</div>
      <div className="font-heading font-bold text-[28px] text-[var(--ink)] leading-none">{value}</div>
      {sub && <div className="text-[12px] mt-1" style={{ color: bg[tone] ? c[tone] : 'var(--muted)' }}>{sub}</div>}
    </div>
  );
}

/* ─── Main Screen ───────────────────────────────────────────── */

interface MembersScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

export function MembersScreen({ onNavigate, onBack }: MembersScreenProps) {
  const user = useAuthStore((s) => s.user);
  const { venues } = useOwnerDashboard();

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [venueFilter, setVenueFilter] = useState<string>('all');
  const [plans, setPlans] = useState<ApiSubscriptionPlan[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── Filter tabs from subscription plans ─────────────────── */
  const filterTabs = useMemo(() => {
    const tabs: { key: string; label: string }[] = [{ key: 'all', label: 'All Plans' }];
    for (const p of plans) {
      if (p.status === 'active' && !tabs.find((t) => t.key === p.name)) {
        tabs.push({ key: p.name, label: p.name });
      }
    }
    return tabs;
  }, [plans]);

  /* ── Fetch subscription plans when venue changes ─────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (venueFilter !== 'all') {
        const p = await listSubscriptionPlans(venueFilter).catch(() => [] as ApiSubscriptionPlan[]);
        if (!cancelled) setPlans(p);
      } else if (venues.length > 0) {
        const all: ApiSubscriptionPlan[] = [];
        for (const v of venues) {
          const p = await listSubscriptionPlans(v.id).catch(() => [] as ApiSubscriptionPlan[]);
          all.push(...p);
        }
        if (!cancelled) setPlans(all);
      } else {
        if (!cancelled) setPlans([]);
      }
    })();
    return () => { cancelled = true; };
  }, [venueFilter, venues]);

  /* ── Fetch members across venues ──────────────────────────── */
  const load = useCallback(async () => {
    if (!user || !venues.length) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    try {
      const venueIds = venueFilter === 'all' ? venues.map((v) => v.id) : [venueFilter];
      const results = await Promise.all(
        venueIds.map((vid) =>
          listVenueMembers(vid)
            .then((rows) => rows.map((m) => ({ ...m, _venueId: vid, _venueName: venues.find((v) => v.id === vid)?.displayName || venues.find((v) => v.id === vid)?.name || 'Venue' })))
            .catch(() => [] as (VenueMember & { _venueId: string; _venueName: string })[]),
        ),
      );
      const flat = results.flat();
      setMembers(flat.map((m) => ({
        id: m.id,
        userId: String(m.userId),
        name: m.displayName?.trim() || m.email || 'Member',
        avatarUrl: m.avatarUrl,
        venueName: m._venueName,
        venueId: m._venueId,
        plan: planLabel(m.tier),
        status: m.status,
        joinedAt: m.createdAt,
      })));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user, venues, venueFilter]);

  useEffect(() => { load(); }, [load]);

  /* ── Filter + search ──────────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = members;
    if (activeFilter !== 'all') {
      list = list.filter((m) => m.plan.toLowerCase() === activeFilter.toLowerCase());
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        m.venueName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [members, activeFilter, searchQuery]);

  /* ── KPIs ─────────────────────────────────────────────────── */
  const kpis = useMemo(() => ({
    total: members.length,
    active: members.filter((m) => m.status === 'active').length,
    pending: members.filter((m) => m.status === 'pending').length,
    venueCount: new Set(members.map((m) => m.venueId)).size,
  }), [members]);

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="scroll safe-top safe-bottom bg-[var(--bg)]">
      {/* Page header — matches /owner/partners */}
      <div className="px-5 pt-3 pb-4 flex items-center gap-3.5">
        <button type="button" aria-label="Back" onClick={onBack}
          className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center">
          <Icon name="back" size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="t-eyebrow">Owner console</div>
          <div className="hd-2 mt-0.5">Members</div>
          <div className="t-sm">Manage your venue memberships</div>
        </div>

        {venues.length > 0 && (
          <select value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)}
            className="h-9 px-3.5 rounded-full bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] text-[13px] font-semibold text-[var(--ink)] appearance-none cursor-pointer pr-8"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%236b7280%27 stroke-width=%272.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpolyline points=%276 9 12 15 18 9%27/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
            <option value="all">All Venues</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.displayName || v.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="px-5">
        {/* ── KPI cards ──────────────────────────────────────── */}
        {loading ? (
          <KpiSkeleton />
        ) : (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <KpiCard label="Total Members" value={kpis.total} sub={`${kpis.venueCount} venue${kpis.venueCount === 1 ? '' : 's'}`} tone="primary" />
            <KpiCard label="Active" value={kpis.active} sub="Current members" tone="success" />
            <KpiCard label="Pending" value={kpis.pending} sub="Awaiting response" tone="warning" />
          </div>
        )}

        {/* ── Search + filter toolbar ──────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mb-5">
          <div className="flex-1 flex items-center gap-2.5 px-3.5 h-11 rounded-xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/10 transition-shadow duration-150">
            <Icon name="search" size={18} className="text-[var(--muted)] shrink-0" />
            <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members…" autoComplete="off"
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] font-medium" />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                className="shrink-0 text-[var(--muted)] hover:text-[var(--ink)] transition-colors" aria-label="Clear search">
                <Icon name="close" size={16} />
              </button>
            )}
          </div>

          <div className="flex gap-1.5 p-1 rounded-full bg-[var(--surface-2)] shrink-0">
            {filterTabs.map((tab) => {
              const active = activeFilter === tab.key;
              return (
                <button key={tab.key} type="button" aria-pressed={active} onClick={() => setActiveFilter(tab.key)}
                  className="inline-flex items-center gap-1 px-3.5 h-8 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all duration-150"
                  style={{ background: active ? 'var(--surface)' : 'transparent', color: active ? 'var(--ink)' : 'var(--muted)', boxShadow: active ? 'var(--shadow-card)' : 'none' }}>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Members list ───────────────────────────────────── */}
        {loading ? (
          <RowSkeleton count={5} />
        ) : error ? (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--coral-soft)] text-[var(--coral)] flex items-center justify-center mb-3">
              <Icon name="close" size={26} />
            </div>
            <p className="font-semibold text-[15px] text-[var(--ink)]">Couldn't load members</p>
            <p className="text-[13px] text-[var(--muted)] mt-1">Check your connection and try again.</p>
            <button type="button" onClick={load}
              className="mt-4 inline-flex items-center gap-1.5 px-5 h-10 rounded-xl bg-[var(--primary)] text-white font-semibold text-[13px]">
              <Icon name="refresh" size={16} /> Retry
            </button>
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="w-16 h-16 rounded-[20px] bg-[var(--surface-2)] text-[var(--muted)] flex items-center justify-center mb-3.5">
              <Icon name="groups" size={28} />
            </div>
            {searchQuery || activeFilter !== 'all' ? (
              <>
                <p className="font-semibold text-[15px] text-[var(--ink)]">No matches found</p>
                <p className="text-[13px] text-[var(--muted)] mt-1 max-w-[260px]">
                  {searchQuery ? `No members matching "${searchQuery}".` : 'No members in this plan yet.'}
                </p>
                <button type="button" onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 h-9 rounded-xl bg-[var(--surface-2)] text-[var(--ink)] font-semibold text-[13px]">
                  <Icon name="close" size={14} /> Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="font-semibold text-[15px] text-[var(--ink)]">No members yet</p>
                <p className="text-[13px] text-[var(--muted)] mt-1 max-w-[280px]">
                  Players who join your venue membership plans will show up here. Set up subscription plans from your venue settings to start accepting members.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] overflow-hidden shadow-[var(--shadow-card)]">
            <div className="sticky top-0 z-10 grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_160px_120px_120px] items-center gap-4 px-5 h-10 bg-[var(--surface-2)] border-b border-[var(--hairline)] text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              <span className="truncate">Member</span>
              <span className="hidden sm:inline truncate">Plan</span>
              <span className="hidden sm:inline truncate">Status</span>
              <span className="hidden sm:inline truncate">Joined</span>
            </div>

            <div className="divide-y divide-[var(--hairline)]">
              {filtered.map((m) => (
                <div key={m.id}
                  className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_160px_120px_120px] items-center gap-4 px-5 py-3 hover:bg-[var(--surface-2)] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={m.name} src={m.avatarUrl} size={38} className="shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{m.name}</div>
                      <div className="text-[12px] text-[var(--muted)] truncate">{m.venueName}</div>
                    </div>
                  </div>
                  <span className="hidden sm:inline text-[13px] text-[var(--ink-2)] font-medium truncate">{m.plan}</span>
                  <span className="hidden sm:flex">{statusChip(m.status)}</span>
                  <span className="hidden sm:inline text-[12px] text-[var(--muted)]">
                    {m.status === 'pending' ? '—' : sinceLabel(m.joinedAt)}
                  </span>
                  <span className="sm:hidden flex flex-col items-end gap-0.5">
                    {statusChip(m.status)}
                    <span className="text-[11px] text-[var(--muted)]">{m.plan} · {sinceLabel(m.joinedAt)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <div style={{ height: 100 }} />
    </div>
  );
}
