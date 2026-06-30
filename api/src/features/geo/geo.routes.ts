import { Hono } from 'hono';
import { geocode, reverseGeocode, suggest } from './geo.controller.js';

const geoRoutes = new Hono();

// GET /api/v1/geocode?q=<address>&country=<iso2?>
geoRoutes.get('/', geocode);
// GET /api/v1/geocode/suggest?q=<partial>&country=<iso2?>&limit=<n?>  — type-ahead list
geoRoutes.get('/suggest', suggest);
// GET /api/v1/geocode/reverse?lat=<n>&lng=<n>
geoRoutes.get('/reverse', reverseGeocode);

export default geoRoutes;
