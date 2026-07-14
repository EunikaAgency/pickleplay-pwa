# What's still unfinished

Phase 1 is done (5/5). This is what's left.

> **Updated 14 July.** The four big questions were answered — see the `Decided` blocks below. The
> headline: **Open Play is player-booked, gets a real lobby, and is free to join unless a subscribed
> organizer charges.** The work turns out to be a **merge** (`OpenPlaySession` → `Game`), not a
> rebuild. **One answer still gates the build** — whether PickleBallers cuts an organizer's join fee.

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
> - The organizer subscription is **already in the code and purchasable — with zero subscribers.**
> - ❓ **Still open:** does PickleBallers take a cut of the organizer's *join fee* too? Reading "a
>   percentage **only** when booking" as **no — the organizer keeps all of it.** Confirm.
> - ❓ **Still open:** coach payments. Unchanged — the app still tells the player to pay the coach
>   afterwards.

## 5. Two things Phase 1 exposed

- **The "Events" tab has no events in it** — it's full of ordinary players' games. The real
  competition sits outside Play. Merge, or rename? — ❓ **still open**
- **A price shows on games that costs you nothing** — it's the court rate the host already paid. The
  filter is fixed; the listing still misleads. Can't fix it until we know who charges whom.

> ### ✅ Unblocked by item 4.
> A listing shows **Free** unless a subscribed organizer set a join fee — in which case it shows
> **that** fee, never the court rate. The court rate is the host's cost, not the joiner's.

## 6. Left for later, on purpose

Social feed · cart checkout · player-facing equipment rental · staff permission levels · re-tuning
the Play ranking.

## 7. Decisions still needed

**The three that matter most — all three ANSWERED 14 July:**

1. ~~Does Open Play get a lobby?~~ → ✅ **Yes**, with a cap. (item 3)
2. ~~Who charges for Open Play, and does PickleBallers take a cut?~~ → ✅ **Free to join** unless the
   host is a subscribed organizer, who sets the fee and keeps it. **PickleBallers takes 7% on the
   booking only** — already live. (item 4)
3. ~~Hide games you can't join, or show them marked?~~ → ✅ **Show them, marked — and disable the
   card.**

> ### Decision on #3, in full — stricter than what was built
> - The listing **still shows** the game, marked as ineligible.
> - **The card is not clickable** — you cannot open its info page.
> - **The Join button is disabled too**, as a second guard, in case anyone reaches the page.
>
> So whoever chose "show it, marked" chose **right** — but only half-built it. Today you can still
> open the game and see a live Join button. **To do:** disable the card itself.

**Still open — the short list:**
1. **Does PickleBallers cut the organizer's join fee**, or does the organizer keep all of it?
   (item 4)
2. **Coach payments** — unchanged, still "pay the coach afterwards".
3. **The "Events" tab** — merge or rename? (item 5)
4. Is "Like" different from "Interested" · final homepage wording.

**And six things already live that nobody signed off on:** the ₱499 coach subscription (the only
thing earning money), the "₱229,000 partner revenue" figure, the pricing engine, the unused rental
inventory, Tournaments sitting outside Play, and request-to-book.

> The **₱999 organizer subscription** is now a seventh — it is live and purchasable, with **zero
> subscribers**. As of today's decision it is the *only* way anyone can charge for Open Play, so it
> stops being dormant and starts being load-bearing.

---

**Next:** items 1, 3, 4 and the show-vs-hide question are all settled. The work is now a **merge**
(`OpenPlaySession` → `Game`), not a rebuild. One answer still gates the build: **whether
PickleBallers cuts the organizer's join fee**.

*Detail, if you want it: [`minutes-2026-07-08-followup.md`](minutes-2026-07-08-followup.md) ·
[`../reports/2026-07-14-Ivan-phase-1-play-and-open-play.md`](../reports/2026-07-14-Ivan-phase-1-play-and-open-play.md)*

---
---

# Tagalog — Ano pa ang kulang

Tapos na ang Phase 1 (5/5). Ito na lang ang natitira.

> **Na-update 14 Hulyo.** Nasagot na ang apat na malaking tanong — nasa mga `Desisyon` na kahon sa
> baba. Ang buod: **player ang nagbo-book ng Open Play, bibigyan ito ng tunay na lobby, at libre ang
> sumali maliban kung may sinisingil na subscribed organizer.** **Pagsasanib** pala ang trabaho
> (`OpenPlaySession` → `Game`), hindi paggawa ng bago. **Isang sagot na lang ang humaharang** —
> kukunan ba ng PickleBallers ang join fee ng organizer.

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
> - Ang organizer subscription ay **nasa code na at pwedeng bilhin — pero wala ni isang subscriber.**
> - ❓ **Bukas pa:** kukunan din ba ng 7% ang *join fee* ng organizer? Ang basa namin sa "porsyento
>   **lang** pag nag-book": **hindi — buo sa organizer.** Kumpirmahin.
> - ❓ **Bukas pa:** bayad sa coach. Hindi nagbago — sinasabi pa rin ng app na bayaran mo na lang siya
>   pagkatapos.

## 5. Dalawang bagay na lumabas dahil sa Phase 1

- **Yung "Events" tab, walang events sa loob** — puro laro ng ordinaryong player. Yung totoong
  tournaments, nasa ibang lugar. Pagsasamahin ba, o papalitan ang pangalan? — ❓ **bukas pa**
- **May presyong lumalabas sa laro pero hindi mo naman babayaran** — presyo yun ng court na bayad na
  ng nag-host. Naayos na yung filter; yung nakasulat sa card, hindi pa. Hindi namin maaayos hangga't
  di alam kung sino ang magsisingil.

> ### ✅ Nabuksan ng item 4.
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
   sumali**, maliban kung subscribed organizer ang nag-host — siya ang magtatakda, sa kanya ang bayad.
   **Sa booking lang kumukuha ng 7% ang PickleBallers** — buhay na. (item 4)
3. ~~Itatago ba yung larong di mo pwedeng salihan, o ipapakita pero may marka?~~ → ✅ **Ipakita, may
   marka — at i-disable ang card.**

> ### Buong desisyon sa #3 — mas mahigpit kaysa sa nagawa
> - **Nakikita** pa rin sa listahan, may markang hindi ka pwede.
> - **Hindi mapipindot ang card** — hindi mo mabubuksan ang info page.
> - **Disabled din ang Join button** — pangalawang harang, kung sakaling makarating man doon.
>
> Kaya yung pumili ng "ipakita, may marka" — **tama siya.** Kalahati lang ang nagawa. Ngayon,
> nabubuksan mo pa rin ang laro at buhay pa rin ang Join button. **Gagawin:** i-disable ang card mismo.

**Bukas pa — maikling listahan:**
1. **Kukunan ba ng PickleBallers ang join fee ng organizer**, o buo sa organizer? (item 4)
2. **Bayad sa coach** — hindi nagbago, "bayaran mo na lang siya pagkatapos" pa rin.
3. **Yung "Events" tab** — pagsasamahin o papalitan ang pangalan? (item 5)
4. Magkaiba ba ang "Like" at "Interested" · anong ilalagay sa homepage.

**Tapos anim na bagay na buhay na sa app pero walang nag-approve:** yung ₱499 na coach subscription
(yun lang ang kumikita), yung "₱229,000 partner revenue", yung pricing engine, yung rental inventory
na hindi magamit, yung Tournaments na nasa labas ng Play, at yung request-to-book.

> Ang **₱999 na organizer subscription**, pampito na. Buhay na at pwedeng bilhin — pero **wala ni isang
> subscriber.** Sa desisyon ngayong araw, **siya na lang ang tanging paraan** para makasingil ng
> Open Play. Kaya hindi na siya tulog — magiging haligi na siya.

---

**Susunod:** tapos na ang items 1, 3, 4, at ang itago-o-ipakita. **Pagsasanib** na ang trabaho
(`OpenPlaySession` → `Game`), hindi paggawa ng bago. Isang sagot na lang ang humaharang: **kukunan ba
ng PickleBallers ang join fee ng organizer.**
