import { useState, type FormEvent } from 'react';
import { Icon } from '../components/ui/Icon';
import { FormField } from '../components/forms/FormField';
import { useForm } from '../hooks/useForm';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onBack?: () => void;
}

export function LoginScreen({ onLoginSuccess, onBack }: LoginScreenProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initial: { email: 'alex@example.com', password: 'password123' },
    validators: {
      email: (v) =>
        !v ? 'Email is required.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string) ? 'Enter a valid email.' : undefined,
      password: (v) => (!v ? 'Password is required.' : (v as string).length < 6 ? 'At least 6 characters.' : undefined),
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.isValid) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess();
    }, 600);
  };

  return (
    <div
      className="scroll"
      style={{
        paddingTop: 'calc(28px + env(safe-area-inset-top))',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(900px 500px at 10% -10%, rgba(0,64,224,0.18), transparent 60%), radial-gradient(600px 400px at 100% 110%, rgba(193,241,0,0.25), transparent 60%), var(--bg)',
      }}
    >
      {onBack && (
        <div style={{ padding: '0 20px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--muted)',
            }}
          >
            <Icon name="back" size={14} />
            Back
          </button>
        </div>
      )}

      <div style={{ padding: '24px 20px 8px', textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: 'var(--lime)',
            color: 'var(--lime-ink)',
            margin: '0 auto 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-fab)',
          }}
        >
          <Icon name="paddle" size={32} />
        </div>
        <h1 className="hd-1" style={{ marginTop: 0 }}>PickleBallers</h1>
        <p className="t-sm" style={{ marginTop: 8 }}>Find games. Meet players. Play pickleball.</p>
      </div>

      <div
        style={{
          margin: '20px 16px 0',
          background: 'var(--surface)',
          border: '0.5px solid var(--hairline)',
          borderRadius: 24,
          padding: '20px 4px 12px',
          boxShadow: 'var(--shadow-pop)',
        }}
      >
        <div style={{ padding: '0 16px 14px' }}>
          <h2 className="hd-2">Welcome back</h2>
          <p className="t-sm" style={{ marginTop: 4 }}>Ready to hit the courts?</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <FormField
              label="Email"
              type="email"
              value={form.values.email}
              onChange={(e) => form.setField('email', e.target.value)}
              onBlur={() => form.setTouched('email')}
              placeholder="you@example.com"
              leadingIcon="mail"
              error={form.touched.email ? form.errors.email : undefined}
            />
          </div>

          <div className="field">
            <FormField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={form.values.password}
              onChange={(e) => form.setField('password', e.target.value)}
              onBlur={() => form.setTouched('password')}
              placeholder="••••••••"
              leadingIcon="lock"
              error={form.touched.password ? form.errors.password : undefined}
              trailingSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ color: 'var(--muted)' }}
                >
                  <Icon name={showPassword ? 'heart' : 'heart_o'} size={16} />
                </button>
              }
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 20px' }}>
            <a href="#" style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
              Forgot password?
            </a>
          </div>

          <button type="submit" className="btn-primary" disabled={loading || !form.isValid}>
            {loading ? (
              <>
                <span style={{ display: 'inline-flex', animation: 'spin 1s linear infinite' }}>
                  <Icon name="spinner" size={18} />
                </span>
                Signing in…
              </>
            ) : (
              <>
                Sign in <Icon name="forward" size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ padding: '20px 20px 12px', textAlign: 'center' }}>
          <p className="t-sm">
            New here?{' '}
            <a href="#" style={{ color: 'var(--primary)', fontWeight: 700 }}>
              Join the league
            </a>
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 18, opacity: 0.7 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
          <Icon name="shield" size={12} /> SECURE
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
          <Icon name="groups" size={12} /> 10K+ PLAYERS
        </span>
      </div>
    </div>
  );
}
