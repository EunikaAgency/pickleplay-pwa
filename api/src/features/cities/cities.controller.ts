import { City } from './cities.model.js';

export async function listCities(c: any) {
  const rows = await City.find({ isActive: true }).sort({ name: 1 }).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}
