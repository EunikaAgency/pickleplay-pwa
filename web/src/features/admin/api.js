import { apiGet } from '../../shared/api/client.js';

// Admin doesn't fully wrap the API surface yet — most pages call the same
// public endpoints the rest of the app uses (venues, coaches, cities, …) but
// with admin auth + larger limits. Admin-only endpoints (/admin/users, the
// moderation queues) live here.

export async function fetchAdminUsers({ limit = 200, q = '', signal } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (q) params.set('q', q);
  const res = await apiGet(`/api/v1/admin/users?${params.toString()}`, { signal });
  return res?.data || [];
}

export async function fetchAdminDashboardSummary({ signal } = {}) {
  // Server endpoint may not exist; caller catches 404 + falls back to
  // client-side aggregation.
  const res = await apiGet('/api/v1/admin/dashboard', { signal });
  return res?.data || null;
}

export async function fetchTables({ signal } = {}) {
  const res = await apiGet('/api/tables/data', { signal });
  return res?.data || res || null;
}

export async function fetchAdminReviews({ limit = 100, status = 'pending_moderation', signal } = {}) {
  const params = new URLSearchParams({ limit: String(limit), status });
  const res = await apiGet(`/api/v1/admin/reviews?${params.toString()}`, { signal });
  return res?.data || [];
}

export async function fetchReviewReports({ limit = 100, signal } = {}) {
  const res = await apiGet(`/api/v1/admin/reports?limit=${limit}`, { signal });
  return res?.data || [];
}

export async function fetchClaims({ limit = 100, signal } = {}) {
  const res = await apiGet(`/api/v1/claims?limit=${limit}`, { signal });
  return res?.data || [];
}

export async function fetchSuggestedEdits({ limit = 100, signal } = {}) {
  const res = await apiGet(`/api/v1/suggested-edits?limit=${limit}`, { signal });
  return res?.data || [];
}

export async function fetchAdminBookings({ limit = 200, status, signal } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set('status', status);
  const res = await apiGet(`/api/v1/bookings?${params.toString()}`, { signal });
  return res?.data || [];
}
