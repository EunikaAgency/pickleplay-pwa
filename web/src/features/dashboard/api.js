import { apiGet, apiDelete } from '../../shared/api/client.js';

// All endpoints below require auth — the apiClient attaches the JWT
// transparently. UserLayout guarantees the user is logged in by the
// time these are called.

export async function fetchMyBookings({ limit = 100, signal } = {}) {
  const res = await apiGet(`/api/v1/bookings?limit=${limit}`, { signal });
  return res?.data || [];
}

export async function fetchMyFavorites({ signal } = {}) {
  const res = await apiGet('/api/v1/favorites?limit=200', { signal });
  return res?.data || [];
}

export async function removeFavorite(favoriteId) {
  await apiDelete(`/api/v1/favorites/${favoriteId}`);
}

export async function fetchMyPayments({ limit = 100, signal } = {}) {
  const res = await apiGet(`/api/v1/payments?limit=${limit}`, { signal });
  return res?.data || [];
}
