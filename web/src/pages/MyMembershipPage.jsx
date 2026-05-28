import Icon from '../components/ui/Icon.jsx';
import { getPricingPlans } from '../data/index.js';

export default function MyMembershipPage() {
  const plans = getPricingPlans();

  return (
    <div>
      <div className="rounded-2xl bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] p-6 text-white">
        <h1 className="font-heading text-3xl font-extrabold">Membership</h1>
        <p className="mt-1 text-white/70">Manage your plan and billing.</p>
        <div className="mt-4 flex items-center gap-4 rounded-2xl bg-white/15 p-4">
          <span className="text-3xl">⭐</span>
          <div><p className="font-heading text-lg font-bold">Free Tier</p><p className="text-base text-white/70">Basic access — you're all set!</p></div>
          <span className="ml-auto rounded-full bg-[#C1F100] px-3 py-1 text-base font-extrabold uppercase text-[#374D00]">Active</span>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-heading text-2xl font-extrabold">Upgrade your game</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.filter(p => p.name !== 'Free').map(plan => (
            <div key={plan.id} className="rounded-2xl bg-white p-6 shadow-lg">
              <p className="text-base font-extrabold uppercase text-on-surface-variant">{plan.name}</p>
              <div className="mt-2"><span className="text-3xl font-extrabold">${plan.price}</span><span className="text-base text-on-surface-variant">/{plan.interval}</span></div>
              <ul className="mt-4 space-y-2">{plan.features?.slice(0,5).map((f,i) => <li key={i} className="flex items-start gap-2 text-base text-on-surface-variant"><span className="mt-0.5 text-[#C1F100] font-bold">✓</span>{f}</li>)}</ul>
              <button className="mt-6 h-12 w-full rounded-2xl bg-[#C1F100] text-base font-extrabold text-[#374D00] shadow-md hover:scale-105 active:scale-95 transition-transform">Upgrade</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
