import { useEffect, useRef } from 'react';
import './splash.css';

// Animated cold-start intro — a pickleball gets served into the PickleBallers
// wordmark, then ambient court art reveals behind it. Ported from the
// standalone `pickleballers-splash.html` mockup into a self-contained React
// component; all timing/markup mirror the original.
//
// `auto` controls how it ends:
//   • app  (auto=false) — waits for the user to tap "Let's Play".
//   • web  (auto=true)  — auto-dismisses a beat after the intro settles
//                         (the CTA still skips ahead if tapped).
// Either way it runs a circular "wipe" before calling `onDone`, which the host
// uses to swap the splash out for the real UI.

type Props = {
  onDone: () => void;
  /** Auto-dismiss after the intro instead of waiting for the CTA tap. */
  auto?: boolean;
  /** Spread the ambient art across the full viewport (web). */
  wide?: boolean;
};

const WIPE_MS = 850;

export function SplashScreen({ onDone, auto = false, wide = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const timers: number[] = [];
    const after = (ms: number, fn: () => void) => { timers.push(window.setTimeout(fn, ms)); };
    const q = <T extends Element>(sel: string) => root.querySelector(sel) as T | null;

    const reduceMotion = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

    const pickleball = q<HTMLElement>('.pickleball');
    const paddle = q<HTMLElement>('.paddle');
    const trail = q<HTMLElement>('.trail');
    const impactBurst = q<HTMLElement>('.impact-burst');
    const logoWrap = q<HTMLElement>('.logo-wrap');
    const footerStack = q<HTMLElement>('.footer-stack');
    const ctaBtn = q<HTMLButtonElement>('.cta-btn');
    const goOverlay = q<HTMLElement>('.go-overlay');
    const particleField = q<HTMLElement>('.particle-field');
    const wordPickle = q<HTMLElement>('.word-pickle');
    const wordBallers = q<HTMLElement>('.word-ballers');

    function buildLetters(container: HTMLElement | null, text: string, baseDelay: number, stepDelay: number) {
      if (!container) return;
      container.innerHTML = '';
      for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span');
        span.className = 'letter';
        span.textContent = text[i] === ' ' ? ' ' : text[i];
        span.style.animationDelay = `${baseDelay + i * stepDelay}ms`;
        container.appendChild(span);
      }
    }

    function buildSparks() {
      if (!impactBurst) return;
      impactBurst.querySelectorAll('.spark').forEach((s) => s.remove());
      const colors = ['#3557FF', '#C8F12C', '#20243A'];
      for (let i = 0; i < 10; i++) {
        const ang = ((Math.PI * 2) / 10) * i + Math.random() * 0.3;
        const dist = 34 + Math.random() * 22;
        const s = document.createElement('div');
        s.className = 'spark';
        s.style.background = colors[i % colors.length];
        s.style.setProperty('--tx', `${(Math.cos(ang) * dist).toFixed(1)}px`);
        s.style.setProperty('--ty', `${(Math.sin(ang) * dist).toFixed(1)}px`);
        s.style.animationDelay = `${Math.random() * 40}ms`;
        impactBurst.appendChild(s);
      }
    }

    function buildParticles() {
      if (!particleField) return;
      particleField.innerHTML = '';
      for (let i = 0; i < 16; i++) {
        const m = document.createElement('div');
        m.className = 'mote';
        const size = 3 + Math.random() * 4;
        const lime = Math.random() > 0.5;
        m.style.width = `${size}px`;
        m.style.height = `${size}px`;
        m.style.left = `${Math.random() * 100}%`;
        m.style.background = lime ? 'rgba(200,241,44,0.8)' : 'rgba(53,87,255,0.6)';
        m.style.boxShadow = lime ? '0 0 8px rgba(200,241,44,0.7)' : '0 0 8px rgba(53,87,255,0.5)';
        m.style.animationDuration = `${7 + Math.random() * 6}s`;
        m.style.animationDelay = `${Math.random() * 9}s`;
        particleField.appendChild(m);
      }
    }

    // Run the circular wipe from (ox, oy) %, then hand off to the host.
    function dismiss(ox = '50%', oy = '55%') {
      if (doneRef.current) return;
      doneRef.current = true;
      if (goOverlay) {
        goOverlay.style.setProperty('--ox', ox);
        goOverlay.style.setProperty('--oy', oy);
        goOverlay.classList.add('run');
      }
      after(reduceMotion ? 60 : WIPE_MS, onDone);
    }

    buildParticles();
    buildLetters(wordPickle, 'Pickle', 1780, 38);
    buildLetters(wordBallers, 'Ballers', 1780 + 6 * 38 + 60, 38);

    if (reduceMotion) {
      // Skip the choreography — reveal the brand immediately.
      root.classList.add('loaded', 'bg-reveal');
      [pickleball, paddle, trail, impactBurst].forEach((el) => { if (el) el.style.display = 'none'; });
      logoWrap?.classList.add('reveal');
      footerStack?.classList.add('reveal');
      root.querySelectorAll('.letter').forEach((l) => {
        (l as HTMLElement).style.opacity = '1';
        (l as HTMLElement).style.transform = 'none';
      });
      if (auto) after(1400, () => dismiss());
      return () => timers.forEach(clearTimeout);
    }

    after(10, () => root.classList.add('loaded'));
    after(160, () => pickleball?.classList.add('show'));
    after(900, () => paddle?.classList.add('swing-in'));

    after(1200, () => {
      pickleball?.classList.remove('show');
      pickleball?.classList.add('hit');
      paddle?.classList.remove('swing-in');
      paddle?.classList.add('hit');
      buildSparks();
      impactBurst?.classList.add('go');
      trail?.classList.add('show');
    });
    after(1280, () => {
      pickleball?.classList.remove('hit');
      pickleball?.classList.add('launch');
      paddle?.classList.remove('hit');
      paddle?.classList.add('swing-out');
    });
    after(1620, () => {
      pickleball?.classList.remove('launch');
      pickleball?.classList.add('fade-out');
    });
    after(1680, () => logoWrap?.classList.add('reveal'));
    after(2480, () => root.classList.add('bg-reveal'));
    after(2980, () => footerStack?.classList.add('reveal'));
    after(3680, () => ctaBtn?.classList.add('pulse'));

    // Web: settle on the brand, then wipe through automatically.
    if (auto) after(4200, () => dismiss());

    // App: the CTA is the way in.
    const onCta = (e: MouseEvent) => {
      if (!ctaBtn) return;
      const rect = ctaBtn.getBoundingClientRect();
      const r = document.createElement('span');
      const size = Math.max(rect.width, rect.height) * 1.6;
      r.className = 'ripple-tap';
      r.style.width = r.style.height = `${size}px`;
      r.style.left = `${e.clientX - rect.left - size / 2}px`;
      r.style.top = `${e.clientY - rect.top - size / 2}px`;
      ctaBtn.appendChild(r);
      window.setTimeout(() => r.remove(), 600);

      const pr = root.getBoundingClientRect();
      const ox = `${(((e.clientX - pr.left) / pr.width) * 100).toFixed(1)}%`;
      const oy = `${(((e.clientY - pr.top) / pr.height) * 100).toFixed(1)}%`;
      dismiss(ox, oy);
    };
    ctaBtn?.addEventListener('click', onCta);

    return () => {
      timers.forEach(clearTimeout);
      ctaBtn?.removeEventListener('click', onCta);
    };
  }, [auto, onDone]);

  return (
    <div ref={rootRef} className={`pb-splash${wide ? ' pb-splash--wide' : ''}`} role="presentation">
      <div className="blob blob-lime" />
      <div className="blob blob-blue" />

      <div className="particle-field" />

      <svg className="court-lines" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke="#3557FF" strokeWidth="2" opacity="0.16">
          <rect x="40" y="120" width="310" height="600" rx="6" />
          <line x1="40" y1="420" x2="350" y2="420" />
          <line x1="195" y1="120" x2="195" y2="300" />
          <line x1="195" y1="540" x2="195" y2="720" />
          <line x1="40" y1="300" x2="350" y2="300" />
          <line x1="40" y1="540" x2="350" y2="540" />
        </g>
      </svg>

      <svg className="pin pin1" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13Z" fill="#3557FF" />
        <circle cx="12" cy="9" r="2.6" fill="#fff" />
      </svg>
      <svg className="pin pin2" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13Z" fill="#C8F12C" />
        <circle cx="12" cy="9" r="2.6" fill="#20243A" />
      </svg>
      <svg className="pin pin3" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13Z" fill="#3557FF" />
        <circle cx="12" cy="9" r="2.6" fill="#fff" />
      </svg>

      <div className="badge badge-1"><span className="dot" />12 Games Today</div>
      <div className="badge badge-2"><span className="dot" />2 Spots Left</div>
      <div className="badge badge-3"><span className="dot" />4 Courts Nearby</div>

      <div className="hero-stage">
        <div className="ball-rig">
          <div className="trail" />

          <svg className="paddle" viewBox="0 0 100 170">
            <defs>
              <linearGradient id="splashPaddleGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6E86FF" />
                <stop offset="100%" stopColor="#3557FF" />
              </linearGradient>
            </defs>
            <rect x="8" y="4" width="84" height="108" rx="38" fill="url(#splashPaddleGrad)" stroke="#20243A" strokeWidth="3" />
            <rect x="16" y="11" width="68" height="94" rx="32" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.28" />
            <circle cx="50" cy="40" r="7" fill="#C8F12C" opacity="0.95" />
            <rect x="42" y="108" width="16" height="48" rx="8" fill="#20243A" />
            <rect x="45.5" y="116" width="9" height="3" rx="1.5" fill="#C8F12C" opacity="0.85" />
            <rect x="45.5" y="126" width="9" height="3" rx="1.5" fill="#C8F12C" opacity="0.65" />
            <rect x="45.5" y="136" width="9" height="3" rx="1.5" fill="#C8F12C" opacity="0.45" />
          </svg>

          <svg className="pickleball" viewBox="0 0 100 100">
            <defs>
              <radialGradient id="splashBallGrad" cx="35%" cy="28%" r="75%">
                <stop offset="0%" stopColor="#EEFFA0" />
                <stop offset="55%" stopColor="#C8F12C" />
                <stop offset="100%" stopColor="#9FCB12" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill="url(#splashBallGrad)" stroke="#20243A" strokeWidth="2.5" />
            <g fill="#20243A" opacity="0.45">
              <circle cx="64" cy="50" r="2.6" /><circle cx="59.9" cy="59.9" r="2.6" />
              <circle cx="50" cy="64" r="2.6" /><circle cx="40.1" cy="59.9" r="2.6" />
              <circle cx="36" cy="50" r="2.6" /><circle cx="40.1" cy="40.1" r="2.6" />
              <circle cx="50" cy="36" r="2.6" /><circle cx="59.9" cy="40.1" r="2.6" />
              <circle cx="78" cy="50" r="2.3" /><circle cx="74.2" cy="64" r="2.3" />
              <circle cx="64" cy="74.2" r="2.3" /><circle cx="50" cy="78" r="2.3" />
              <circle cx="36" cy="74.2" r="2.3" /><circle cx="25.8" cy="64" r="2.3" />
              <circle cx="22" cy="50" r="2.3" /><circle cx="25.8" cy="36" r="2.3" />
              <circle cx="36" cy="25.8" r="2.3" /><circle cx="50" cy="22" r="2.3" />
              <circle cx="64" cy="25.8" r="2.3" /><circle cx="74.2" cy="36" r="2.3" />
              <circle cx="90" cy="50" r="2" /><circle cx="70" cy="84.6" r="2" />
              <circle cx="30" cy="84.6" r="2" /><circle cx="10" cy="50" r="2" />
              <circle cx="30" cy="15.4" r="2" /><circle cx="70" cy="15.4" r="2" />
            </g>
            <ellipse cx="36" cy="33" rx="13" ry="8" fill="#ffffff" opacity="0.35" />
          </svg>

          <div className="impact-burst">
            <div className="ripple" />
          </div>
        </div>

        <div className="logo-wrap">
          <svg className="logo-mark" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="#C8F12C" stroke="#20243A" strokeWidth="3" />
            <circle cx="36" cy="50" r="2.6" fill="#20243A" opacity=".5" />
            <circle cx="50" cy="36" r="2.6" fill="#20243A" opacity=".5" />
            <circle cx="64" cy="50" r="2.6" fill="#20243A" opacity=".5" />
            <circle cx="50" cy="64" r="2.6" fill="#20243A" opacity=".5" />
            <ellipse cx="36" cy="33" rx="12" ry="7" fill="#fff" opacity=".35" />
          </svg>
          <h1 className="logo-text">
            <span className="word word-pickle" /><span className="word word-ballers" />
          </h1>
        </div>
      </div>

      <div className="footer-stack">
        <p className="tagline">Find games. Meet players. Play more.</p>
        <button className="cta-btn" type="button">Let's Play</button>
      </div>

      <div className="go-overlay">
        <h2>You're in 🎾</h2>
      </div>
    </div>
  );
}
