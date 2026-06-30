import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import {
  submitTournamentApplication,
  getMyTournamentApplications,
  cancelTournamentApplication,
  getOwnerTournamentApplications,
  getVenueTournamentApplications,
  approveTournamentApplication,
  rejectTournamentApplication,
} from './tournament-applications.controller.js';

const tournamentApplicationsRoutes = new Hono();

/* ─── Organizer side ──────────────────────────────────────────────── */
tournamentApplicationsRoutes.post('/', requireAuth, submitTournamentApplication);
tournamentApplicationsRoutes.get('/mine', requireAuth, getMyTournamentApplications);
tournamentApplicationsRoutes.patch('/:id/cancel', requireAuth, cancelTournamentApplication);

/* ─── Owner side ──────────────────────────────────────────────────── */
tournamentApplicationsRoutes.get('/owner', requireAuth, getOwnerTournamentApplications);
tournamentApplicationsRoutes.get('/venue/:venueId', requireAuth, getVenueTournamentApplications);
tournamentApplicationsRoutes.patch('/:id/approve', requireAuth, approveTournamentApplication);
tournamentApplicationsRoutes.patch('/:id/reject', requireAuth, rejectTournamentApplication);

export default tournamentApplicationsRoutes;
