# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: play-discover.spec.ts >> Discover filters (§4.3) >> the four new filters are offered
- Location: e2e/play-discover.spec.ts:105:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Venue' })
Expected: visible
Error: strict mode violation: getByRole('button', { name: 'Venue' }) resolved to 9 elements:
    1) <article tabindex="0" role="button" class="game-card">…</article> aka getByRole('button', { name: 'Open Play Advanced Open Play Sun, Jul 19 · 8:00 AM Rockwell Club, Amorsolo' })
    2) <article tabindex="0" role="button" class="game-card">…</article> aka getByRole('button', { name: 'Open Play Advanced Open Play Sun, Jul 26 · 5:00 PM The Pickle Spot Makati' })
    3) <article tabindex="0" role="button" class="game-card">…</article> aka getByRole('button', { name: 'Open Play Open / All levels Open Play Tue, Aug 4 · 6:00 PM The Dink Lab Open /' })
    4) <article tabindex="0" role="button" class="game-card">…</article> aka getByRole('button', { name: 'Open Play Intermediate Open Play Sat, Aug 8 · 5:00 PM DragonSmash Intermediate' })
    5) <article tabindex="0" role="button" class="game-card">…</article> aka getByRole('button', { name: 'Open Play Beginner Open Play Wed, Aug 5 · 9:00 AM Pickle Play Beginner · ₱350' })
    6) <article tabindex="0" role="button" class="game-card">…</article> aka getByRole('button', { name: 'Open Play Advanced Open Play Tue, Jul 28 · 10:00 AM Southridge Pickleball Club' })
    7) <article tabindex="0" role="button" class="game-card">…</article> aka getByRole('button', { name: 'Open Play Advanced Open Play Thu, Aug 6 · 7:00 AM Arcovia Pickleball Club' })
    8) <article tabindex="0" role="button" class="game-card">…</article> aka getByRole('button', { name: 'Open Play Open play Tue, Aug' })
    9) <button id="_r_2_" type="button" aria-label="Venue" aria-expanded="false" aria-haspopup="listbox" class="control flex items-center justify-between gap-2 text-left ">…</button> aka getByRole('button', { name: 'Venue', exact: true })

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('button', { name: 'Venue' })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - main [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e7]:
        - button "PickleBallers home" [ref=e8] [cursor=pointer]: PickleBallers
        - button "Notifications" [ref=e10] [cursor=pointer]:
          - img [ref=e11]
      - main [ref=e14]:
        - generic [ref=e15]:
          - generic [ref=e16]:
            - heading "Play" [level=1] [ref=e17]
            - paragraph [ref=e18]: Open play sessions, player-hosted plays, and your court bookings.
          - tablist "Play section" [ref=e20]:
            - tab "Open Play" [selected] [ref=e21] [cursor=pointer]
            - tab "Events" [ref=e22] [cursor=pointer]
          - tablist "Play view" [ref=e24]:
            - tab "Discover" [selected] [ref=e25] [cursor=pointer]
            - tab "Manage" [ref=e26] [cursor=pointer]
          - generic [ref=e27]:
            - generic [ref=e28]:
              - img [ref=e29]
              - searchbox "Search by name, venue, or host…" [ref=e32]
            - generic [ref=e33]:
              - button "Filter plays" [active] [ref=e34] [cursor=pointer]:
                - img [ref=e35]
                - text: Filter
              - generic [ref=e36]:
                - generic [ref=e37]: "Sort:"
                - 'button "Sort plays: Relevance" [ref=e38] [cursor=pointer]':
                  - text: Relevance
                  - img [ref=e39]
          - generic [ref=e41]:
            - status [ref=e42]:
              - generic [ref=e43]: Location is off, so plays aren’t sorted by distance.
              - generic [ref=e44]:
                - button "Use my location" [ref=e45] [cursor=pointer]
                - button "Dismiss" [ref=e46] [cursor=pointer]:
                  - img [ref=e47]
            - button "Open Play Open / All levels Open Play Fri, Jul 17 · 1:00 PM Valle Verde Pickleball Club Open / All levels · ₱350 · Hosted by Local League 7/13" [ref=e50] [cursor=pointer]:
              - generic [ref=e52]: Open Play
              - generic [ref=e53]:
                - generic [ref=e54]: Open / All levels Open Play
                - generic [ref=e55]:
                  - generic [ref=e56]:
                    - img [ref=e57]
                    - text: Fri, Jul 17 · 1:00 PM
                  - generic [ref=e60]:
                    - img [ref=e61]
                    - text: Valle Verde Pickleball Club
                  - generic [ref=e64]: Open / All levels · ₱350 · Hosted by Local League
                - generic [ref=e68]: 7/13
            - button "Open Play Competitive Ladder Warm-Ups Tue, Jul 14 · 6:00 PM Conquest Sports 3.5+ · Per Hour (Court Rental) Starting soon 1/10 interested" [ref=e69] [cursor=pointer]:
              - generic [ref=e71]: Open Play
              - generic [ref=e72]:
                - generic [ref=e73]: Competitive Ladder Warm-Ups
                - generic [ref=e74]:
                  - generic [ref=e75]:
                    - img [ref=e76]
                    - text: Tue, Jul 14 · 6:00 PM
                  - generic [ref=e79]:
                    - img [ref=e80]
                    - text: Conquest Sports
                  - generic [ref=e83]: 3.5+ · Per Hour (Court Rental)
                - generic [ref=e85]: Starting soon
                - generic [ref=e89]: 1/10 interested
            - button "Open Play Advanced Open Play Sun, Jul 19 · 8:00 AM Rockwell Club, Amorsolo Square Advanced · ₱400 · Hosted by Venue Staff 17/20" [ref=e90] [cursor=pointer]:
              - generic [ref=e92]: Open Play
              - generic [ref=e93]:
                - generic [ref=e94]: Advanced Open Play
                - generic [ref=e95]:
                  - generic [ref=e96]:
                    - img [ref=e97]
                    - text: Sun, Jul 19 · 8:00 AM
                  - generic [ref=e100]:
                    - img [ref=e101]
                    - text: Rockwell Club, Amorsolo Square
                  - generic [ref=e104]: Advanced · ₱400 · Hosted by Venue Staff
                - generic [ref=e108]: 17/20
            - button "Open Play Intermediate Open Play Fri, Jul 17 · 4:00 PM Makati Pickleball Club Intermediate · ₱300 · Hosted by Local League 7/19" [ref=e109] [cursor=pointer]:
              - generic [ref=e111]: Open Play
              - generic [ref=e112]:
                - generic [ref=e113]: Intermediate Open Play
                - generic [ref=e114]:
                  - generic [ref=e115]:
                    - img [ref=e116]
                    - text: Fri, Jul 17 · 4:00 PM
                  - generic [ref=e119]:
                    - img [ref=e120]
                    - text: Makati Pickleball Club
                  - generic [ref=e123]: Intermediate · ₱300 · Hosted by Local League
                - generic [ref=e127]: 7/19
            - button "Open Play Weekend Warriors Open Play Wed, Jul 15 · 8:00 AM Zone Sports Center 3.5–4.0 · Per Player · Hosted by Jobert Forcadilla 0 interested" [ref=e128] [cursor=pointer]:
              - generic [ref=e130]: Open Play
              - generic [ref=e131]:
                - generic [ref=e132]: Weekend Warriors Open Play
                - generic [ref=e133]:
                  - generic [ref=e134]:
                    - img [ref=e135]
                    - text: Wed, Jul 15 · 8:00 AM
                  - generic [ref=e138]:
                    - img [ref=e139]
                    - text: Zone Sports Center
                  - generic [ref=e142]: 3.5–4.0 · Per Player · Hosted by Jobert Forcadilla
                - generic [ref=e144]: 0 interested
            - button "Open Play Payday Weekend Open Play Jam Fri, Jul 17 · 9:00 AM Blue Ridge Pickleball Club Open · Per Player · Hosted by E2E Owner 1/16 interested" [ref=e145] [cursor=pointer]:
              - generic [ref=e147]: Open Play
              - generic [ref=e148]:
                - generic [ref=e149]: Payday Weekend Open Play Jam
                - generic [ref=e150]:
                  - generic [ref=e151]:
                    - img [ref=e152]
                    - text: Fri, Jul 17 · 9:00 AM
                  - generic [ref=e155]:
                    - img [ref=e156]
                    - text: Blue Ridge Pickleball Club
                  - generic [ref=e159]: Open · Per Player · Hosted by E2E Owner
                - generic [ref=e163]: 1/16 interested
            - button "Open Play Advanced Open Play Thu, Jul 23 · 6:00 PM Lumiere Pickleball Club Advanced · ₱150 · Hosted by PB Community 3/12" [ref=e164] [cursor=pointer]:
              - generic [ref=e166]: Open Play
              - generic [ref=e167]:
                - generic [ref=e168]: Advanced Open Play
                - generic [ref=e169]:
                  - generic [ref=e170]:
                    - img [ref=e171]
                    - text: Thu, Jul 23 · 6:00 PM
                  - generic [ref=e174]:
                    - img [ref=e175]
                    - text: Lumiere Pickleball Club
                  - generic [ref=e178]: Advanced · ₱150 · Hosted by PB Community
                - generic [ref=e182]: 3/12
            - button "Open Play Open / All levels Open Play Wed, Jul 22 · 7:00 AM Rosario 5&6 Covered Court Pickleball Open / All levels · ₱300 · Hosted by PB Community 0/14" [ref=e183] [cursor=pointer]:
              - generic [ref=e185]: Open Play
              - generic [ref=e186]:
                - generic [ref=e187]: Open / All levels Open Play
                - generic [ref=e188]:
                  - generic [ref=e189]:
                    - img [ref=e190]
                    - text: Wed, Jul 22 · 7:00 AM
                  - generic [ref=e193]:
                    - img [ref=e194]
                    - text: Rosario 5&6 Covered Court Pickleball
                  - generic [ref=e197]: Open / All levels · ₱300 · Hosted by PB Community
                - generic [ref=e200]: 0/14
            - button "Open Play Mid-Month Intermediate Meetup Wed, Jul 22 · 6:00 PM Pickle Play 3.0–3.5 · Open Play Promo / Court Rental 1/12 interested" [ref=e201] [cursor=pointer]:
              - generic [ref=e203]: Open Play
              - generic [ref=e204]:
                - generic [ref=e205]: Mid-Month Intermediate Meetup
                - generic [ref=e206]:
                  - generic [ref=e207]:
                    - img [ref=e208]
                    - text: Wed, Jul 22 · 6:00 PM
                  - generic [ref=e211]:
                    - img [ref=e212]
                    - text: Pickle Play
                  - generic [ref=e215]: 3.0–3.5 · Open Play Promo / Court Rental
                - generic [ref=e219]: 1/12 interested
            - button "Open Play Advanced Open Play Sun, Jul 26 · 8:00 AM Tru Grit Pickleball Court Advanced · ₱300 · Hosted by PB Community 9/18" [ref=e220] [cursor=pointer]:
              - generic [ref=e222]: Open Play
              - generic [ref=e223]:
                - generic [ref=e224]: Advanced Open Play
                - generic [ref=e225]:
                  - generic [ref=e226]:
                    - img [ref=e227]
                    - text: Sun, Jul 26 · 8:00 AM
                  - generic [ref=e230]:
                    - img [ref=e231]
                    - text: Tru Grit Pickleball Court
                  - generic [ref=e234]: Advanced · ₱300 · Hosted by PB Community
                - generic [ref=e238]: 9/18
            - button "Open Play Open / All levels Open Play Fri, Jul 24 · 11:00 AM Montecourt Merville Open / All levels · ₱350 · Hosted by PB Community 2/9" [ref=e239] [cursor=pointer]:
              - generic [ref=e241]: Open Play
              - generic [ref=e242]:
                - generic [ref=e243]: Open / All levels Open Play
                - generic [ref=e244]:
                  - generic [ref=e245]:
                    - img [ref=e246]
                    - text: Fri, Jul 24 · 11:00 AM
                  - generic [ref=e249]:
                    - img [ref=e250]
                    - text: Montecourt Merville
                  - generic [ref=e253]: Open / All levels · ₱350 · Hosted by PB Community
                - generic [ref=e257]: 2/9
            - button "Open Play Advanced Open Play Sun, Jul 26 · 5:00 PM The Pickle Spot Makati Advanced · ₱450 · Hosted by Venue Staff 7/14" [ref=e258] [cursor=pointer]:
              - generic [ref=e260]: Open Play
              - generic [ref=e261]:
                - generic [ref=e262]: Advanced Open Play
                - generic [ref=e263]:
                  - generic [ref=e264]:
                    - img [ref=e265]
                    - text: Sun, Jul 26 · 5:00 PM
                  - generic [ref=e268]:
                    - img [ref=e269]
                    - text: The Pickle Spot Makati
                  - generic [ref=e272]: Advanced · ₱450 · Hosted by Venue Staff
                - generic [ref=e276]: 7/14
            - button "Open Play Intermediate Open Play Sat, Jul 25 · 5:00 PM UPAP Intermediate · ₱400 · Hosted by PB Community 5/16" [ref=e277] [cursor=pointer]:
              - generic [ref=e279]: Open Play
              - generic [ref=e280]:
                - generic [ref=e281]: Intermediate Open Play
                - generic [ref=e282]:
                  - generic [ref=e283]:
                    - img [ref=e284]
                    - text: Sat, Jul 25 · 5:00 PM
                  - generic [ref=e287]:
                    - img [ref=e288]
                    - text: UPAP
                  - generic [ref=e291]: Intermediate · ₱400 · Hosted by PB Community
                - generic [ref=e295]: 5/16
            - button "Open Play Intermediate Open Play Tue, Jul 28 · 10:00 AM The Upper Deck Sports Center Intermediate · ₱150 · Hosted by Local League 17/20" [ref=e296] [cursor=pointer]:
              - generic [ref=e298]: Open Play
              - generic [ref=e299]:
                - generic [ref=e300]: Intermediate Open Play
                - generic [ref=e301]:
                  - generic [ref=e302]:
                    - img [ref=e303]
                    - text: Tue, Jul 28 · 10:00 AM
                  - generic [ref=e306]:
                    - img [ref=e307]
                    - text: The Upper Deck Sports Center
                  - generic [ref=e310]: Intermediate · ₱150 · Hosted by Local League
                - generic [ref=e314]: 17/20
            - button "Open Play Intermediate Open Play Fri, Aug 7 · 7:00 PM Makati Sports Club Intermediate · ₱200 · Hosted by PB Community 15/22" [ref=e315] [cursor=pointer]:
              - generic [ref=e317]: Open Play
              - generic [ref=e318]:
                - generic [ref=e319]: Intermediate Open Play
                - generic [ref=e320]:
                  - generic [ref=e321]:
                    - img [ref=e322]
                    - text: Fri, Aug 7 · 7:00 PM
                  - generic [ref=e325]:
                    - img [ref=e326]
                    - text: Makati Sports Club
                  - generic [ref=e329]: Intermediate · ₱200 · Hosted by PB Community
                - generic [ref=e333]: 15/22
            - button "Open Play Advanced Open Play Sun, Aug 2 · 8:00 AM Pickleball Junction Advanced · ₱250 · Hosted by PB Community 11/18" [ref=e334] [cursor=pointer]:
              - generic [ref=e336]: Open Play
              - generic [ref=e337]:
                - generic [ref=e338]: Advanced Open Play
                - generic [ref=e339]:
                  - generic [ref=e340]:
                    - img [ref=e341]
                    - text: Sun, Aug 2 · 8:00 AM
                  - generic [ref=e344]:
                    - img [ref=e345]
                    - text: Pickleball Junction
                  - generic [ref=e348]: Advanced · ₱250 · Hosted by PB Community
                - generic [ref=e352]: 11/18
            - button "Open Play Intermediate Open Play Sat, Aug 8 · 6:00 AM SM Center Antipolo Downtown Intermediate · ₱300 · Hosted by Local League 10/13" [ref=e353] [cursor=pointer]:
              - generic [ref=e355]: Open Play
              - generic [ref=e356]:
                - generic [ref=e357]: Intermediate Open Play
                - generic [ref=e358]:
                  - generic [ref=e359]:
                    - img [ref=e360]
                    - text: Sat, Aug 8 · 6:00 AM
                  - generic [ref=e363]:
                    - img [ref=e364]
                    - text: SM Center Antipolo Downtown
                  - generic [ref=e367]: Intermediate · ₱300 · Hosted by Local League
                - generic [ref=e371]: 10/13
            - button "Open Play Advanced Open Play Fri, Aug 7 · 7:00 PM Mission Hills Pickleball Club Advanced · ₱300 · Hosted by Local League 15/23" [ref=e372] [cursor=pointer]:
              - generic [ref=e374]: Open Play
              - generic [ref=e375]:
                - generic [ref=e376]: Advanced Open Play
                - generic [ref=e377]:
                  - generic [ref=e378]:
                    - img [ref=e379]
                    - text: Fri, Aug 7 · 7:00 PM
                  - generic [ref=e382]:
                    - img [ref=e383]
                    - text: Mission Hills Pickleball Club
                  - generic [ref=e386]: Advanced · ₱300 · Hosted by Local League
                - generic [ref=e390]: 15/23
            - button "Open Play Intermediate Open Play Wed, Jul 29 · 7:00 PM Market! Market! Pickleball Club Intermediate · ₱300 · Hosted by Local League 13/22" [ref=e391] [cursor=pointer]:
              - generic [ref=e393]: Open Play
              - generic [ref=e394]:
                - generic [ref=e395]: Intermediate Open Play
                - generic [ref=e396]:
                  - generic [ref=e397]:
                    - img [ref=e398]
                    - text: Wed, Jul 29 · 7:00 PM
                  - generic [ref=e401]:
                    - img [ref=e402]
                    - text: Market! Market! Pickleball Club
                  - generic [ref=e405]: Intermediate · ₱300 · Hosted by Local League
                - generic [ref=e409]: 13/22
            - button "Open Play Open / All levels Open Play Tue, Aug 4 · 6:00 PM The Dink Lab Open / All levels · ₱350 · Hosted by Venue Staff 11/20" [ref=e410] [cursor=pointer]:
              - generic [ref=e412]: Open Play
              - generic [ref=e413]:
                - generic [ref=e414]: Open / All levels Open Play
                - generic [ref=e415]:
                  - generic [ref=e416]:
                    - img [ref=e417]
                    - text: Tue, Aug 4 · 6:00 PM
                  - generic [ref=e420]:
                    - img [ref=e421]
                    - text: The Dink Lab
                  - generic [ref=e424]: Open / All levels · ₱350 · Hosted by Venue Staff
                - generic [ref=e428]: 11/20
            - button "Open Play Intermediate Open Play Sat, Aug 8 · 5:00 PM DragonSmash Intermediate · ₱200 · Hosted by Venue Staff 6/11" [ref=e429] [cursor=pointer]:
              - generic [ref=e431]: Open Play
              - generic [ref=e432]:
                - generic [ref=e433]: Intermediate Open Play
                - generic [ref=e434]:
                  - generic [ref=e435]:
                    - img [ref=e436]
                    - text: Sat, Aug 8 · 5:00 PM
                  - generic [ref=e439]:
                    - img [ref=e440]
                    - text: DragonSmash
                  - generic [ref=e443]: Intermediate · ₱200 · Hosted by Venue Staff
                - generic [ref=e447]: 6/11
            - button "Open Play Advanced Open Play Fri, Jul 31 · 10:00 AM Magallanes Village Association Advanced · ₱450 · Hosted by PB Community 8/15" [ref=e448] [cursor=pointer]:
              - generic [ref=e450]: Open Play
              - generic [ref=e451]:
                - generic [ref=e452]: Advanced Open Play
                - generic [ref=e453]:
                  - generic [ref=e454]:
                    - img [ref=e455]
                    - text: Fri, Jul 31 · 10:00 AM
                  - generic [ref=e458]:
                    - img [ref=e459]
                    - text: Magallanes Village Association
                  - generic [ref=e462]: Advanced · ₱450 · Hosted by PB Community
                - generic [ref=e466]: 8/15
            - button "Open Play Beginner Open Play Thu, Jul 30 · 5:00 PM Celebrity Sports Club Beginner · ₱200 · Hosted by PB Community 7/14" [ref=e467] [cursor=pointer]:
              - generic [ref=e469]: Open Play
              - generic [ref=e470]:
                - generic [ref=e471]: Beginner Open Play
                - generic [ref=e472]:
                  - generic [ref=e473]:
                    - img [ref=e474]
                    - text: Thu, Jul 30 · 5:00 PM
                  - generic [ref=e477]:
                    - img [ref=e478]
                    - text: Celebrity Sports Club
                  - generic [ref=e481]: Beginner · ₱200 · Hosted by PB Community
                - generic [ref=e485]: 7/14
            - button "Open Play Open / All levels Open Play Thu, Jul 30 · 7:00 PM Home Court Pickleball Open / All levels · ₱400 · Hosted by Local League 8/19" [ref=e486] [cursor=pointer]:
              - generic [ref=e488]: Open Play
              - generic [ref=e489]:
                - generic [ref=e490]: Open / All levels Open Play
                - generic [ref=e491]:
                  - generic [ref=e492]:
                    - img [ref=e493]
                    - text: Thu, Jul 30 · 7:00 PM
                  - generic [ref=e496]:
                    - img [ref=e497]
                    - text: Home Court Pickleball
                  - generic [ref=e500]: Open / All levels · ₱400 · Hosted by Local League
                - generic [ref=e504]: 8/19
            - button "Open Play Intermediate Open Play Sat, Aug 1 · 9:00 AM The 3rd Shot Homecourt Intermediate · ₱300 · Hosted by PB Community 1 spot left 22/23" [ref=e505] [cursor=pointer]:
              - generic [ref=e507]: Open Play
              - generic [ref=e508]:
                - generic [ref=e509]: Intermediate Open Play
                - generic [ref=e510]:
                  - generic [ref=e511]:
                    - img [ref=e512]
                    - text: Sat, Aug 1 · 9:00 AM
                  - generic [ref=e515]:
                    - img [ref=e516]
                    - text: The 3rd Shot Homecourt
                  - generic [ref=e519]: Intermediate · ₱300 · Hosted by PB Community
                - generic [ref=e521]: 1 spot left
                - generic [ref=e525]: 22/23
            - button "Open Play Advanced Open Play Wed, Jul 29 · 6:00 PM Metro South Pickleball Club Advanced · ₱250 · Hosted by PB Community 4/13" [ref=e526] [cursor=pointer]:
              - generic [ref=e528]: Open Play
              - generic [ref=e529]:
                - generic [ref=e530]: Advanced Open Play
                - generic [ref=e531]:
                  - generic [ref=e532]:
                    - img [ref=e533]
                    - text: Wed, Jul 29 · 6:00 PM
                  - generic [ref=e536]:
                    - img [ref=e537]
                    - text: Metro South Pickleball Club
                  - generic [ref=e540]: Advanced · ₱250 · Hosted by PB Community
                - generic [ref=e544]: 4/13
            - button "Open Play Intermediate Open Play Fri, Jul 31 · 1:00 PM Blue Ridge Pickleball Club Intermediate · ₱150 · Hosted by PB Community 5/17" [ref=e545] [cursor=pointer]:
              - generic [ref=e547]: Open Play
              - generic [ref=e548]:
                - generic [ref=e549]: Intermediate Open Play
                - generic [ref=e550]:
                  - generic [ref=e551]:
                    - img [ref=e552]
                    - text: Fri, Jul 31 · 1:00 PM
                  - generic [ref=e555]:
                    - img [ref=e556]
                    - text: Blue Ridge Pickleball Club
                  - generic [ref=e559]: Intermediate · ₱150 · Hosted by PB Community
                - generic [ref=e563]: 5/17
            - button "Open Play Beginner Open Play Wed, Aug 5 · 9:00 AM Pickle Play Beginner · ₱350 · Hosted by Venue Staff 7/24" [ref=e564] [cursor=pointer]:
              - generic [ref=e566]: Open Play
              - generic [ref=e567]:
                - generic [ref=e568]: Beginner Open Play
                - generic [ref=e569]:
                  - generic [ref=e570]:
                    - img [ref=e571]
                    - text: Wed, Aug 5 · 9:00 AM
                  - generic [ref=e574]:
                    - img [ref=e575]
                    - text: Pickle Play
                  - generic [ref=e578]: Beginner · ₱350 · Hosted by Venue Staff
                - generic [ref=e582]: 7/24
            - button "Open Play Advanced Open Play Tue, Jul 28 · 10:00 AM Southridge Pickleball Club Advanced · ₱200 · Hosted by Venue Staff 3/13" [ref=e583] [cursor=pointer]:
              - generic [ref=e585]: Open Play
              - generic [ref=e586]:
                - generic [ref=e587]: Advanced Open Play
                - generic [ref=e588]:
                  - generic [ref=e589]:
                    - img [ref=e590]
                    - text: Tue, Jul 28 · 10:00 AM
                  - generic [ref=e593]:
                    - img [ref=e594]
                    - text: Southridge Pickleball Club
                  - generic [ref=e597]: Advanced · ₱200 · Hosted by Venue Staff
                - generic [ref=e601]: 3/13
            - button "Open Play Intermediate Open Play Mon, Jul 27 · 2:00 PM PAL Sports Center Intermediate · ₱350 · Hosted by Local League 1/18" [ref=e602] [cursor=pointer]:
              - generic [ref=e604]: Open Play
              - generic [ref=e605]:
                - generic [ref=e606]: Intermediate Open Play
                - generic [ref=e607]:
                  - generic [ref=e608]:
                    - img [ref=e609]
                    - text: Mon, Jul 27 · 2:00 PM
                  - generic [ref=e612]:
                    - img [ref=e613]
                    - text: PAL Sports Center
                  - generic [ref=e616]: Intermediate · ₱350 · Hosted by Local League
                - generic [ref=e620]: 1/18
            - button "Open Play Beginner Open Play Fri, Aug 7 · 1:00 PM Amadea Resort and Pickleball Beginner · ₱250 · Hosted by Local League 3/16" [ref=e621] [cursor=pointer]:
              - generic [ref=e623]: Open Play
              - generic [ref=e624]:
                - generic [ref=e625]: Beginner Open Play
                - generic [ref=e626]:
                  - generic [ref=e627]:
                    - img [ref=e628]
                    - text: Fri, Aug 7 · 1:00 PM
                  - generic [ref=e631]:
                    - img [ref=e632]
                    - text: Amadea Resort and Pickleball
                  - generic [ref=e635]: Beginner · ₱250 · Hosted by Local League
                - generic [ref=e639]: 3/16
            - button "Open Play Advanced Open Play Thu, Aug 6 · 7:00 AM Arcovia Pickleball Club Advanced · ₱350 · Hosted by Venue Staff 2/12" [ref=e640] [cursor=pointer]:
              - generic [ref=e642]: Open Play
              - generic [ref=e643]:
                - generic [ref=e644]: Advanced Open Play
                - generic [ref=e645]:
                  - generic [ref=e646]:
                    - img [ref=e647]
                    - text: Thu, Aug 6 · 7:00 AM
                  - generic [ref=e650]:
                    - img [ref=e651]
                    - text: Arcovia Pickleball Club
                  - generic [ref=e654]: Advanced · ₱350 · Hosted by Venue Staff
                - generic [ref=e658]: 2/12
            - button "Open Play Open play Tue, Aug 4 · 1:00 PM Venue TBA 3.0–3.5 0 interested" [ref=e659] [cursor=pointer]:
              - generic [ref=e661]: Open Play
              - generic [ref=e662]:
                - generic [ref=e663]: Open play
                - generic [ref=e664]:
                  - generic [ref=e665]:
                    - img [ref=e666]
                    - text: Tue, Aug 4 · 1:00 PM
                  - generic [ref=e669]:
                    - img [ref=e670]
                    - text: Venue TBA
                  - generic [ref=e673]: 3.0–3.5
                - generic [ref=e675]: 0 interested
            - button "Open Play Intermediate Open Play Thu, Aug 6 · 5:00 PM One Serendra Pickleball Club Intermediate · ₱500 · Hosted by PB Community 0/9" [ref=e676] [cursor=pointer]:
              - generic [ref=e678]: Open Play
              - generic [ref=e679]:
                - generic [ref=e680]: Intermediate Open Play
                - generic [ref=e681]:
                  - generic [ref=e682]:
                    - img [ref=e683]
                    - text: Thu, Aug 6 · 5:00 PM
                  - generic [ref=e686]:
                    - img [ref=e687]
                    - text: One Serendra Pickleball Club
                  - generic [ref=e690]: Intermediate · ₱500 · Hosted by PB Community
                - generic [ref=e693]: 0/9
            - button "Open Play Advanced Open Play Thu, Jul 30 · 1:00 PM Cristy Hernandez Activity Center Advanced · ₱500 · Hosted by PB Community Full 16/16" [ref=e694] [cursor=pointer]:
              - generic [ref=e696]: Open Play
              - generic [ref=e697]:
                - generic [ref=e698]: Advanced Open Play
                - generic [ref=e699]:
                  - generic [ref=e700]:
                    - img [ref=e701]
                    - text: Thu, Jul 30 · 1:00 PM
                  - generic [ref=e704]:
                    - img [ref=e705]
                    - text: Cristy Hernandez Activity Center
                  - generic [ref=e708]: Advanced · ₱500 · Hosted by PB Community
                - generic [ref=e710]: Full
                - generic [ref=e714]: 16/16
            - button "Open Play Intermediate Open Play Tue, Jul 14 · 6:00 AM Fairview Pickleball Club Intermediate · ₱400 · Hosted by Local League Full 16/16" [ref=e715] [cursor=pointer]:
              - generic [ref=e717]: Open Play
              - generic [ref=e718]:
                - generic [ref=e719]: Intermediate Open Play
                - generic [ref=e720]:
                  - generic [ref=e721]:
                    - img [ref=e722]
                    - text: Tue, Jul 14 · 6:00 AM
                  - generic [ref=e725]:
                    - img [ref=e726]
                    - text: Fairview Pickleball Club
                  - generic [ref=e729]: Intermediate · ₱400 · Hosted by Local League
                - generic [ref=e731]: Full
                - generic [ref=e735]: 16/16
            - button "Open Play Advanced Open Play Wed, Jul 29 · 4:00 PM Dink & Drive Pickleball Advanced · ₱250 · Hosted by PB Community Full 20/20" [ref=e736] [cursor=pointer]:
              - generic [ref=e738]: Open Play
              - generic [ref=e739]:
                - generic [ref=e740]: Advanced Open Play
                - generic [ref=e741]:
                  - generic [ref=e742]:
                    - img [ref=e743]
                    - text: Wed, Jul 29 · 4:00 PM
                  - generic [ref=e746]:
                    - img [ref=e747]
                    - text: Dink & Drive Pickleball
                  - generic [ref=e750]: Advanced · ₱250 · Hosted by PB Community
                - generic [ref=e752]: Full
                - generic [ref=e756]: 20/20
        - dialog "Filter plays" [ref=e758]:
          - generic [ref=e760]:
            - generic [ref=e761]:
              - heading "Filter plays" [level=2] [ref=e762]
              - generic [ref=e763]: Find your perfect match
            - button "Close" [ref=e764] [cursor=pointer]:
              - img [ref=e766]
          - generic [ref=e768]:
            - generic [ref=e769]:
              - generic [ref=e770]: When
              - generic [ref=e771]:
                - button "Any time" [pressed] [ref=e772] [cursor=pointer]
                - button "Today" [ref=e773] [cursor=pointer]
                - button "Tomorrow" [ref=e774] [cursor=pointer]
                - button "Weekend" [ref=e775] [cursor=pointer]
                - button "Pick a date" [ref=e776] [cursor=pointer]
            - generic [ref=e778]: Skill level
            - generic [ref=e779]:
              - button "Any" [ref=e780] [cursor=pointer]
              - button "Beginner" [ref=e781] [cursor=pointer]
              - button "2.5–3.0" [ref=e782] [cursor=pointer]
              - button "3.0–3.5" [ref=e783] [cursor=pointer]
              - button "3.5–4.0" [ref=e784] [cursor=pointer]
              - button "4.0+" [ref=e785] [cursor=pointer]
            - generic [ref=e786]:
              - generic [ref=e787]: Play type
              - generic [ref=e788]:
                - button "Any" [pressed] [ref=e789] [cursor=pointer]
                - button "Doubles" [ref=e790] [cursor=pointer]
                - button "Singles" [ref=e791] [cursor=pointer]
                - button "Open Play" [ref=e792] [cursor=pointer]
            - generic [ref=e793]:
              - generic [ref=e794]: Who can play
              - generic [ref=e795]:
                - button "Any" [pressed] [ref=e796] [cursor=pointer]
                - button "Everyone" [ref=e797] [cursor=pointer]
                - button "Men" [ref=e798] [cursor=pointer]
                - button "Women" [ref=e799] [cursor=pointer]
            - generic [ref=e800]:
              - generic [ref=e801]: Cost to join
              - generic [ref=e802]:
                - button "Any" [pressed] [ref=e803] [cursor=pointer]
                - button "Free" [ref=e804] [cursor=pointer]
                - button "Paid" [ref=e805] [cursor=pointer]
            - generic [ref=e806]:
              - generic [ref=e807]: Who can join
              - generic [ref=e808]:
                - button "Any" [pressed] [ref=e809] [cursor=pointer]
                - button "Open" [ref=e810] [cursor=pointer]
                - button "Invite only" [ref=e811] [cursor=pointer]
            - generic [ref=e812]:
              - generic [ref=e813]: How often
              - generic [ref=e814]:
                - button "Any" [pressed] [ref=e815] [cursor=pointer]
                - button "Weekly" [ref=e816] [cursor=pointer]
                - button "One-off" [ref=e817] [cursor=pointer]
            - generic [ref=e819]:
              - text: Venue
              - button "Venue" [ref=e821] [cursor=pointer]:
                - generic [ref=e823]: Any venue
                - img [ref=e825]
            - generic [ref=e827]:
              - generic [ref=e828]: Availability
              - button "Has open spots" [ref=e830] [cursor=pointer]
          - generic [ref=e832]:
            - button "Reset" [ref=e833] [cursor=pointer]
            - button "Show 37 plays" [ref=e834] [cursor=pointer]
      - navigation "Primary navigation" [ref=e835]:
        - button "Home" [ref=e836] [cursor=pointer]:
          - img [ref=e837]
          - generic [ref=e839]: Home
        - button "Map" [ref=e840] [cursor=pointer]:
          - img [ref=e841]
          - generic [ref=e844]: Map
        - button "Play" [ref=e845] [cursor=pointer]:
          - img [ref=e846]
          - generic [ref=e848]: Play
        - button "Social" [ref=e849] [cursor=pointer]:
          - img [ref=e850]
          - generic [ref=e855]: Social
        - button "Profile" [ref=e856] [cursor=pointer]:
          - img [ref=e857]
          - generic [ref=e860]: Profile
  - dialog [ref=e861]:
    - generic [ref=e863]:
      - generic [ref=e864]:
        - heading [level=2] [ref=e865]: Create your free account
        - generic [ref=e866]: You'll need an account to continue. Browsing stays free — sign up takes a few seconds.
      - button [ref=e867] [cursor=pointer]:
        - img [ref=e869]
    - generic [ref=e872]:
      - list [ref=e873]:
        - listitem [ref=e874]:
          - img [ref=e877]
          - text: Join games and lock in your spot
        - listitem [ref=e879]:
          - img [ref=e882]
          - text: Create matches and start clubs
        - listitem [ref=e884]:
          - img [ref=e887]
          - text: Track your matches and streaks
      - button [ref=e889] [cursor=pointer]: Create free account
      - button [ref=e890] [cursor=pointer]: I already have an account
```

# Test source

```ts
  11  |  * The Play tab is public, so these run as a guest — which is also the cold-start
  12  |  * case the ranker has to degrade cleanly for (no location, no skill, no friends).
  13  |  */
  14  | 
  15  | import { test, expect, type Page, type Request } from '@playwright/test';
  16  | 
  17  | const APP = 'http://localhost:9000';
  18  | const API_BASE = 'http://localhost:9002/api/v1';
  19  | 
  20  | // The launch splash is a once-per-session overlay that sits on top of everything
  21  | // until "Let's Play" is tapped. Locators still FIND elements behind it, so an
  22  | // assertion can pass while a click times out — mark it seen before the app boots.
  23  | test.beforeEach(async ({ page }) => {
  24  |   await page.addInitScript(() => sessionStorage.setItem('pb-splash-seen', '1'));
  25  | });
  26  | 
  27  | /** Every /play/discover call the page makes. */
  28  | function trackDiscover(page: Page): Request[] {
  29  |   const calls: Request[] = [];
  30  |   page.on('request', (r) => {
  31  |     if (r.url().includes('/play/discover')) calls.push(r);
  32  |   });
  33  |   return calls;
  34  | }
  35  | 
  36  | test.describe('Play Discover — server-ranked feed', () => {
  37  |   test('the Play tab loads its feed from /play/discover, and renders the cards it returns', async ({ page }) => {
  38  |     const calls = trackDiscover(page);
  39  |     const errors: string[] = [];
  40  |     page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  41  | 
  42  |     await page.goto(`${APP}/games`);
  43  |     await page.waitForLoadState('networkidle');
  44  | 
  45  |     // The screen asked the server to rank, rather than ranking on the device.
  46  |     expect(calls.length).toBeGreaterThan(0);
  47  |     expect(calls[0].url()).toContain('section=open-play');
  48  | 
  49  |     // And what came back is what's on screen.
  50  |     const res = await page.request.get(
  51  |       'http://localhost:9002/api/v1/play/discover?section=open-play&pageSize=50',
  52  |     );
  53  |     const body = await res.json();
  54  |     expect(body.data.length).toBeGreaterThan(0);
  55  | 
  56  |     const cards = page.locator('.game-card');
  57  |     await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  58  | 
  59  |     // The top-ranked listing's venue is on the page — the server's #1 is the
  60  |     // user's #1. If the client re-ranked, this would drift.
  61  |     await expect(page.getByText(body.data[0].venueName, { exact: false }).first()).toBeVisible();
  62  | 
  63  |     expect(errors.filter((e) => !e.includes('favicon'))).toEqual([]);
  64  |   });
  65  | 
  66  |   test('the old client-side ranking sources are no longer fetched for Discover', async ({ page }) => {
  67  |     // The screen used to pull the public games list and rank it locally. If that
  68  |     // request comes back, two rankers are live again and they will drift.
  69  |     const publicGameCalls: string[] = [];
  70  |     page.on('request', (r) => {
  71  |       const u = r.url();
  72  |       if (u.includes('/games?') && u.includes('status=published')) publicGameCalls.push(u);
  73  |     });
  74  | 
  75  |     await page.goto(`${APP}/games`);
  76  |     await page.waitForLoadState('networkidle');
  77  | 
  78  |     expect(publicGameCalls).toEqual([]);
  79  |   });
  80  | 
  81  |   test('the ranked order is stable across a reload — it is the server\'s, not the device\'s', async ({ page }) => {
  82  |     await page.goto(`${APP}/games`);
  83  |     await page.waitForLoadState('networkidle');
  84  |     await expect(page.locator('.game-card').first()).toBeVisible({ timeout: 10_000 });
  85  | 
  86  |     const first = await page.locator('.game-card').first().innerText();
  87  | 
  88  |     await page.reload();
  89  |     await page.waitForLoadState('networkidle');
  90  |     await expect(page.locator('.game-card').first()).toBeVisible({ timeout: 10_000 });
  91  | 
  92  |     // Same viewer, same inputs, same order.
  93  |     expect(await page.locator('.game-card').first().innerText()).toBe(first);
  94  |   });
  95  | });
  96  | 
  97  | test.describe('Discover filters (§4.3)', () => {
  98  |   async function openFilters(page: Page) {
  99  |     await page.goto(`${APP}/games`);
  100 |     await page.waitForLoadState('networkidle');
  101 |     await expect(page.locator('.game-card').first()).toBeVisible({ timeout: 10_000 });
  102 |     await page.getByRole('button', { name: /filter/i }).first().click();
  103 |   }
  104 | 
  105 |   test('the four new filters are offered', async ({ page }) => {
  106 |     await openFilters(page);
  107 |     // The meeting asked for free/paid, public/invite-only, recurring/one-time, venue.
  108 |     await expect(page.getByText('Cost to join')).toBeVisible();
  109 |     await expect(page.getByText('Who can join')).toBeVisible();
  110 |     await expect(page.getByText('How often')).toBeVisible();
> 111 |     await expect(page.getByRole('button', { name: 'Venue' })).toBeVisible();
      |                                                               ^ Error: expect(locator).toBeVisible() failed
  112 |   });
  113 | 
  114 |   test('"Weekly" narrows the feed to recurring sessions, and clearing restores it', async ({ page }) => {
  115 |     await openFilters(page);
  116 |     const before = await page.locator('.game-card').count();
  117 | 
  118 |     await page.getByRole('button', { name: 'Weekly', exact: true }).click();
  119 |     await page.getByRole('button', { name: /show|apply/i }).last().click();
  120 |     await page.waitForTimeout(500);
  121 | 
  122 |     const after = await page.locator('.game-card').count();
  123 |     expect(after).toBeGreaterThan(0);
  124 |     expect(after).toBeLessThan(before);
  125 | 
  126 |     // A filter that empties the feed with no way back is the failure mode here.
  127 |     await page.getByRole('button', { name: /clear|reset/i }).first().click();
  128 |     await page.waitForTimeout(500);
  129 |     expect(await page.locator('.game-card').count()).toBe(before);
  130 |   });
  131 | 
  132 |   test('"Free" keeps the free-to-join games whose card shows the venue\'s court rate', async ({ page }) => {
  133 |     // The whole point of joinFee: a player-hosted game is free to join even when its
  134 |     // card reads "₱350" — that is what the COURT cost the host, not what you pay.
  135 |     const res = await page.request.get(`${API_BASE}/play/discover?section=open-play&pageSize=200`);
  136 |     const items = (await res.json()).data as { joinFee: number | null; priceLabel: string | null }[];
  137 |     const freeButPriced = items.filter((i) => i.joinFee === null && i.priceLabel);
  138 |     expect(freeButPriced.length).toBeGreaterThan(0); // the trap exists in real data
  139 | 
  140 |     await openFilters(page);
  141 |     await page.getByRole('button', { name: 'Free', exact: true }).click();
  142 |     await page.getByRole('button', { name: /show|apply/i }).last().click();
  143 |     await page.waitForTimeout(500);
  144 | 
  145 |     // Had the filter been built on priceLabel, these would all have been hidden.
  146 |     expect(await page.locator('.game-card').count()).toBeGreaterThanOrEqual(freeButPriced.length);
  147 |   });
  148 | });
  149 | 
  150 | test.describe('Play sections — Open Play and Events, side by side', () => {
  151 |   test('both sections are visible as tabs — neither is hidden behind a dropdown', async ({ page }) => {
  152 |     await page.goto(`${APP}/games`);
  153 |     await page.waitForLoadState('networkidle');
  154 | 
  155 |     // The whole point of §3.4: a player who never opens a menu must still be able
  156 |     // to SEE that Events exists.
  157 |     await expect(page.locator('.section-tab')).toHaveCount(2);
  158 |     expect(await page.locator('.section-tab').allInnerTexts()).toEqual(['Open Play', 'Events']);
  159 | 
  160 |     // The dropdown that used to hide Events is gone.
  161 |     await expect(page.locator('.section-dropdown')).toHaveCount(0);
  162 |   });
  163 | 
  164 |   test('a bare Play tap opens on Open Play, not Events (§3.3)', async ({ page }) => {
  165 |     await page.goto(`${APP}/games`);
  166 |     await page.waitForLoadState('networkidle');
  167 | 
  168 |     // It used to land on Events, so the most common player need sat one hidden
  169 |     // dropdown away while the least common one greeted them.
  170 |     await expect(page.locator('.section-tab.active')).toHaveText('Open Play');
  171 |     await expect(page.locator('.games-subheading')).toContainText('Open play');
  172 |   });
  173 | 
  174 |   test('tapping Events switches section and refetches that section\'s ranked feed', async ({ page }) => {
  175 |     const calls = trackDiscover(page);
  176 | 
  177 |     await page.goto(`${APP}/games`);
  178 |     await page.waitForLoadState('networkidle');
  179 |     expect(calls.at(-1)!.url()).toContain('section=open-play');
  180 | 
  181 |     await page.getByRole('tab', { name: 'Events' }).click();
  182 |     await page.waitForLoadState('networkidle');
  183 | 
  184 |     await expect(page.locator('.section-tab.active')).toHaveText('Events');
  185 |     // Events is a different product with a different candidate set — it must be
  186 |     // ranked as one, not sliced out of the Open Play feed on the device.
  187 |     expect(calls.at(-1)!.url()).toContain('section=events');
  188 |   });
  189 | 
  190 |   test('the chosen section survives a reload', async ({ page }) => {
  191 |     await page.goto(`${APP}/games`);
  192 |     await page.waitForLoadState('networkidle');
  193 |     await page.getByRole('tab', { name: 'Events' }).click();
  194 |     await page.waitForLoadState('networkidle');
  195 | 
  196 |     await page.reload();
  197 |     await page.waitForLoadState('networkidle');
  198 | 
  199 |     await expect(page.locator('.section-tab.active')).toHaveText('Events');
  200 |   });
  201 | });
  202 | 
```