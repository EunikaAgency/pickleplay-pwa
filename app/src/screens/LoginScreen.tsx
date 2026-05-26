import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Icon } from '../components/ui/Icon';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('alex@example.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  useEffect(() => {
    return () => {
      loadingRef.current = false;
    };
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    loadingRef.current = true;
    setTimeout(() => {
      if (!loadingRef.current) return;
      setLoading(false);
      onLoginSuccess();
    }, 600);
  };

  return (
    <div className="flex min-h-dvh w-full flex-col bg-background md:bg-surface-dim">
      <div className="flex flex-1 flex-col md:flex-row">
        {/* Desktop hero panel */}
        <div className="hidden md:flex md:w-[440px] lg:w-[520px] flex-col items-center justify-center bg-gradient-to-br from-primary via-primary-container to-primary/80 p-12 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.07]">
            <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-white" />
            <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-white" />
          </div>
          <div className="relative z-10 text-center text-on-primary">
            <Icon name="sports_tennis" size={80} filled className="mx-auto mb-6 opacity-95" />
            <h1 className="font-heading text-headline-xl font-bold mb-3">PickleBaller</h1>
            {/* <p className="text-body-lg opacity-85 italic">Enter the Kitchen.</p> */}
          </div>
        </div>

        {/* Form panel */}
        <main className="flex flex-1 flex-col justify-center px-5 py-8 md:py-12 mx-auto w-full max-w-sm md:max-w-md">
          {/* Mobile brand header */}
          <div className="mb-8 md:hidden text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Icon name="sports_tennis" size={36} filled className="text-primary" />
              <h2 className="font-heading text-headline-md font-bold text-primary">PickleBaller</h2>
            </div>
            {/* <p className="text-body-md italic text-on-surface-variant">Enter the Kitchen.</p> */}
          </div>

          {/* Login Card */}
          <div
            className="w-full rounded-[14px] bg-surface-container-lowest p-6 md:p-8 border border-surface-variant/30"
            style={{ boxShadow: '0 10px 30px -10px rgba(0, 64, 224, 0.15)' }}
          >
            <div className="mb-6 md:mb-8">
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
                    className="w-full h-12 pl-12 pr-4 bg-surface-container-low border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md"
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
                    className="w-full h-12 pl-12 pr-12 bg-surface-container-low border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md"
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
            <div className="relative my-6 md:my-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant" /></div>
              <div className="relative flex justify-center text-label-sm">
                <span className="bg-surface-container-lowest px-4 text-on-surface-variant font-bold">OR</span>
              </div>
            </div>

            {/* Social buttons */}
            <div className="flex gap-4 justify-center">
              <button aria-label="Continue with Google" className="w-14 h-14 rounded-full border border-outline-variant flex items-center justify-center hover:bg-surface-container-low transition-colors active:scale-95">
                <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.49 12.27c0-.78-.07-1.53-.2-2.27H12v4.31h6.47a5.54 5.54 0 0 1-2.4 3.63v2.96h3.9c2.28-2.1 3.52-5.2 3.52-8.63z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.9-2.96c-1.08.72-2.45 1.14-4.05 1.14-3.12 0-5.77-2.1-6.72-4.94H1.25v3.05A12 12 0 0 0 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.34A7.2 7.2 0 0 1 4.9 12c0-.81.14-1.6.38-2.34V6.61H1.25A12 12 0 0 0 0 12c0 1.94.45 3.77 1.25 5.39l4.03-3.05z" />
                  <path fill="#EA4335" d="M12 4.72c1.76 0 3.34.6 4.59 1.79l3.45-3.45A11.55 11.55 0 0 0 12 0 12 12 0 0 0 1.25 6.61l4.03 3.05C6.23 6.82 8.88 4.72 12 4.72z" />
                </svg>
              </button>
              <button className="w-14 h-14 rounded-full border border-outline-variant flex items-center justify-center hover:bg-surface-container-low transition-colors active:scale-95">
                <Icon name="ios" size={24} filled className="text-on-surface" />
              </button>
              <button className="w-14 h-14 rounded-full border border-outline-variant flex items-center justify-center hover:bg-surface-container-low transition-colors active:scale-95">
                <Icon name="social_leaderboard" size={24} filled className="text-[#1877F2]" />
              </button>
            </div>

            <div className="mt-6 md:mt-8 text-center">
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
    </div>
  );
}
