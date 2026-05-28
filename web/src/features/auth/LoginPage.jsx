import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuth from './authStore.js';
import Icon from '../../shared/components/Icon.jsx';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuth(s => s.login);
  const loading = useAuth(s => s.loading);
  const error = useAuth(s => s.error);
  const clearError = useAuth(s => s.clearError);

  // Clear any leftover error from a previous visit when this page first mounts.
  useEffect(() => { clearError(); }, [clearError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const u = await login(email.trim(), password);
      const fallback =
        u?.role === 'admin' ? '/admin' :
        u?.modePreference === 'coach' ? '/coach' :
        u?.modePreference === 'owner' ? '/owner' :
        '/dashboard/profile';
      const next = location.state?.from || fallback;
      navigate(next, { replace: true });
    } catch {
      /* error already surfaced in store */
    }
  };

  return (
    <div>
      <section className="bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] px-5 py-10">
        <div className="mx-auto max-w-3xl flex items-center gap-8">
          <div className="flex-1 text-white">
            <h1 className="font-heading text-4xl font-extrabold">Welcome!</h1>
            <p className="mt-2 text-white/70">Find courts, join games, meet your pickle crew.</p>
          </div>
        </div>
      </section>
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-5 -mt-4">
      <div className="w-full rounded-3xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="text-5xl">🏓</div>
          <h1 className="mt-3 font-heading text-3xl font-extrabold text-on-surface">Welcome Back!</h1>
          <p className="mt-2 text-base text-on-surface-variant">Ready to hit the courts?</p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="login-email" className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Password</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low pl-4 pr-12 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                tabIndex={-1}
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              >
                <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-error-container px-4 py-3 text-base font-semibold text-on-error-container">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="h-14 w-full rounded-2xl bg-[#C1F100] text-base font-extrabold text-[#374D00] shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-60 disabled:hover:scale-100"
          >
            {loading ? 'Signing in…' : "Let's Go! 🎉"}
          </button>
        </form>

        <p className="mt-6 text-center text-base text-on-surface-variant">
          New here? <Link to="/register" className="font-extrabold text-primary no-underline hover:underline">Join the crew</Link>
        </p>
      </div>
      </div>
    </div>
  );
}
