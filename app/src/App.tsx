import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { LandingScreen } from './features/auth/LandingScreen';
import { LoginScreen } from './features/auth/LoginScreen';
import { ForgotPasswordScreen } from './features/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from './features/auth/ResetPasswordScreen';
import { VerifyEmailScreen } from './features/auth/VerifyEmailScreen';
import { VerifyEmailBanner } from './features/auth/VerifyEmailBanner';
import { OnboardingScreen } from './features/auth/OnboardingScreen';
import { SplashScreen } from './features/auth/SplashScreen';
import { GameDetailsScreen } from './features/games/GameDetailsScreen';
import { CourtDetailsScreen } from './features/venues/CourtDetailsScreen';
import { ClubDetailsScreen } from './features/clubs/ClubDetailsScreen';
import { CreateGameScreen } from './features/games/CreateGameScreen';
import { MyGamesScreen } from './features/games/MyGamesScreen';
import { BookCourtScreen } from './features/bookings/BookCourtScreen';
import { MyBookingsScreen } from './features/bookings/MyBookingsScreen';
import { BookingRefundScreen } from './features/bookings/BookingRefundScreen';
import { PaymentHistoryScreen } from './features/profile/PaymentHistoryScreen';
import { PlayerProfileScreen } from './features/profile/PlayerProfileScreen';
import { CoachSubscribeScreen } from './features/coaches/CoachSubscribeScreen';
import { CoachBookingsScreen } from './features/coaches/CoachBookingsScreen';
import { CoachPricingScreen } from './features/coaches/CoachPricingScreen';
import { FindCoachScreen } from './features/coaches/FindCoachScreen';
import { CoachDetailScreen } from './features/coaches/CoachDetailScreen';
import { BookCoachScreen } from './features/coaches/BookCoachScreen';
import { CreateClubScreen } from './features/clubs/CreateClubScreen';
import { EditClubScreen } from './features/clubs/EditClubScreen';
import { ClubPostScreen } from './features/clubs/ClubPostScreen';
import { ClubPostEditScreen } from './features/clubs/ClubPostEditScreen';
import { ClubChatScreen } from './features/clubs/ClubChatScreen';
import { EditProfileScreen } from './features/profile/EditProfileScreen';
import { SettingsScreen } from './features/profile/SettingsScreen';
import { TestEmailScreen } from './features/profile/TestEmailScreen';
import { SearchScreen } from './features/search/SearchScreen';
import { InvitePlayersScreen } from './features/games/InvitePlayersScreen';
import { NotificationsScreen } from './features/profile/NotificationsScreen';
import { ConversationsScreen } from './features/messages/ConversationsScreen';
import { ChatScreen } from './features/messages/ChatScreen';
import { GameChatScreen } from './features/games/GameChatScreen';
import { OpenPlayChatScreen } from './features/games/v2/OpenPlayChatScreen';
import { OwnerVenuesScreen } from './features/owner/OwnerVenuesScreen';
import { OwnerHomeScreen } from './features/owner/OwnerHomeScreen';
import { OwnerProfileScreen } from './features/owner/OwnerProfileScreen';
import { OwnerStaffScreen } from './features/owner/OwnerStaffScreen';
import { OwnerSettlementsScreen } from './features/owner/OwnerSettlementsScreen';
import { SubscriptionPlansScreen } from './features/owner/SubscriptionPlansScreen';
import { OwnerBookingsScreen } from './features/owner/OwnerBookingsScreen';
import { OwnerFrontDeskScreen } from './features/owner/OwnerFrontDeskScreen';
import { OwnerManualReservationScreen } from './features/owner/OwnerManualReservationScreen';
import { OwnerPricingScreen } from './features/owner/OwnerPricingScreen';
import { OwnerInsightsScreen } from './features/owner/OwnerInsightsScreen';
import { OwnerGamesScreen } from './features/owner/OwnerGamesScreen';
import { OwnerNearbyScreen } from './features/owner/OwnerNearbyScreen';
import { OwnerVenueScreen } from './features/owner/OwnerVenueScreen';
import { OwnerNewVenueScreen } from './features/owner/OwnerNewVenueScreen';
import { ClaimVenueScreen } from './features/owner/ClaimVenueScreen';
import { OwnerShopScreen } from './features/owner/OwnerShopScreen';
import { OwnerCalendarScreen } from './features/owner/OwnerCalendarScreen';
import { OwnerPartnersScreen } from './features/owner/OwnerPartnersScreen';
import { OwnerVenuesScreenV2 } from './features/owner/OwnerVenuesScreenV2';
import { MembersScreen } from './features/profile/MembersScreen';
import { AdminClaimsScreen } from './features/admin/AdminClaimsScreen';
import { AdminPostReportsScreen } from './features/admin/AdminPostReportsScreen';
import { OpenPlayBookScreen } from './features/bookings/OpenPlayBookScreen';
import PlanPdfsPage from './features/plan-pdfs/PlanPdfsPage';
import { OrganizerHubScreen } from './features/organizer/OrganizerHubScreen';
import { TournamentsScreen } from './features/organizer/tournaments/TournamentsScreen';
import { CreateTournamentScreen } from './features/organizer/tournaments/CreateTournamentScreen';
import { TournamentDetailScreen } from './features/organizer/tournaments/TournamentDetailScreen';
import { BracketScreen } from './features/organizer/tournaments/BracketScreen';
import { OpenPlayScreen } from './features/organizer/openplay/OpenPlayScreen';
import { SessionRosterScreen } from './features/organizer/openplay/SessionRosterScreen';
import { RostersScreen } from './features/organizer/rosters/RostersScreen';
import { RosterDetailScreen } from './features/organizer/rosters/RosterDetailScreen';
import { VenueRequestsScreen } from './features/organizer/venues/VenueRequestsScreen';
import { TabBar } from './shared/components/layout/TabBar';
import { Sidebar } from './shared/components/layout/Sidebar';
import { InstallPrompt } from './shared/components/ui/InstallPrompt';
import { OfflineBanner } from './shared/components/ui/OfflineBanner';
import { AuthPromptSheet } from './shared/components/ui/AuthPromptSheet';
import { ErrorBoundary } from './shared/components/ui/ErrorBoundary';
import { DemoStateControl } from './shared/components/ui/DemoStateControl';
import { DemoStateProvider, useDemoState } from './shared/lib/demoState';
import { userHasPermission, type Permission } from './shared/lib/permissions';
import { useAuthStore } from './shared/lib/authStore';
import { useNotificationPolling } from './shared/hooks/useNotificationPolling';
import { useMessagePolling } from './shared/hooks/useMessagePolling';
import { useFriendRequestPolling } from './shared/hooks/useFriendRequestPolling';
import { useInvitePolling } from './shared/hooks/useInvitePolling';
import { useInviteStore } from './shared/lib/inviteStore';
import { useRealtimeStream } from './shared/hooks/useRealtimeStream';
import { useTheme } from './shared/hooks/useTheme';
import { tabScreens, pathFromScreen, screenFromLocation, deepLinkParent, type Navigate, type Screen, type ScreenId, type TabId } from './shared/lib/navigation';
// v2.1 redesign ("Pickleballers Mockup v2.1") — the player-side screens (now the
// only player design; the legacy New/Classic variants + their toggle were removed).
import { HomeScreenV2 } from './features/home/v2/HomeScreenV2';
import { NearbyScreenV2 } from './features/venues/v2/NearbyScreenV2';
import { GamesScreenV2 } from './features/games/v2/GamesScreenV2';
import { SocialScreen } from './features/social/SocialScreen';
import { FeedPostScreen } from './features/social/FeedPostScreen';
import { TournamentsScreenV2 } from './features/tournaments/v2/TournamentsScreenV2';
import { TournamentDetailScreen as PlayerTournamentDetailScreen } from './features/tournaments/v2/TournamentDetailScreen';
import { TournamentChatScreen } from './features/tournaments/v2/TournamentChatScreen';
import { ProfileScreenV2 } from './features/profile/v2/ProfileScreenV2';
import { SettingsScreenV2 } from './features/profile/v2/SettingsScreenV2';
import { CreateGameV2 } from './features/games/v2/CreateGameV2';
import { OpenPlayDetailScreen } from './features/games/v2/OpenPlayDetailScreen';
import { CreateClubV2 } from './features/clubs/v2/CreateClubV2';
import { V2Shell, type V2ScreenChrome } from './shared/components/layout/V2Chrome';
import { V2Skeleton } from './shared/components/ui/V2Skeleton';
import { hasStoredSession } from './shared/lib/api';

/**
 * A screen can be reachable by more than one route to the same job, in which case
 * holding ANY of the listed permissions opens it. Recurring Open Play is the case
 * that needed it: it is an organizer's event *or* an owner's own courts (§5.3), and
 * an owner should not have to be handed the whole organizer role to run a weekly
 * session at their venue. The server still enforces the real per-venue rule — this
 * only decides whether the door is visible.
 */
function hasScreenPermission(user: Parameters<typeof userHasPermission>[0], req: Permission | Permission[] | undefined): boolean {
  if (!req) return true;
  return (Array.isArray(req) ? req : [req]).some((p) => userHasPermission(user, p));
}

const SCREEN_PERMISSIONS: Partial<Record<ScreenId, Permission | Permission[]>> = {
  'create-game': 'player.games.create',
  'edit-game': 'player.games.manage',
  'my-games': 'player.games.manage',
  'book-court': 'player.bookings.create',
  'booking-refund': 'player.bookings.create',
  'payment-history': 'player.payments.view',
  // Subscribing + booking a coach are ordinary player capabilities (the paid
  // subscription is the real gate, enforced server-side). `find-coach` and
  // `coach-detail` stay ungated — browsing coaches is open to guests, like
  // browsing courts and games.
  'coach-subscribe': 'player.profile.manage',
  'organizer-subscribe': 'player.profile.manage',
  'book-coach': 'player.bookings.create',
  'coach-bookings': 'coach.profile.manage',
  'coach-information': 'coach.profile.manage',
  'create-club': 'player.clubs.create',
  'edit-club': 'player.clubs.create',
  'club-post-edit': 'player.clubs.post',
  'club-chat': 'player.clubs.chat',
  'edit-profile': 'player.profile.manage',
  settings: 'player.profile.manage',
  'test-email': 'admin.access',
  notifications: 'user.notifications.manage',
  messages: 'user.messages.send',
  chat: 'user.messages.send',
  'game-chat': 'player.games.chat',
  'open-play-chat': 'player.games.chat',
  'tournament-chat': 'player.tournaments.chat',
  'invite-players': 'player.games.create',
  'owner-venues': 'owner.access',
  'owner-venue': 'owner.venues.manage',
  'owner-new-venue': 'owner.venues.create',
  'claim-venue': 'owner.venues.claim',
  // /owner/reports — the cross-venue revenue/KPI report. Owner-only: staff hold
  // owner.bookings.manage (they work the front desk, calendar, and per-venue
  // inbox) but must not see the owner's business-wide numbers.
  'owner-bookings': ['owner.reports.view', 'owner.analytics.view'],
  'owner-front-desk': 'owner.bookings.manage',
  'owner-manual-reservation': 'owner.bookings.manage',
  // /owner/pricing — the rates players are charged. Owner-only, same reasoning as
  // /owner/reports: staff run the courts, they don't set the business's prices.
  'owner-pricing': 'owner.pricing.manage',
  'owner-insights': 'owner.analytics.view',
  'owner-notifications': 'user.notifications.manage',
  'owner-staff': 'owner.staff.manage',
  'owner-settlements': 'owner.access',
  'owner-subscription-plans': 'owner.bookings.manage',
  'organizer-hub': 'organizer.access',
  'organizer-tournaments': 'organizer.tournaments.manage',
  'organizer-tournament': 'organizer.tournaments.manage',
  'organizer-tournament-new': 'organizer.tournaments.manage',
  'organizer-bracket': 'organizer.brackets.manage',
  // Organizers run events; owners run recurring play on their own courts (§5.3).
  'organizer-open-play': ['organizer.events.manage', 'owner.venues.manage'],
  'organizer-session': ['organizer.events.manage', 'owner.venues.manage'],
  'organizer-rosters': 'organizer.events.manage',
  'organizer-roster': 'organizer.events.manage',
  'organizer-venue-requests': 'organizer.tournaments.manage',
  'admin-claims': 'admin.moderation.manage',
  'admin-post-reports': 'admin.moderation.manage',
  'open-play-book': 'player.bookings.create',
  'owner-shop': 'owner.access',
  'owner-venues-v2': 'owner.access',
  'owner-calendar': 'owner.bookings.manage',
  'owner-partners': 'owner.access',
  'members': 'owner.access',
};

// Human-readable verb phrases for the guest auth prompt ("You'll need an
// account to <intent>"). Used when a guest hits a permission-gated screen.
const SCREEN_AUTH_INTENT: Partial<Record<ScreenId, string>> = {
  'create-game': 'create a game',
  'edit-game': 'edit your game',
  'my-games': 'see your games',
  'book-court': 'book a court',
  'my-bookings': 'see your bookings',
  'booking-refund': 'manage your booking',
  'payment-history': 'see your payment history',
  'coach-subscribe': 'become a coach',
  'organizer-subscribe': 'become an organizer',
  'coach-bookings': 'manage your coaching sessions',
  'coach-information': 'manage your coach information',
  'book-coach': 'book a coach',
  'create-club': 'start a club',
  'edit-club': 'edit your club',
  'club-post-edit': 'edit your post',
  'club-chat': 'chat with the club',
  'invite-players': 'invite players',
  'edit-profile': 'manage your profile',
  settings: 'manage your settings',
  'test-email': 'use the test email tool',
  notifications: 'see your notifications',
  messages: 'see your messages',
  chat: 'send a message',
  'game-chat': 'open the game chat',
  'open-play-chat': 'open the Open Play chat',
  'tournament-chat': 'open the tournament chat',
  'owner-venues': 'manage your venues',
  'owner-venue': 'manage your venue',
  'owner-new-venue': 'add a venue',
  'claim-venue': 'claim a venue',
  'owner-bookings': 'see your bookings',
  'owner-front-desk': 'run the front desk',
  'owner-manual-reservation': 'add a manual reservation',
  'owner-pricing': 'manage venue pricing',
  'owner-insights': 'see your insights',
  'owner-staff': 'manage your staff',
  'owner-settlements': 'see your settlements',
  'owner-subscription-plans': 'manage subscription plans',
  'admin-claims': 'review venue claims',
  'admin-post-reports': 'review reported posts',
  'open-play-book': 'join open play',
  'owner-shop': 'manage rental inventory',
  'owner-venues-v2': 'manage your venues',
  'owner-calendar': 'see your booking calendar',
  'owner-partners': 'manage your partners',
  'members': 'manage your members',
};

function isTabScreen(id: ScreenId): id is TabId {
  return (tabScreens as readonly string[]).includes(id);
}

export default function App() {
  return (
    <DemoStateProvider>
      <AppInner />
    </DemoStateProvider>
  );
}

// ── URL routing ─────────────────────────────────────────────────────────────
// The PWA is fully URL-routed: every screen has its own path (see
// `pathFromScreen`/`screenFromLocation` in navigation.ts), so the browser
// back/forward buttons, refresh, deep links and shareable URLs all just work.
// We drive the History API directly (no router library) and surface the current
// location through `useSyncExternalStore`, so React re-renders on every push,
// replace, and popstate. The rendered screen is derived purely from the URL —
// there is no in-memory screen/history state anymore.
const NAV_EVENT = 'pb:navigate';
// Once-per-session flag so the launch splash doesn't replay on every reload.
const SPLASH_KEY = 'pb-splash-seen';

const locationKey = () => window.location.pathname + window.location.search;

function subscribeLocation(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAV_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAV_EVENT, onChange);
  };
}

// In-app history depth, kept on `history.state` so it survives reload and is
// restored by the browser on back/forward. Lets `goBack` tell a deep-link
// cold-start (idx 0 → back should go to a sane parent, not off-site) from a
// screen we pushed (idx > 0 → just pop).
function historyIndex(): number {
  const s = window.history.state as { pbIdx?: number } | null;
  return typeof s?.pbIdx === 'number' ? s.pbIdx : 0;
}

// Push (or replace) a path and notify subscribers. Navigating to the path we're
// already on is a no-op so re-tapping a tab doesn't pile up history entries.
function routerNavigate(to: string, opts?: { replace?: boolean }) {
  if (to === locationKey()) return;
  const idx = historyIndex();
  if (opts?.replace) window.history.replaceState({ pbIdx: idx }, '', to);
  else window.history.pushState({ pbIdx: idx + 1 }, '', to);
  window.dispatchEvent(new Event(NAV_EVENT));
}

// Subscribe to the URL and resolve it to the active Screen.
function useCurrentScreen(): Screen {
  const key = useSyncExternalStore(subscribeLocation, locationKey, locationKey);
  return useMemo(() => {
    const q = key.indexOf('?');
    const pathname = q === -1 ? key : key.slice(0, q);
    const search = q === -1 ? '' : key.slice(q);
    return screenFromLocation(pathname, search);
  }, [key]);
}

// Which tab to highlight for a given screen — tab screens map to themselves;
// detail/flow screens map to the tab they belong under (purely cosmetic).
function tabForScreen(id: ScreenId): TabId {
  if (isTabScreen(id)) return id;
  if (id === 'court-details' || id === 'book-court' || id === 'open-play-book') return 'nearby';
  // Owner venue screens live under the "Venues" tab (which itself opens
  // /owner/venues), so keep it highlighted while managing/claiming a venue.
  if (id === 'owner-venues' || id === 'owner-venue' || id === 'owner-new-venue' || id === 'claim-venue' || id === 'owner-pricing' || id === 'owner-settlements' || id === 'owner-subscription-plans' || id === 'owner-venues-v2' || id === 'owner-calendar' || id === 'owner-partners' || id === 'owner-manual-reservation') return 'nearby';
  if (id === 'clubs' || id === 'friends' || id === 'club-details' || id === 'create-club' || id === 'edit-club' || id === 'club-post' || id === 'club-post-edit' || id === 'club-chat' || id === 'feed-post') return 'social';
  if (id === 'game-details' || id === 'open-play-detail' || id === 'game-chat' || id === 'open-play-chat' || id === 'create-game' || id === 'edit-game' || id === 'my-games' || id === 'invite-players') return 'games';
  if (id === 'tournament' || id === 'tournament-chat') return 'tournaments';
  if (id === 'chat') return 'messages';
  // Finding/booking a coach is a Home-tab journey (entered from the Home card);
  // subscribing + the coach's own inbox live under Profile, which is the fallthrough.
  if (id === 'find-coach' || id === 'coach-detail' || id === 'book-coach' || id === 'player-profile') return 'home';
  return 'profile';
}

function AppInner() {
  const { state: demoState } = useDemoState();
  useTheme();
  const currentUser = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const restoreSession = useAuthStore((s) => s.restore);
  const logout = useAuthStore((s) => s.logout);
  // Keep the unread-notification badge live while signed in (polls + refreshes
  // on focus/visibility); clears on logout.
  useNotificationPolling(isLoggedIn);
  // Keep the unread-message badge on the sidebar/tab-bar Messages button live.
  useMessagePolling(isLoggedIn);
  // Keeps the Social tab's pending friend-request badge live.
  useFriendRequestPolling(isLoggedIn);
  // Keep the "Invites" FAB badge (pending Open Play invites) live.
  useInvitePolling(isLoggedIn);
  const inviteCount = useInviteStore((s) => s.count);
  // Realtime push of new notifications + incoming messages over one SSE stream
  // (the 30s poll above stays as a fallback if the stream drops).
  useRealtimeStream(isLoggedIn);
  // A deep link (notification click / shared URL) opens the PWA at a path like
  // `/games/<id>`; resolve it to the initial screen, else cold-start on home so
  // guests can browse. Detail-screen deep links seed a Back target so the back
  // arrow returns somewhere sane instead of dead-ending.
  // The active screen is derived from the URL (single source of truth); the tab
  // to highlight and whether Back is available fall out of it. No screen/history
  // state — the browser owns history now.
  const screen = useCurrentScreen();
  const activeTab = tabForScreen(screen.id);
  // `owner-venues`/`owner-venues-v2` is the owner "Venues" tab destination (a tab
  // root), so it behaves like a tab screen for chrome (bottom nav shown, no forced back).
  const isTabRoot = isTabScreen(screen.id) || screen.id === 'owner-venues' || screen.id === 'owner-venues-v2';
  const canGoBack = !isTabRoot || historyIndex() > 0;
  // When set, the soft auth-gate sheet is shown; the string is the verb phrase
  // describing the action the guest tried to take ("join this game", …).
  const [authIntent, setAuthIntent] = useState<string | null>(null);
  // Animated launch splash — shown once per browser session on cold start, then
  // dismissed by the "Let's Play" CTA. The app mounts behind it (so session
  // restore etc. run during the intro); the splash just sits on top.
  const [showSplash, setShowSplash] = useState(() => {
    // Skip the splash on deep-link entry points (reset-password, forgot-password)
    // — the user clicked a link from an email, not a cold app launch.
    const path = window.location.pathname;
    if (path.startsWith('/reset-password') || path.startsWith('/forgot-password') || path.startsWith('/verify-email')) return false;
    // /plan-pdfs is a standalone public report viewer — no launch splash.
    if (path.startsWith('/plan-pdfs')) return false;
    try { return sessionStorage.getItem(SPLASH_KEY) !== '1'; } catch { return true; }
  });
  const dismissSplash = () => {
    try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch { /* private mode — splash just shows again next load */ }
    setShowSplash(false);
  };

  // Soft auth gate: returns true if the action may proceed, otherwise opens the
  // "create an account" sheet and returns false. Guests can browse freely — we
  // only gate the commit actions (join / create / find a match).
  const requireAuth = (intent: string): boolean => {
    if (isLoggedIn) return true;
    setAuthIntent(intent);
    return false;
  };

  const navigate = ((id: ScreenId, params?: Record<string, unknown>, opts?: { replace?: boolean }) => {
    if (!hasScreenPermission(currentUser, SCREEN_PERMISSIONS[id])) {
      // A guest hit a gated screen — prompt them to sign up instead of silently
      // dropping the tap. Logged-in users lacking the permission still no-op.
      if (!isLoggedIn) setAuthIntent(SCREEN_AUTH_INTENT[id] ?? 'do that');
      return;
    }
    // Drive the URL. `replace` swaps the current entry instead of pushing, so
    // backing out of the destination skips it — e.g. after creating a game, back
    // from the new game's details goes where the user started, not the form.
    routerNavigate(pathFromScreen({ id, params } as Screen), { replace: opts?.replace });
  }) as Navigate;

  const goBack = () => {
    // Real browser history: pop it when there's an in-app entry to return to.
    if (historyIndex() > 0) {
      window.history.back();
      return;
    }
    // Cold-start / deep-link landing (nothing to pop) — go to a sane parent
    // instead of stepping off the app entirely.
    routerNavigate(pathFromScreen(deepLinkParent(screen.id)), { replace: true });
  };

  const handleTabPress = (tab: TabId) => {
    // The "You" tab is personal — for guests it reads "Login" and goes straight
    // to the sign-in / join flow instead of opening the profile.
    if ((tab === 'profile' || tab === 'messages') && !isLoggedIn) {
      goToLogin();
      return;
    }
    // Owners' "Venues" tab lives under the owner console (/owner/venues/v2) — the
    // v2 venues screen (new design), not the legacy /nearby or /owner/venues one.
    if (isOwner && tab === 'nearby') {
      routerNavigate(pathFromScreen({ id: 'owner-venues-v2' }));
      return;
    }
    routerNavigate(pathFromScreen({ id: tab } as Screen));
  };

  // Tracks when session restore has settled, so the route guard below doesn't
  // bounce a logged-in user off a gated deep link before their token revalidates.
  const [restored, setRestored] = useState(false);

  // Restore a session on cold start: the store validates any stored token
  // against /me and rehydrates the user (incl. their `hasOnboarded` flag). A
  // stale/invalid token just falls back to guest browsing (tokens cleared).
  useEffect(() => {
    Promise.resolve(restoreSession()).finally(() => setRestored(true));
  }, [restoreSession]);

  // Seed the in-app history index on the first entry so back/forward can tell a
  // cold-start from a screen we pushed (see `historyIndex`/`goBack`). The URL is
  // left exactly as loaded — deep links and refresh land on the right screen.
  useEffect(() => {
    const s = window.history.state as { pbIdx?: number } | null;
    if (typeof s?.pbIdx !== 'number') {
      window.history.replaceState({ ...(s ?? {}), pbIdx: 0 }, '');
    }
  }, []);

  // Route guard for direct URL loads / browser-back into a gated screen: the
  // per-tap gate in `navigate` can't catch a hard navigation straight to a
  // permissioned path, so once restore settles, bounce a user who lacks the
  // required permission — guests to the login screen (so they can sign in),
  // signed-in-but-unauthorized users back to home.
  const screenId = screen.id;
  useEffect(() => {
    if (!restored) return;
    if (!hasScreenPermission(currentUser, SCREEN_PERMISSIONS[screenId])) {
      routerNavigate(isLoggedIn ? '/' : pathFromScreen({ id: 'login' }), { replace: true });
    }
  }, [restored, screenId, currentUser, isLoggedIn]);

  // Called by LoginScreen after the store's `login` action has set the user.
  // Only first-time users (who haven't onboarded on this account yet) see the
  // onboarding flow; everyone else lands straight on home. Read the freshly
  // logged-in user from the store — this render's `currentUser` is still stale.
  const handleLoginSuccess = () => {
    const user = useAuthStore.getState().user;
    // Replace so backing out of the destination doesn't return to the login form.
    routerNavigate(pathFromScreen({ id: user && !user.hasOnboarded ? 'onboarding' : 'home' }), { replace: true });
  };

  // Onboarding persists the `hasOnboarded` flag to the account itself (see
  // OnboardingScreen → completeOnboarding), so it's remembered across sessions.
  const handleOnboardingComplete = () => {
    routerNavigate('/', { replace: true });
  };

  const handleLogout = () => {
    // Store clears the user + tokens (best-effort server logout).
    logout();
    // Send the user to the login screen (not home/guest browsing). Replace so the
    // back arrow doesn't return to the now-stale signed-in screen.
    routerNavigate(pathFromScreen({ id: 'login' }), { replace: true });
  };

  // Enter the sign-in / sign-up flow from a guest screen. Pushed (not replaced)
  // so the back arrow returns to browsing. Also dismisses the auth sheet.
  const goToLogin = () => {
    setAuthIntent(null);
    routerNavigate(pathFromScreen({ id: 'login' }));
  };

  // v2.1 is the only player design, but it's player-side only: owners keep their
  // dedicated dashboards (Home/Nearby/Games) and the legacy v1 player screens for
  // Clubs/Profile/Settings/Create, so `playerV2` is simply "any non-owner".
  const isOwner = userHasPermission(currentUser, 'owner.access');
  // Organizing is now a player-plus SUBSCRIPTION, not a primary role: a player who
  // subscribes to the organizer plan stays a player (player Home tab + player
  // chrome) and reaches the Organizer Console from the Profile tab
  // (ProfileScreenV2 → 'organizer-hub'). So the subscription must NOT hijack the
  // app shell — an organizer subscriber is treated as a player here, never handed
  // the owner-style hub-as-home. Kept as a named flag (not inlined) so the intent
  // is explicit at every use site below.
  const isOrganizer = false;

  // A stored session is present but not yet validated: we hold a token, but the
  // user (and therefore the role) isn't known until `restore()`'s /me lands. A
  // cached session seeds `currentUser` synchronously (authStore), so this is only
  // true on a cold reload whose cached user is missing — never for a guest (no
  // token) and never once restore has settled. While true, the role-branched tab
  // roots below would render the guest/player screen and then swap to the
  // owner/organizer one when /me returns; hold a skeleton instead.
  const sessionPending = !restored && !currentUser && hasStoredSession();
  // v2.1 is the player design; owners get their dedicated dashboards, and
  // organizers get the owner-style chrome (bottom TabBar + desktop Sidebar)
  // instead of the player v2 flow.
  const playerV2 = !isOwner && !isOrganizer;
  // Tournaments are a player surface (browse + join/leave) — also for coaches and
  // organizers, who are players too. Owners and admins don't get the player
  // Tournament tab (organizers still manage tournaments from the organizer hub).
  const isAdmin = userHasPermission(currentUser, 'admin.access');
  // The standalone Tournament tab stays hidden, but tournament detail routes are
  // allowed because Games > Discover now uses tournaments as structured games.
  const canOpenTournaments = !isOwner && !isAdmin;
  const canSeeTournaments = false;
  // Staff are a delegated work account — they run the owner's courts, they don't
  // host games from the console. Role-based, not permission-based: staff hold the
  // player capabilities (player.games.create etc.) like every other role, so the
  // Create CTA can't be gated on a permission without taking it from players too.
  const isStaff = currentUser?.roles.includes('staff') ?? false;
  // Social (Clubs + Friends) is a PUBLIC surface — guests browse it holding no
  // permissions at all — so it can't hang off a permission without taking it from
  // guests and players too. Role-gated instead, like the Tournament tab.
  const canSeeSocial = !isStaff;
  // Desktop sidebar layout for admin/owner/organizer: the frame cap is lifted so
  // the app can grow past 1024 px, activating the existing @container queries
  // that swap the bottom tab bars for a fixed sidebar.
  const roleAttr = isAdmin ? 'admin' : isOwner ? 'owner' : isOrganizer ? 'organizer' : undefined;

  const handleCreate = () => {
    navigate('games', { section: 'open-play', view: 'discover' });
  };
  const handleHost = () => {
    navigate('nearby');
  };
  const handleInvites = () => {
    navigate('games', { section: 'open-play', view: 'invites' });
  };
  const canShowCreate = true;

  // `hideChrome` matters for the auth/onboarding surfaces, which run full-bleed.
  const hideChrome = ['landing', 'onboarding', 'login', 'forgot-password', 'reset-password', 'verify-email', 'plan-pdfs'].includes(screen.id);
  // Guests get the full chrome while browsing — that's how they roam the app.
  // In v2.1 the player screens supply their own top nav + bottom tab bar, so the
  // app's mobile TabBar (and the install prompt riding above it) are suppressed.
  const showTabBar = !hideChrome && isTabRoot && !playerV2;
  const showSidebar = !hideChrome;
  const frame = screen.id === 'landing' ? 'wide' : 'standard';

  // The chrome/handlers every v2 player screen needs (tab bar, FAB, auth gate,
  // and the universal header back button — bound to the app's absolute history).
  const v2Chrome: V2ScreenChrome = {
    activeTab, onNavigate: navigate, onTabPress: handleTabPress,
    onCreate: handleCreate, onHost: handleHost, onInvites: handleInvites, isLoggedIn, requireAuth,
    onBack: goBack, canGoBack, inviteCount,
    tabIds: (canSeeTournaments ? [...tabScreens] : tabScreens.filter((t) => t !== 'tournaments')).filter((t) => t !== 'messages'),
    suppressTabBar: isOrganizer,
  };

  const renderScreen = () => {
    // Auth + onboarding surfaces render full-bleed regardless of login state.
    if (screen.id === 'login') {
      return <LoginScreen onLoginSuccess={handleLoginSuccess} onBack={goBack} onNavigate={navigate} />;
    }
    if (screen.id === 'landing') {
      return <LandingScreen onGetStarted={goToLogin} onSignIn={goToLogin} />;
    }
    if (screen.id === 'onboarding') {
      return <OnboardingScreen onComplete={handleOnboardingComplete} />;
    }
    if (screen.id === 'forgot-password') {
      return <ForgotPasswordScreen onNavigate={navigate} onBack={goBack} />;
    }
    if (screen.id === 'reset-password') {
      return <ResetPasswordScreen onNavigate={navigate} onBack={goBack} token={screen.params.token} />;
    }
    if (screen.id === 'verify-email') {
      return <VerifyEmailScreen onNavigate={navigate} onBack={goBack} token={screen.params?.token} />;
    }

    // While a stored session is validating, the role isn't known yet — hold a
    // chrome-stable skeleton on the role-branched tab roots (home / nearby /
    // games) rather than briefly rendering the guest/player screen and then
    // swapping to the owner/organizer one (or re-running loads) when /me lands.
    if (sessionPending && (screen.id === 'home' || screen.id === 'nearby' || screen.id === 'games')) {
      if (screen.id === 'home') {
        return <V2Shell screen="v2-home" chrome={v2Chrome} hideBack><div className="page-content"><V2Skeleton variant="home-featured" /><V2Skeleton variant="home-discover" count={4} /></div></V2Shell>;
      }
      if (screen.id === 'nearby') {
        return <V2Shell screen="v2-nearby" chrome={v2Chrome}><div className="page-content"><V2Skeleton variant="court-list" count={5} /></div></V2Shell>;
      }
      return <V2Shell screen="v2-games" chrome={v2Chrome}><div className="page-content"><V2Skeleton variant="game-list" count={5} /></div></V2Shell>;
    }

    // Everything below is browsable as a guest; commit actions inside each
    // screen call back through `navigate`/`requireAuth` to trigger the gate.
    switch (screen.id) {
      case 'home':
        // Owners get their dashboard on the Home tab; everyone else — players and
        // organizer/coach subscribers alike — gets the v2.1 player home. The
        // Organizer Console lives on its own screen ('organizer-hub'), reached
        // from the Profile tab, so subscribing never displaces the Home tab.
        if (isOwner) return <OwnerHomeScreen onNavigate={navigate} />;
        return <HomeScreenV2 {...v2Chrome} />;
      case 'nearby':
        // Owners get a local market map (their venues vs nearby competitors);
        // players/guests get the normal discover-courts-near-me view.
        if (userHasPermission(currentUser, 'owner.market.view')) return <OwnerNearbyScreen onNavigate={navigate} />;
        return <NearbyScreenV2 {...v2Chrome} intent={screen.params?.intent} />;
      case 'games':
        // Owners get "Your courts" (games + bookings at their venues); players
        // get the normal browse/join games view.
        if (userHasPermission(currentUser, 'owner.games.view')) return <OwnerGamesScreen onNavigate={navigate} />;
        return <GamesScreenV2 {...v2Chrome} initialSection={screen.params?.section} initialView={screen.params?.view} />;
      case 'booking':
        // Owner "Bookings" tab (ownerTabs in TabBar/Sidebar → /booking) — the
        // cross-venue bookings + lobbies agenda ("Your courts", default
        // "Bookings" view). Only owners can reach this tab; a direct URL from a
        // non-owner falls back to their normal home.
        return isOwner
          ? <OwnerGamesScreen onNavigate={navigate} />
          : playerV2 ? <HomeScreenV2 {...v2Chrome} /> : <OwnerHomeScreen onNavigate={navigate} />;
      case 'tournaments':
        // Player-only surface; owners/admins don't get it (deep-link safety —
        // the tab is already hidden from their nav).
        if (!canOpenTournaments) return isOwner ? <OwnerHomeScreen onNavigate={navigate} /> : <HomeScreenV2 {...v2Chrome} />;
        return <TournamentsScreenV2 {...v2Chrome} />;
      case 'tournament':
        if (!canOpenTournaments) return isOwner ? <OwnerHomeScreen onNavigate={navigate} /> : <HomeScreenV2 {...v2Chrome} />;
        return <PlayerTournamentDetailScreen key={screen.params.id} tournamentId={screen.params.id} onNavigate={navigate} onBack={goBack} onRequireAuth={requireAuth} />;
      case 'tournament-chat':
        return <TournamentChatScreen key={screen.params.id} tournamentId={screen.params.id} name={screen.params.name} onBack={goBack} />;
      case 'social':
        // Deep-link safety — the tab is already hidden from staff nav, but the
        // URL still resolves, so the screen itself has to refuse.
        if (!canSeeSocial) return <OwnerHomeScreen onNavigate={navigate} />;
        return <SocialScreen chrome={v2Chrome} tab={screen.params?.tab} />;
      // `/clubs` and `/friends` are back-compat aliases onto the Social tab — they
      // resolve to the same screen, so they need the same gate or they're a hole.
      case 'clubs':
        if (!canSeeSocial) return <OwnerHomeScreen onNavigate={navigate} />;
        return <SocialScreen chrome={v2Chrome} tab="clubs" />;
      case 'profile':
        // Owners get their own profile dashboard; everyone else uses the v2 profile.
        if (isOwner) return <OwnerProfileScreen onNavigate={navigate} onLogout={handleLogout} />;
        return <ProfileScreenV2 {...v2Chrome} onLogout={handleLogout} />;
      case 'game-details':
        return <GameDetailsScreen key={screen.params.id} gameId={screen.params.id} onNavigate={navigate} onBack={goBack} onRequireAuth={requireAuth} />;
      case 'open-play-detail':
        return <OpenPlayDetailScreen key={`${screen.params.source}:${screen.params.id}`} source={screen.params.source} id={screen.params.id} chrome={v2Chrome} onBack={goBack} />;
      case 'court-details':
        return <CourtDetailsScreen key={screen.params.id} courtId={screen.params.id} intent={screen.params.intent} filterDate={screen.params.filterDate} filterStartHour={screen.params.filterStartHour} filterEndHour={screen.params.filterEndHour} onNavigate={navigate} onBack={goBack} />;
      case 'club-details':
        return <ClubDetailsScreen key={screen.params.id} clubId={screen.params.id} invited={screen.params.invited} onNavigate={navigate} onBack={goBack} />;
      case 'edit-club':
        return <EditClubScreen key={screen.params.id} clubId={screen.params.id} onBack={goBack} />;
      case 'club-post':
        return <ClubPostScreen key={`${screen.params.id}:${screen.params.postId}`} clubId={screen.params.id} postId={screen.params.postId} onNavigate={navigate} onBack={goBack} />;
      case 'club-post-edit':
        return <ClubPostEditScreen key={`${screen.params.id}:${screen.params.postId}:edit`} clubId={screen.params.id} postId={screen.params.postId} onBack={goBack} />;
      case 'feed-post':
        return <FeedPostScreen key={screen.params.postId} postId={screen.params.postId} onNavigate={navigate} onBack={goBack} />;
      case 'club-chat':
        return <ClubChatScreen key={screen.params.id} clubId={screen.params.id} name={screen.params.name} onNavigate={navigate} onBack={goBack} />;
      case 'create-game':
        return playerV2 ? <CreateGameV2 {...v2Chrome} bookingId={screen.params?.bookingId} onBack={goBack} /> : <CreateGameScreen onNavigate={navigate} onBack={goBack} />;
      case 'edit-game':
        return <CreateGameScreen key={screen.params.id} gameId={screen.params.id} onNavigate={navigate} onBack={goBack} />;
      case 'my-games':
        return <MyGamesScreen onNavigate={navigate} onBack={goBack} />;
      case 'book-court':
        return (
          <BookCourtScreen
            venueId={screen.params.venueId}
            date={screen.params.date}
            time={screen.params.time}
            hours={screen.params.hours}
            intent={screen.params.intent}
            onNavigate={navigate}
            onBack={goBack}
          />
        );
      case 'my-bookings':
        return <MyBookingsScreen onNavigate={navigate} onBack={goBack} />;
      case 'booking-refund':
        return <BookingRefundScreen bookingId={screen.params.bookingId} onNavigate={navigate} onBack={goBack} />;
      case 'payment-history':
        return <PaymentHistoryScreen onNavigate={navigate} onBack={goBack} />;
      case 'coach-subscribe':
        return <CoachSubscribeScreen onNavigate={navigate} onBack={goBack} />;
      case 'organizer-subscribe':
        return <CoachSubscribeScreen plan="organizer" onNavigate={navigate} onBack={goBack} />;
      case 'coach-bookings':
        return <CoachBookingsScreen onBack={goBack} />;
      case 'coach-information':
        return <CoachPricingScreen onNavigate={navigate} onBack={goBack} />;
      case 'find-coach':
        return <FindCoachScreen onNavigate={navigate} onBack={goBack} />;
      case 'coach-detail':
        return (
          <CoachDetailScreen
            key={screen.params.id}
            coachId={screen.params.id}
            onNavigate={navigate}
            onBack={goBack}
            onRequireAuth={requireAuth}
          />
        );
      case 'book-coach':
        return (
          <BookCoachScreen
            key={screen.params.id}
            coachId={screen.params.id}
            serviceId={screen.params.serviceId}
            onNavigate={navigate}
            onBack={goBack}
          />
        );
      case 'player-profile':
        return <PlayerProfileScreen key={screen.params.id} userId={screen.params.id} onNavigate={navigate} onBack={goBack} />;
      case 'create-club':
        return playerV2 ? <CreateClubV2 {...v2Chrome} onBack={goBack} /> : <CreateClubScreen onNavigate={navigate} onBack={goBack} />;
      case 'edit-profile':
        return <EditProfileScreen onBack={goBack} />;
      case 'settings':
        return playerV2
          ? <SettingsScreenV2 {...v2Chrome} onLogout={handleLogout} />
          : <SettingsScreen onBack={goBack} onLogout={handleLogout} onNavigate={navigate} />;
      case 'test-email':
        return <TestEmailScreen onBack={goBack} />;
      case 'search':
        return <SearchScreen onNavigate={navigate} onBack={goBack} />;
      case 'invite-players':
        return <InvitePlayersScreen key={screen.params.id} gameId={screen.params.id} onNavigate={navigate} onBack={goBack} />;
      case 'notifications':
        return <NotificationsScreen onNavigate={navigate} onBack={goBack} />;
      case 'friends':
        if (!canSeeSocial) return <OwnerHomeScreen onNavigate={navigate} />;
        return <SocialScreen chrome={v2Chrome} tab="friends" />;
      case 'messages':
        return <ConversationsScreen onNavigate={navigate} onBack={goBack} />;
      case 'chat':
        return <ChatScreen key={screen.params.id} conversationId={screen.params.id} name={screen.params.name} onBack={goBack} />;
      case 'game-chat':
        return <GameChatScreen key={screen.params.id} gameId={screen.params.id} name={screen.params.name} onBack={goBack} />;
      case 'open-play-chat':
        return <OpenPlayChatScreen key={screen.params.id} sessionId={screen.params.id} name={screen.params.name} onBack={goBack} />;
      case 'owner-venues':
        // The owner "Venues" tab (and Profile → "My venues"). Owners with
        // market-map access get the venues ops map + list (the screen the Nearby
        // slot used to render at /nearby); others get the plain venues list.
        if (userHasPermission(currentUser, 'owner.market.view')) return <OwnerNearbyScreen onNavigate={navigate} />;
        return <OwnerVenuesScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-venue':
        return <OwnerVenueScreen key={screen.params.id} venueId={screen.params.id} initialTab={screen.params.tab} onNavigate={navigate} onBack={goBack} />;
      case 'owner-new-venue':
        return <OwnerNewVenueScreen onNavigate={navigate} onBack={goBack} />;
      case 'claim-venue':
        return <ClaimVenueScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-bookings':
        return <OwnerBookingsScreen initialStatus={screen.params?.status as 'all' | 'pending_approval' | 'confirmed' | 'cancelled' | undefined} onNavigate={navigate} onBack={goBack} />;
      case 'owner-front-desk':
        return <OwnerFrontDeskScreen venueId={screen.params?.venueId} onNavigate={navigate} onBack={goBack} />;
      case 'owner-manual-reservation':
        return <OwnerManualReservationScreen venueId={screen.params?.venueId} onNavigate={navigate} onBack={goBack} />;
      case 'owner-pricing':
        return <OwnerPricingScreen onBack={goBack} onNavigate={navigate} />;
      case 'owner-insights':
        return <OwnerInsightsScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-notifications':
        return <NotificationsScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-staff':
        return <OwnerStaffScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-settlements':
        return <OwnerSettlementsScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-subscription-plans':
        return (
          <SubscriptionPlansScreen
            venueId={screen.params.venueId}
            venueName={screen.params.venueName ?? ''}
            onNavigate={navigate}
            onBack={goBack}
          />
        );
      case 'owner-shop':
        return <OwnerShopScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-venues-v2':
        return <OwnerVenuesScreenV2 onNavigate={navigate} onBack={goBack} />;
      case 'owner-calendar':
        return <OwnerCalendarScreen onNavigate={navigate} onBack={goBack} />;
      case 'owner-partners':
        return <OwnerPartnersScreen onNavigate={navigate} onBack={goBack} />;
      case 'members':
        return <MembersScreen onNavigate={navigate} onBack={goBack} />;
      case 'organizer-hub':
        return <OrganizerHubScreen onNavigate={navigate} onBack={goBack} />;
      case 'organizer-tournaments':
        return <TournamentsScreen onNavigate={navigate} onBack={goBack} />;
      case 'organizer-tournament-new':
        return <CreateTournamentScreen onNavigate={navigate} onBack={goBack} />;
      case 'organizer-tournament':
        return <TournamentDetailScreen key={screen.params.id} tournamentId={screen.params.id} onNavigate={navigate} onBack={goBack} />;
      case 'organizer-bracket':
        return <BracketScreen key={screen.params.tournamentId} tournamentId={screen.params.tournamentId} onBack={goBack} />;
      case 'organizer-open-play':
        return <OpenPlayScreen onNavigate={navigate} onBack={goBack} />;
      case 'organizer-session':
        return <SessionRosterScreen key={screen.params.id} sessionId={screen.params.id} onBack={goBack} />;
      case 'organizer-rosters':
        return <RostersScreen onNavigate={navigate} onBack={goBack} />;
      case 'organizer-roster':
        return <RosterDetailScreen key={screen.params.id} rosterId={screen.params.id} onBack={goBack} />;
      case 'organizer-venue-requests':
        return <VenueRequestsScreen tournamentId={screen.params?.tournamentId} onNavigate={navigate} onBack={goBack} />;
      case 'admin-claims':
        return <AdminClaimsScreen onNavigate={navigate} onBack={goBack} />;
      case 'admin-post-reports':
        return <AdminPostReportsScreen onNavigate={navigate} onBack={goBack} />;
      case 'open-play-book':
        return <OpenPlayBookScreen key={screen.params.venueId} venueId={screen.params.venueId} onNavigate={navigate} onBack={goBack} />;
      case 'plan-pdfs':
        return <PlanPdfsPage />;
      default:
        // Unknown screen id — fall back to the home tab (owner dashboard or
        // the v2.1 player home).
        return playerV2 ? <HomeScreenV2 {...v2Chrome} /> : <OwnerHomeScreen onNavigate={navigate} />;
    }
  };

  return (
    <div className="app" data-frame={frame} data-role={roleAttr}>
      {/* Offline banner */}
      <div className="fixed left-0 right-0 top-0 z-[9999] pt-[env(safe-area-inset-top)]">
        <OfflineBanner forceShow={demoState === 'offline'} />
      </div>

      {showSidebar && (
        <Sidebar activeTab={activeTab} onTabPress={handleTabPress} onCreate={handleCreate} canCreate={canShowCreate} showCreate={!isStaff && !isAdmin} isLoggedIn={isLoggedIn} onBack={goBack} canGoBack={canGoBack} onOpenMessages={() => navigate('messages')} onOpenPricing={() => navigate('owner-pricing')} pricingActive={screen.id === 'owner-pricing'} onOpenManualReservation={isOwner ? () => navigate('owner-manual-reservation', {}) : undefined} manualReservationActive={screen.id === 'owner-manual-reservation'} onOpenCalendar={isOwner ? () => navigate('owner-calendar') : undefined} calendarActive={screen.id === 'owner-calendar'} onOpenPartners={isOwner ? () => navigate('owner-partners') : undefined} partnersActive={screen.id === 'owner-partners'} onOpenShop={isOwner ? () => navigate('owner-shop') : undefined} shopActive={screen.id === 'owner-shop'} onOpenPostReports={userHasPermission(currentUser, 'admin.moderation.manage') ? () => navigate('admin-post-reports') : undefined} postReportsActive={screen.id === 'admin-post-reports'} onOpenClaims={userHasPermission(currentUser, 'admin.moderation.manage') ? () => navigate('admin-claims') : undefined} claimsActive={screen.id === 'admin-claims'} showTournaments={canSeeTournaments} showSocial={canSeeSocial} isOwner={isOwner} isOrganizer={isOrganizer} isAdmin={isAdmin} />
      )}

      <main className="app-main">
        {!hideChrome && isTabRoot && <VerifyEmailBanner onNavigate={navigate} />}
        <ErrorBoundary>{renderScreen()}</ErrorBoundary>
      </main>

      {showTabBar && (
        <TabBar activeTab={activeTab} onTabPress={handleTabPress} onCreate={handleCreate} canCreate={canShowCreate} isLoggedIn={isLoggedIn} isOwner={isOwner} isOrganizer={isOrganizer} showTournaments={canSeeTournaments} showSocial={canSeeSocial} isAdmin={isAdmin} />
      )}

      {/* Tab screens only: detail/wizard screens carry a sticky bottom CTA the
          banner would otherwise float over and intercept taps on. */}
      {showTabBar && <InstallPrompt hasBottomChrome />}

      <AuthPromptSheet
        open={authIntent !== null}
        intent={authIntent ?? ''}
        onClose={() => setAuthIntent(null)}
        onContinue={goToLogin}
      />

      <DemoStateControl />

      {/* Animated launch splash, on top of everything (waits for the CTA tap). */}
      {showSplash && <SplashScreen onDone={dismissSplash} auto />}
    </div>
  );
}
