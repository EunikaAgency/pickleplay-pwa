import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import RootLayout from './shared/layouts/RootLayout.jsx';
import UserLayout from './features/dashboard/UserLayout.jsx';
import AdminLayout from './features/admin/AdminLayout.jsx';
import HomePage from './features/marketing/HomePage.jsx';
import NotFoundPage from './features/marketing/NotFoundPage.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import VenuesPage from './features/venues/VenuesPage.jsx';
import VenueDetailPage from './features/venues/VenueDetailPage.jsx';
import ClubsPage from './features/clubs/ClubsPage.jsx';
import ClubDetailPage from './features/clubs/ClubDetailPage.jsx';
import OpenPlayPage from './features/games/OpenPlayPage.jsx';
import OpenPlayDetailPage from './features/games/OpenPlayDetailPage.jsx';
import SearchPage from './features/venues/SearchPage.jsx';
import DownloadPage from './features/marketing/DownloadPage.jsx';
import MyBookingsPage from './features/dashboard/MyBookingsPage.jsx';
import MyGamesPage from './features/dashboard/MyGamesPage.jsx';
import MyProfilePage from './features/dashboard/MyProfilePage.jsx';
import MySettingsPage from './features/dashboard/MySettingsPage.jsx';
import MyFavoritesPage from './features/dashboard/MyFavoritesPage.jsx';
import MyGroupsPage from './features/dashboard/MyGroupsPage.jsx';
import MyWaitlistsPage from './features/dashboard/MyWaitlistsPage.jsx';
import MyPaymentsPage from './features/dashboard/MyPaymentsPage.jsx';
import MyEventsPage from './features/dashboard/MyEventsPage.jsx';
import MyMembershipPage from './features/dashboard/MyMembershipPage.jsx';
import BookingPage from './features/venues/BookingPage.jsx';
import LeaguesPage from './features/games/LeaguesPage.jsx';
import TournamentsPage from './features/games/TournamentsPage.jsx';
import PricingPage from './features/marketing/PricingPage.jsx';
import LearnPage from './features/marketing/LearnPage.jsx';
import CommunityPage from './features/clubs/CommunityPage.jsx';
import CoachesPage from './features/coaches/CoachesPage.jsx';
import NewsPage from './features/marketing/NewsPage.jsx';
import AboutPage from './features/marketing/AboutPage.jsx';
import CheckoutPage from './features/venues/CheckoutPage.jsx';
import RoadmapPage from './features/marketing/RoadmapPage.jsx';
import RegisterPage from './features/auth/RegisterPage.jsx';
import CreateGamePage from './features/games/CreateGamePage.jsx';
import CreateClubPage from './features/clubs/CreateClubPage.jsx';
import CityPage from './features/venues/CityPage.jsx';
import RequireRole from './features/auth/RequireRole.jsx';
import AdminOverviewPage from './features/admin/AdminOverviewPage.jsx';
import AdminVenuesPage from './features/admin/AdminVenuesPage.jsx';
import AdminUsersPage from './features/admin/AdminUsersPage.jsx';
import AdminGamesPage from './features/admin/AdminGamesPage.jsx';
import AdminAnalyticsPage from './features/admin/AdminAnalyticsPage.jsx';

// Legacy /my/* paths used to be the dashboard root before 2026-05-28.
// Forward them to /dashboard/* so existing bookmarks keep working.
function MyRedirect() {
  const params = useParams();
  const sub = params['*'] || '';
  return <Navigate to={`/dashboard${sub ? `/${sub}` : ''}`} replace />;
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/venues', element: <VenuesPage /> },
      { path: '/venues/:slug/book', element: <BookingPage /> },
      { path: '/venues/:slug', element: <VenueDetailPage /> },
      { path: '/clubs', element: <ClubsPage /> },
      { path: '/clubs/:slug', element: <ClubDetailPage /> },
      { path: '/open-play', element: <OpenPlayPage /> },
      { path: '/open-play/:id', element: <OpenPlayDetailPage /> },
      { path: '/games/create', element: <CreateGamePage /> },
      { path: '/clubs/create', element: <CreateClubPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/download', element: <DownloadPage /> },
      { path: '/city/:slug', element: <CityPage /> },
      { path: '/pricing', element: <PricingPage /> },
      { path: '/leagues', element: <LeaguesPage /> },
      { path: '/leagues/:id', element: <LeaguesPage /> },
      { path: '/tournaments', element: <TournamentsPage /> },
      { path: '/tournaments/:id', element: <TournamentsPage /> },
      { path: '/learn', element: <LearnPage /> },
      { path: '/community', element: <CommunityPage /> },
      { path: '/community/:id', element: <CommunityPage /> },
      { path: '/coaches', element: <CoachesPage /> },
      { path: '/news', element: <NewsPage /> },
      { path: '/about', element: <AboutPage /> },
      { path: '/roadmap', element: <RoadmapPage /> },
      { path: '/checkout', element: <CheckoutPage /> },
      { path: '/my', element: <MyRedirect /> },
      { path: '/my/*', element: <MyRedirect /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/dashboard',
    element: <UserLayout />,
    children: [
      { path: 'bookings', element: <MyBookingsPage /> },
      { path: 'games', element: <MyGamesPage /> },
      { path: 'events', element: <MyEventsPage /> },
      { path: 'payments', element: <MyPaymentsPage /> },
      { path: 'membership', element: <MyMembershipPage /> },
      { path: 'waitlists', element: <MyWaitlistsPage /> },
      { path: 'favorites', element: <MyFavoritesPage /> },
      { path: 'groups', element: <MyGroupsPage /> },
      { path: 'profile', element: <MyProfilePage /> },
      { path: 'settings', element: <MySettingsPage /> },
    ],
  },
  {
    path: '/admin',
    element: <RequireRole role="admin"><AdminLayout /></RequireRole>,
    children: [
      { index: true, element: <AdminOverviewPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'venues', element: <AdminVenuesPage /> },
      { path: 'venues/:id/courts', element: <AdminVenuesPage /> },
      { path: 'venues/:id/bookings', element: <AdminVenuesPage /> },
      { path: 'games', element: <AdminGamesPage /> },
      { path: 'analytics', element: <AdminAnalyticsPage /> },
    ],
  },
]);

export default router;
