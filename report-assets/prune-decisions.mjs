// Prune the answered decisions from the client board and re-point every
// "decision N" reference at the new numbering.
import { readFileSync, writeFileSync } from 'node:fs';
const F = '/var/public/pickleplay/reports/2026-07-16-progress-client.html';
let s = readFileSync(F, 'utf8');
const before = s;

/* 1 ── DECISIONS array: keep only what is still open.
   Removed (already answered): lobby · Like-vs-Interested · homepage wording · Events-as-tabs.
   Kept from the old "two small refinements": the staff-figures half, which is still open. */
const NEW_DECISIONS = `const DECISIONS=[
  {q:"What are the Open Play payment rules by host type?",d:"May organizer / venue-hosted sessions charge joiners while player-hosted stay free? Who collects, does PickleBallers take a share, and what happens on cancellation?",ub:["unblocks 18","unblocks 19"]},
  {q:"How should gender & eligibility restrictions work?",d:"Men / women / skill restrictions are already built — confirm the full set, and whether an ineligible player sees the listing marked “not eligible” or doesn't see it at all.",ub:[]},
  {q:"How should coach session payments work?",d:"When is payment collected, who receives it, does the venue take a share, and does the platform charge a commission — or does the ₱499 subscription stay the whole model?",ub:["unblocks 20"]},
  {q:"What venue figures should staff see?",d:"Nothing financial at all, or today's takings for their own shift? Reports is already owner-only and the staff home revenue tile is hidden — this settles the last of it.",ub:["unblocks 11"]},
];`;
const startIdx = s.indexOf('const DECISIONS=[');
const endIdx = s.indexOf('];', startIdx) + 2;
if (startIdx === -1 || endIdx === 1) throw new Error('DECISIONS array not found');
s = s.slice(0, startIdx) + NEW_DECISIONS + s.slice(endIdx);

/* 2 ── Drop the now-unused "✓ Decided" rendering (nothing carries `decided` any more). */
s = s.replace(
  /DECISIONS\.forEach\(\(d,i\)=>\{const box=el\("div","dec"\+\(d\.decided\?" done":""\)\);[\s\S]*?dec\.appendChild\(box\);\}\);/,
  'DECISIONS.forEach((d,i)=>{const box=el("div","dec");\n' +
  '  const ubs=d.ub.map(u=>`<span class="ub">▸ ${u}</span>`).join("");\n' +
  '  box.innerHTML=`<div class="dnum">${i+1}</div><div class="db"><div class="dq">${d.q}</div><div class="dd">${d.d}</div><div class="unblk">${ubs}</div></div>`;\n' +
  '  dec.appendChild(box);});'
);

/* 3 ── Re-point every reference to the new numbering (old → new):
       payments 2→1 · eligibility 3→2 · coach 4→3 · staff figures 7→4.
       Answered ones (lobby 1, reactions 5, wording 6) lose their pointer entirely. */
const R = [
  // task 1 — wording is settled now
  ['A few secondary screens still say "Games" and are being swept. Final wording is a quick confirm (decision 6).',
   'A few secondary screens still say "Games" and are being swept. The wording is settled — Play / Book Court / Find Coach stays.'],
  // task 7 — lobby direction confirmed
  ["We'd like to confirm the intended rule alongside the Open Play lobby direction (decision 1).",
   'The lobby direction is now confirmed (Open Play gets a lobby, like an event), so the invite rule follows from it.'],
  // task 8 — lobby confirmed
  ['Extending the same chat to Open Play sessions follows naturally once the lobby direction is set (decision 1).',
   'With the lobby direction confirmed, extending the same chat to Open Play sessions is the natural next step.'],
  // task 11 — staff figures is now decision 4
  ['Whether staff should also lose the per-venue insights view is a quick preference to confirm (decision 7).',
   'Whether staff should also lose the per-venue insights view is a quick preference to confirm (decision 4).'],
  // task 18 — payments is now decision 1
  ['Collecting that fee is ready to build as soon as the Open Play payment rules are confirmed (decision 2). Court bookings already run the platform fee today.',
   'Collecting that fee is ready to build as soon as the Open Play payment rules are confirmed (decision 1). Court bookings already run the platform fee today.'],
  ['The gate works; collection follows decision 2 (see 18).', 'The gate works; collection follows decision 1 (see 18).'],
  // task 20 — coach payments is now decision 3
  ['Whether to also take a per-session commission is a business decision to confirm (decision 4).',
   'Whether to also take a per-session commission is a business decision to confirm (decision 3).'],
  // task 23 — wording settled
  ['Labelled "Find Coach" — final wording is part of decision 6.',
   'Labelled "Find Coach" — the wording is settled and stays.'],
  // money flow
  ['A per-session commission is <span class="next">decision 4</span>.', 'A per-session commission is <span class="next">decision 3</span>.'],
  ['<span class="next">collection is ready to switch on</span> once the payment rules are confirmed (decision 2).',
   '<span class="next">collection is ready to switch on</span> once the payment rules are confirmed (decision 1).'],
  // demo acts
  ['pv:"Features 6, 19 · opens decision 2"', 'pv:"Features 6, 19 · opens decision 1"'],
  ['pv:"Features 20, 22 · opens decision 4"', 'pv:"Features 20, 22 · opens decision 3"'],
  ['d:"Walk the decisions above — lobby, payments, eligibility, coach commission, reactions, wording, and the two small refinements.",pv:"Sets next week\'s priorities"',
   'd:"Walk the four open decisions above — Open Play payments, eligibility behaviour, coach commission, and what figures staff may see.",pv:"Sets next week\'s priorities"'],
  // section intro
  ['<p class="sec-intro">None of these are blocked by engineering — they\'re product choices. Each one lets us finish specific features above. These are the agenda for this week.</p>',
   '<p class="sec-intro">Only what is still open — the ones already settled have been taken off this list. None are blocked by engineering; they\'re product choices, and each lets us finish specific features above. This is the agenda for this week.</p>'],
  ['<span class="count">priority order</span>', '<span class="count">4 still open · priority order</span>'],
];
let missed = [];
for (const [a, b] of R) { if (!s.includes(a)) missed.push(a.slice(0, 55)); else s = s.split(a).join(b); }

writeFileSync(F, s);
console.log(`written: ${s.length} bytes (was ${before.length})`);
console.log(`replacements applied: ${R.length - missed.length}/${R.length}`);
if (missed.length) { console.log('MISSED (check these):'); missed.forEach(m => console.log('  - ' + m)); }
// sanity: no stale pointers to removed decisions
const stale = [...s.matchAll(/decision [567]\b/g)].map(m => m[0]);
console.log('stale pointers to removed decisions:', stale.length ? stale : 'none ✓');
