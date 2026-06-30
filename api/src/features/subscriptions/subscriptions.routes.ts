import { Hono } from 'hono';
import { subscribe, unsubscribe } from './subscriptions.controller.js';

const subscriptionsRoutes = new Hono();

subscriptionsRoutes.post('/', subscribe);
subscriptionsRoutes.delete('/', unsubscribe);

export default subscriptionsRoutes;
