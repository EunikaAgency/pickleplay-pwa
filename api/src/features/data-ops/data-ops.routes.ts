import { Hono } from 'hono';
import { getDataJob, getDataStatus, seedData, truncateData } from './data-ops.controller.js';

// Mounted at /admin/data, so it inherits admin.routes.ts's
// `use('/*', requireAuth, requireAdmin)`. Each handler additionally requires
// `admin.settings.manage` — plain admin.access isn't enough to wipe the DB.
const dataOpsRoutes = new Hono();

dataOpsRoutes.get('/status', getDataStatus);
dataOpsRoutes.post('/seed', seedData);
dataOpsRoutes.post('/truncate', truncateData);
dataOpsRoutes.get('/jobs/:id', getDataJob);

export default dataOpsRoutes;
