import { Hono } from 'hono';
import { listCities } from './cities.controller.js';

const citiesRoutes = new Hono();

citiesRoutes.get('/', listCities);

export default citiesRoutes;
