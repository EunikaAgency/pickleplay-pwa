import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import { requireAdmin } from '../admin/admin.controller.js';
import { listPermissions, listRoles, requireRoleAdmin, updateRole } from './roles.controller.js';

const rolesRoutes = new Hono();

// Roles are a fixed set — list + read the permission catalogue (admin.access),
// and edit a role's permissions (admin.settings.manage). No create/delete.
rolesRoutes.use('/*', requireAuth, requireAdmin);
rolesRoutes.get('/roles', listRoles);
rolesRoutes.get('/permissions', listPermissions);
rolesRoutes.patch('/roles/:key', requireRoleAdmin, updateRole);

export default rolesRoutes;
