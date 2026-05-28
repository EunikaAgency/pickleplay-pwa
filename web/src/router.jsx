import { createBrowserRouter } from 'react-router-dom';
import RootLayout from './shared/layouts/RootLayout.jsx';
import UserLayout from './features/my/UserLayout.jsx';
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
import MyBookingsPage from './features/my/MyBookingsPage.jsx';
import MyGamesPage from './features/my/MyGamesPage.jsx';
import MyProfilePage from './features/my/MyProfilePage.jsx';
import MySettingsPage from './features/my/MySettingsPage.jsx';
import MyFavoritesPage from './features/my/MyFavoritesPage.jsx';
import MyGroupsPage from './features/my/MyGroupsPage.jsx';
import MyWaitlistsPage from './features/my/MyWaitlistsPage.jsx';
import MyPaymentsPage from './features/my/MyPaymentsPage.jsx';
import MyEventsPage from './features/my/MyEventsPage.jsx';
import MyMembershipPage from './features/my/MyMembershipPage.jsx';
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
import AdminVenuesPage from './features/admin/AdminVenuesPage.jsx';
import AdminUsersPage from './features/admin/AdminUsersPage.jsx';
import AdminGamesPage from './features/admin/AdminGamesPage.jsx';
import AdminAnalyticsPage from './features/admin/AdminAnalyticsPage.jsx';

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
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/my',
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
    element: <AdminLayout />,
    children: [
      { path: 'venues', element: <AdminVenuesPage /> },
      { path: 'venues/:id/courts', element: <AdminVenuesPage /> },
      { path: 'venues/:id/bookings', element: <AdminVenuesPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'games', element: <AdminGamesPage /> },
      { path: 'clubs', element: <AdminVenuesPage /> },
      { path: 'content', element: <AdminVenuesPage /> },
      { path: 'reports', element: <AdminVenuesPage /> },
      { path: 'analytics', element: <AdminAnalyticsPage /> },
    ],
  },
]);

export default router;
