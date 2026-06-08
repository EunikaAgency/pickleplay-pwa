import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { getInitials } from '../../shared/lib/initials';
import { DuprExplainerSheet } from '../../shared/components/ui/DuprExplainerSheet';
import type { Navigate } from '../../shared/lib/navigation';
import { tierForDupr } from '../../shared/lib/skillTiers';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';

interface ProfileScreenProps {
  onNavigate: Navigate;
  onLogout: () => void;
}

const ACHIEVEMENTS = [
  { ic: 'trophy', label: 'First win',  color: '#c89000',         bg: 'rgba(200,144,0,0.15)' },
  { ic: 'fire',   label: '5-streak',   color: 'var(--coral)',    bg: 'var(--coral-soft)' },
  { ic: 'star',   label: 'Top 5 club', color: 'var(--primary)',  bg: 'var(--primary-tint)' },
  { ic: 'paddle', label: '100 games',  color: 'var(--lime-ink)', bg: 'var(--lime-soft)' },
] as const;

export function ProfileScreen({ onNavigate, onLogout }: ProfileScreenProps) {
  const currentUser = useAuthStore((s) => s.user);
  const [duprOpen, setDuprOpen] = useState(false);
  const isOwner = userHasPermission(currentUser, 'owner.access');

  const name = currentUser?.displayName ?? 'Your profile';
  const initials = getInitials(currentUser?.displayName) || '··';
  const tier = currentUser?.skillLevel != null ? tierForDupr(currentUser.skillLevel) : null;
  const tierLine = tier
    ? `${tier.name.toUpperCase()} · ${tier.dupr}`
    : (currentUser?.skillLevelLabel?.toUpperCase() ?? 'UNRATED PLAYER');

  const pct = 66;
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div className="scroll safe-top safe-bottom">
      <div className="app-header">
        <div className="greet-name">Profile</div>
        <button
          onClick={() => onNavigate('settings')}
          aria-label="Open settings"
          className="w-10 h-10 rounded-xl bg-[var(--surface)] text-[var(--ink-2)] flex items-center justify-center shadow-[var(--shadow-card)] border-[0.5px] border-[var(--hairline)]"
        >
          <Icon name="settings" size={18} />
        </button>
      </div>

      <div className="profile-hero">
        <div className="avatar-xl w-[112px]! h-[112px]! overflow-hidden">
          {currentUser?.avatarUrl ? (
            <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="text-[42px]">{initials}</div>
          )}
          <button
            type="button"
            onClick={() => setDuprOpen(true)}
            className="dupr-pill -bottom-2.5! right-auto! left-1/2! -translate-x-1/2"
            aria-label="What is DUPR?"
          >
            <Icon name="bolt" size={11} /> {currentUser?.skillLevel != null ? `${currentUser.skillLevel} DUPR` : 'DUPR'}
          </button>
        </div>
        <h2 className="mt-[22px]">{name}</h2>
        <div className="tier">{tierLine}</div>
        {currentUser?.bio && (
          <div className="mt-2.5 text-[13px] text-[var(--muted)] italic">
            "{currentUser.bio}"
          </div>
        )}
      </div>

      {/* Win-rate ring + stats — wrapped so we can lay it side-by-side
          with quick-actions on desktop. */}
      <div className="profile-stats-grid"><div className="ring-card">
        <div className="win-rate-ring">
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
            <circle
              cx="48"
              cy="48"
              r={r}
              fill="none"
              stroke="var(--lime)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
              transform="rotate(-90 48 48)"
            />
          </svg>
          <div className="center">
            <div className="pct">{pct}%</div>
            <div className="lbl">Win rate</div>
          </div>
        </div>
        <div className="stats">
          <div className="row">
            <span className="l">Games played</span>
            <span className="v">124</span>
          </div>
          <div className="row">
            <span className="l">Wins</span>
            <span className="v text-[#5b7400]">82</span>
          </div>
          <div className="row">
            <span className="l">Losses</span>
            <span className="v text-[var(--coral)]">42</span>
          </div>
          <div className="row">
            <span className="l">Current streak</span>
            <span className="v">4 wins 🔥</span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="qa-row profile-qa">
        {([
          { ic: 'calendar', label: 'Games',  color: 'var(--primary)', nav: 'games' },
          { ic: 'heart',    label: 'Saved',  color: 'var(--coral)' },
          { ic: 'shield',   label: 'Verify', color: '#5b7400' },
          { ic: 'help',     label: 'Help',   color: 'var(--ink-2)' },
        ] as const).map((q) => (
          <button key={q.label} className="qa" onClick={() => 'nav' in q && onNavigate(q.nav)}>
            <div
              className="ic"
              style={{
                color: q.color,
                background:
                  q.color === 'var(--ink-2)' ? 'var(--surface-2)' : `color-mix(in oklab, ${q.color} 12%, transparent)`,
              }}
            >
              <Icon name={q.ic} size={18} />
            </div>
            <div className="label">{q.label}</div>
          </button>
        ))}
      </div></div>

      {/* Achievements rail */}
      <div className="section">
        <div className="section-head">
          <div className="hd-2">Recent achievements</div>
          <button className="more">All</button>
        </div>
        <div className="rail">
          {ACHIEVEMENTS.map((a) => (
            <div
              key={a.label}
              className="w-[110px] px-2.5 py-3.5 bg-[var(--surface)] rounded-2xl border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-card)] flex flex-col items-center gap-2"
            >
              <div
                className="w-11 h-11 rounded-[14px] flex items-center justify-center"
                style={{ background: a.bg, color: a.color }}
              >
                <Icon name={a.ic} size={22} />
              </div>
              <div className="text-[11px] font-bold text-[var(--ink-2)] text-center">
                {a.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Owner console entry — only for users with venue-owner access. */}
      {isOwner && (
        <div className="section">
          <div className="set-list">
            <button className="row" onClick={() => onNavigate('owner-venues')}>
              <div className="ic" style={{ background: 'var(--primary)' }}>
                <Icon name="storefront" size={16} />
              </div>
              <div className="body">
                <div className="name">My venues</div>
                <div className="desc">Manage listings, hours, courts & reviews</div>
              </div>
              <Icon name="chevron" size={16} className="chev" />
            </button>
          </div>
        </div>
      )}

      {/* Settings list */}
      <div className="section">
        <div className="set-list">
          {([
            { ic: 'calendar', name: 'My bookings',  desc: 'Court reservations',       color: 'var(--lime-700,#5b7400)', nav: 'my-bookings' },
            { ic: 'paddle', name: 'My games',       desc: 'Games you created',        color: 'var(--primary)', nav: 'my-games' },
            { ic: 'user',   name: 'Account',        desc: 'Profile, email, password', color: 'var(--primary)', nav: 'edit-profile' },
            { ic: 'shield', name: 'Privacy',        desc: 'Visibility & permissions', color: '#5b7400',         nav: 'settings' },
            { ic: 'bell',   name: 'Notifications',  desc: 'Push, email, in-app',      color: 'var(--coral)',    nav: 'notifications' },
            { ic: 'help',   name: 'Help & Support', desc: 'Rules, FAQ, contact us',   color: 'var(--ink-2)',    nav: 'settings' },
          ] as const).map((s) => (
            <button key={s.name} className="row" onClick={() => s.nav && onNavigate(s.nav)}>
              <div className="ic" style={{ background: s.color }}>
                <Icon name={s.ic} size={16} />
              </div>
              <div className="body">
                <div className="name">{s.name}</div>
                <div className="desc">{s.desc}</div>
              </div>
              <Icon name="chevron" size={16} className="chev" />
            </button>
          ))}
          <button className="row" onClick={onLogout}>
            <div className="ic bg-[var(--coral)]">
              <Icon name="logout" size={16} />
            </div>
            <div className="body">
              <div className="name text-[var(--coral)]!">Sign out</div>
            </div>
            <Icon name="chevron" size={16} className="chev" />
          </button>
        </div>
      </div>

      <DuprExplainerSheet open={duprOpen} onClose={() => setDuprOpen(false)} />
    </div>
  );
}
