import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';

export default function CheckoutPage() {
  const [step, setStep] = useState(1);

  return (
    <div>
      <section className="bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] px-5 py-10">
        <div className="mx-auto max-w-3xl flex items-center gap-6">
          <div className="flex-1 text-white">
            <h1 className="font-heading text-3xl font-extrabold">Secure Checkout</h1>
            <p className="mt-1 text-white/70">Your booking is one step away.</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-5 py-8">
        {step === 1 && (
        <div className="mt-6 rounded-[14px] bg-surface-container-lowest p-8 shadow-card space-y-5">
          <div>
            <label className="mb-1 block text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Card Number</label>
            <input type="text" placeholder="4242 4242 4242 4242" className="h-12 w-full rounded-[12px] border border-outline-variant bg-surface-container-low px-4 text-body-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Expiry</label>
              <input type="text" placeholder="MM/YY" className="h-12 w-full rounded-[12px] border border-outline-variant bg-surface-container-low px-4 text-body-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="mb-1 block text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">CVC</label>
              <input type="text" placeholder="123" className="h-12 w-full rounded-[12px] border border-outline-variant bg-surface-container-low px-4 text-body-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <button onClick={() => setStep(2)} className="h-12 w-full rounded-full bg-secondary-container text-body-lg font-bold text-on-secondary-container shadow-sm active:scale-95">
            Pay $15.00
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 rounded-[14px] bg-surface-container-lowest p-8 shadow-card text-center">
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary-fixed">
              <Icon name="check" size={40} filled className="text-on-secondary-fixed" />
            </div>
          </div>
          <h2 className="mt-6 font-heading text-headline-lg font-bold text-on-surface">Payment confirmed!</h2>
          <p className="mt-2 text-body-md text-on-surface-variant">Your booking is confirmed. Check your email for details.</p>
          <Link to="/my/bookings" className="mt-6 inline-flex h-12 items-center rounded-full bg-secondary-container px-8 text-body-lg font-bold text-on-secondary-container no-underline shadow-sm active:scale-95">View Bookings</Link>
        </div>
      )}
      </div>
    </div>
  );
}
