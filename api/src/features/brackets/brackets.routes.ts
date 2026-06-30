import { Hono } from 'hono';
import { requireAuth, optionalAuth } from '../../shared/middleware/auth.js';
import {
  listEntrants,
  buildEntrants,
  addEntrant,
  updateEntrant,
  removeEntrant,
  seedEntrants,
  generateBracketHandler,
  getBracket,
  deleteBracket,
  swapEntrants,
  submitMatchResult,
  clearMatchResult,
  getStandings,
} from './brackets.controller.js';

// Bracket + entrant management for a tournament. Mounted at the v1 root (like
// content), so all paths live under /tournaments/:id/… — write routes require
// organizer.brackets.manage (checked in the controller); reads are public for
// public tournaments. Static sub-paths are registered before the :entrantId
// matcher so they win.
const bracketsRoutes = new Hono();

bracketsRoutes.get('/tournaments/:id/entrants', optionalAuth, listEntrants);
bracketsRoutes.post('/tournaments/:id/entrants/build', requireAuth, buildEntrants);
bracketsRoutes.post('/tournaments/:id/entrants/seed', requireAuth, seedEntrants);
bracketsRoutes.post('/tournaments/:id/entrants', requireAuth, addEntrant);
bracketsRoutes.patch('/tournaments/:id/entrants/:entrantId', requireAuth, updateEntrant);
bracketsRoutes.delete('/tournaments/:id/entrants/:entrantId', requireAuth, removeEntrant);

bracketsRoutes.post('/tournaments/:id/bracket/swap', requireAuth, swapEntrants);
bracketsRoutes.post('/tournaments/:id/bracket', requireAuth, generateBracketHandler);
bracketsRoutes.get('/tournaments/:id/bracket', optionalAuth, getBracket);
bracketsRoutes.delete('/tournaments/:id/bracket', requireAuth, deleteBracket);

bracketsRoutes.get('/tournaments/:id/standings', optionalAuth, getStandings);
bracketsRoutes.post('/tournaments/:id/matches/:matchId/result', requireAuth, submitMatchResult);
bracketsRoutes.delete('/tournaments/:id/matches/:matchId/result', requireAuth, clearMatchResult);

export default bracketsRoutes;
