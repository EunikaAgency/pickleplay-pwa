import { useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { sendTestEmails, TEST_EMAIL_TEMPLATES, type TestEmailTemplate } from '../../shared/lib/api';

interface TestEmailScreenProps {
  onBack: () => void;
}

const TEMPLATE_LABELS: Record<TestEmailTemplate, string> = {
  welcome: 'Welcome email',
  'password-reset': 'Password reset',
  'password-changed': 'Password changed notification',
  'email-verification': 'Email verification',
  'booking-confirmed': 'Booking confirmed receipt',
  'booking-requested': 'Booking requested receipt',
  'booking-approved': 'Booking approved receipt',
  'payment-receipt': 'Payment receipt',
  cancellation: 'Cancellation / refund',
  membership: 'Membership receipt',
};

export function TestEmailScreen({ onBack }: TestEmailScreenProps) {
  const [testTo, setTestTo] = useState('');
  const [testSelected, setTestSelected] = useState<Set<TestEmailTemplate>>(new Set(TEST_EMAIL_TEMPLATES));
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const doSendTest = async () => {
    if (!testTo || testSelected.size === 0) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const r = await sendTestEmails(testTo, [...testSelected]);
      if (r.status === 'ok') setTestResult(`Sent ${r.sent.length} email(s) successfully. Check ${testTo}.`);
      else if (r.status === 'partial') setTestResult(`Sent ${r.sent.length}, failed ${r.errors.length}: ${r.errors.map(e => e.template).join(', ')}`);
      else setTestResult(`Failed: ${r.errors.map(e => `${e.template} (${e.error})`).join('; ')}`);
    } catch (e) {
      setTestResult(`Error: ${(e as Error).message}`);
    }
    setTestSending(false);
  };

  const toggleTemplate = (t: TestEmailTemplate) => {
    const next = new Set(testSelected);
    if (next.has(t)) next.delete(t); else next.add(t);
    setTestSelected(next);
  };

  return (
    <div className="scroll pb-[60px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} title="Test email tool" subtitle="Send sample emails to preview how they look in an inbox" />

      <div className="section mt-0!">
        <div className="card p-4">
          {/* Target email */}
          <label className="block text-[13px] font-heading font-semibold text-[var(--ink)] mb-1.5">Recipient</label>
          <input
            type="email" value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="Your email address"
            className="w-full h-11 rounded-xl border-2 border-[var(--muted)] bg-[var(--surface)] px-4 text-[14px] font-semibold text-[var(--ink)] placeholder:text-[var(--muted)] outline-none mb-4 focus:border-[var(--lime)]"
          />

          {/* Template checkboxes */}
          <label className="flex items-center justify-between cursor-pointer mb-3">
            <span className="font-heading font-semibold text-[14px] text-[var(--ink)]">Select all</span>
            <input
              type="checkbox"
              checked={testSelected.size === TEST_EMAIL_TEMPLATES.length}
              onChange={() => setTestSelected(testSelected.size === TEST_EMAIL_TEMPLATES.length ? new Set() : new Set(TEST_EMAIL_TEMPLATES))}
              className="size-5 rounded accent-[var(--lime)]"
            />
          </label>
          <div className="space-y-0.5 border border-[var(--hairline)] rounded-xl p-2 mb-4">
            {TEST_EMAIL_TEMPLATES.map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={testSelected.has(t)}
                  onChange={() => toggleTemplate(t)}
                  className="size-4 rounded accent-[var(--lime)]"
                />
                <span className="text-[13px] text-[var(--ink)]">{TEMPLATE_LABELS[t]}</span>
              </label>
            ))}
          </div>

          {/* Send button */}
          <button
            onClick={doSendTest}
            disabled={testSending || !testTo || testSelected.size === 0}
            className="h-11 px-6 rounded-full bg-[var(--lime)] text-[var(--lime-ink)] font-heading font-semibold text-[14px] disabled:opacity-40 flex items-center gap-2"
          >
            <Icon name="send" size={16} />
            {testSending ? 'Sending...' : 'Send test emails'}
          </button>

          {/* Result */}
          {testResult && (
            <p className={`mt-4 text-[13px] font-semibold ${testResult.startsWith('Sent') && !testResult.includes('failed') ? 'text-[#16a34a]' : 'text-[var(--coral)]'}`}>
              {testResult}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
