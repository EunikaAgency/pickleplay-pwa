import { V2Shell, type V2ScreenChrome } from '../../shared/components/layout/V2Chrome';
import { V2Skeleton } from '../../shared/components/ui/V2Skeleton';
import { useFriendRequestStore } from '../../shared/lib/friendRequestStore';
import { ClubsPanel } from './ClubsPanel';
import { FriendsPanel } from './FriendsPanel';

export type SocialTab = 'clubs' | 'friends';

interface SocialScreenProps {
  chrome: V2ScreenChrome;
  /** From `?tab=` in the URL. Absent on a bare `/social` — see the landing rule. */
  tab?: SocialTab;
}

/**
 * The Social tab — Clubs and Friends, the two halves of "people I play with".
 *
 * Friends used to sit three taps deep in Profile (under Payments), so nobody
 * found it. Hoisting it here alongside Clubs costs no nav slot: Social replaces
 * the Clubs tab rather than adding one.
 *
 * The outer switch is a segmented pill track, deliberately *not* another chip
 * row — both panels already have their own chip filters underneath, and two
 * stacked chip rows read as noise.
 */
export function SocialScreen({ chrome, tab }: SocialScreenProps) {
  const { onNavigate, isLoggedIn, requireAuth } = chrome;
  const pending = useFriendRequestStore((s) => s.pending);
  const countLoaded = useFriendRequestStore((s) => s.loaded);

  // Landing rule for a bare `/social`: open on Friends when requests are waiting,
  // otherwise on Clubs — so an existing club member never notices a change.
  // Guests always land on Clubs (Friends needs an account).
  const landing: SocialTab = !isLoggedIn ? 'clubs' : pending > 0 ? 'friends' : 'clubs';
  const active = tab ?? (countLoaded ? landing : null);

  const goPanel = (next: SocialTab) => {
    if (next === active) return;
    // Friends needs an account. Prompt, and leave the panel where it was —
    // a guest tapping Friends shouldn't land on an empty signed-out screen.
    if (next === 'friends' && !requireAuth('find players')) return;
    onNavigate('social', { tab: next }, { replace: true });
  };

  return (
    <V2Shell screen="v2-social" chrome={chrome}>
      <div className="page-content">
        <div className="clubs-intro">
          <h1 className="clubs-heading">Social</h1>
          <p className="clubs-subheading">
            {active === 'friends'
              ? 'Connect with players, coaches, and organizers near you.'
              : 'Join a community, share posts, and meet players near you.'}
          </p>
        </div>

        <div className="social-seg" role="tablist" aria-label="Social sections">
          <button
            role="tab"
            aria-selected={active === 'clubs'}
            className={active === 'clubs' ? 'active' : ''}
            onClick={() => goPanel('clubs')}
          >
            Clubs
          </button>
          <button
            role="tab"
            aria-selected={active === 'friends'}
            className={active === 'friends' ? 'active' : ''}
            onClick={() => goPanel('friends')}
          >
            Friends
            {pending > 0 && <span className="social-seg-count">{pending}</span>}
          </button>
        </div>

        {/* `active` is null only for the blink between mount and the first
            pending-count resolution on a bare `/social` cold load. */}
        {active === null ? (
          <V2Skeleton variant="club-list" count={4} />
        ) : active === 'friends' ? (
          <FriendsPanel chrome={chrome} />
        ) : (
          <ClubsPanel chrome={chrome} onFindPlayers={() => goPanel('friends')} />
        )}
      </div>
    </V2Shell>
  );
}
