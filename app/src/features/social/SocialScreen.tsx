import { V2Shell, type V2ScreenChrome } from '../../shared/components/layout/V2Chrome';
import { useFriendRequestStore } from '../../shared/lib/friendRequestStore';
import { ClubsPanel } from './ClubsPanel';
import { FriendsPanel } from './FriendsPanel';
import { FeedPanel } from './FeedPanel';

export type SocialTab = 'feed' | 'clubs' | 'friends';

interface SocialScreenProps {
  chrome: V2ScreenChrome;
  /** From `?tab=` in the URL. Absent on a bare `/social` — see the landing rule. */
  tab?: SocialTab;
}

/**
 * The Social tab — PickleFeed, Clubs, and Friends.
 *
 * PickleFeed (a global, Threads-style player newsfeed) is the first section and
 * the default landing: opening Social drops you straight into the feed. Clubs
 * and Friends keep their panels; `clubs`/`friends` also survive as URL aliases.
 *
 * The outer switch is a segmented pill track, deliberately *not* another chip
 * row — the panels carry their own filters underneath.
 */
export function SocialScreen({ chrome, tab }: SocialScreenProps) {
  const { onNavigate, requireAuth } = chrome;
  const pending = useFriendRequestStore((s) => s.pending);

  // PickleFeed is the default landing (guests included — the feed is public
  // read). Friends still badges its pending count; it just no longer changes
  // where a bare `/social` lands.
  const active: SocialTab = tab ?? 'feed';

  const goPanel = (next: SocialTab) => {
    if (next === active) return;
    // Friends needs an account. Prompt, and leave the panel where it was —
    // a guest tapping Friends shouldn't land on an empty signed-out screen.
    if (next === 'friends' && !requireAuth('find players')) return;
    onNavigate('social', { tab: next }, { replace: true });
  };

  const subheading =
    active === 'friends'
      ? 'Connect with players, coaches, and organizers near you.'
      : active === 'clubs'
        ? 'Join a community, share posts, and meet players near you.'
        : 'See what players are up to — share games, open play, and clubs.';

  return (
    <V2Shell screen="v2-social" chrome={chrome}>
      <div className="page-content">
        <div className="clubs-intro">
          <h1 className="clubs-heading">Social</h1>
          <p className="clubs-subheading">{subheading}</p>
        </div>

        <div className="social-seg" role="tablist" aria-label="Social sections">
          <button
            role="tab"
            aria-selected={active === 'feed'}
            className={active === 'feed' ? 'active' : ''}
            onClick={() => goPanel('feed')}
          >
            PickleFeed
          </button>
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

        {active === 'feed' ? (
          <FeedPanel chrome={chrome} />
        ) : active === 'friends' ? (
          <FriendsPanel chrome={chrome} />
        ) : (
          <ClubsPanel chrome={chrome} onFindPlayers={() => goPanel('friends')} />
        )}
      </div>
    </V2Shell>
  );
}
