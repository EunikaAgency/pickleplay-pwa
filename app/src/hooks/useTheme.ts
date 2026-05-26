import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'pickleballers:theme';

function readStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'light';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // localStorage may throw in private mode
  }
  return 'light';
}

function applyTheme(theme: ThemePreference) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  return { theme, setTheme };
}
