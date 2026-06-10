// Auth/session store. Owns the current user + login state and wraps the auth
// API calls (api.ts) so screens can read `useAuthStore((s) => s.user)` directly
// instead of receiving the user through props.

import { create } from 'zustand';
import {
  ApiError,
  fetchCurrentUser,
  getStoredUser,
  hasStoredSession,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  updateMe,
  type ProfileUpdate,
  type RegisterPayload,
} from './api';
import type { AppUser } from './permissions';
import { refreshPushSubscription, unbindPushOnLogout } from './push';

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

  /** Create a new account (defaults to the player role) and sign in. Throws (ApiError) on failure. */
  register: (payload: RegisterPayload) => Promise<AppUser>;

  /**
   * Persist profile edits to the account (`PATCH /me`) and update the store so
   * the new values render everywhere immediately. Throws (ApiError) on failure
   * so the caller can surface it.
   */
  updateProfile: (patch: ProfileUpdate) => Promise<AppUser>;

  /**
   * Mark first-run onboarding as done on the account (so the user is never
   * re-onboarded), optionally saving the skill level they picked. Best-effort:
   * swallows errors so a transient failure never traps the user in onboarding.
   */
  completeOnboarding: (data?: { skillLevel?: number; skillLevelLabel?: string }) => Promise<void>;

  /** Best-effort server logout; always clears the local session. */
  logout: () => void;
}

// Seed synchronously from the cached session so a refresh renders the logged-in
// UI immediately (no flash to guest); `restore()` then revalidates against /me.
const cachedUser = getStoredUser();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: cachedUser,
  isLoggedIn: cachedUser !== null,

  restore: async () => {
    if (!hasStoredSession()) {
      // No token: make sure we aren't showing a stale optimistic user.
      set({ user: null, isLoggedIn: false });
      return false;
    }
    try {
      // fetchCurrentUser auto-refreshes a 15m-expired access token via the
      // stored refresh token (see rawRequest), so this only throws 401 when the
      // refresh token is *also* gone/expired — i.e. the session is truly over.
      const user = await fetchCurrentUser();
      set({ user, isLoggedIn: true });
      void refreshPushSubscription(); // re-bind this device's push to the restored user
      return true;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        // Genuinely unauthenticated — clear the session, fall back to guest.
        apiLogout();
        set({ user: null, isLoggedIn: false });
        return false;
      }
      // Network/server hiccup: keep the optimistic cached session rather than
      // logging the user out over a transient failure. Revalidates next time.
      return get().isLoggedIn;
    }
  },

  login: async (email, password) => {
    const user = await apiLogin(email, password);
    set({ user, isLoggedIn: true });
    void refreshPushSubscription(); // re-bind this device's push to the new user
    return user;
  },

  register: async (payload) => {
    const user = await apiRegister(payload);
    set({ user, isLoggedIn: true });
    return user;
  },

  updateProfile: async (patch) => {
    const user = await updateMe(patch);
    set({ user, isLoggedIn: true });
    return user;
  },

  completeOnboarding: async (data) => {
    const patch: ProfileUpdate = { hasOnboarded: true };
    if (data?.skillLevel != null) {
      patch.skillLevel = String(data.skillLevel);
      if (data.skillLevelLabel) patch.skillLevelLabel = data.skillLevelLabel;
    }
    try {
      const user = await updateMe(patch);
      set({ user, isLoggedIn: true });
    } catch {
      // Best-effort: don't block the user on a transient save failure — they'll
      // simply be asked to onboard again on a future login.
    }
  },

  logout: () => {
    unbindPushOnLogout(); // best-effort: drop this device's push before the token is cleared
    apiLogout();
    set({ user: null, isLoggedIn: false });
  },
}));
