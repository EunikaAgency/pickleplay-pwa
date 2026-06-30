import { Hono } from 'hono';
import { requireAuth, optionalAuth } from '../../shared/middleware/auth.js';
import { checkIn, checkOut, getVenueCheckIns, getHotspot } from './check-ins.controller.js';

const checkInsRoutes = new Hono();

// Busiest venue right now (powers the home "who's playing" banner). Public.
checkInsRoutes.get('/hotspot', getHotspot);
// Who's checked in at a venue (?venueId=slug|_id); flags `checkedIn` when authed.
checkInsRoutes.get('/', optionalAuth, getVenueCheckIns);
// Check in / out (auth; check-in gated by player.venues.checkin in the controller).
checkInsRoutes.post('/', requireAuth, checkIn);
checkInsRoutes.delete('/', requireAuth, checkOut);

export default checkInsRoutes;
