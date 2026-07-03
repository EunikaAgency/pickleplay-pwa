# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: datetime-filter.spec.ts >> C: Edge cases & robustness >> C.3 Previous year navigation works in date picker
- Location: e2e/datetime-filter.spec.ts:412:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 2025
Received: 2026
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
      - main:
        - generic [ref=e14]:
          - generic [ref=e16]:
            - generic:
              - generic:
                - button "Marker" [ref=e17] [cursor=pointer]
                - button "Marker" [ref=e18] [cursor=pointer]
                - button "Marker" [ref=e19] [cursor=pointer]
                - button "Marker" [ref=e20] [cursor=pointer]
                - button "Marker" [ref=e21] [cursor=pointer]
                - button "Marker" [ref=e22] [cursor=pointer]
                - button "Marker" [ref=e23] [cursor=pointer]
                - button "Marker" [ref=e24] [cursor=pointer]
                - button "Marker" [ref=e25] [cursor=pointer]
                - button "Marker" [ref=e26] [cursor=pointer]
                - button "Marker" [ref=e27] [cursor=pointer]
                - button "Marker" [ref=e28] [cursor=pointer]
                - button "Marker" [ref=e29] [cursor=pointer]
                - button "Marker" [ref=e30] [cursor=pointer]
                - button "Marker" [ref=e31] [cursor=pointer]
                - button "Marker" [ref=e32] [cursor=pointer]
                - button "Marker" [ref=e33] [cursor=pointer]
                - button "Marker" [ref=e34] [cursor=pointer]
                - button "Marker" [ref=e35] [cursor=pointer]
                - button "Marker" [ref=e36] [cursor=pointer]
                - button "Marker" [ref=e37] [cursor=pointer]
                - button "Marker" [ref=e38] [cursor=pointer]
                - button "Marker" [ref=e39] [cursor=pointer]
                - button "Marker" [ref=e40] [cursor=pointer]
                - button "Marker" [ref=e41] [cursor=pointer]
                - button "Marker" [ref=e42] [cursor=pointer]
                - button "Marker" [ref=e43] [cursor=pointer]
                - button "Marker" [ref=e44] [cursor=pointer]
                - button "Marker" [ref=e45] [cursor=pointer]
                - button "Marker" [ref=e46] [cursor=pointer]
          - generic [ref=e47]:
            - generic [ref=e48]:
              - img [ref=e49]
              - textbox "Search courts" [ref=e52]:
                - /placeholder: Find a court…
            - button "Use my location to sort courts" [ref=e53] [cursor=pointer]:
              - img [ref=e54]
              - text: Near me
          - generic [ref=e57]:
            - button "Show map" [expanded] [ref=e58] [cursor=pointer]:
              - generic [ref=e60]: Show map
            - generic [ref=e61]:
              - button "Pick a date" [expanded] [ref=e62] [cursor=pointer]:
                - img [ref=e63]
                - generic [ref=e65]: Any date
                - img [ref=e66]
              - button "Pick start time" [ref=e69] [cursor=pointer]:
                - img [ref=e70]
                - generic [ref=e73]: Start
                - img [ref=e74]
              - button "Pick end time" [ref=e77] [cursor=pointer]:
                - img [ref=e78]
                - generic [ref=e81]: End
                - img [ref=e82]
              - button "Apply" [disabled] [ref=e84]
            - dialog [ref=e85]:
              - generic [ref=e86]:
                - generic [ref=e89]:
                  - heading "Pick a date" [level=3] [ref=e90]
                  - button "Close" [ref=e91] [cursor=pointer]:
                    - img [ref=e92]
                - generic [ref=e95]: Friday, July 3, 2026
                - generic [ref=e96]:
                  - button "Today" [ref=e97] [cursor=pointer]
                  - button "Tomorrow" [ref=e98] [cursor=pointer]
                  - button "This Weekend" [ref=e99] [cursor=pointer]
                - generic [ref=e100]:
                  - button "Previous year" [ref=e101] [cursor=pointer]:
                    - img [ref=e102]
                  - button "Previous month" [ref=e105] [cursor=pointer]:
                    - img [ref=e106]
                  - generic [ref=e108]: July 2026
                  - button "Next month" [ref=e109] [cursor=pointer]:
                    - img [ref=e110]
                  - button "Next year" [ref=e112] [cursor=pointer]:
                    - img [ref=e113]
                - generic [ref=e117]:
                  - generic [ref=e118]:
                    - generic [ref=e119]: S
                    - generic [ref=e120]: M
                    - generic [ref=e121]: T
                    - generic [ref=e122]: W
                    - generic [ref=e123]: T
                    - generic [ref=e124]: F
                    - generic [ref=e125]: S
                  - generic [ref=e126]:
                    - button "2026-07-01" [disabled] [ref=e131] [cursor=pointer]: "1"
                    - button "2026-07-02" [disabled] [ref=e133] [cursor=pointer]: "2"
                    - button "2026-07-03" [pressed] [ref=e135] [cursor=pointer]: "3"
                    - button "2026-07-04" [ref=e137] [cursor=pointer]: "4"
                    - button "2026-07-05" [ref=e139] [cursor=pointer]: "5"
                    - button "2026-07-06" [ref=e141] [cursor=pointer]: "6"
                    - button "2026-07-07" [ref=e143] [cursor=pointer]: "7"
                    - button "2026-07-08" [ref=e145] [cursor=pointer]: "8"
                    - button "2026-07-09" [ref=e147] [cursor=pointer]: "9"
                    - button "2026-07-10" [ref=e149] [cursor=pointer]: "10"
                    - button "2026-07-11" [ref=e151] [cursor=pointer]: "11"
                    - button "2026-07-12" [ref=e153] [cursor=pointer]: "12"
                    - button "2026-07-13" [ref=e155] [cursor=pointer]: "13"
                    - button "2026-07-14" [ref=e157] [cursor=pointer]: "14"
                    - button "2026-07-15" [ref=e159] [cursor=pointer]: "15"
                    - button "2026-07-16" [ref=e161] [cursor=pointer]: "16"
                    - button "2026-07-17" [ref=e163] [cursor=pointer]: "17"
                    - button "2026-07-18" [ref=e165] [cursor=pointer]: "18"
                    - button "2026-07-19" [ref=e167] [cursor=pointer]: "19"
                    - button "2026-07-20" [ref=e169] [cursor=pointer]: "20"
                    - button "2026-07-21" [ref=e171] [cursor=pointer]: "21"
                    - button "2026-07-22" [ref=e173] [cursor=pointer]: "22"
                    - button "2026-07-23" [ref=e175] [cursor=pointer]: "23"
                    - button "2026-07-24" [ref=e177] [cursor=pointer]: "24"
                    - button "2026-07-25" [ref=e179] [cursor=pointer]: "25"
                    - button "2026-07-26" [ref=e181] [cursor=pointer]: "26"
                    - button "2026-07-27" [ref=e183] [cursor=pointer]: "27"
                    - button "2026-07-28" [ref=e185] [cursor=pointer]: "28"
                    - button "2026-07-29" [ref=e187] [cursor=pointer]: "29"
                    - button "2026-07-30" [ref=e189] [cursor=pointer]: "30"
                    - button "2026-07-31" [ref=e191] [cursor=pointer]: "31"
                - generic [ref=e192]:
                  - button "Cancel" [ref=e193] [cursor=pointer]
                  - button "Apply" [ref=e194] [cursor=pointer]
            - generic [ref=e195]:
              - generic [ref=e196]:
                - generic [ref=e197]: Nearby courts
                - generic [ref=e198]: 182 courts
              - generic [ref=e199]:
                - generic [ref=e200]: "Sort:"
                - 'button "Sort courts: Distance" [ref=e201] [cursor=pointer]':
                  - text: Distance
                  - img [ref=e202]
            - generic [ref=e204]:
              - button "📍 Turn on location for nearest courts" [ref=e205] [cursor=pointer]
              - button "⭐ Top Pick 3 Courts The Dink Lab 4.7 (64) Kawit / Tabon III / Robertson Plaza · Cavite • Indoor" [ref=e206] [cursor=pointer]:
                - generic [ref=e209]:
                  - generic [ref=e210]: ⭐ Top Pick
                  - generic [ref=e211]: 3 Courts
                - generic [ref=e212]:
                  - generic [ref=e213]:
                    - generic [ref=e214]: The Dink Lab
                    - generic [ref=e215]:
                      - img [ref=e216]
                      - generic [ref=e218]: "4.7"
                      - generic [ref=e219]: (64)
                  - generic [ref=e220]:
                    - img [ref=e221]
                    - text: Kawit / Tabon III / Robertson Plaza · Cavite
                    - generic [ref=e224]: •
                    - generic [ref=e225]: Indoor
              - generic [ref=e227]: More nearby
              - button "Private / Membership Celebrity Sports Club Old Balara / Capitol Hills · Quezon City 4.6 (128) 4 Courts Outdoor hard" [ref=e228] [cursor=pointer]:
                - generic [ref=e229]:
                  - generic [ref=e232]: Private / Membership
                  - generic [ref=e233]:
                    - generic [ref=e234]:
                      - generic [ref=e235]: Celebrity Sports Club
                      - generic [ref=e236]:
                        - img [ref=e237]
                        - text: Old Balara / Capitol Hills · Quezon City
                      - generic [ref=e240]:
                        - img [ref=e241]
                        - generic [ref=e243]: "4.6"
                        - generic [ref=e244]: (128)
                    - generic [ref=e245]:
                      - generic [ref=e246]: 4 Courts
                      - generic [ref=e247]: Outdoor
                      - generic [ref=e248]: hard
              - button "Tournament Registration SM Mall of Asia Pickleball (MOA Music Hall / Activity Center) Barangay 76 (SM MOA Complex) · Pasay 4.5 (41) 2 Courts Indoor portable court panels over music hall floor (event setup)" [ref=e249] [cursor=pointer]:
                - generic [ref=e250]:
                  - generic [ref=e253]: Tournament Registration
                  - generic [ref=e254]:
                    - generic [ref=e255]:
                      - generic [ref=e256]: SM Mall of Asia Pickleball (MOA Music Hall / Activity Center)
                      - generic [ref=e257]:
                        - img [ref=e258]
                        - text: Barangay 76 (SM MOA Complex) · Pasay
                      - generic [ref=e261]:
                        - img [ref=e262]
                        - generic [ref=e264]: "4.5"
                        - generic [ref=e265]: (41)
                    - generic [ref=e266]:
                      - generic [ref=e267]: 2 Courts
                      - generic [ref=e268]: Indoor
                      - generic [ref=e269]: portable court panels over music hall floor (event setup)
              - button "Per Session Banay-Banay Pickleball Lipa Banay-Banay (Lipa City) · Lipa 4.4 (18) 2 Courts Mixed hard" [ref=e270] [cursor=pointer]:
                - generic [ref=e271]:
                  - generic [ref=e274]: Per Session
                  - generic [ref=e275]:
                    - generic [ref=e276]:
                      - generic [ref=e277]: Banay-Banay Pickleball Lipa
                      - generic [ref=e278]:
                        - img [ref=e279]
                        - text: Banay-Banay (Lipa City) · Lipa
                      - generic [ref=e282]:
                        - img [ref=e283]
                        - generic [ref=e285]: "4.4"
                        - generic [ref=e286]: (18)
                    - generic [ref=e287]:
                      - generic [ref=e288]: 2 Courts
                      - generic [ref=e289]: Mixed
                      - generic [ref=e290]: hard
              - button "Per Player Bagong Bayan Picklers Guinhawa · Malolos 4.3 (22) 2 Courts Outdoor hard" [ref=e291] [cursor=pointer]:
                - generic [ref=e292]:
                  - generic [ref=e295]: Per Player
                  - generic [ref=e296]:
                    - generic [ref=e297]:
                      - generic [ref=e298]: Bagong Bayan Picklers
                      - generic [ref=e299]:
                        - img [ref=e300]
                        - text: Guinhawa · Malolos
                      - generic [ref=e303]:
                        - img [ref=e304]
                        - generic [ref=e306]: "4.3"
                        - generic [ref=e307]: (22)
                    - generic [ref=e308]:
                      - generic [ref=e309]: 2 Courts
                      - generic [ref=e310]: Outdoor
                      - generic [ref=e311]: hard
              - button "PHP (Daet Racquet Club) Courtside Amore Brgy. Camambugan · Daet hard" [ref=e312] [cursor=pointer]:
                - generic [ref=e313]:
                  - generic [ref=e316]: PHP
                  - generic [ref=e317]:
                    - generic [ref=e318]:
                      - generic [ref=e319]: (Daet Racquet Club) Courtside Amore
                      - generic [ref=e320]:
                        - img [ref=e321]
                        - text: Brgy. Camambugan · Daet
                    - generic [ref=e325]: hard
              - button "Per Court / Hour 24/7 Pickle Mandaluyong Plainview / San Rafael · Mandaluyong 1 Court Indoor hard" [ref=e326] [cursor=pointer]:
                - generic [ref=e327]:
                  - generic [ref=e330]: Per Court / Hour
                  - generic [ref=e331]:
                    - generic [ref=e332]:
                      - generic [ref=e333]: 24/7 Pickle Mandaluyong
                      - generic [ref=e334]:
                        - img [ref=e335]
                        - text: Plainview / San Rafael · Mandaluyong
                    - generic [ref=e338]:
                      - generic [ref=e339]: 1 Court
                      - generic [ref=e340]: Indoor
                      - generic [ref=e341]: hard
              - button "Per Session 2916 Pickleballers @ Guillermo Badminton & Pickleball Court (Bacarra) Bacarra (postal 2916) · Bacarra Mixed hard" [ref=e342] [cursor=pointer]:
                - generic [ref=e343]:
                  - generic [ref=e346]: Per Session
                  - generic [ref=e347]:
                    - generic [ref=e348]:
                      - generic [ref=e349]: 2916 Pickleballers @ Guillermo Badminton & Pickleball Court (Bacarra)
                      - generic [ref=e350]:
                        - img [ref=e351]
                        - text: Bacarra (postal 2916) · Bacarra
                    - generic [ref=e354]:
                      - generic [ref=e355]: Mixed
                      - generic [ref=e356]: hard
              - button "Varies (resort stay / court rental) ACE & E Resort Pickleball Lalakay (Springdale Garden Subdivision) · Los Baños 2 Courts Indoor hard (usa standard)" [ref=e357] [cursor=pointer]:
                - generic [ref=e358]:
                  - generic [ref=e361]: Varies (resort stay / court rental)
                  - generic [ref=e362]:
                    - generic [ref=e363]:
                      - generic [ref=e364]: ACE & E Resort Pickleball
                      - generic [ref=e365]:
                        - img [ref=e366]
                        - text: Lalakay (Springdale Garden Subdivision) · Los Baños
                    - generic [ref=e369]:
                      - generic [ref=e370]: 2 Courts
                      - generic [ref=e371]: Indoor
                      - generic [ref=e372]: hard (usa standard)
              - button "unknown Abra High School Gym Poblacion / Sports Complex Area · Bangued unknown" [ref=e373] [cursor=pointer]:
                - generic [ref=e374]:
                  - generic [ref=e377]: unknown
                  - generic [ref=e378]:
                    - generic [ref=e379]:
                      - generic [ref=e380]: Abra High School Gym
                      - generic [ref=e381]:
                        - img [ref=e382]
                        - text: Poblacion / Sports Complex Area · Bangued
                    - generic [ref=e386]: unknown
              - button "Per Player Actifit Sports Center Karuhatan · Valenzuela 2 Courts Indoor hard" [ref=e387] [cursor=pointer]:
                - generic [ref=e388]:
                  - generic [ref=e391]: Per Player
                  - generic [ref=e392]:
                    - generic [ref=e393]:
                      - generic [ref=e394]: Actifit Sports Center
                      - generic [ref=e395]:
                        - img [ref=e396]
                        - text: Karuhatan · Valenzuela
                    - generic [ref=e399]:
                      - generic [ref=e400]: 2 Courts
                      - generic [ref=e401]: Indoor
                      - generic [ref=e402]: hard
              - button "Per Hour (premium franchise) Activate Skypark Festival Mall Alabang Pickleball Alabang (Festival Mall - Skypark) · Muntinlupa Indoor hard (premium ac indoor)" [ref=e403] [cursor=pointer]:
                - generic [ref=e404]:
                  - generic [ref=e407]: Per Hour (premium franchise)
                  - generic [ref=e408]:
                    - generic [ref=e409]:
                      - generic [ref=e410]: Activate Skypark Festival Mall Alabang Pickleball
                      - generic [ref=e411]:
                        - img [ref=e412]
                        - text: Alabang (Festival Mall - Skypark) · Muntinlupa
                    - generic [ref=e415]:
                      - generic [ref=e416]: Indoor
                      - generic [ref=e417]: hard (premium ac indoor)
              - button "Per hour Activate Sports PH Lucena Lucena (Quezon) · Lucena City Indoor premium hard" [ref=e418] [cursor=pointer]:
                - generic [ref=e419]:
                  - generic [ref=e422]: Per hour
                  - generic [ref=e423]:
                    - generic [ref=e424]:
                      - generic [ref=e425]: Activate Sports PH Lucena
                      - generic [ref=e426]:
                        - img [ref=e427]
                        - text: Lucena (Quezon) · Lucena City
                    - generic [ref=e430]:
                      - generic [ref=e431]: Indoor
                      - generic [ref=e432]: premium hard
              - button "Per Hour (premium franchise) Activate Sports PH One Ayala (Makati) Ayala Center (One Ayala mall) · Makati Indoor hard (premium mall flooring)" [ref=e433] [cursor=pointer]:
                - generic [ref=e434]:
                  - generic [ref=e437]: Per Hour (premium franchise)
                  - generic [ref=e438]:
                    - generic [ref=e439]:
                      - generic [ref=e440]: Activate Sports PH One Ayala (Makati)
                      - generic [ref=e441]:
                        - img [ref=e442]
                        - text: Ayala Center (One Ayala mall) · Makati
                    - generic [ref=e445]:
                      - generic [ref=e446]: Indoor
                      - generic [ref=e447]: hard (premium mall flooring)
              - button "Private / Membership Alabang Country Club Alabang Country Club · Muntinlupa 4 Courts Outdoor hard" [ref=e448] [cursor=pointer]:
                - generic [ref=e449]:
                  - generic [ref=e452]: Private / Membership
                  - generic [ref=e453]:
                    - generic [ref=e454]:
                      - generic [ref=e455]: Alabang Country Club
                      - generic [ref=e456]:
                        - img [ref=e457]
                        - text: Alabang Country Club · Muntinlupa
                    - generic [ref=e460]:
                      - generic [ref=e461]: 4 Courts
                      - generic [ref=e462]: Outdoor
                      - generic [ref=e463]: hard
              - button "PHP Albay Pickleball Club @ Emmalene Iimuro Tennis Club Albay (Emmalene Iimuro Tennis Club) · Legazpi City Outdoor hard (tennis court)" [ref=e464] [cursor=pointer]:
                - generic [ref=e465]:
                  - generic [ref=e468]: PHP
                  - generic [ref=e469]:
                    - generic [ref=e470]:
                      - generic [ref=e471]: Albay Pickleball Club @ Emmalene Iimuro Tennis Club
                      - generic [ref=e472]:
                        - img [ref=e473]
                        - text: Albay (Emmalene Iimuro Tennis Club) · Legazpi City
                    - generic [ref=e476]:
                      - generic [ref=e477]: Outdoor
                      - generic [ref=e478]: hard (tennis court)
              - button "Per Head / Court Rental Amadea Resort and Pickleball Amadeo · Cavite Outdoor unknown" [ref=e479] [cursor=pointer]:
                - generic [ref=e480]:
                  - generic [ref=e483]: Per Head / Court Rental
                  - generic [ref=e484]:
                    - generic [ref=e485]:
                      - generic [ref=e486]: Amadea Resort and Pickleball
                      - generic [ref=e487]:
                        - img [ref=e488]
                        - text: Amadeo · Cavite
                    - generic [ref=e491]:
                      - generic [ref=e492]: Outdoor
                      - generic [ref=e493]: unknown
              - button "Pay to Play Arcovia Pickleball Club Arcovia City / C5 · Pasig Indoor hard" [ref=e494] [cursor=pointer]:
                - generic [ref=e495]:
                  - generic [ref=e498]: Pay to Play
                  - generic [ref=e499]:
                    - generic [ref=e500]:
                      - generic [ref=e501]: Arcovia Pickleball Club
                      - generic [ref=e502]:
                        - img [ref=e503]
                        - text: Arcovia City / C5 · Pasig
                    - generic [ref=e506]:
                      - generic [ref=e507]: Indoor
                      - generic [ref=e508]: hard
              - button "FREE Asingan Paddlers Pickleball Club Angela Valdez High School · Asingan 3 Courts Mixed hard (school court surface)" [ref=e509] [cursor=pointer]:
                - generic [ref=e510]:
                  - generic [ref=e513]: FREE
                  - generic [ref=e514]:
                    - generic [ref=e515]:
                      - generic [ref=e516]: Asingan Paddlers Pickleball Club
                      - generic [ref=e517]:
                        - img [ref=e518]
                        - text: Angela Valdez High School · Asingan
                    - generic [ref=e521]:
                      - generic [ref=e522]: 3 Courts
                      - generic [ref=e523]: Mixed
                      - generic [ref=e524]: hard (school court surface)
              - button "Per Player Athlete Central San Isidro · Cainta 7 Courts Indoor usapa tournament-grade" [ref=e525] [cursor=pointer]:
                - generic [ref=e526]:
                  - generic [ref=e529]: Per Player
                  - generic [ref=e530]:
                    - generic [ref=e531]:
                      - generic [ref=e532]: Athlete Central
                      - generic [ref=e533]:
                        - img [ref=e534]
                        - text: San Isidro · Cainta
                    - generic [ref=e537]:
                      - generic [ref=e538]: 7 Courts
                      - generic [ref=e539]: Indoor
                      - generic [ref=e540]: usapa tournament-grade
              - button "Per Player Per Open Play Session Athlete Central PH Cainta (Rizal's Biggest Pickleball Facility, 11 PB-capable courts) OAX Complex (KM 22 Ortigas Avenue Extension) · Cainta Indoor usapa tournament-grade (true tournament-grade playing surface built to official usapa standards - exceptional ball bounce, consistent speed, premium playing experience)" [ref=e541] [cursor=pointer]:
                - generic [ref=e542]:
                  - generic [ref=e545]: Per Player Per Open Play Session
                  - generic [ref=e546]:
                    - generic [ref=e547]:
                      - generic [ref=e548]: Athlete Central PH Cainta (Rizal's Biggest Pickleball Facility, 11 PB-capable courts)
                      - generic [ref=e549]:
                        - img [ref=e550]
                        - text: OAX Complex (KM 22 Ortigas Avenue Extension) · Cainta
                    - generic [ref=e553]:
                      - generic [ref=e554]: Indoor
                      - generic [ref=e555]: usapa tournament-grade (true tournament-grade playing surface built to official usapa standards - exceptional ball bounce, consistent speed, premium playing experience)
              - button "Per Player Ayala Heights Badminton Court Ayala Heights Village / Sultan Kudarat · Quezon City 1 Court Indoor hard court" [ref=e556] [cursor=pointer]:
                - generic [ref=e557]:
                  - generic [ref=e560]: Per Player
                  - generic [ref=e561]:
                    - generic [ref=e562]:
                      - generic [ref=e563]: Ayala Heights Badminton Court
                      - generic [ref=e564]:
                        - img [ref=e565]
                        - text: Ayala Heights Village / Sultan Kudarat · Quezon City
                    - generic [ref=e568]:
                      - generic [ref=e569]: 1 Court
                      - generic [ref=e570]: Indoor
                      - generic [ref=e571]: hard court
              - button "Per Hour Ayala Malls 30th (Pasig) Pickleball - 2nd Floor Ortigas Center (Meralco Avenue corner 30th Street) · Pasig Indoor hard (mall flooring)" [ref=e572] [cursor=pointer]:
                - generic [ref=e573]:
                  - generic [ref=e576]: Per Hour
                  - generic [ref=e577]:
                    - generic [ref=e578]:
                      - generic [ref=e579]: Ayala Malls 30th (Pasig) Pickleball - 2nd Floor
                      - generic [ref=e580]:
                        - img [ref=e581]
                        - text: Ortigas Center (Meralco Avenue corner 30th Street) · Pasig
                    - generic [ref=e584]:
                      - generic [ref=e585]: Indoor
                      - generic [ref=e586]: hard (mall flooring)
              - button "Per Player BF Multi-purpose Court Monte Vista Subdivision · Marikina 3 Courts Indoor hard" [ref=e587] [cursor=pointer]:
                - generic [ref=e588]:
                  - generic [ref=e591]: Per Player
                  - generic [ref=e592]:
                    - generic [ref=e593]:
                      - generic [ref=e594]: BF Multi-purpose Court
                      - generic [ref=e595]:
                        - img [ref=e596]
                        - text: Monte Vista Subdivision · Marikina
                    - generic [ref=e599]:
                      - generic [ref=e600]: 3 Courts
                      - generic [ref=e601]: Indoor
                      - generic [ref=e602]: hard
              - button "Per Player (Open Play) / Per Hour (Court Rental) Bacnotan Pickleball Club (BPC) - First Ever PB Court in Bacnotan Nagsaraboan (Bacnotan-San Gabriel Road) · Bacnotan Outdoor hard" [ref=e603] [cursor=pointer]:
                - generic [ref=e604]:
                  - generic [ref=e607]: Per Player (Open Play) / Per Hour (Court Rental)
                  - generic [ref=e608]:
                    - generic [ref=e609]:
                      - generic [ref=e610]: Bacnotan Pickleball Club (BPC) - First Ever PB Court in Bacnotan
                      - generic [ref=e611]:
                        - img [ref=e612]
                        - text: Nagsaraboan (Bacnotan-San Gabriel Road) · Bacnotan
                    - generic [ref=e615]:
                      - generic [ref=e616]: Outdoor
                      - generic [ref=e617]: hard
              - button "Per Session (varies by host) Batangas Pickleball Arena Batangas City · Batangas City Mixed competition surface (per reclub description)" [ref=e618] [cursor=pointer]:
                - generic [ref=e619]:
                  - generic [ref=e622]: Per Session (varies by host)
                  - generic [ref=e623]:
                    - generic [ref=e624]:
                      - generic [ref=e625]: Batangas Pickleball Arena
                      - generic [ref=e626]:
                        - img [ref=e627]
                        - text: Batangas City · Batangas City
                    - generic [ref=e630]:
                      - generic [ref=e631]: Mixed
                      - generic [ref=e632]: competition surface (per reclub description)
              - button "Per Player Blue Ridge Pickleball Club Project 4 / Blue Ridge B · Quezon City 6 Courts Indoor hard court" [ref=e633] [cursor=pointer]:
                - generic [ref=e634]:
                  - generic [ref=e637]: Per Player
                  - generic [ref=e638]:
                    - generic [ref=e639]:
                      - generic [ref=e640]: Blue Ridge Pickleball Club
                      - generic [ref=e641]:
                        - img [ref=e642]
                        - text: Project 4 / Blue Ridge B · Quezon City
                    - generic [ref=e645]:
                      - generic [ref=e646]: 6 Courts
                      - generic [ref=e647]: Indoor
                      - generic [ref=e648]: hard court
              - button "Per Hour (online booking) Bounce at Parqal Mall Pickleball Parañaque Tambo (Aseana City) · Parañaque Outdoor hard (multi-purpose sports flooring)" [ref=e649] [cursor=pointer]:
                - generic [ref=e650]:
                  - generic [ref=e653]: Per Hour (online booking)
                  - generic [ref=e654]:
                    - generic [ref=e655]:
                      - generic [ref=e656]: Bounce at Parqal Mall Pickleball Parañaque
                      - generic [ref=e657]:
                        - img [ref=e658]
                        - text: Tambo (Aseana City) · Parañaque
                    - generic [ref=e661]:
                      - generic [ref=e662]: Outdoor
                      - generic [ref=e663]: hard (multi-purpose sports flooring)
              - button "Per Session / Per Court Rental Bravo Pickleball Vista Mall Bataan Vista Mall Bataan · Balanga Indoor acrylic (pro-standard, tournament-grade)" [ref=e664] [cursor=pointer]:
                - generic [ref=e665]:
                  - generic [ref=e668]: Per Session / Per Court Rental
                  - generic [ref=e669]:
                    - generic [ref=e670]:
                      - generic [ref=e671]: Bravo Pickleball Vista Mall Bataan
                      - generic [ref=e672]:
                        - img [ref=e673]
                        - text: Vista Mall Bataan · Balanga
                    - generic [ref=e676]:
                      - generic [ref=e677]: Indoor
                      - generic [ref=e678]: acrylic (pro-standard, tournament-grade)
              - button "Free (or ₱30 earlier) Bulacan Sports Complex Guinhawa · Malolos 3 Courts Outdoor hard" [ref=e679] [cursor=pointer]:
                - generic [ref=e680]:
                  - generic [ref=e683]: Free (or ₱30 earlier)
                  - generic [ref=e684]:
                    - generic [ref=e685]:
                      - generic [ref=e686]: Bulacan Sports Complex
                      - generic [ref=e687]:
                        - img [ref=e688]
                        - text: Guinhawa · Malolos
                    - generic [ref=e691]:
                      - generic [ref=e692]: 3 Courts
                      - generic [ref=e693]: Outdoor
                      - generic [ref=e694]: hard
              - paragraph [ref=e695]: Showing top 30 of 182
  - dialog [ref=e696]:
    - generic [ref=e698]:
      - generic [ref=e699]:
        - heading [level=2] [ref=e700]: Create your free account
        - generic [ref=e701]: You'll need an account to continue. Browsing stays free — sign up takes a few seconds.
      - button [ref=e702] [cursor=pointer]:
        - img [ref=e704]
    - generic [ref=e707]:
      - list [ref=e708]:
        - listitem [ref=e709]:
          - img [ref=e712]
          - text: Join games and lock in your spot
        - listitem [ref=e714]:
          - img [ref=e717]
          - text: Create matches and start clubs
        - listitem [ref=e719]:
          - img [ref=e722]
          - text: Track your matches and streaks
      - button [ref=e724] [cursor=pointer]: Create free account
      - button [ref=e725] [cursor=pointer]: I already have an account
```

# Test source

```ts
  326 |     await pickShortcutDate(page, 'Tomorrow');
  327 |     await pickStartHour(page, 9);   // 9 AM
  328 |     await pickEndHour(page, 12);    // 12 PM
  329 |     await applyBtn(page).click();
  330 |     await page.waitForTimeout(3000);
  331 | 
  332 |     // The page should not crash regardless of match count visibility.
  333 |     await expect(filterBar(page)).toBeVisible();
  334 |   });
  335 | 
  336 |   test('B.6 Clear restores unfiltered list', async ({ page }) => {
  337 |     await goNearby(page);
  338 | 
  339 |     await pickShortcutDate(page, 'Tomorrow');
  340 |     await pickStartHour(page, 10);
  341 |     await applyBtn(page).click();
  342 |     await page.waitForTimeout(3000);
  343 |     const filteredCount = await venueCount(page);
  344 | 
  345 |     await clearFilter(page);
  346 |     await page.waitForTimeout(1000);
  347 | 
  348 |     const restoredCount = await venueCount(page);
  349 |     expect(restoredCount).toBeGreaterThanOrEqual(filteredCount);
  350 |     await expect(matchBadge(page)).not.toBeVisible();
  351 |   });
  352 | 
  353 |   test('B.7 Active class on filter bar when filter applied', async ({ page }) => {
  354 |     await goNearby(page);
  355 |     await expect(page.locator('.dt-filter-bar.active')).not.toBeVisible();
  356 | 
  357 |     await pickShortcutDate(page, 'Tomorrow');
  358 |     await pickStartHour(page, 10);
  359 |     await applyBtn(page).click();
  360 |     await page.waitForTimeout(2000);
  361 | 
  362 |     await expect(page.locator('.dt-filter-bar.active')).toBeVisible({ timeout: 5000 });
  363 |   });
  364 | 
  365 |   test('B.8 Active class removed on clear', async ({ page }) => {
  366 |     await goNearby(page);
  367 |     await pickShortcutDate(page, 'Tomorrow');
  368 |     await pickStartHour(page, 10);
  369 |     await applyBtn(page).click();
  370 |     await expect(page.locator('.dt-filter-bar.active')).toBeVisible({ timeout: 5000 });
  371 | 
  372 |     await clearFilter(page);
  373 |     await expect(page.locator('.dt-filter-bar.active')).not.toBeVisible();
  374 |   });
  375 | });
  376 | 
  377 | // ─────────────────────────────────────────────────────────────────────
  378 | // Suite C — Edge cases and robustness
  379 | // ─────────────────────────────────────────────────────────────────────
  380 | 
  381 | test.describe('C: Edge cases & robustness', () => {
  382 | 
  383 |   test('C.1 Loading spinner and match count never visible simultaneously', async ({ page }) => {
  384 |     await goNearby(page);
  385 |     await pickShortcutDate(page, 'Tomorrow');
  386 |     await pickStartHour(page, 10);
  387 | 
  388 |     await applyBtn(page).click();
  389 |     await page.waitForTimeout(3000);
  390 | 
  391 |     const spinnerVisible = await loadingSpinner(page).isVisible().catch(() => false);
  392 |     const badgeVisible = await matchBadge(page).isVisible().catch(() => false);
  393 | 
  394 |     expect(spinnerVisible && badgeVisible).toBe(false);
  395 |   });
  396 | 
  397 |   test('C.2 Month navigation works in date picker', async ({ page }) => {
  398 |     await goNearby(page);
  399 |     await datePill(page).click();
  400 |     await dateSheet(page).waitFor({ state: 'visible', timeout: 3000 });
  401 | 
  402 |     const firstMonth = await monthNavLabel(page).innerText();
  403 | 
  404 |     // Force-click to bypass potential top-nav interception.
  405 |     await nextMonthBtn(page).click({ force: true });
  406 |     await page.waitForTimeout(300);
  407 | 
  408 |     const secondMonth = await monthNavLabel(page).innerText();
  409 |     expect(secondMonth).not.toBe(firstMonth);
  410 |   });
  411 | 
  412 |   test('C.3 Previous year navigation works in date picker', async ({ page }) => {
  413 |     await goNearby(page);
  414 |     await datePill(page).click();
  415 |     await dateSheet(page).waitFor({ state: 'visible', timeout: 3000 });
  416 | 
  417 |     const firstYear = (await monthNavLabel(page).innerText()).match(/\d{4}/)?.[0];
  418 |     expect(firstYear).toBeDefined();
  419 | 
  420 |     // Force-click to bypass potential top-nav interception.
  421 |     await prevYearBtn(page).click({ force: true });
  422 |     await page.waitForTimeout(300);
  423 | 
  424 |     const secondYear = (await monthNavLabel(page).innerText()).match(/\d{4}/)?.[0];
  425 |     expect(secondYear).toBeDefined();
> 426 |     expect(Number(secondYear)).toBe(Number(firstYear) - 1);
      |                                ^ Error: expect(received).toBe(expected) // Object.is equality
  427 |   });
  428 | 
  429 |   test('C.4 Obscure-hour filter does not crash', async ({ page }) => {
  430 |     await goNearby(page);
  431 |     await pickShortcutDate(page, 'Tomorrow');
  432 |     await pickStartHour(page, 3); // 3 AM — unlikely to have courts open.
  433 |     await applyBtn(page).click();
  434 |     await page.waitForTimeout(3000);
  435 | 
  436 |     await expect(page.locator('text=Could not load')).toHaveCount(0);
  437 |     await expect(filterBar(page)).toBeVisible();
  438 |   });
  439 | 
  440 |   test('C.5 "This Weekend" shortcut works', async ({ page }) => {
  441 |     await goNearby(page);
  442 |     await datePill(page).click();
  443 |     await dateSheet(page).waitFor({ state: 'visible', timeout: 3000 });
  444 | 
  445 |     await shortcutWeekend(page).click();
  446 |     const readout = await dateReadout(page).innerText();
  447 |     expect(readout).not.toBe('');
  448 |     const day = readout.split(',')[0]?.trim();
  449 |     expect(['Saturday', 'Sunday']).toContain(day);
  450 |   });
  451 | 
  452 |   test('C.6 Filter survives sheet collapse/expand', async ({ page }) => {
  453 |     await goNearby(page);
  454 | 
  455 |     await pickShortcutDate(page, 'Tomorrow');
  456 |     await pickStartHour(page, 10);
  457 |     await applyBtn(page).click();
  458 |     await page.waitForTimeout(3000);
  459 | 
  460 |     const filteredCount = await venueCount(page);
  461 | 
  462 |     const handleBtn = page.locator('button.sheet-handle');
  463 |     if (await handleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  464 |       await handleBtn.click();
  465 |       await page.waitForTimeout(1000);
  466 |       await handleBtn.click();
  467 |       await page.waitForTimeout(1000);
  468 |     }
  469 | 
  470 |     const afterCount = await venueCount(page);
  471 |     expect(afterCount).toBe(filteredCount);
  472 |   });
  473 | 
  474 |   test('C.7 Apply with end hour ≤ start hour drops the end hour', async ({ page }) => {
  475 |     await goNearby(page);
  476 | 
  477 |     await pickShortcutDate(page, 'Tomorrow');
  478 |     await pickStartHour(page, 10);  // 10 AM
  479 |     await pickEndHour(page, 9);     // 9 AM — before start, should be dropped
  480 |     await applyBtn(page).click();
  481 |     await page.waitForTimeout(3000);
  482 | 
  483 |     // Should still work (single-hour window [10, 11)).
  484 |     // Either match count appears or page is still functional.
  485 |     await expect(page.locator('text=Could not load')).toHaveCount(0);
  486 |     await expect(filterBar(page)).toBeVisible();
  487 |   });
  488 | });
  489 | 
```