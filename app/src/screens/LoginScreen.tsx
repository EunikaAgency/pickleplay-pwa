import { useState, type FormEvent } from 'react';
import { Icon } from '../components/ui/Icon';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess();
    }, 600);
  };

  return (
    <div className="flex min-h-full flex-col bg-background">
      <main className="flex flex-1 flex-col justify-center px-5 py-12 mx-auto w-full max-w-md">
        {/* Mobile Header */}
        <div className="mb-10 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Icon name="sports_tennis" size={36} filled className="text-primary" />
            <h2 className="font-heading text-headline-md font-bold text-primary">PicklePlay</h2>
          </div>
          <p className="text-body-md italic text-on-surface-variant">Enter the Kitchen.</p>
        </div>

        {/* Login Card */}
        <div
          className="w-full rounded-[24px] bg-surface-container-lowest p-8 border border-surface-variant/30"
          style={{ boxShadow: '0 10px 30px -10px rgba(0, 64, 224, 0.15)' }}
        >
          <div className="mb-8">
            <h2 className="font-heading text-headline-lg-mobile text-on-surface mb-1">Welcome Back</h2>
            <p className="text-body-md text-on-surface-variant">Ready to hit the courts?</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">EMAIL ADDRESS</label>
              <div className="relative group">
                <Icon name="mail" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline transition-colors group-focus-within:text-primary" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full h-12 pl-12 pr-4 bg-surface-container-low border border-outline-variant rounded-[16px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="block text-label-sm text-on-surface-variant font-bold">PASSWORD</label>
                <a href="#" className="text-primary text-label-sm font-bold hover:underline">Forgot?</a>
              </div>
              <div className="relative group">
                <Icon name="lock" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline transition-colors group-focus-within:text-primary" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-12 pl-12 pr-12 bg-surface-container-low border border-outline-variant rounded-[16px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-12 bg-secondary-container text-on-secondary-container font-heading text-body-lg font-bold rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 hover:brightness-105 disabled:opacity-50"
              style={{ boxShadow: '0 10px 30px -10px rgba(0, 64, 224, 0.15)' }}
            >
              {loading ? (
                <>
                  <Icon name="sync" size={20} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <Icon name="arrow_forward" size={20} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant" /></div>
            <div className="relative flex justify-center text-label-sm">
              <span className="bg-surface-container-lowest px-4 text-on-surface-variant font-bold">OR CONTINUE WITH</span>
            </div>
          </div>

          {/* Social buttons */}
          <div className="flex gap-4 justify-center">
            <button className="w-14 h-14 rounded-full border border-outline-variant flex items-center justify-center hover:bg-surface-container-low transition-colors active:scale-95">
              <img alt="Google" className="w-6 h-6" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBYXhjvzgVvy8PmhEtel4UerRhEwSaXUhGM6UOOvB73q1CUuV-CrT7pix520ZmqsLiRoZhlfGHLweHCEY8LRAMcB6Wc-TE4QQXdiCSiYmXltthLb7vyvdthPsitUxYDJfBZ4pkCCtslMoqru8_RoTTELcjYAcI8UdWjIySj-BV3sP4sP4BYaSLPcb4UiKf4T4R3H1zRa6V5DM0UkWEciAU4oXASm4WiEfxiI8CSB0Xrvc5EQqi8EjNUUtEj0MADyzZO704-MEfA" />
            </button>
            <button className="w-14 h-14 rounded-full border border-outline-variant flex items-center justify-center hover:bg-surface-container-low transition-colors active:scale-95">
              <Icon name="ios" size={24} filled className="text-on-surface" />
            </button>
            <button className="w-14 h-14 rounded-full border border-outline-variant flex items-center justify-center hover:bg-surface-container-low transition-colors active:scale-95">
              <Icon name="social_leaderboard" size={24} filled className="text-[#1877F2]" />
            </button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-body-md text-on-surface-variant">
              New to the court?{' '}
              <a href="#" className="text-primary font-bold hover:underline ml-1">Join the league</a>
            </p>
          </div>
        </div>

        {/* Trust signals */}
        <div className="mt-8 flex items-center justify-center gap-6 opacity-60">
          <div className="flex items-center gap-1">
            <Icon name="verified_user" size={14} />
            <span className="text-label-sm font-bold">SECURE SSL</span>
          </div>
          <div className="flex items-center gap-1">
            <Icon name="groups" size={14} />
            <span className="text-label-sm font-bold">10K+ PLAYERS</span>
          </div>
        </div>
      </main>
    </div>
  );
}
