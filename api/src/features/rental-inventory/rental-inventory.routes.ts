import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import {
  listInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  archiveInventoryItem,
  getInventoryStats,
  exportInventoryCsv,
} from './rental-inventory.controller.js';

const r = new Hono();
r.use('*', requireAuth);

// Specific routes before parameterized ones to avoid conflicts
r.get('/stats', getInventoryStats);
r.get('/export/csv', exportInventoryCsv);
r.get('/', listInventory);
r.post('/', createInventoryItem);
r.get('/:id', getInventoryItem);
r.patch('/:id', updateInventoryItem);
r.delete('/:id', archiveInventoryItem);

export default r;
