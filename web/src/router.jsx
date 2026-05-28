import { createBrowserRouter } from 'react-router-dom';
import RootLayout from './layouts/RootLayout.jsx';
import UserLayout from './layouts/UserLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import HomePage from './pages/HomePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import VenuesPage from './pages/VenuesPage.jsx';
import VenueDetailPage from './pages/VenueDetailPage.jsx';
import ClubsPage from './pages/ClubsPage.jsx';
import ClubDetailPage from './pages/ClubDetailPage.jsx';
import OpenPlayPage from './pages/OpenPlayPage.jsx';
import OpenPlayDetailPage from './pages/OpenPlayDetailPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import DownloadPage from './pages/DownloadPage.jsx';
import MyBookingsPage from './pages/MyBookingsPage.jsx';
import MyGamesPage from './pages/MyGamesPage.jsx';
import MyProfilePage from './pages/MyProfilePage.jsx';
import MySettingsPage from './pages/MySettingsPage.jsx';
import MyFavoritesPage from './pages/MyFavoritesPage.jsx';
import MyGroupsPage from './pages/MyGroupsPage.jsx';
import MyWaitlistsPage from './pages/MyWaitlistsPage.jsx';
import MyPaymentsPage from './pages/MyPaymentsPage.jsx';
import MyEventsPage from './pages/MyEventsPage.jsx';
import MyMembershipPage from './pages/MyMembershipPage.jsx';
import BookingPage from './pages/BookingPage.jsx';
import LeaguesPage from './pages/LeaguesPage.jsx';
import TournamentsPage from './pages/TournamentsPage.jsx';
import PricingPage from './pages/PricingPage.jsx';
import LearnPage from './pages/LearnPage.jsx';
import CommunityPage from './pages/CommunityPage.jsx';
import CoachesPage from './pages/CoachesPage.jsx';
import NewsPage from './pages/NewsPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import RoadmapPage from './pages/RoadmapPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import CreateGamePage from './pages/CreateGamePage.jsx';
import CreateClubPage from './pages/CreateClubPage.jsx';
import CityPage from './pages/CityPage.jsx';
import AdminVenuesPage from './pages/AdminVenuesPage.jsx';
import AdminUsersPage from './pages/AdminUsersPage.jsx';
import AdminGamesPage from './pages/AdminGamesPage.jsx';
import AdminAnalyticsPage from './pages/AdminAnalyticsPage.jsx';

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
