import { Hono } from 'hono';
import { listTags } from './tags.controller.js';

const tagsRoutes = new Hono();

tagsRoutes.get('/', listTags);

export default tagsRoutes;
