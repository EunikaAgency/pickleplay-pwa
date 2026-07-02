// HTML email templates — inline CSS (Gmail strips <style> blocks).
// Every template has a matching `.txt` plain-text version.
//
// Layout: green header · white content · dark footer

const GREEN = '#b9e615';
const DARK = '#0b1220';
const BRAND = 'PickleBallers';

function shell(title: string, content: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#64748b">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#64748b;padding:40px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
  <tr><td style="background:${GREEN};padding:36px 32px 32px;text-align:center">
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:20px;font-weight:800;color:${DARK};letter-spacing:-0.02em">${BRAND}</div>
  </td></tr>
  <tr><td style="background:#fff;padding:32px">
    ${content}
  </td></tr>
  <tr><td style="background:${DARK};padding:24px 32px;text-align:center">
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#64748b;line-height:1.6">
      ${BRAND} &middot; sent from a court near you 🏓
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function heading(text: string): string {
  return `<h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:20px;font-weight:700;color:#0f172a;margin:0 0 6px;letter-spacing:-0.02em">${text}</h1>`;
}
function para(text: string): string {
  return `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#475569;line-height:1.65;margin:0 0 12px">${text}</p>`;
}
function muted(text: string): string {
  return `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#94a3b8;line-height:1.5;margin:16px 0 0">${text}</p>`;
}
function btn(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0"><tr>
    <td style="background:${GREEN};border-radius:12px">
      <a href="${url}" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:700;color:${DARK};text-decoration:none">${label}</a>
    </td>
  </tr></table>`;
}
function badge(label: string, color: string): string {
  return `<span style="display:inline-block;background:${color};color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding:4px 10px;border-radius:6px;margin-bottom:8px">${label}</span>`;
}

// ── Receipt card (gray box with label→value rows) ─────────────────

function card(rows: { label: string; value: string }[]): string {
  const items = rows.map((r) => `
    <tr><td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;padding:0 0 2px">${r.label}</td></tr>
    <tr><td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;color:#0f172a;padding:0 0 14px">${r.value}</td></tr>
  `).join('\n');
  return `<table cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border-radius:12px;padding:20px 24px;margin:0 0 8px"><tr><td>${items}</td></tr></table>`;
}

function lineItems(lines: { label: string; amount: string; bold?: boolean }[]): string {
  const items = lines.map((l) => `
    <tr>
      <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:${l.bold ? '15' : '14'}px;color:${l.bold ? '#0f172a' : '#475569'};padding:5px 0;font-weight:${l.bold ? '700' : '400'}">${l.label}</td>
      <td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:${l.bold ? '15' : '14'}px;color:${l.bold ? '#0f172a' : '#475569'};padding:5px 0;font-weight:${l.bold ? '700' : '400'}">${l.amount}</td>
    </tr>
  `).join('\n');
  return `<table cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:4px">${items}</table>`;
}

// ═══════════════════════════════════════════════════════════════════
//  PUBLIC TEMPLATES
// ═══════════════════════════════════════════════════════════════════

// ── Welcome / account created ─────────────────────────────────────

export function welcomeEmail(opts: {
  name: string; role: string;
}) {
  const roleLabel = { player: 'Player', owner: 'Owner', organizer: 'Organizer', coach: 'Coach' }[opts.role] || opts.role;
  const text = [
    `Welcome to ${BRAND}, ${opts.name}!`,
    '',
    `You signed up as a ${roleLabel}.`,
    '',
    'Download the app or visit pickleballer.eunika.xyz to get started.',
    '',
    'See you on the court!',
  ].join('\n');

  const features = [
    ['Find courts', 'Browse venues near you and book instantly'],
    ['Join games', 'Hop into open games or host your own lobby'],
    ['Clubs', 'Join local pickleball communities'],
    ['Messages', 'Chat with players and venue owners'],
  ].map(([t, d]) =>
    `<tr><td style="padding:6px 0;vertical-align:top"><span style="font-size:18px">🏓</span></td><td style="padding:6px 0 6px 10px;vertical-align:top"><span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;color:#0f172a">${t}</span><br><span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#64748b">${d}</span></td></tr>`
  ).join('\n');

  const html = shell('Welcome!', [
    heading(`Welcome, ${opts.name}! 🎉`),
    para(`Your <strong>${roleLabel}</strong> account is ready. Here's what you can do:`),
    `<table cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0">${features}</table>`,
    btn('Get started', 'https://pickleballer-pwa.eunika.xyz'),
    muted(`Account created — ${BRAND} team`),
  ].join('\n'));
  return { html, text };
}

export function passwordResetEmail(resetUrl: string) {
  const text = [
    'Someone requested a password reset for your PickleBallers account.',
    '',
    `Reset your password: ${resetUrl}`,
    '',
    'This link expires in 1 hour.',
  ].join('\n');
  const html = shell('Reset your password', [
    heading('Reset your password'),
    para('Someone requested a password reset for your account.'),
    btn('Reset password', resetUrl),
    para(`Or copy this link:<br><a href="${resetUrl}" style="color:#0ea5e9;word-break:break-all;font-size:13px">${resetUrl}</a>`),
    muted('Link expires in 1 hour. Ignore if you didn\'t request this.'),
  ].join('\n'));
  return { html, text };
}

export function passwordChangedEmail() {
  const text = [
    'Your PickleBallers password has been changed.',
    '',
    'If you made this change, no further action is needed.',
    '',
    'If you did NOT change your password, please reset it immediately using the app.',
  ].join('\n');
  const html = shell('Password changed', [
    heading('Password changed'),
    para('Your PickleBallers password was just changed.'),
    para('If this was you, you\'re all set — no further action is needed.'),
    para('<strong>If you did not make this change</strong>, someone may have accessed your account. Please reset your password immediately using the app.'),
    muted('This is an automated security notification.'),
  ].join('\n'));
  return { html, text };
}

export function emailVerificationEmail(verifyUrl: string) {
  const text = [`Welcome to ${BRAND}!`, '', `Verify your email: ${verifyUrl}`, '', 'Link expires in 24 hours.'].join('\n');
  const html = shell('Verify your email', [
    heading('Welcome! 🎉'),
    para('Thanks for signing up. Verify your email to get started:'),
    btn('Verify email', verifyUrl),
    muted('Link expires in 24 hours. Ignore if you didn\'t sign up.'),
  ].join('\n'));
  return { html, text };
}

// ── Booking: Confirmed (instant / paid) ───────────────────────────

export function bookingConfirmedReceipt(opts: {
  receipt: string; venue: string; court?: string;
  date: string; start: string; end: string; hours: number;
  rate: string; subtotal: string; fee: string; total: string;
  method?: string;
}) {
  const text = [
    `BOOKING CONFIRMED — #${opts.receipt}`,
    `${opts.venue}${opts.court ? ` · ${opts.court}` : ''}`,
    `${opts.date} · ${opts.start}–${opts.end} (${opts.hours}h)`,
    `Rate: ${opts.rate}/hr`, `Subtotal: ${opts.subtotal}`,
    `Service fee: ${opts.fee}`, `Total: ${opts.total}`,
    opts.method ? `Paid: ${opts.method}` : '',
    '', 'See you on the court!',
  ].filter(Boolean).join('\n');
  const html = shell('Booking Confirmed', [
    badge('Confirmed', '#22c55e'),
    heading('Court booked!'),
    para('Your booking is confirmed. Show this at the front desk.'),
    card([
      { label: 'Receipt', value: `#${opts.receipt}` },
      { label: 'Venue', value: opts.venue },
      ...(opts.court ? [{ label: 'Court', value: opts.court }] : []),
      { label: 'Date', value: opts.date },
      { label: 'Time', value: `${opts.start} – ${opts.end} (${opts.hours} hr${opts.hours > 1 ? 's' : ''})` },
    ]),
    lineItems([
      { label: `${opts.rate}/hr × ${opts.hours}h`, amount: opts.subtotal },
      { label: 'Service fee (7%)', amount: opts.fee },
      { label: 'Total', amount: opts.total, bold: true },
      ...(opts.method ? [{ label: opts.method, amount: opts.total, bold: true }] : []),
    ]),
  ].join('\n'));
  return { html, text };
}

// ── Booking: Requested (pending owner approval) ────────────────────

export function bookingRequestedReceipt(opts: {
  receipt: string; venue: string; court?: string;
  date: string; start: string; end: string; hours: number;
  rate: string; estimatedTotal: string;
}) {
  const text = [
    `BOOKING REQUEST — #${opts.receipt}`,
    `${opts.venue}${opts.court ? ` · ${opts.court}` : ''}`,
    `${opts.date} · ${opts.start}–${opts.end} (${opts.hours}h)`,
    `Estimated total: ${opts.estimatedTotal}`,
    '', 'The venue will review your request. We\'ll notify you once approved.',
  ].join('\n');
  const html = shell('Booking Requested', [
    badge('Pending', '#e8a100'),
    heading('Booking request sent'),
    para('The venue owner will review your request. Once approved, you\'ll have a limited window to pay and confirm.'),
    card([
      { label: 'Request', value: `#${opts.receipt}` },
      { label: 'Venue', value: opts.venue },
      ...(opts.court ? [{ label: 'Court', value: opts.court }] : []),
      { label: 'Date', value: opts.date },
      { label: 'Time', value: `${opts.start} – ${opts.end} (${opts.hours} hr${opts.hours > 1 ? 's' : ''})` },
    ]),
    lineItems([
      { label: `${opts.rate}/hr × ${opts.hours}h`, amount: opts.estimatedTotal },
      { label: 'Estimated total', amount: opts.estimatedTotal, bold: true },
    ]),
    muted('Your card has been saved but not charged. No payment until the owner approves.'),
  ].join('\n'));
  return { html, text };
}

// ── Booking: Approved (owner approved, player must pay) ────────────

export function bookingApprovedReceipt(opts: {
  receipt: string; venue: string; court?: string;
  date: string; start: string; end: string;
  total: string; deadline: string; payUrl: string;
}) {
  const text = [
    `BOOKING APPROVED — #${opts.receipt}`,
    `${opts.venue} · ${opts.date} · ${opts.start}–${opts.end}`,
    `Total: ${opts.total}`, `Pay by ${opts.deadline}: ${opts.payUrl}`,
  ].join('\n');
  const html = shell('Booking Approved', [
    badge('Approved', '#0ea5e9'),
    heading('Booking approved!'),
    para(`Your request was approved. Pay by <strong>${opts.deadline}</strong> to confirm your slot — or it will be released.`),
    card([
      { label: 'Booking', value: `#${opts.receipt}` },
      { label: 'Venue', value: opts.venue },
      ...(opts.court ? [{ label: 'Court', value: opts.court }] : []),
      { label: 'Date', value: opts.date },
      { label: 'Time', value: `${opts.start} – ${opts.end}` },
      { label: 'Deadline', value: opts.deadline },
    ]),
    lineItems([{ label: 'Total due', amount: opts.total, bold: true }]),
    btn('Pay now', opts.payUrl),
  ].join('\n'));
  return { html, text };
}

// ── Payment receipt ────────────────────────────────────────────────

export function paymentReceipt(opts: {
  receipt: string; bookingRef: string; venue: string;
  date: string; time: string; subtotal: string; fee: string;
  vat: string; total: string; method: string; paidAt: string;
}) {
  const text = [
    `PAYMENT RECEIPT — #${opts.receipt}`,
    `Booking: ${opts.bookingRef}`, `${opts.venue} · ${opts.date} · ${opts.time}`,
    `Subtotal: ${opts.subtotal}`, `Service fee: ${opts.fee}`,
    `VAT (12%): ${opts.vat}`, `Total: ${opts.total}`,
    `${opts.method} · ${opts.paidAt}`,
  ].join('\n');
  const html = shell('Payment Receipt', [
    badge('Paid', '#22c55e'),
    heading('Payment receipt'),
    para('Your payment has been processed.'),
    card([
      { label: 'Receipt', value: `#${opts.receipt}` },
      { label: 'Booking', value: opts.bookingRef },
      { label: 'Venue', value: opts.venue },
      { label: 'Date & time', value: `${opts.date} · ${opts.time}` },
    ]),
    lineItems([
      { label: 'Subtotal', amount: opts.subtotal },
      { label: 'Service fee (7%)', amount: opts.fee },
      { label: 'VAT (12%)', amount: opts.vat },
      { label: 'Total', amount: opts.total, bold: true },
      { label: `${opts.method} · ${opts.paidAt}`, amount: opts.total },
    ]),
    muted('This serves as your official receipt. VAT-registered · BIR compliant.'),
  ].join('\n'));
  return { html, text };
}

// ── Cancellation / refund ──────────────────────────────────────────

export function cancellationReceipt(opts: {
  receipt: string; venue: string; date: string; time: string;
  refund: string; refundStatus: string; cancelledAt: string;
}) {
  const text = [
    `CANCELLED — #${opts.receipt}`,
    `${opts.venue} · ${opts.date} · ${opts.time}`,
    `Refund: ${opts.refund} (${opts.refundStatus})`, `Cancelled: ${opts.cancelledAt}`,
  ].join('\n');
  const html = shell('Booking Cancelled', [
    badge('Cancelled', '#ef4444'),
    heading('Booking cancelled'),
    para('Your booking has been cancelled and the court slot released.'),
    card([
      { label: 'Reference', value: `#${opts.receipt}` },
      { label: 'Venue', value: opts.venue },
      { label: 'Date & time', value: `${opts.date} · ${opts.time}` },
      { label: 'Cancelled', value: opts.cancelledAt },
    ]),
    lineItems([
      { label: 'Refund', amount: opts.refund },
      { label: 'Status', amount: opts.refundStatus, bold: true },
    ]),
    muted('Refunds take 5–10 business days depending on your payment method.'),
  ].join('\n'));
  return { html, text };
}

// ── Membership subscription ────────────────────────────────────────

export function membershipReceipt(opts: {
  receipt: string; venue: string; plan: string;
  cycle: string; amount: string; nextBilling: string;
  benefits: string[]; method?: string;
}) {
  const text = [
    `MEMBERSHIP — #${opts.receipt}`,
    `${opts.venue} — ${opts.plan}`, `${opts.cycle} · ${opts.amount}`,
    `Next billing: ${opts.nextBilling}`,
    '', 'Benefits:', ...opts.benefits.map((b) => `  ✅ ${b}`),
    opts.method ? `\nPaid: ${opts.method}` : '',
  ].join('\n');
  const bfHtml = opts.benefits.length
    ? `<div style="margin-top:12px">${opts.benefits.map((b) => `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#475569;padding:3px 0">✅ ${b}</div>`).join('')}</div>`
    : '';
  const html = shell('Membership Confirmed', [
    badge('Active', '#22c55e'),
    heading(`Welcome to ${opts.venue}!`),
    para(`Your <strong>${opts.plan}</strong> membership is now active.`),
    card([
      { label: 'Receipt', value: `#${opts.receipt}` },
      { label: 'Venue', value: opts.venue },
      { label: 'Plan', value: opts.plan },
      { label: 'Billing', value: `${opts.cycle} — renews ${opts.nextBilling}` },
    ]),
    lineItems([
      { label: opts.cycle, amount: opts.amount },
      { label: 'Total', amount: opts.amount, bold: true },
      ...(opts.method ? [{ label: opts.method, amount: opts.amount, bold: true }] : []),
    ]),
    bfHtml,
  ].join('\n'));
  return { html, text };
}
