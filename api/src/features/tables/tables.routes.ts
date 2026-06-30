import { Hono } from 'hono';
import { getTablesData } from './tables.controller.js';

const tablesRoutes = new Hono();

tablesRoutes.get('/data', getTablesData);

export default tablesRoutes;
