import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from './authStore.js';
import Icon from '../../shared/components/Icon.jsx';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const register = useAuth(s => s.register);
  const loading = useAuth(s => s.loading);
  const error = useAuth(s => s.error);
  const clearError = useAuth(s => s.clearError);

  useEffect(() => { clearError(); }, [clearError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const displayName = name.trim();
    if (!displayName) return;
    const [firstName, ...rest] = displayName.split(/\s+/);
    const lastName = rest.join(' ');
    try {
      await register({
        email: email.trim(),
        password,
        displayName,
        firstName,
        lastName,
      });
      navigate('/dashboard/profile', { replace: true });
    } catch {
      /* error already surfaced in store */
    }
  };

  const passwordTooShort = password.length > 0 && password.length < 6;

  return (
    <div>
      <section className="bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] px-5 py-10">
        <div className="mx-auto max-w-3xl flex items-center gap-8">
          <div className="flex-1 text-white">
            <h1 className="font-heading text-4xl font-extrabold">Join the crew!</h1>
            <p className="mt-2 text-white/70">Create your free account and get on the court.</p>
          </div>
        </div>
      </section>

      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 -mt-4">
        <div className="w-full rounded-3xl bg-white p-8 shadow-xl">
          <div className="text-center">
            <div className="text-5xl">🤝</div>
            <h1 className="mt-3 font-heading text-3xl font-extrabold text-on-surface">Create Account</h1>
            <p className="mt-2 text-on-surface-variant">Grab your paddle and let's go!</p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="reg-name" className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Full Name</label>
              <input
                id="reg-name"
                type="text"
                autoComplete="name"
                required
                placeholder="Alex Player"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Email</label>
              <input
                id="reg-email"
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
              <label htmlFor="reg-password" className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Password</label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
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
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
                </button>
              </div>
              {passwordTooShort && (
                <p className="mt-1 text-base text-error">Use at least 6 characters.</p>
              )}
            </div>

            {error && (
              <div role="alert" className="rounded-xl bg-error-container px-4 py-3 text-base font-semibold text-on-error-container">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !name.trim() || !email || password.length < 6}
              className="h-14 w-full rounded-2xl bg-[#C1F100] text-base font-extrabold text-[#374D00] shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-60 disabled:hover:scale-100"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-on-surface-variant">
            Already have an account? <Link to="/login" className="font-extrabold text-primary no-underline hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
