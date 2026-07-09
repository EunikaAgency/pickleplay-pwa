import { Hono } from 'hono';
import { getHealth, getHome, listEndpoints } from '../features/root/root.controller.js';
import authRoutes from '../features/auth/auth.routes.js';
import searchRoutes from '../features/search/search.routes.js';
import geoRoutes from '../features/geo/geo.routes.js';
import venuesRoutes from '../features/venues/venues.routes.js';
import coachesRoutes from '../features/coaches/coaches.routes.js';
import coachReviewsRoutes from '../features/coaches/coach-reviews.routes.js';
import coachApplicationsRoutes from '../features/coach-applications/coach-applications.routes.js';
import organizerApplicationsRoutes from '../features/organizer-applications/organizer-applications.routes.js';
import tournamentApplicationsRoutes from '../features/tournament-applications/tournament-applications.routes.js';
import partnersRoutes from '../features/partners/partners.routes.js';
import bookingsRoutes from '../features/bookings/bookings.routes.js';
import gamesRoutes from '../features/games/games.routes.js';
import clubsRoutes from '../features/clubs/clubs.routes.js';
import paymentsRoutes from '../features/payments/payments.routes.js';
import mediaRoutes from '../features/media/media.routes.js';
import subscriptionsRoutes from '../features/subscriptions/subscriptions.routes.js';
import citiesRoutes from '../features/cities/cities.routes.js';
import tagsRoutes from '../features/tags/tags.routes.js';
import adminRoutes from '../features/admin/admin.routes.js';
import rolesRoutes from '../features/roles/roles.routes.js';
import contentRoutes from '../features/content/content.routes.js';
import bracketsRoutes from '../features/brackets/brackets.routes.js';
import interactionsRoutes from '../features/interactions/interactions.routes.js';
import venueManagementRoutes from '../features/venues/venue-management.routes.js';
import tablesRoutes from '../features/tables/tables.routes.js';
import settingsRoutes from '../features/settings/settings.routes.js';
import rostersRoutes from '../features/rosters/rosters.routes.js';
import checkInsRoutes from '../features/check-ins/check-ins.routes.js';
import pushRoutes from '../features/push/push.routes.js';
import messagesRoutes from '../features/messages/messages.routes.js';
import staffRoutes from '../features/staff/staff.routes.js';
import demandRoutes from '../features/demand/demand.routes.js';
import rentalInventoryRoutes from '../features/rental-inventory/rental-inventory.routes.js';
import waitlistRoutes from '../features/waitlist/waitlist.routes.js';
import friendsRoutes from '../features/friends/friends.routes.js';

const routes = new Hono();

/* ─── Root Routes ──────────────────────────────────────────── */

routes.get('/health', getHealth);
routes.get('/', getHome);
routes.get('/lists', listEndpoints);

/* ─── API v1 ───────────────────────────────────────────────── */

const v1 = new Hono();
v1.route('/auth', authRoutes);
v1.route('/search', searchRoutes);
v1.route('/geocode', geoRoutes);
v1.route('/venues', venuesRoutes);
v1.route('/coaches', coachesRoutes);
v1.route('/coach-reviews', coachReviewsRoutes);
v1.route('/coach-applications', coachApplicationsRoutes);
v1.route('/organizer-applications', organizerApplicationsRoutes);
v1.route('/tournament-applications', tournamentApplicationsRoutes);
v1.route('/partners', partnersRoutes);
v1.route('/bookings', bookingsRoutes);
v1.route('/games', gamesRoutes);
v1.route('/clubs', clubsRoutes);
v1.route('/payments', paymentsRoutes);
v1.route('/settings', settingsRoutes);
v1.route('/rosters', rostersRoutes);
v1.route('/check-ins', checkInsRoutes);
v1.route('/push', pushRoutes);
v1.route('/messages', messagesRoutes);
v1.route('/staff', staffRoutes);
v1.route('/demand', demandRoutes);
v1.route('/rental-inventory', rentalInventoryRoutes);
v1.route('/waitlist', waitlistRoutes);
v1.route('/friends', friendsRoutes);
v1.route('/friends', friendsRoutes);
v1.route('/media', mediaRoutes);
v1.route('/subscriptions', subscriptionsRoutes);
v1.route('/cities', citiesRoutes);
v1.route('/tags', tagsRoutes);
v1.route('/admin', adminRoutes);
v1.route('/admin', rolesRoutes);
v1.route('/', contentRoutes);
v1.route('/', bracketsRoutes);
v1.route('/', interactionsRoutes);
v1.route('/', venueManagementRoutes);

const api = new Hono();
api.route('/v1', v1);
api.route('/tables', tablesRoutes);
routes.route('/api', api);

export default routes;
