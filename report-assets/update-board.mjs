// Correct the client board on the Open Play join-fee reality:
// no screen anywhere can set a fee (not even an organizer), and nothing is
// collected on join. Also reflect that the lobby itself has since shipped.
import { readFileSync, writeFileSync } from 'node:fs';
const F = '/var/public/pickleplay/reports/2026-07-16-progress-client.html';
let s = readFileSync(F, 'utf8');
const before = s.length;

const R = [
  // ── task 18 — joiner pays the host
  ['ship:"A join fee can be set (organizer accounts) and is shown on the card.",',
   'ship:"The join-fee field exists in the data model and drives the Free / Paid chip on listing cards.",'],
  ['note:"Collecting that fee is ready to build as soon as the Open Play payment rules are confirmed (decision 1). Court bookings already run the platform fee today."},',
   'note:"Nothing in the app can actually set a fee today — there is no input on any screen, not even for a subscribed organizer — and nothing is collected when a player joins. Two pieces follow decision 1: a fee input in lobby creation, and a checkout step before joining. Court bookings already run the 7% platform fee."},'],

  // ── task 19 — fee only on organizer/owner Open Play
  ['ship:"A join fee above ₱0 can only be set by an active organizer subscriber; everyone else is fixed at ₱0 (on create and on edit).",',
   'ship:"The server forces a ₱0 join fee unless the host holds an active organizer subscription — enforced on create and on edit, so a lapsed host can\'t start charging.",'],
  ['note:"The gate works; collection follows decision 1 (see 18)."},',
   'note:"The gate is real and working. But there is still no screen to set a fee — even for a subscribed organizer — and nothing collects it (see 18)."},'],

  // ── money flow
  ['{who:"Open Play",flow:\'The join fee is set and displayed; <span class="next">collection is ready to switch on</span> once the payment rules are confirmed (decision 1).\'},',
   '{who:"Open Play",flow:\'Joining a lobby is <span class="next">free and instant</span> — no screen can set a fee, and nothing is collected. Both the fee input and the checkout step follow decision 1.\'},'],

  // ── organizer role flow: "set join fee" is not actually reachable
  ['["Create Open Play + set join fee","done"],\n    ["Recurring series (3 edit scopes)","done"],["Collect join fee at checkout","wait"]',
   '["Create Open Play","done"],\n    ["Recurring series (3 edit scopes)","done"],["Set a join fee — no input built yet","wait"],["Collect the fee at checkout","wait"]'],

  // ── task 7 — the lobby has since shipped
  ['note:"The lobby direction is now confirmed (Open Play gets a lobby, like an event), so the invite rule follows from it."},',
   'note:"The lobby direction is confirmed and has since shipped — Open Play now has a Join lobby button and a real size, so a full lobby locks anyone else out. What is left to confirm is the invite rule itself: players only, or anyone."},'],
];

let missed = [];
for (const [a, b] of R) { if (!s.includes(a)) missed.push(a.slice(0, 60)); else s = s.split(a).join(b); }
writeFileSync(F, s);
console.log(`written (${before} → ${s.length} bytes)`);
console.log(`applied: ${R.length - missed.length}/${R.length}`);
if (missed.length) { console.log('MISSED:'); missed.forEach(m => console.log('  - ' + m)); }
// sanity
console.log('\nchecks:');
console.log('  "join fee can be set" gone:', !s.includes('A join fee can be set') ? '✓' : '✗');
console.log('  "Create Open Play + set join fee" gone:', !s.includes('Create Open Play + set join fee') ? '✓' : '✗');
console.log('  free-and-instant money row:', s.includes('free and instant') ? '✓' : '✗');
