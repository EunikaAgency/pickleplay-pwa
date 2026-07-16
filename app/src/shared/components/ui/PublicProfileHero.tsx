import type { ReactNode } from 'react';
import { getInitials } from '../../lib/initials';

/** One "23.1K followers"-style figure in the meta row. */
export interface ProfileStat {
  value: string;
  label: string;
}

/** A hero action button. The first is rendered filled (lime), the rest outlined. */
export interface ProfileAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'outline';
}

interface PublicProfileHeroProps {
  /** Display name — the big headline. */
  name: string;
  /** Small muted line under the name (role · skill, specialty, @handle…). */
  handle?: ReactNode;
  /** Already-resolved avatar URL (via apiImageUrl); null shows initials. */
  avatarUrl?: string | null;
  verified?: boolean;
  bio?: string | null;
  /** The "linktr.ee" analog — a single detail line (location, website…). */
  detail?: ReactNode;
  stats?: ProfileStat[];
  /** One or two buttons. Threads-style: one filled, one outlined. */
  actions?: ProfileAction[];
  tabs?: string[];
  activeTab?: string;
  onTab?: (tab: string) => void;
}

const CheckBadge = () => (
  <svg className="px-verified" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-label="Verified" role="img">
    <path d="M12 2 9.8 4.2 6.7 3.9 5.4 6.7 2.6 8l.3 3.1L1 12l1.9 2.9-.3 3.1 2.8 1.3 1.3 2.8 3.1-.3L12 22l2.2-2.2 3.1.3 1.3-2.8 2.8-1.3-.3-3.1L23 12l-1.9-2.9.3-3.1-2.8-1.3-1.3-2.8-3.1.3z" />
    <path d="m9.5 12.4 1.7 1.7 3.6-3.8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Threads-style public-profile header: name + handle on the left, a round avatar
 * top-right, bio, a detail line, a stats row, the two-button action row, and an
 * optional tab strip. Shared by the coach-detail + player-profile screens so they
 * stay visually identical. Render it inside a `.pb-v2 .px-profile` scope so it
 * inherits the v2 tokens + dark mode. Tab panels go in the parent, after this.
 */
export function PublicProfileHero({
  name, handle, avatarUrl, verified, bio, detail, stats, actions, tabs, activeTab, onTab,
}: PublicProfileHeroProps) {
  return (
    <section className="px-hero">
      <div className="px-id">
        <div className="px-id-main">
          <h1 className="px-name">
            {name}
            {verified && <CheckBadge />}
          </h1>
          {handle && <p className="px-handle">{handle}</p>}
        </div>
        <div className="px-avatar">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{getInitials(name)}</span>}
        </div>
      </div>

      {bio && <p className="px-bio">{bio}</p>}

      {detail && <div className="px-detail">{detail}</div>}

      {stats && stats.length > 0 && (
        <div className="px-stats">
          {stats.map((s) => (
            <span key={s.label} className="px-stat"><b>{s.value}</b> {s.label}</span>
          ))}
        </div>
      )}

      {actions && actions.length > 0 && (
        <div className="px-actions">
          {actions.map((a, i) => (
            <button
              key={a.label}
              type="button"
              className={`px-btn ${a.variant ?? (i === 0 ? 'primary' : 'outline')}`}
              onClick={a.onClick}
              disabled={a.disabled}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {tabs && tabs.length > 0 && (
        <div className="px-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === activeTab}
              className={`px-tab${t === activeTab ? ' active' : ''}`}
              onClick={() => onTab?.(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
