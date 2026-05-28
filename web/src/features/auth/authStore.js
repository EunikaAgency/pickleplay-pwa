import { create } from 'zustand';
import { apiGet, apiPost, apiImageUrl } from '../../shared/api/client.js';

const KEY_USER = 'pickleballer_user';
const KEY_TOKEN = 'pickleballer_access_token';
const KEY_REFRESH = 'pickleballer_refresh_token';

function readStored() {
  try {
    const raw = localStorage.getItem(KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist(user, accessToken, refreshToken) {
  try {
    if (user) localStorage.setItem(KEY_USER, JSON.stringify(user));
    else localStorage.removeItem(KEY_USER);
    if (accessToken) localStorage.setItem(KEY_TOKEN, accessToken);
    else localStorage.removeItem(KEY_TOKEN);
    if (refreshToken) localStorage.setItem(KEY_REFRESH, refreshToken);
    else localStorage.removeItem(KEY_REFRESH);
  } catch {
    /* localStorage unavailable — silently degrade */
  }
}

// Normalize the API's user document into the view-model the UI expects
// (Header reads `user.avatar`, `user.firstName`; the API returns `avatarUrl`).
function normalizeUser(u) {
  if (!u) return null;
  return {
    id: u.id || u._id,
    email: u.email,
    displayName: u.displayName,
    firstName: u.firstName || (u.displayName || '').split(' ')[0] || '',
    lastName: u.lastName || (u.displayName || '').split(' ').slice(1).join(' ') || '',
    avatar: apiImageUrl(u.avatarUrl) || '',
    avatarUrl: u.avatarUrl,
    phone: u.phone || '',
    skillLevel: u.skillLevel,
    skillLevelLabel: u.skillLevelLabel,
    skillLabel: u.skillLevelLabel || '',
    role: u.roleDefault || 'player',
    roleDefault: u.roleDefault || 'player',
    modePreference: u.modePreference,
    bio: u.bio || '',
    privacySetting: u.privacySetting,
    isVerified: !!u.isVerified,
    homeCityId: u.homeCityId,
    gcashNumber: u.gcashNumber,
  };
}

const useAuth = create((set, get) => ({
  user: normalizeUser(readStored()),
  isLoggedIn: !!localStorage.getItem(KEY_TOKEN),
  loading: false,
  error: null,

  async login(email, password) {
    set({ loading: true, error: null });
    try {
      const res = await apiPost('/api/v1/auth/login', { email, password });
      const { accessToken, refreshToken, user: rawUser } = res.data;
      const user = normalizeUser(rawUser);
      persist(user, accessToken, refreshToken);
      set({ user, isLoggedIn: true, loading: false, error: null });
      return user;
    } catch (e) {
      const msg = e.status === 401 ? 'Invalid email or password.' :
                  e.status === 429 ? 'Too many attempts — wait a minute and try again.' :
                  'Could not sign in. Try again in a moment.';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  async register({ email, password, displayName, firstName, lastName }) {
    set({ loading: true, error: null });
    try {
      const body = { email, password, displayName };
      if (firstName) body.firstName = firstName;
      if (lastName) body.lastName = lastName;
      const res = await apiPost('/api/v1/auth/register', body);
      const { accessToken, refreshToken, user: rawUser } = res.data;
      const user = normalizeUser(rawUser);
      persist(user, accessToken, refreshToken);
      set({ user, isLoggedIn: true, loading: false, error: null });
      return user;
    } catch (e) {
      const msg = e.status === 409 ? 'That email is already registered. Sign in instead.' :
                  e.status === 400 ? 'Check the form — some fields are invalid.' :
                  'Could not create your account. Try again in a moment.';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  logout() {
    persist(null, null, null);
    set({ user: null, isLoggedIn: false, error: null });
  },

  // Re-fetch the current user from the API (called on app boot if a token
  // exists). Quietly logs out if the token is no longer valid.
  async refreshMe() {
    if (!localStorage.getItem(KEY_TOKEN)) return null;
    try {
      const res = await apiGet('/api/v1/auth/me');
      const user = normalizeUser(res.data);
      persist(user, localStorage.getItem(KEY_TOKEN), localStorage.getItem(KEY_REFRESH));
      set({ user, isLoggedIn: true });
      return user;
    } catch (e) {
      if (e.status === 401) get().logout();
      return null;
    }
  },

  clearError() {
    set({ error: null });
  },
}));

export default useAuth;
