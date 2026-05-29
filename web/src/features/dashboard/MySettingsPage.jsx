import { useState } from 'react';

function Toggle({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div><p className="text-base font-bold">{label}</p><p className="text-base text-on-surface-variant">{desc}</p></div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`h-7 w-12 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-surface-variant'}`}>
        <div className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${checked ? 'ml-6' : 'ml-0.5'}`} />
      </button>
    </div>
  );
}

export default function MySettingsPage() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [gameReminders, setGameReminders] = useState(true);

  return (
    <div>
      <h1 className="font-heading text-3xl font-extrabold text-on-surface">Settings</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">🔔 Notifications</h2>
          <div className="mt-3 divide-y divide-surface-variant"><Toggle label="Email" desc="Get updates via email" checked={emailNotifs} onChange={setEmailNotifs} /><Toggle label="Push" desc="In-app notifications" checked={pushNotifs} onChange={setPushNotifs} /><Toggle label="Game reminders" desc="1 hour before games" checked={gameReminders} onChange={setGameReminders} /></div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">💳 Payment Methods</h2>
          <div className="mt-3 flex items-center gap-4 rounded-2xl border-2 border-surface-variant p-4">
            <div className="flex h-12 w-16 items-center justify-center rounded-xl bg-surface-container-high text-xl">💳</div>
            <div><p className="font-bold">Visa ending 4242</p><p className="text-base text-on-surface-variant">Expires 12/26</p></div>
            <span className="ml-auto rounded-full bg-[#C1F100]/20 px-2.5 py-0.5 text-base font-extrabold uppercase text-[#374D00]">Default</span>
          </div>
          <button type="button" className="mt-3 flex items-center gap-2 text-base font-extrabold text-primary hover:underline">+ Add method</button>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">👤 Account</h2>
          <div className="mt-3 space-y-2">
            <button type="button" className="w-full rounded-2xl border-2 border-surface-variant p-4 text-left text-base font-bold hover:bg-surface-container-low active:scale-[0.99]">Change Password</button>
            <button type="button" className="w-full rounded-2xl border-2 border-surface-variant p-4 text-left text-base font-bold hover:bg-surface-container-low active:scale-[0.99]">Download My Data</button>
            <button type="button" className="w-full rounded-2xl border-2 border-error-container p-4 text-left text-base font-bold text-error hover:bg-error-container/10 active:scale-[0.99]">Delete Account</button>
          </div>
        </div>
      </div>
    </div>
  );
}
