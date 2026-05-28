// Single fetch wrapper for the Pickleballers API.
// Reads VITE_API_URL when set; otherwise points at the production host.
// Add VITE_API_URL=http://localhost:9002 in a .env.local for dev.

const BASE_URL = (import.meta.env.VITE_API_URL || 'https://pickleballer-api.eunika.xyz').replace(/\/$/, '');

function authHeader() {
  try {
    const token = localStorage.getItem('pickleballer_access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request(method, path, { body, signal } = {}) {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeader(),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`API ${method} ${path} → ${res.status}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const apiGet = (path, opts) => request('GET', path, opts);
export const apiPost = (path, body, opts) => request('POST', path, { ...opts, body });
export const apiPatch = (path, body, opts) => request('PATCH', path, { ...opts, body });
export const apiDelete = (path, opts) => request('DELETE', path, opts);

// Convert image paths returned by the API (e.g. "/images/venues/foo/bar.jpg")
// into absolute URLs against the API host.
export function apiImageUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export { BASE_URL };
