import { Icon } from '../../shared/components/ui/Icon';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission, type Permission } from '../../shared/lib/permissions';
import type { Navigate } from '../../shared/lib/navigation';
import { useOrganizerHub } from './hooks/useOrganizerHub';

interface OrganizerHubScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

interface Tool {
  key: string;
  icon: string;
  color: string;
  label: string;
  description: string;
  onPress: () => void;
  /** Permission required to see this tool (beyond organizer.access). */
  perm: Permission;
  stat?: string;
}

/**
 * The organizer console home. Reached from the "Organize" entry on Profile
 * (gated by `organizer.access`). Lists the organizer tools as cards, each hidden
 * when the user lacks its sub-permission — organizers are players who *also* run
 * events, so this is an entry point, not a tab takeover (cf. the owner console).
 */
export function OrganizerHubScreen({ onNavigate, onBack }: OrganizerHubScreenProps) {
  const currentUser = useAuthStore((s) => s.user);
  const { counts, loading } = useOrganizerHub();

  const tools: Tool[] = [
    {
      key: 'games', icon: 'trophy', color: 'var(--primary)',
      label: 'Games', description: 'Create and manage tournaments, brackets, and structured games.',
      onPress: () => onNavigate('organizer-tournaments'), perm: 'organizer.tournaments.manage',
      stat: loading ? undefined : counts.tournaments + ' total - ' + counts.activeTournaments + ' active',
    },
    // HIDDEN: tournaments temporarily disabled for all roles
    // {
    //   key: 'tournaments', icon: 'trophy', color: 'var(--primary)',
    //   label: 'Tournaments', description: 'Create, register, seed, and run brackets to a champion.',
    //   onPress: () => onNavigate('organizer-tournaments'), perm: 'organizer.tournaments.manage',
    //   stat: loading ? undefined : `${counts.tournaments} total · ${counts.activeTournaments} active`,
    // },
    {
      key: 'open-play', icon: 'calendar', color: '#5b7400',
      label: 'Open Play', description: 'Recurring weekly sessions with rosters and attendance.',
      onPress: () => onNavigate('organizer-open-play'), perm: 'organizer.events.manage',
      stat: loading ? undefined : `${counts.series} series · ${counts.upcomingSessions} sessions`,
    },
    {
      key: 'rosters', icon: 'groups', color: 'var(--coral)',
      label: 'Player Lists', description: 'Reusable rosters of your regulars.',
      onPress: () => onNavigate('organizer-rosters'), perm: 'organizer.events.manage',
      stat: loading ? undefined : `${counts.rosters} list${counts.rosters === 1 ? '' : 's'}`,
    },
    // HIDDEN: venue requests temporarily disabled (depends on tournaments)
    // {
    //   key: 'venue-requests', icon: 'storefront', color: 'var(--primary)',
    //   label: 'Venue Requests', description: 'Request a venue for a tournament and track approvals.',
    //   onPress: () => onNavigate('organizer-venue-requests', {}), perm: 'organizer.tournaments.manage',
    //   stat: loading ? undefined : (counts.pendingRequests > 0 ? `${counts.pendingRequests} pending` : 'Up to date'),
    // },
  ];

  const visible = tools.filter((t) => userHasPermission(currentUser, t.perm));

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} title="Organize" eyebrow="Organizer console" />

      <div className="px-5 flex flex-col gap-3">
        {visible.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={t.onPress}
            className="card p-4 w-full text-left flex items-center gap-3.5"
          >
            <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ background: t.color }}>
              <Icon name={t.icon} size={20} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="font-heading font-semibold text-[16px] text-[var(--ink)] block">{t.label}</span>
              <span className="t-sm block">{t.description}</span>
              {t.stat && <span className="t-eyebrow mt-1 block">{t.stat}</span>}
            </span>
            <Icon name="chevron" size={18} className="text-[var(--surface-3)] shrink-0" />
          </button>
        ))}

        {visible.length === 0 && (
          <div className="text-center text-[13px] text-[var(--muted)] py-10">
            You don't have any organizer tools enabled yet.
          </div>
        )}
      </div>
    </div>
  );
}
