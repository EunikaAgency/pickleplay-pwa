import { Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import { getPricingPlans } from '../../shared/data/index.js';

export default function PricingPage() {
  const plans = getPricingPlans();

  return (
    <div>
      <section className="bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] px-5 py-12">
        <div className="mx-auto max-w-5xl flex items-center gap-8">
          <div className="flex-1 text-white">
            <h1 className="font-heading text-4xl font-extrabold">Plans for every player</h1>
            <p className="mt-2 text-white/70">From casual to competitive, we have a plan for you.</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-12">
        <div className="mt-0 grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.id} className={`rounded-[14px] bg-surface-container-lowest p-8 shadow-card ${plan.highlight ? 'ring-2 ring-primary' : ''}`}>
            <p className="text-label-sm font-bold uppercase text-on-surface-variant">{plan.name}</p>
            <div className="mt-3">
              <span className="font-heading text-headline-xl font-bold text-on-surface">${plan.price}</span>
              <span className="text-body-md text-on-surface-variant">/{plan.interval}</span>
            </div>
            <p className="mt-3 text-body-md text-on-surface-variant">{plan.description}</p>
            <ul className="mt-6 space-y-3">
              {plan.features?.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-body-md text-on-surface">
                  <Icon name="check" size={18} className="mt-0.5 shrink-0 text-secondary-container" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to={plan.name === 'Free' ? '/register' : '/checkout'}
              className={`mt-8 flex h-12 items-center justify-center rounded-full text-body-lg font-bold no-underline shadow-sm active:scale-95 ${
                plan.highlight
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'border border-outline-variant text-on-surface'
              }`}
            >
              {plan.cta || 'Get Started'}
            </Link>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
