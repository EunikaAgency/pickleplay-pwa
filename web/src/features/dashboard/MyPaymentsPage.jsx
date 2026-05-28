import Icon from '../../shared/components/Icon.jsx';
import { getPayments } from '../../shared/data/index.js';
import useAuth from '../auth/authStore.js';

export default function MyPaymentsPage() {
  const user = useAuth(s => s.user);
  const payments = getPayments().filter(p => p.userId === user?.id);

  if (!payments.length) return (
    <div>
      <h1 className="font-heading text-3xl font-extrabold text-on-surface">Payments</h1>
      <div className="mt-16 flex flex-col items-center text-center">
        <div className="text-6xl">💳</div>
        <h2 className="mt-4 font-heading text-xl font-bold">No payments yet</h2>
        <p className="mt-2 text-base text-on-surface-variant">Your payment history will show up here.</p>
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="font-heading text-3xl font-extrabold text-on-surface">Payments</h1>
      <p className="mt-1 text-base text-on-surface-variant">{payments.length} transactions</p>
      <div className="mt-6 space-y-3">
        {payments.map(p => (
          <div key={p.id} className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-high text-xl">💳</div>
              <div><p className="font-bold">{p.description}</p><p className="text-base text-on-surface-variant">{new Date(p.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>
                <span className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-base font-extrabold uppercase ${p.status==='succeeded'?'bg-[#C1F100]/20 text-[#374D00]':'bg-surface-container-high'}`}>{p.status}</span></div>
            </div>
            <p className="font-extrabold">${p.amount}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
