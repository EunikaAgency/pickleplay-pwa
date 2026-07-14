# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: zztabs.spec.ts >> section tabs
- Location: e2e/zztabs.spec.ts:2:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('tab', { name: 'Events' })
    - locator resolved to <button role="tab" type="button" aria-selected="true" class="section-tab active">Events</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="hero-stage">…</div> from <div role="presentation" class="pb-splash loaded">…</div> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="hero-stage">…</div> from <div role="presentation" class="pb-splash loaded">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    4 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="hero-stage">…</div> from <div role="presentation" class="pb-splash loaded">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
    106 × waiting for element to be visible, enabled and stable
        - element is visible, enabled and stable
        - scrolling into view if needed
        - done scrolling
        - <div class="hero-stage">…</div> from <div role="presentation" class="pb-splash loaded bg-reveal">…</div> subtree intercepts pointer events
      - retrying click action
        - waiting 500ms

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
            - paragraph [ref=e18]: Tournaments, competitive matches, and organized events.
          - tablist "Play section" [ref=e20]:
            - tab "Open Play" [ref=e21] [cursor=pointer]
            - tab "Events" [selected] [ref=e22] [cursor=pointer]
          - tablist "Play view" [ref=e24]:
            - tab "Discover" [selected] [ref=e25] [cursor=pointer]
            - tab "Manage" [ref=e26] [cursor=pointer]
          - generic [ref=e27]:
            - generic [ref=e28]:
              - img [ref=e29]
              - searchbox "Search by name, venue, or host…" [ref=e32]
            - generic [ref=e33]:
              - button "Filter plays" [ref=e34] [cursor=pointer]:
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
            - button "Doubles Pickle-Yard Saturday Dinks Wed, Jul 15 · 9:00 AM The Pickle-Yard 3.0–3.5 · Per Court / Session · Hosted by Benjo BJ Hervias 1 spot left 3/4" [ref=e50] [cursor=pointer]:
              - generic [ref=e52]: Doubles
              - generic [ref=e53]:
                - generic [ref=e54]: Pickle-Yard Saturday Dinks
                - generic [ref=e55]:
                  - generic [ref=e56]:
                    - img [ref=e57]
                    - text: Wed, Jul 15 · 9:00 AM
                  - generic [ref=e60]:
                    - img [ref=e61]
                    - text: The Pickle-Yard
                  - generic [ref=e64]: 3.0–3.5 · Per Court / Session · Hosted by Benjo BJ Hervias
                - generic [ref=e66]: 1 spot left
                - generic [ref=e70]: 3/4
            - button "Bracketing Midweek Bracket Battles Thu, Jul 16 · 8:00 PM Merville Covered Court 3.0–3.5 · Per Player · Hosted by Armando Tantoco 3/6" [ref=e71] [cursor=pointer]:
              - generic [ref=e73]: Bracketing
              - generic [ref=e74]:
                - generic [ref=e75]: Midweek Bracket Battles
                - generic [ref=e76]:
                  - generic [ref=e77]:
                    - img [ref=e78]
                    - text: Thu, Jul 16 · 8:00 PM
                  - generic [ref=e81]:
                    - img [ref=e82]
                    - text: Merville Covered Court
                  - generic [ref=e85]: 3.0–3.5 · Per Player · Hosted by Armando Tantoco
                - generic [ref=e89]: 3/6
            - button "Mini-tournament Sunday Mini Tourney + Merienda Mon, Jul 20 · 3:00 PM JCAS Malolos 2.5–3.0 · Per Player · Hosted by Federico Costales 5/12" [ref=e90] [cursor=pointer]:
              - generic [ref=e92]: Mini-tournament
              - generic [ref=e93]:
                - generic [ref=e94]: Sunday Mini Tourney + Merienda
                - generic [ref=e95]:
                  - generic [ref=e96]:
                    - img [ref=e97]
                    - text: Mon, Jul 20 · 3:00 PM
                  - generic [ref=e100]:
                    - img [ref=e101]
                    - text: JCAS Malolos
                  - generic [ref=e104]: 2.5–3.0 · Per Player · Hosted by Federico Costales
                - generic [ref=e108]: 5/12
            - button "Doubles Sunday Championship Doubles Thu, Jul 16 · 4:00 PM Magallanes Village Association 3.5–4.0 · Per Player · Hosted by Christian Ian Alcazar Full 4/4" [ref=e109] [cursor=pointer]:
              - generic [ref=e111]: Doubles
              - generic [ref=e112]:
                - generic [ref=e113]: Sunday Championship Doubles
                - generic [ref=e114]:
                  - generic [ref=e115]:
                    - img [ref=e116]
                    - text: Thu, Jul 16 · 4:00 PM
                  - generic [ref=e119]:
                    - img [ref=e120]
                    - text: Magallanes Village Association
                  - generic [ref=e123]: 3.5–4.0 · Per Player · Hosted by Christian Ian Alcazar
                - generic [ref=e125]: Full
                - generic [ref=e129]: 4/4
        - dialog [ref=e130]:
          - generic [ref=e132]:
            - generic [ref=e133]:
              - heading [level=2] [ref=e134]: Filter plays
              - generic [ref=e135]: Find your perfect match
            - button [ref=e136] [cursor=pointer]:
              - img [ref=e138]
          - generic [ref=e140]:
            - generic [ref=e141]:
              - generic [ref=e142]: When
              - generic [ref=e143]:
                - button [pressed] [ref=e144] [cursor=pointer]: Any time
                - button [ref=e145] [cursor=pointer]: Today
                - button [ref=e146] [cursor=pointer]: Tomorrow
                - button [ref=e147] [cursor=pointer]: Weekend
                - button [ref=e148] [cursor=pointer]: Pick a date
            - generic [ref=e150]: Skill level
            - generic [ref=e151]:
              - button [ref=e152] [cursor=pointer]: Any
              - button [ref=e153] [cursor=pointer]: Beginner
              - button [ref=e154] [cursor=pointer]: 2.5–3.0
              - button [ref=e155] [cursor=pointer]: 3.0–3.5
              - button [ref=e156] [cursor=pointer]: 3.5–4.0
              - button [ref=e157] [cursor=pointer]: 4.0+
            - generic [ref=e158]:
              - generic [ref=e159]: Play type
              - generic [ref=e160]:
                - button [pressed] [ref=e161] [cursor=pointer]: Any
                - button [ref=e162] [cursor=pointer]: Doubles
                - button [ref=e163] [cursor=pointer]: Singles
            - generic [ref=e164]:
              - generic [ref=e165]: Availability
              - button [ref=e167] [cursor=pointer]: Has open spots
          - generic [ref=e169]:
            - button [ref=e170] [cursor=pointer]: Reset
            - button [ref=e171] [cursor=pointer]: Show 4 plays
      - navigation "Primary navigation" [ref=e172]:
        - button "Home" [ref=e173] [cursor=pointer]:
          - img [ref=e174]
          - generic [ref=e176]: Home
        - button "Map" [ref=e177] [cursor=pointer]:
          - img [ref=e178]
          - generic [ref=e181]: Map
        - button "Play" [ref=e182] [cursor=pointer]:
          - img [ref=e183]
          - generic [ref=e185]: Play
        - button "Social" [ref=e186] [cursor=pointer]:
          - img [ref=e187]
          - generic [ref=e192]: Social
        - button "Profile" [ref=e193] [cursor=pointer]:
          - img [ref=e194]
          - generic [ref=e197]: Profile
  - dialog [ref=e198]:
    - generic [ref=e200]:
      - generic [ref=e201]:
        - heading [level=2] [ref=e202]: Create your free account
        - generic [ref=e203]: You'll need an account to continue. Browsing stays free — sign up takes a few seconds.
      - button [ref=e204] [cursor=pointer]:
        - img [ref=e206]
    - generic [ref=e209]:
      - list [ref=e210]:
        - listitem [ref=e211]:
          - img [ref=e214]
          - text: Join games and lock in your spot
        - listitem [ref=e216]:
          - img [ref=e219]
          - text: Create matches and start clubs
        - listitem [ref=e221]:
          - img [ref=e224]
          - text: Track your matches and streaks
      - button [ref=e226] [cursor=pointer]: Create free account
      - button [ref=e227] [cursor=pointer]: I already have an account
  - img [ref=e230]
  - img [ref=e233]
  - img [ref=e236]
  - img [ref=e239]
  - generic [ref=e242]: 12 Games Today
  - generic [ref=e244]: 2 Spots Left
  - generic [ref=e246]: 4 Courts Nearby
  - generic [ref=e248]:
    - generic [ref=e249]:
      - img [ref=e251]
      - img [ref=e259]
    - generic [ref=e301]:
      - img [ref=e302]
      - heading "P i c k l e B a l l e r s" [level=1] [ref=e309]:
        - generic [ref=e310]:
          - generic [ref=e311]: P
          - generic [ref=e312]: i
          - generic [ref=e313]: c
          - generic [ref=e314]: k
          - generic [ref=e315]: l
          - generic [ref=e316]: e
        - generic [ref=e317]:
          - generic [ref=e318]: B
          - generic [ref=e319]: a
          - generic [ref=e320]: l
          - generic [ref=e321]: l
          - generic [ref=e322]: e
          - generic [ref=e323]: r
          - generic [ref=e324]: s
  - generic [ref=e325]:
    - paragraph [ref=e326]: Find games. Meet players. Play more.
    - button "Let's Play" [ref=e327] [cursor=pointer]
  - generic:
    - heading "You're in 🎾" [level=2]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | test('section tabs', async ({ page }) => {
  3  |   await page.goto('http://localhost:9000/games');
  4  |   await page.waitForLoadState('networkidle');
  5  |   const tabs = page.locator('.section-tab');
  6  |   console.log('TABS>', await tabs.count(), JSON.stringify(await tabs.allInnerTexts()));
  7  |   console.log('ACTIVE>', await page.locator('.section-tab.active').innerText());
  8  |   console.log('SUBHEAD>', await page.locator('.games-subheading').innerText());
  9  |   console.log('DROPDOWN GONE>', await page.locator('.section-dropdown').count());
  10 |   // switch to Events
> 11 |   await page.getByRole('tab', { name: 'Events' }).click();
     |                                                   ^ Error: locator.click: Test timeout of 60000ms exceeded.
  12 |   await page.waitForTimeout(800);
  13 |   console.log('AFTER CLICK ACTIVE>', await page.locator('.section-tab.active').innerText());
  14 |   console.log('URL>', page.url());
  15 |   await expect(page.locator('.section-tab')).toHaveCount(2);
  16 | });
  17 | 
```