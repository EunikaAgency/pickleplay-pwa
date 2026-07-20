// CORRECTION. The previous pass claimed "no screen can set a fee, not even for an
// organizer". That is true only for the player-hosted joinFee. The venue/organizer
// RECURRING SESSION path does have a Price input (Recurring sessions → New series),
// and a live series already carries ₱300. Nothing is collected on either path.
import { readFileSync, writeFileSync } from 'node:fs';
const F = '/var/public/pickleplay/reports/2026-07-16-progress-client.html';
let s = readFileSync(F, 'utf8');
const before = s.length;

const R = [
  // task 18
  ['ship:"The join-fee field exists in the data model and drives the Free / Paid chip on listing cards.",',
   'ship:"There are two Open Play paths. A venue/organizer <em>recurring session</em> can carry a price — set in Recurring sessions → New series, and a live series already runs at ₱300. A player-hosted open play has a join-fee field instead, which drives the Free / Paid chip.",'],
  ['note:"Nothing in the app can actually set a fee today — there is no input on any screen, not even for a subscribed organizer — and nothing is collected when a player joins. Two pieces follow decision 1: a fee input in lobby creation, and a checkout step before joining. Court bookings already run the 7% platform fee."},',
   'note:"Nothing is collected on either path — joining is free and instant. A session price is display-only, and the player-hosted join fee has no input on any screen at all. The missing piece is the checkout step, and it follows decision 1. Court bookings already run the 7% platform fee."},'],

  // task 19
  ['note:"The gate is real and working. But there is still no screen to set a fee — even for a subscribed organizer — and nothing collects it (see 18)."},',
   'note:"The gate is real and working on the player-hosted path, which has no fee input anyway. The venue/organizer recurring session takes a price from its own form — that one is not gated on a subscription, because it is the venue\'s own court. Nothing collects either (see 18)."},'],

  // money flow
  ['{who:"Open Play",flow:\'Joining a lobby is <span class="next">free and instant</span> — no screen can set a fee, and nothing is collected. Both the fee input and the checkout step follow decision 1.\'},',
   '{who:"Open Play",flow:\'A venue/organizer session can carry a price (a live series runs at ₱300) and it shows on the card — but joining is <span class="next">free and instant</span> and nothing is collected on either path. The checkout step follows decision 1.\'},'],

  // organizer role flow
  ['["Set a join fee — no input built yet","wait"],["Collect the fee at checkout","wait"]',
   '["Set a session price + capacity (recurring series)","done"],["Collect the price at checkout","wait"]'],
];
let missed = [];
for (const [a, b] of R) { if (!s.includes(a)) missed.push(a.slice(0, 60)); else s = s.split(a).join(b); }
writeFileSync(F, s);
console.log(`written (${before} → ${s.length})  applied: ${R.length - missed.length}/${R.length}`);
if (missed.length) { console.log('MISSED:'); missed.forEach(m => console.log('  - ' + m)); }
console.log('\nchecks:');
console.log('  wrong "no input on any screen, not even" claim gone:', !s.includes('not even for a subscribed organizer') ? '✓' : '✗');
console.log('  session-price reality present:', s.includes('recurring session') || s.includes('Recurring sessions') ? '✓' : '✗');
