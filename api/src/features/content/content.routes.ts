import { Hono } from 'hono';
import { requireAuth, optionalAuth } from '../../shared/middleware/auth.js';
import {
  listEvents, listOpenPlay, listPosts, listTournaments,
  createTournament, getMyTournaments, getTournament, updateTournament, cancelTournament,
  openTournamentRegistration, registerForTournament, withdrawFromTournament,
  getMyTournamentRegistration, getMyTournamentRegistrations, getTournamentRegistrations,
  createTournamentAnnouncement, listTournamentAnnouncements,
  listTournamentMessages, sendTournamentMessage,
  manageTournamentRegistration,
  createOpenPlaySeries, getMyOpenPlay, getMyOpenPlayRegistrations, getOpenPlaySession, cancelOpenPlaySeries, cancelOpenPlaySession,
  updateOpenPlaySeries, updateOpenPlaySession,
  joinOpenPlay, leaveOpenPlay, getOpenPlayRegistrations, manageOpenPlayRegistration,
} from './content.controller.js';

const contentRoutes = new Hono();

contentRoutes.get('/open-play', listOpenPlay);
// Recurring open play — organizers AND venue owners/staff, the latter scoped to the
// venues they manage (§5.3). Static segments before `:id` matchers.
contentRoutes.post('/open-play', requireAuth, createOpenPlaySeries);
contentRoutes.get('/open-play/mine', requireAuth, getMyOpenPlay);
contentRoutes.get('/open-play/registrations/mine', requireAuth, getMyOpenPlayRegistrations);
contentRoutes.get('/open-play/:id', optionalAuth, getOpenPlaySession);
// `/series/:id` before `/:id` — otherwise "series" is swallowed as a session id.
contentRoutes.patch('/open-play/series/:id/cancel', requireAuth, cancelOpenPlaySeries);
contentRoutes.patch('/open-play/series/:id', requireAuth, updateOpenPlaySeries);
contentRoutes.patch('/open-play/:id/cancel', requireAuth, cancelOpenPlaySession);
contentRoutes.patch('/open-play/:id', requireAuth, updateOpenPlaySession);
contentRoutes.get('/open-play/:id/registrations', requireAuth, getOpenPlayRegistrations);
contentRoutes.patch('/open-play/:id/registrations/:regId', requireAuth, manageOpenPlayRegistration);
contentRoutes.post('/open-play/:id/join', requireAuth, joinOpenPlay);
contentRoutes.post('/open-play/:id/leave', requireAuth, leaveOpenPlay);
contentRoutes.get('/tournaments', listTournaments);
// Organizer tournament management. `/mine` must precede the `/:id` matcher.
contentRoutes.post('/tournaments', requireAuth, createTournament);
contentRoutes.get('/tournaments/mine', requireAuth, getMyTournaments);
// The current user's registrations across all tournaments. Static segments
// before the `/:id` matcher (else `registrations` reads as a tournament id).
contentRoutes.get('/tournaments/registrations/mine', requireAuth, getMyTournamentRegistrations);
contentRoutes.get('/tournaments/:id', optionalAuth, getTournament);
contentRoutes.patch('/tournaments/:id', requireAuth, updateTournament);
contentRoutes.patch('/tournaments/:id/cancel', requireAuth, cancelTournament);
contentRoutes.patch('/tournaments/:id/open-registration', requireAuth, openTournamentRegistration);
// Player registration + participant list.
contentRoutes.post('/tournaments/:id/register', requireAuth, registerForTournament);
contentRoutes.post('/tournaments/:id/withdraw', requireAuth, withdrawFromTournament);
contentRoutes.get('/tournaments/:id/my-registration', optionalAuth, getMyTournamentRegistration);
contentRoutes.get('/tournaments/:id/registrations', requireAuth, getTournamentRegistrations);
// Organizer manages a registration: check-in attendance, approve/decline.
contentRoutes.patch('/tournaments/:id/registrations/:regId', requireAuth, manageTournamentRegistration);
// Organizer announcements: broadcast to participants (host) + read the feed (anyone).
contentRoutes.get('/tournaments/:id/announcements', optionalAuth, listTournamentAnnouncements);
contentRoutes.post('/tournaments/:id/announcements', requireAuth, createTournamentAnnouncement);
// Participant group chat (roster: organizer + registrants). Read = roster; post = player.tournaments.chat.
contentRoutes.get('/tournaments/:id/messages', requireAuth, listTournamentMessages);
contentRoutes.post('/tournaments/:id/messages', requireAuth, sendTournamentMessage);
contentRoutes.get('/events', listEvents);
contentRoutes.get('/posts', listPosts);

export default contentRoutes;
