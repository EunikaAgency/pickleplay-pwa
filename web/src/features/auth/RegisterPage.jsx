import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../auth/authStore.js';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const login = useAuth(s => s.login);

  const handleSubmit = e => {
    e.preventDefault();
    login(email || `${name.toLowerCase().replace(/\s/g, '.')}@pickleballer.xyz`);
    navigate('/my/profile');
  };

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

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Full Name</label>
              <input type="text" placeholder="Alex Player" value={name} onChange={e => setName(e.target.value)}
                className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
            </div>
            <div>
              <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Email</label>
              <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
                className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
            </div>
            <div>
              <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Password</label>
              <input type="password" placeholder="Min 8 characters"
                className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
            </div>
            <button type="submit" className="h-14 w-full rounded-2xl bg-[#C1F100] text-base font-extrabold text-[#374D00] shadow-lg hover:scale-105 active:scale-95 transition-transform">
              Create Account
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
