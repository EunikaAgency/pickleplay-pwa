import { Link } from 'react-router-dom';

export default function MyMembershipPage() {
  return (
    <div>
      <div className="rounded-2xl bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] p-6 text-white">
        <h1 className="font-heading text-3xl font-extrabold">Membership</h1>
        <p className="mt-1 text-white/70">Manage your plan and billing.</p>
        <div className="mt-4 flex items-center gap-4 rounded-2xl bg-white/15 p-4">
          <span className="text-3xl">⭐</span>
          <div>
            <p className="font-heading text-lg font-bold">Free</p>
            <p className="text-base text-white/70">Basic access — you're all set.</p>
          </div>
          <span className="ml-auto rounded-full bg-[#C1F100] px-3 py-1 text-base font-extrabold uppercase text-[#374D00]">Active</span>
        </div>
      </div>

      <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-md">
        <div className="text-5xl">💎</div>
        <h2 className="mt-3 font-heading text-xl font-bold text-on-surface">Paid plans coming soon</h2>
        <p className="mx-auto mt-2 max-w-md text-base text-on-surface-variant">
          We haven't wired the paid-subscription backend yet (the existing Subscription model is for the newsletter only).
          Until then, every account stays on the Free tier with full access to the core features.
        </p>
        <Link to="/pricing" className="mt-5 inline-flex h-12 items-center rounded-full bg-surface-container-high px-6 text-base font-bold text-on-surface no-underline hover:bg-surface-container-highest">
          Preview pricing plans
        </Link>
      </div>
    </div>
  );
}
