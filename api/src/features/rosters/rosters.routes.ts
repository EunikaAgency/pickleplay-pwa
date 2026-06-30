import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import {
  listRosters, createRoster, updateRoster, deleteRoster,
  addRosterMember, removeRosterMember,
} from './rosters.controller.js';

// Organizer reusable player lists. All writes are gated server-side by
// organizer.events.manage + ownership inside the controller.
const rostersRoutes = new Hono();

rostersRoutes.get('/', requireAuth, listRosters);
rostersRoutes.post('/', requireAuth, createRoster);
rostersRoutes.patch('/:id', requireAuth, updateRoster);
rostersRoutes.delete('/:id', requireAuth, deleteRoster);
rostersRoutes.post('/:id/members', requireAuth, addRosterMember);
rostersRoutes.delete('/:id/members/:memberId', requireAuth, removeRosterMember);

export default rostersRoutes;
