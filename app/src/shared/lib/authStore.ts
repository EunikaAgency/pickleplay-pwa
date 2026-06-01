// Auth/session store. Owns the current user + login state and wraps the auth
// API calls (api.ts) so screens can read `useAuthStore((s) => s.user)` directly
// instead of receiving the user through props.

import { create } from 'zustand';
import {
  fetchCurrentUser,
  hasStoredSession,
  login as apiLogin,
  logout as apiLogout,
} from './api';
import type { AppUser } from './permissions';

interface AuthState {
  user: AppUser | null;
  isLoggedIn: boolean;

  /**
   * Validate a stored token on cold start and rehydrate the user. Resolves to
   * `true` if a session was restored, `false` otherwise (no token, or the token
   * was stale — in which case it's cleared). Safe to call once on mount.
   */
  restore: () => Promise<boolean>;

  /** Log in with credentials; stores tokens + user. Throws (ApiError) on failure. */
  login: (email: string, password: string) => Promise<AppUser>;

  /** Best-effort server logout; always clears the local session. */
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoggedIn: false,

  restore: async () => {
    if (!hasStoredSession()) return false;
    try {
      const user = await fetchCurrentUser();
      set({ user, isLoggedIn: true });
      return true;
    } catch {
      // Invalid/expired token — clear it so we fall back to guest browsing.
      apiLogout();
      set({ user: null, isLoggedIn: false });
      return false;
    }
  },

  login: async (email, password) => {
    const user = await apiLogin(email, password);
    set({ user, isLoggedIn: true });
    return user;
  },

  logout: () => {
    apiLogout();
    set({ user: null, isLoggedIn: false });
  },
}));
