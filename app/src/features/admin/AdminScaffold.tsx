import { type ReactNode } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Chip } from '../../shared/components/ui/Chip';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';

/**
 * Shared building blocks for the mobile Admin console (the port of the website's
 * `/admin/*` dashboard). Every admin screen renders inside <AdminScreen> and
 * uses these primitives so the console reads as one system — the same header,
 * filter chips, search field, stat tiles, rows, and loading/empty/error states.
 */

export type LoadState = 'loading' | 'idle' | 'error';

interface AdminScreenProps {
  onBack: () => void;
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  /** When provided, a hamburger menu button renders beside the back arrow. */
  onMenuToggle?: () => void;
  children: ReactNode;
}

/** The outer chrome: a sticky "Admin console" header with a Back arrow and an
 *  optional refresh action, over a scrolling body. */
export function AdminScreen({ onBack, title, subtitle, onRefresh, onMenuToggle, children }: AdminScreenProps) {
  return (
    <div className="scroll safe-top safe-bottom px-5">
      <ScreenHeader
        onBack={onBack}
        eyebrow="Admin console"
        title={title}
        subtitle={subtitle}
        className="sticky top-0 z-20 -mx-5 px-5 bg-[var(--bg)] border-b-[0.5px] border-[var(--hairline)]"
        action={onRefresh ? (
          <button type="button" onClick={onRefresh} aria-label="Refresh" className="text-[var(--muted)]">
            <Icon name="refresh" size={20} />
          </button>
        ) : undefined}
      />
      {children}
    </div>
  );
}

/** A horizontally-scrolling chip filter row (status / role / state tabs). */
export function AdminFilters<T extends string>({
  filters, value, onChange,
}: { filters: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto py-3 -mx-5 px-5">
      {filters.map((f) => (
        <Chip key={f.value} selected={value === f.value} onClick={() => onChange(f.value)}>{f.label}</Chip>
      ))}
    </div>
  );
}

/** A search field wired to a controlled string. */
export function AdminSearch({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative pt-3">
      <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder || 'Search'}
        className="control pl-9"
      />
    </div>
  );
}

/** A compact KPI tile (label + big value + icon). */
export function AdminStat({
  label, value, icon, tone = 'var(--blue)',
}: { label: string; value: ReactNode; icon: string; tone?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="lbl">{label}</span>
        <span style={{ color: tone }}><Icon name={icon} size={18} /></span>
      </div>
      <div className="hd-1 mt-1 tabular-nums">{value}</div>
    </div>
  );
}

/** One list row: a card with an optional leading icon/avatar, a title +
 *  subtitle stack, optional trailing meta, and an optional actions footer. */
export function AdminRow({
  icon, iconColor = 'var(--blue)', avatarUrl, title, subtitle, meta, children,
}: {
  icon?: string;
  iconColor?: string;
  avatarUrl?: string | null;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="card p-4">
      <div className="flex items-start gap-3">
        {(icon || avatarUrl) && (
          <div className="shrink-0 size-10 rounded-full overflow-hidden flex items-center justify-center bg-[var(--surface-2,rgba(0,0,0,0.05))]" style={{ color: iconColor }}>
            {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : icon ? <Icon name={icon} size={20} /> : null}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="hd-3 truncate">{title}</div>
          {subtitle != null && <div className="t-sm truncate">{subtitle}</div>}
        </div>
        {meta != null && <div className="shrink-0 text-right">{meta}</div>}
      </div>
      {children}
    </section>
  );
}

/** A small pill tag used for statuses/roles. Pass a token colour. */
export function AdminTag({ label, color = 'var(--muted)' }: { label: string; color?: string }) {
  return <span className="text-[11px] font-bold uppercase tracking-wide shrink-0" style={{ color }}>{label}</span>;
}

/** Renders the loading skeleton, an error state, an empty state, or the list —
 *  the standard four-way branch every admin list screen needs. */
export function AdminStates({
  state, isEmpty, loadingCount = 3, emptyIcon = 'inbox', emptyTitle, emptyDescription, errorTitle = "Couldn't load", errorDescription = 'Check your connection and try again.', children,
}: {
  state: LoadState;
  isEmpty: boolean;
  loadingCount?: number;
  emptyIcon?: string;
  emptyTitle: string;
  emptyDescription: string;
  errorTitle?: string;
  errorDescription?: string;
  children: ReactNode;
}) {
  if (state === 'loading') return <LoadingSkeleton variant="card" count={loadingCount} />;
  if (state === 'error') return <EmptyState icon="error" title={errorTitle} description={errorDescription} />;
  if (isEmpty) return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  return <>{children}</>;
}

/** Format an ISO date as a short local date, or a dash when absent/invalid. */
export function adminDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const numberFmt = new Intl.NumberFormat();
export function adminNumber(n?: number | null): string {
  return numberFmt.format(n ?? 0);
}
