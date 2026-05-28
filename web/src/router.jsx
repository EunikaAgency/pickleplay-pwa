import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';

// Layouts + guards stay eager — they wrap every route and changing them
// shouldn't show a flash of "Loading…".
import RootLayout from './shared/layouts/RootLayout.jsx';
import UserLayout from './features/dashboard/UserLayout.jsx';
import AdminLayout from './features/admin/AdminLayout.jsx';
import RequireRole from './features/auth/RequireRole.jsx';
import MyRedirect from './features/dashboard/MyRedirect.jsx';

// Every leaf route lazy-loads so the initial bundle stays small. Vite
// emits one chunk per dynamic import; the loaders are tree-shakable.
const HomePage = lazy(() => import('./features/marketing/HomePage.jsx'));
const NotFoundPage = lazy(() => import('./features/marketing/NotFoundPage.jsx'));
const LoginPage = lazy(() => import('./features/auth/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./features/auth/RegisterPage.jsx'));
const VenuesPage = lazy(() => import('./features/venues/VenuesPage.jsx'));
const VenueDetailPage = lazy(() => import('./features/venues/VenueDetailPage.jsx'));
const BookingPage = lazy(() => import('./features/venues/BookingPage.jsx'));
const SearchPage = lazy(() => import('./features/venues/SearchPage.jsx'));
const CheckoutPage = lazy(() => import('./features/venues/CheckoutPage.jsx'));
const CityPage = lazy(() => import('./features/venues/CityPage.jsx'));
const ClubsPage = lazy(() => import('./features/clubs/ClubsPage.jsx'));
const ClubDetailPage = lazy(() => import('./features/clubs/ClubDetailPage.jsx'));
const CreateClubPage = lazy(() => import('./features/clubs/CreateClubPage.jsx'));
const CommunityPage = lazy(() => import('./features/clubs/CommunityPage.jsx'));
const OpenPlayPage = lazy(() => import('./features/games/OpenPlayPage.jsx'));
const OpenPlayDetailPage = lazy(() => import('./features/games/OpenPlayDetailPage.jsx'));
const CreateGamePage = lazy(() => import('./features/games/CreateGamePage.jsx'));
const LeaguesPage = lazy(() => import('./features/games/LeaguesPage.jsx'));
const TournamentsPage = lazy(() => import('./features/games/TournamentsPage.jsx'));
const CoachesPage = lazy(() => import('./features/coaches/CoachesPage.jsx'));
const DownloadPage = lazy(() => import('./features/marketing/DownloadPage.jsx'));
const PricingPage = lazy(() => import('./features/marketing/PricingPage.jsx'));
const LearnPage = lazy(() => import('./features/marketing/LearnPage.jsx'));
const NewsPage = lazy(() => import('./features/marketing/NewsPage.jsx'));
const AboutPage = lazy(() => import('./features/marketing/AboutPage.jsx'));
const RoadmapPage = lazy(() => import('./features/marketing/RoadmapPage.jsx'));

const MyBookingsPage = lazy(() => import('./features/dashboard/MyBookingsPage.jsx'));
const MyGamesPage = lazy(() => import('./features/dashboard/MyGamesPage.jsx'));
const MyEventsPage = lazy(() => import('./features/dashboard/MyEventsPage.jsx'));
const MyPaymentsPage = lazy(() => import('./features/dashboard/MyPaymentsPage.jsx'));
const MyMembershipPage = lazy(() => import('./features/dashboard/MyMembershipPage.jsx'));
const MyWaitlistsPage = lazy(() => import('./features/dashboard/MyWaitlistsPage.jsx'));
const MyFavoritesPage = lazy(() => import('./features/dashboard/MyFavoritesPage.jsx'));
const MyGroupsPage = lazy(() => import('./features/dashboard/MyGroupsPage.jsx'));
const MyProfilePage = lazy(() => import('./features/dashboard/MyProfilePage.jsx'));
const MySettingsPage = lazy(() => import('./features/dashboard/MySettingsPage.jsx'));

const AdminOverviewPage = lazy(() => import('./features/admin/AdminOverviewPage.jsx'));
const AdminUsersPage = lazy(() => import('./features/admin/AdminUsersPage.jsx'));
const AdminVenuesPage = lazy(() => import('./features/admin/AdminVenuesPage.jsx'));
const AdminCoachesPage = lazy(() => import('./features/admin/AdminCoachesPage.jsx'));
const AdminBookingsPage = lazy(() => import('./features/admin/AdminBookingsPage.jsx'));
const AdminGamesPage = lazy(() => import('./features/admin/AdminGamesPage.jsx'));
const AdminAnalyticsPage = lazy(() => import('./features/admin/AdminAnalyticsPage.jsx'));
const ModerationDashboardPage = lazy(() => import('./features/admin/ModerationDashboardPage.jsx'));
const ReviewQueuePage = lazy(() => import('./features/admin/ReviewQueuePage.jsx'));
const ReviewReportsPage = lazy(() => import('./features/admin/ReviewReportsPage.jsx'));
const ClaimsQueuePage = lazy(() => import('./features/admin/ClaimsQueuePage.jsx'));
const SuggestedEditsPage = lazy(() => import('./features/admin/SuggestedEditsPage.jsx'));

// Fallback shown while a lazy chunk is loading. Kept intentionally bland
// so it works in any layout (sidebar, tabs, marketing hero).
function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-on-surface-variant">
      Loading…
    </div>
  );
}

// Wraps a route element in <Suspense> so Vite's dynamic chunk loading
// has somewhere to render the fallback.
function L(element) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: L(<HomePage />) },
      { path: '/login', element: L(<LoginPage />) },
      { path: '/register', element: L(<RegisterPage />) },
      { path: '/venues', element: L(<VenuesPage />) },
      { path: '/venues/:slug/book', element: L(<BookingPage />) },
      { path: '/venues/:slug', element: L(<VenueDetailPage />) },
      { path: '/clubs', element: L(<ClubsPage />) },
      { path: '/clubs/:slug', element: L(<ClubDetailPage />) },
      { path: '/open-play', element: L(<OpenPlayPage />) },
      { path: '/open-play/:id', element: L(<OpenPlayDetailPage />) },
      { path: '/games/create', element: L(<CreateGamePage />) },
      { path: '/clubs/create', element: L(<CreateClubPage />) },
      { path: '/search', element: L(<SearchPage />) },
      { path: '/download', element: L(<DownloadPage />) },
      { path: '/city/:slug', element: L(<CityPage />) },
      { path: '/pricing', element: L(<PricingPage />) },
      { path: '/leagues', element: L(<LeaguesPage />) },
      { path: '/leagues/:id', element: L(<LeaguesPage />) },
      { path: '/tournaments', element: L(<TournamentsPage />) },
      { path: '/tournaments/:id', element: L(<TournamentsPage />) },
      { path: '/learn', element: L(<LearnPage />) },
      { path: '/community', element: L(<CommunityPage />) },
      { path: '/community/:id', element: L(<CommunityPage />) },
      { path: '/coaches', element: L(<CoachesPage />) },
      { path: '/news', element: L(<NewsPage />) },
      { path: '/about', element: L(<AboutPage />) },
      { path: '/roadmap', element: L(<RoadmapPage />) },
      { path: '/checkout', element: L(<CheckoutPage />) },
      { path: '/my', element: <MyRedirect /> },
      { path: '/my/*', element: <MyRedirect /> },
      { path: '*', element: L(<NotFoundPage />) },
    ],
  },
  {
    path: '/dashboard',
    element: <UserLayout />,
    children: [
      { path: 'bookings', element: L(<MyBookingsPage />) },
      { path: 'games', element: L(<MyGamesPage />) },
      { path: 'events', element: L(<MyEventsPage />) },
      { path: 'payments', element: L(<MyPaymentsPage />) },
      { path: 'membership', element: L(<MyMembershipPage />) },
      { path: 'waitlists', element: L(<MyWaitlistsPage />) },
      { path: 'favorites', element: L(<MyFavoritesPage />) },
      { path: 'groups', element: L(<MyGroupsPage />) },
      { path: 'profile', element: L(<MyProfilePage />) },
      { path: 'settings', element: L(<MySettingsPage />) },
    ],
  },
  {
    path: '/admin',
    element: <RequireRole role="admin"><AdminLayout /></RequireRole>,
    children: [
      { index: true, element: L(<AdminOverviewPage />) },
      { path: 'users', element: L(<AdminUsersPage />) },
      { path: 'venues', element: L(<AdminVenuesPage />) },
      { path: 'venues/:id/courts', element: L(<AdminVenuesPage />) },
      { path: 'venues/:id/bookings', element: L(<AdminVenuesPage />) },
      { path: 'coaches', element: L(<AdminCoachesPage />) },
      { path: 'bookings', element: L(<AdminBookingsPage />) },
      { path: 'games', element: L(<AdminGamesPage />) },
      { path: 'moderation', element: L(<ModerationDashboardPage />) },
      { path: 'moderation/reviews', element: L(<ReviewQueuePage />) },
      { path: 'moderation/review-reports', element: L(<ReviewReportsPage />) },
      { path: 'moderation/claims', element: L(<ClaimsQueuePage />) },
      { path: 'moderation/suggested-edits', element: L(<SuggestedEditsPage />) },
      { path: 'analytics', element: L(<AdminAnalyticsPage />) },
    ],
  },
]);

export default router;
