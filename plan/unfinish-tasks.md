# What's still unfinished

Phase 1 is done (5/5). This is what's left.

> **Updated 14 July — Open Play, money, and refunds are all decided. Nothing gates the build.** See
> the `Decided` blocks below.
>
> **The headline:** Open Play is **player-booked** (any player, no role needed), gets a **real lobby**
> with a player-set cap, and is **free to join** unless a subscribed organizer charges — in which case
> **they keep every peso**. The work turns out to be a **merge** (`OpenPlaySession` → `Game`), not a
> rebuild.
>
> **The revenue model, in one line:** the **subscription is the licence to charge**. PickleBallers
> takes **7% on court bookings and nothing else**. The player pays the transaction fee. On a refund,
> **whoever cancelled pays** — outside a **3-day free window**.
>
> **Still open:** homepage wording, and the seven live-but-unapproved things. **Neither blocks Open
> Play.**

---

## 1. Settle this first: do venues host their own sessions? — ✅ ANSWERED 14 July

> ### Decided: **NO.**
> - **A player creates Open Play** by booking a court. **Any** player — no special role needed.
> - **"Organizer" is not a venue.** It's a paid subscription a *player* can hold (already in the
>   code: `PartnerPlan = 'coach' | 'organizer'`, ₱999). It does **not** gate creating Open Play. It
>   gates **charging** for it — see item 4.
> - **Recurring stays, but moves.** It becomes an option in **booking step 2**: repeat this? on which
>   days? — always at the time slot already booked. It is *not* an organizer-only publishing tool.
>
> **What the code actually holds (checked 14 July, corrects the numbers above):**
> | | rows | booked a court? | lobby? |
> |---|---|---|---|
> | `Game` — player-created | 37 (19 open) | ✅ yes | ✅ yes |
> | `OpenPlaySession` — organizer-published, read-only | 95 | ❌ **no** | ❌ no |
> | └ with a real organizer (from 5 recurring series) | 35 | ❌ no | ❌ no |
> | └ legacy editorial/import, **no owner at all** | 60 | ❌ no | ❌ no |
>
> **So the work is a MERGE, not a rebuild.** `Game` already is the model we just agreed on — booking,
> lobby, restrictions, capacity. `OpenPlaySession` is the same idea built without a booking.
>
> **To do:**
> 1. Fold `OpenPlaySession` into `Game` — every Open Play goes through a court booking.
> 2. Move recurring into booking step 2 (drop `OpenPlaySeries` as an organizer-only surface).
> 3. Delete the 60 ownerless legacy rows.
>
> **⚠️ Live revenue hole:** those 35 organizer sessions run with **no court booked and no payment**,
> so PickleBallers earns **nothing** on them. The 7% only fires on a booking.

## 2. Restrictions are half built — ✅ UNBLOCKED by item 1

**Works:** a player who hosts can set men-only / women-only / open-to-all, and it's genuinely
enforced — the wrong people can't get in.

**Doesn't work:**
- Venue-run sessions have no restriction setting at all, and nothing stops the wrong people joining.
- No skill restriction ("beginners only") anywhere.
- **Someone chose "show it, marked ineligible" over "hide it" — nobody approved that.**

> ### Decided:
> - The first bullet **dissolves with the merge**. Once every Open Play is a `Game`, it inherits the
>   restrictions that already work. Nothing new to build there.
> - **Skill restriction ("beginners only") still to build.**
> - **Show-vs-hide: settled — see item 7's decision below.** The direction that was already built is
>   right; the build is incomplete.

## 3. Open Play has no lobby — ✅ ANSWERED 14 July

One tap ("I'm Interested") and a headcount. No confirmed roster, no invites, no group chat.

The pieces already exist elsewhere in the app. It's a matter of connecting them — not building from
scratch.

> ### Decided: **YES — Open Play gets a lobby.**
> - **"I'm Interested" is replaced by a real lobby**, the same one `Game` already has: named roster,
>   invites, group chat.
> - **The player sets the cap** — an option at booking, **and editable afterwards**. Not taken from
>   the court's capacity.
> - **Guard:** the cap can never be lowered below the number already joined. Nobody gets bumped by an
>   edit.

## 4. No rules for money — ✅ ANSWERED 14 July

Who charges, where it goes, does PickleBallers take a cut, what happens on refunds. Same for
coaching — the app currently tells the player to pay the coach afterwards.

Not hard to build. We just don't know the rules. Real money already moves through the app
(tournament entry fees), so we'd extend that rather than invent something new.

> ### Decided:
> | Who | Joining their Open Play costs | Who keeps it |
> |---|---|---|
> | **Any player** (no subscription) | **Free** | — |
> | **Player subscribed as organizer** (₱999) | **They decide** — free or paid | **They keep it** |
>
> - **PickleBallers' cut is on the BOOKING only** — the court fee the host pays. Already built and
>   live: `serviceFeePercent`, **7%**, on every `Booking`. Nothing to change here.
> - **PickleBallers takes NO cut of the organizer's join fee.** Confirmed 14 July. The organizer keeps
>   every peso of it. The 7% on the booking is the platform's *only* earning on an Open Play.
> - The organizer subscription is **already in the code and purchasable — with zero subscribers.**
>
> **Worked example.** An organizer books a ₱800 court and charges ₱150/head. Six join.
> → Organizer keeps **₱900**, in full. PickleBallers earns **7% of ₱800 ≈ ₱56**. Nothing else.
>
> ### Coach payments — decided 14 July
> - **Lesson fees go through the app**, like a court booking. No more "pay the coach afterwards".
> - **PickleBallers takes 0%** of the lesson fee. The coach already paid ₱499 to *be* a coach.
>
> ### The revenue model, stated plainly
> | Money | PickleBallers takes |
> |---|---|
> | Court booking | **7%** |
> | Organizer's join fee (₱999 sub) | **0%** |
> | Coach's lesson fee (₱499 sub) | **0%** |
>
> **The subscription is the licence to charge.** The platform does not cut into what a partner earns.
>
> ### The transaction fee — decided 14 July
> **The player pays it.** Tax and transaction charges on a court booking or a coaching lesson are
> borne by **the person booking**, shown at checkout. They are not absorbed by PickleBallers and not
> deducted from the partner. So the 0% cut above stays a true 0% — the platform loses nothing on it.
>
> ### Refunds — decided 14 July
> **Free-cancellation window: 3 days.** Cancel more than 3 days out and the refund is **whole** — no
> deduction, whoever cancels. The slot can still be resold; nothing was really lost.
>
> **Inside the window, whoever cancels pays the transaction fee.**
>
> | Who cancelled | Player gets back | Who eats the fee |
> |---|---|---|
> | **The player** — changed their mind | Amount **minus** the fee | **The player** |
> | **Host / organizer / coach** | **100%, whole** | **The canceller** — off their payout |
> | **Venue, weather, or us** | **100%, whole** | **PickleBallers** |
>
> The principle: **you pay for the damage you cause.** A player must never be left worse off by
> someone *else's* cancellation than by never having booked.
>
> ### ⚠️ Warn the player BEFORE they confirm
> When a player cancels and the fee will come off their refund, the confirmation must **say so, with
> the real numbers, before the button is pressed** — "You paid ₱800. You will get back **₱773**. A
> ₱27 transaction fee is deducted." Then they choose.
>
> **No surprises after the fact.** A deduction discovered *after* confirming is how you lose a player
> for good. If we cannot show the exact figure, we do not take the deduction.
>
> ⚠️ **A refund is never free.** The gateway does not return the original processing fee when you
> refund — that money is already spent — and some charge a further refund fee. Every refund costs
> somebody; the table above only decides *who*.
>
> ### Gateway: **PayMongo — not set up yet**
> **Do not hardcode a fee percentage.** It goes in settings beside `serviceFeePercent`, and the real
> numbers get filled in when PayMongo is actually wired. No guessed figures in the code or the UI.

## 5. Two things Phase 1 exposed

- **The "Events" tab has no events in it** — it's full of ordinary players' games. The real
  competition sits outside Play. Merge, or rename?
- **A price shows on games that costs you nothing** — it's the court rate the host already paid. The
  filter is fixed; the listing still misleads. Can't fix it until we know who charges whom.

> ### Decided 14 July — the first bullet was wrong. **Leave "Events" alone.**
> Two corrections first:
> - **It isn't a tab.** It's a segment inside the **Play** tab, beside Open Play —
>   [`GamesScreenV2.tsx:40`](../app/src/features/games/v2/GamesScreenV2.tsx#L40). Play lands on Open
>   Play; Events is the other half.
> - **The name is deliberate, not a typo.** "Events" is a *container for competitive formats* —
>   round-robin, mini tournament, bracketing — not a synonym for "tournament". It reads empty only
>   because the public game is currently the *only* format built.
>
> The schema already anticipates this: [`games.model.ts:17`](../api/src/features/games/games.model.ts#L17)
> carries `format: 'bracketing' | 'round_robin' | 'mini_tournament'` on `gameType: 'public'` (8 rows
> today). **The name is right; the contents are just early.**
>
> - **Do NOT rename it.** **Do NOT merge Tournaments into it.**
> - **Tournaments is skipped for now** — the public game serves as the mini tournament.
> - Building out the other formats is future work, not a fix.

> ### ✅ Second bullet — unblocked by item 4.
> A listing shows **Free** unless a subscribed organizer set a join fee — in which case it shows
> **that** fee, never the court rate. The court rate is the host's cost, not the joiner's.

## 6. Left for later, on purpose

Social feed · cart checkout · player-facing equipment rental · staff permission levels · re-tuning
the Play ranking.

## 7. Decisions still needed

**The three that matter most — all three ANSWERED 14 July:**

1. ~~Does Open Play get a lobby?~~ → ✅ **Yes**, with a cap. (item 3)
2. ~~Who charges for Open Play, and does PickleBallers take a cut?~~ → ✅ **Free to join** unless the
   host is a subscribed organizer, who sets the fee and **keeps all of it**. **PickleBallers takes 7%
   on the booking only** — already live. (item 4)
3. ~~Hide games you can't join, or show them marked?~~ → ✅ **Show them, marked — and disable the
   card.**

> ### Decision on #3, in full — stricter than what was built
> - The listing **still shows** the game, marked as ineligible.
> - **The card is not clickable** — you cannot open its info page.
> - **The Join button is disabled too**, as a second guard, in case anyone reaches the page.
>
> So whoever chose "show it, marked" chose **right** — but only half-built it. Today you can still
> open the game and see a live Join button. **To do:** disable the card itself.

> ### "Like" vs "Interested" — answered from the code 14 July. **No decision needed.**
> They were never the same thing, and never met:
> - **"Interested"** exists only on **Open Play** (`interestedCount` / `interestedUsers`).
> - **"Like"** exists only on **club posts** in Social (`reactionCount` / `viewerReacted`). It does
>   not appear on games at all.
>
> And **"Interested" is being deleted anyway** — the lobby replaces it (item 3). The question
> dissolves with the merge.

**Still open — nothing here blocks the Open Play build:**
1. **Final homepage wording.**
2. **The seven live-but-unapproved things below** — each still needs a keep-or-kill.

**And six things already live that nobody signed off on:** the ₱499 coach subscription (the only
thing earning money), the "₱229,000 partner revenue" figure, the pricing engine, the unused rental
inventory, Tournaments sitting outside Play, and request-to-book.

> - **Tournaments outside Play — parked, 14 July.** Deliberately skipped for now; the public game
>   serves as the mini tournament. Not a question anymore.
> - **The ₱999 organizer subscription** is a seventh — live and purchasable, with **zero subscribers**.
>   As of today's decision it is the *only* way anyone can charge for Open Play, so it stops being
>   dormant and starts being load-bearing.

---

**Next: the build can start.** Open Play, the revenue model, and refunds are all settled. The work is
a **merge** (`OpenPlaySession` → `Game`), not a rebuild.

Only two things are still open — **homepage wording** and the **seven live-but-unapproved things** —
and neither blocks a line of it.

*Detail, if you want it: [`minutes-2026-07-08-followup.md`](minutes-2026-07-08-followup.md) ·
[`../reports/2026-07-14-Ivan-phase-1-play-and-open-play.md`](../reports/2026-07-14-Ivan-phase-1-play-and-open-play.md)*

---
---

# Tagalog — Ano pa ang kulang

Tapos na ang Phase 1 (5/5). Ito na lang ang natitira.

> **Na-update 14 Hulyo — tapos na ang Open Play, ang pera, at ang refund. Wala nang humaharang.** Nasa
> mga `Desisyon` na kahon sa baba.
>
> **Ang buod:** **player ang nagbo-book** ng Open Play (kahit sino, walang kailangang role), may
> **tunay na lobby** na siya rin ang naglagay ng cap, at **libre ang sumali** — maliban kung may
> sinisingil na subscribed organizer, at **buo sa kanya** ang bawat piso. **Pagsasanib** pala ang
> trabaho (`OpenPlaySession` → `Game`), hindi paggawa ng bago.
>
> **Ang modelo ng kita, sa isang linya:** ang **subscription ang bayad sa karapatang makasingil**.
> **7% sa booking ng court** ang kukunin ng PickleBallers, at wala nang iba. Ang player ang sasagot sa
> transaction fee. Sa refund, **kung sino ang nagkansela, siya ang sasagot** — labas sa **3-araw na
> libreng bintana**.
>
> **Bukas pa:** wording ng homepage, at yung pitong buhay-pero-walang-approval. **Wala sa kanila ang
> humaharang sa Open Play.**

---

## 1. Sagutin muna to: nagpapatakbo ba ng sarili nilang session ang mga venue? — ✅ NASAGOT 14 Hulyo

> ### Desisyon: **HINDI.**
> - **Player ang gumagawa ng Open Play** — nag-book siya ng court. **Kahit sinong player.** Walang
>   kailangang espesyal na role.
> - **Ang "organizer" ay hindi venue.** Subscription siya na hawak ng isang *player* (nasa code na:
>   `PartnerPlan = 'coach' | 'organizer'`, ₱999). **Hindi** ito ang nagbubukas ng paggawa ng Open
>   Play — **ang nagbubukas ng pagsingil.** Tingnan ang item 4.
> - **Mananatili ang recurring, pero lilipat.** Magiging option sa **booking step 2**: uulitin mo ba?
>   anong mga araw? — palaging kasunod ang oras na na-book na. **Hindi** ito kasangkapang pang-organizer.
>
> **Ang totoong nasa code (tiningnan 14 Hulyo — mali ang bilang sa itaas):**
> | | rows | may booking? | may lobby? |
> |---|---|---|---|
> | `Game` — player ang gumawa | 37 (19 open) | ✅ oo | ✅ oo |
> | `OpenPlaySession` — organizer ang naglathala, read-only | 95 | ❌ **wala** | ❌ wala |
> | └ may tunay na organizer (galing sa 5 recurring series) | 35 | ❌ wala | ❌ wala |
> | └ lumang editorial/import, **walang may-ari kahit sino** | 60 | ❌ wala | ❌ wala |
>
> **Kaya PAGSASANIB ang trabaho, hindi paggawa ng bago.** Ang `Game`, siya na mismo ang modelong
> napagkasunduan natin — booking, lobby, restriction, capacity. Ang `OpenPlaySession` ay parehong
> ideya, ginawa lang nang walang booking.
>
> **Gagawin:**
> 1. Isanib ang `OpenPlaySession` sa `Game` — lahat ng Open Play, dadaan sa booking ng court.
> 2. Ilipat ang recurring sa booking step 2 (aalisin ang `OpenPlaySeries` bilang pang-organizer lang).
> 3. Burahin ang 60 na walang may-ari.
>
> **⚠️ May butas sa pera ngayon:** yung 35 na organizer session ay tumatakbo nang **walang court na
> na-book at walang bayad** — kaya **walang kinikita** ang PickleBallers doon. Sa booking lang tumatama
> ang 7%.

## 2. Kalahati pa lang ang restriction — ✅ NABUKSAN ng item 1

**Gumagana:** kapag player ang nag-host, kaya na niyang gawing lalaki lang, babae lang, o pwede lahat
— at totoong hindi makakapasok yung hindi bagay.

**Hindi pa gumagana:**
- Yung mga session ng venue, walang ganitong setting. At kahit ilagay natin, walang pumipigil sa
  hindi bagay na sumali.
- Wala pang "beginners lang" na restriction kahit saan.
- **May pumili ng "ipakita pero markahan" imbes na "itago" — walang nag-approve nun.**

> ### Desisyon:
> - Yung unang bullet, **mawawala sa pagsasanib.** Pag naging `Game` na ang lahat ng Open Play,
>   makukuha na nila ang restriction na gumagana na. Wala nang bagong gagawin doon.
> - **Yung "beginners lang" na restriction, gagawin pa.**
> - **Yung itago-o-ipakita: napagdesisyunan na — nasa item 7 sa baba.** Tama ang pinili nila; kulang
>   lang ang pagkakagawa.

## 3. Wala pang lobby ang Open Play — ✅ NASAGOT 14 Hulyo

Isang pindot lang ("I'm Interested") tapos bilang ng tao. Hindi mo makikita kung sino ang sigurado,
walang invite, walang group chat.

May ganito nang parts sa ibang bahagi ng app. Ikakabit lang — hindi na gagawin from scratch.

> ### Desisyon: **OO — bibigyan ng lobby ang Open Play.**
> - **Papalitan ng tunay na lobby ang "I'm Interested"** — yung mismong meron na ang `Game`: nakikitang
>   roster, invite, group chat.
> - **Ang player ang naglalagay ng cap** — may option sa booking, **at pwedeng baguhin mamaya** sa
>   edit. Hindi galing sa capacity ng court.
> - **Harang:** hindi pwedeng ibaba ang cap sa ilalim ng bilang ng nakasali na. Walang matatanggal na
>   tao dahil lang sa edit.

## 4. Wala pang rules sa pera — ✅ NASAGOT 14 Hulyo

Sino ang magsisingil, saan mapupunta, may kukunin ba ang PickleBallers, paano kapag nag-refund.
Ganun din sa coach — sinasabi mismo ng app na bayaran mo na lang ang coach pagkatapos.

Hindi mahirap gawin. **Hindi lang namin alam ang rules.** May dumadaan nang totoong pera sa app
(bayad sa tournament), kaya yun ang gagamitin — hindi na mag-iimbento ng bago.

> ### Desisyon:
> | Sino | Ang pagsali sa Open Play niya | Kanino mapupunta |
> |---|---|---|
> | **Kahit sinong player** (walang subscription) | **Libre** | — |
> | **Player na naka-subscribe as organizer** (₱999) | **Siya ang magtatakda** — libre o may bayad | **Sa kanya** |
>
> - **Sa BOOKING lang kumukuha ang PickleBallers** — sa bayad sa court ng nag-host. Buhay na ito:
>   `serviceFeePercent`, **7%**, sa bawat `Booking`. Walang babaguhin dito.
> - **Walang kinukuha ang PickleBallers sa join fee ng organizer.** Kumpirmado 14 Hulyo. **Buo sa
>   organizer** ang bawat piso. Ang 7% sa booking ang **tanging** kita ng platform sa Open Play.
> - Ang organizer subscription ay **nasa code na at pwedeng bilhin — pero wala ni isang subscriber.**
>
> **Halimbawa.** Nag-book ang organizer ng ₱800 na court, sinisingil ng ₱150 kada tao. Anim ang sumali.
> → **₱900** ang sa organizer, buo. **7% ng ₱800 ≈ ₱56** ang sa PickleBallers. Wala nang iba.
>
> ### Bayad sa coach — napagdesisyunan 14 Hulyo
> - **Dadaan na sa app ang bayad sa lesson**, gaya ng booking ng court. Wala nang "bayaran mo na lang
>   siya pagkatapos."
> - **0% ang kukunin ng PickleBallers** sa lesson fee. Nagbayad na ng ₱499 ang coach para *maging* coach.
>
> ### Ang modelo ng kita, plano-plano
> | Pera | Kukunin ng PickleBallers |
> |---|---|
> | Booking ng court | **7%** |
> | Join fee ng organizer (₱999 sub) | **0%** |
> | Lesson fee ng coach (₱499 sub) | **0%** |
>
> **Ang subscription ang bayad sa karapatang makasingil.** Hindi kumakagat ang platform sa kinikita ng
> partner.
>
> ### Ang transaction fee — napagdesisyunan 14 Hulyo
> **Ang player ang sasagot.** Ang buwis at kaltas sa booking ng court o sa lesson ng coach ay **sa
> nagbo-book** manggagaling, at nakikita sa checkout. Hindi sasagutin ng PickleBallers, hindi
> ikakaltas sa partner. Kaya ang 0% sa itaas ay **tunay ngang 0%** — walang nalulugi ang platform doon.
>
> ### Refund — napagdesisyunan 14 Hulyo
> **Libreng bintana: 3 araw.** Kanselahin nang mahigit 3 araw bago, at **buo** ang refund — walang
> kaltas, kahit sino pa ang nagkansela. Naibebenta pa ang slot; wala namang tunay na nasira.
>
> **Sa loob ng bintana, kung sino ang nagkansela, siya ang sasagot sa transaction fee.**
>
> | Sino ang nagkansela | Makukuha ng player | Sino ang kakaltasan |
> |---|---|---|
> | **Ang player** — nagbago ang isip | Bayad **bawas** ang fee | **Ang player** |
> | **Host / organizer / coach** | **Buo. 100%.** | **Ang nagkansela** — bawas sa payout niya |
> | **Venue, ulan, o kami** | **Buo. 100%.** | **PickleBallers** |
>
> Ang batayan: **ikaw ang magbabayad sa pinsalang ikaw ang may gawa.** Hindi kailanman dapat mas
> masama ang kalalabasan ng player dahil sa kanselang **hindi niya** ginawa, kaysa sa hindi na lang
> siya nag-book.
>
> ### ⚠️ Sabihan ang player BAGO siya magkumpirma
> Kapag player ang nagkansela at may ikakaltas sa refund niya, **dapat nakasulat sa kumpirmasyon, may
> totoong numero, bago pa niya mapindot** — "Nagbayad ka ng ₱800. Makukuha mo ang **₱773**. May ₱27 na
> transaction fee na ikakaltas." Siya na ang bahalang pumili.
>
> **Walang gulat pagkatapos.** Ang kaltas na nadiskubre **matapos** magkumpirma — yun ang paraan para
> tuluyang mawala ang isang player. Kung hindi natin maipapakita ang eksaktong halaga, **hindi tayo
> kakaltas.**
>
> ⚠️ **Walang libreng refund.** Hindi ibinabalik ng gateway ang orihinal na processing fee kapag
> nag-refund ka — gastos na yun — at may dagdag pang refund fee ang iba. **May gastos ang bawat
> refund**; ang tanging pinagdedesisyunan ng talahanayan sa itaas ay **sino** ang sasagot.
>
> ### Gateway: **PayMongo — hindi pa naka-setup**
> **Huwag i-hardcode ang porsyento ng fee.** Ilalagay siya sa settings, katabi ng `serviceFeePercent`,
> at ilalagay ang totoong bilang pag na-wire na ang PayMongo. **Walang hulang numero sa code o sa UI.**

## 5. Dalawang bagay na lumabas dahil sa Phase 1

- **Yung "Events" tab, walang events sa loob** — puro laro ng ordinaryong player. Yung totoong
  tournaments, nasa ibang lugar. Pagsasamahin ba, o papalitan ang pangalan?
- **May presyong lumalabas sa laro pero hindi mo naman babayaran** — presyo yun ng court na bayad na
  ng nag-host. Naayos na yung filter; yung nakasulat sa card, hindi pa. Hindi namin maaayos hangga't
  di alam kung sino ang magsisingil.

> ### Desisyon 14 Hulyo — **mali ang unang bullet. Wag galawin ang "Events".**
> Dalawang pagtatama muna:
> - **Hindi siya tab.** Segment siya sa loob ng **Play** tab, katabi ng Open Play —
>   [`GamesScreenV2.tsx:40`](../app/src/features/games/v2/GamesScreenV2.tsx#L40). Sa Open Play bumabagsak
>   ang Play; ang Events ang kabilang kalahati.
> - **Sinadya ang pangalan, hindi typo.** Ang "Events" ay **lalagyan ng mga format ng kompetisyon** —
>   round-robin, mini tournament, bracketing. Hindi siya katumbas ng "tournament". Mukha lang siyang
>   walang laman kasi ang public game pa lang ang **tanging** format na nabubuo.
>
> Nakahanda na ito sa schema: [`games.model.ts:17`](../api/src/features/games/games.model.ts#L17) —
> `format: 'bracketing' | 'round_robin' | 'mini_tournament'` sa `gameType: 'public'` (8 rows ngayon).
> **Tama ang pangalan; maaga lang ang laman.**
>
> - **HUWAG palitan ang pangalan.** **HUWAG isama ang Tournaments dito.**
> - **Ipagpapaliban muna ang Tournaments** — ang public game muna ang mini tournament.
> - Ang pagbuo ng ibang format ay trabaho sa hinaharap, hindi pag-aayos ng sira.

> ### ✅ Pangalawang bullet — nabuksan ng item 4.
> **"Libre"** ang ipapakita sa card — maliban kung may in-set na join fee ang isang subscribed
> organizer, at **yun** ang ipapakita. Hindi kailanman ang presyo ng court. Gastos yun ng nag-host,
> hindi ng sasali.

## 6. Ipinagpaliban muna

Social feed · cart checkout · pagrenta ng gamit para sa player · levels ng staff permission ·
pag-adjust ng ranking.

## 7. Mga desisyong kailangan

**Tatlo ang pinakaimportante — NASAGOT na lahat noong 14 Hulyo:**

1. ~~Gagawan ba ng lobby ang Open Play?~~ → ✅ **Oo**, may cap. (item 3)
2. ~~Sino ang magsisingil sa Open Play, at may kukunin ba ang PickleBallers?~~ → ✅ **Libre ang
   sumali**, maliban kung subscribed organizer ang nag-host — siya ang magtatakda, at **buo sa kanya**
   ang bayad. **Sa booking lang kumukuha ng 7% ang PickleBallers** — buhay na. (item 4)
3. ~~Itatago ba yung larong di mo pwedeng salihan, o ipapakita pero may marka?~~ → ✅ **Ipakita, may
   marka — at i-disable ang card.**

> ### Buong desisyon sa #3 — mas mahigpit kaysa sa nagawa
> - **Nakikita** pa rin sa listahan, may markang hindi ka pwede.
> - **Hindi mapipindot ang card** — hindi mo mabubuksan ang info page.
> - **Disabled din ang Join button** — pangalawang harang, kung sakaling makarating man doon.
>
> Kaya yung pumili ng "ipakita, may marka" — **tama siya.** Kalahati lang ang nagawa. Ngayon,
> nabubuksan mo pa rin ang laro at buhay pa rin ang Join button. **Gagawin:** i-disable ang card mismo.

> ### "Like" vs "Interested" — nasagot sa code 14 Hulyo. **Walang kailangang desisyon.**
> Hindi sila kailanman naging pareho, at hindi sila nagkikita:
> - **"Interested"** — nasa **Open Play** lang (`interestedCount` / `interestedUsers`).
> - **"Like"** — nasa **club posts** lang sa Social (`reactionCount` / `viewerReacted`). Wala siya sa
>   laro kahit saan.
>
> At **mawawala na rin ang "Interested"** — pinapalitan siya ng lobby (item 3). Kusang nawawala ang
> tanong kasabay ng pagsasanib.

**Bukas pa — wala nang humaharang sa Open Play build:**
1. **Anong ilalagay sa homepage.**
2. **Yung pitong buhay-pero-walang-approval sa baba** — bawat isa, kailangan ng "itago o tanggalin".

**Tapos anim na bagay na buhay na sa app pero walang nag-approve:** yung ₱499 na coach subscription
(yun lang ang kumikita), yung "₱229,000 partner revenue", yung pricing engine, yung rental inventory
na hindi magamit, yung Tournaments na nasa labas ng Play, at yung request-to-book.

> - **Tournaments sa labas ng Play — ipinarada, 14 Hulyo.** Sinadyang laktawan muna; ang public game
>   muna ang mini tournament. Hindi na ito tanong.
> - Ang **₱999 na organizer subscription**, pampito. Buhay na at pwedeng bilhin — pero **wala ni isang
>   subscriber.** Sa desisyon ngayong araw, **siya na lang ang tanging paraan** para makasingil ng
>   Open Play. Kaya hindi na siya tulog — magiging haligi na siya.

---

**Susunod: pwede nang simulan ang build.** Tapos na ang Open Play, ang modelo ng kita, at ang refund.
**Pagsasanib** ang trabaho (`OpenPlaySession` → `Game`), hindi paggawa ng bago.

Dalawang bagay na lang ang bukas — **wording ng homepage** at yung **pitong buhay-pero-walang-approval**
— at wala ni isang linyang hinaharangan ng dalawang yun.
