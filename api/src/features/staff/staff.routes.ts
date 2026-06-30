import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import { createStaff, listStaff, updateStaff, removeStaff } from './staff.controller.js';

// Org-level staff accounts. All routes need a valid session; the per-handler
// guard then enforces owner.staff.manage (owners + admins) and ownership scope.
const staffRoutes = new Hono();

staffRoutes.get('/', requireAuth, listStaff);
staffRoutes.post('/', requireAuth, createStaff);
staffRoutes.patch('/:id', requireAuth, updateStaff);
staffRoutes.delete('/:id', requireAuth, removeStaff);

export default staffRoutes;
