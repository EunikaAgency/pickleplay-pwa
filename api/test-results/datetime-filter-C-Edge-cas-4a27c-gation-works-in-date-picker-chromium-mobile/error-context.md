# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: datetime-filter.spec.ts >> C: Edge cases & robustness >> C.2 Month navigation works in date picker
- Location: e2e/datetime-filter.spec.ts:397:3

# Error details

```
Error: expect(received).not.toBe(expected) // Object.is equality

Expected: not "July 2026"
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
                - generic [ref=e95]: Monday, August 3, 2026
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
                  - button "Next month" [active] [ref=e109] [cursor=pointer]:
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
                    - button "2026-08-01" [ref=e134] [cursor=pointer]: "1"
                    - button "2026-08-02" [ref=e136] [cursor=pointer]: "2"
                    - button "2026-08-03" [pressed] [ref=e138] [cursor=pointer]: "3"
                    - button "2026-08-04" [ref=e140] [cursor=pointer]: "4"
                    - button "2026-08-05" [ref=e142] [cursor=pointer]: "5"
                    - button "2026-08-06" [ref=e144] [cursor=pointer]: "6"
                    - button "2026-08-07" [ref=e146] [cursor=pointer]: "7"
                    - button "2026-08-08" [ref=e148] [cursor=pointer]: "8"
                    - button "2026-08-09" [ref=e150] [cursor=pointer]: "9"
                    - button "2026-08-10" [ref=e152] [cursor=pointer]: "10"
                    - button "2026-08-11" [ref=e154] [cursor=pointer]: "11"
                    - button "2026-08-12" [ref=e156] [cursor=pointer]: "12"
                    - button "2026-08-13" [ref=e158] [cursor=pointer]: "13"
                    - button "2026-08-14" [ref=e160] [cursor=pointer]: "14"
                    - button "2026-08-15" [ref=e162] [cursor=pointer]: "15"
                    - button "2026-08-16" [ref=e164] [cursor=pointer]: "16"
                    - button "2026-08-17" [ref=e166] [cursor=pointer]: "17"
                    - button "2026-08-18" [ref=e168] [cursor=pointer]: "18"
                    - button "2026-08-19" [ref=e170] [cursor=pointer]: "19"
                    - button "2026-08-20" [ref=e172] [cursor=pointer]: "20"
                    - button "2026-08-21" [ref=e174] [cursor=pointer]: "21"
                    - button "2026-08-22" [ref=e176] [cursor=pointer]: "22"
                    - button "2026-08-23" [ref=e178] [cursor=pointer]: "23"
                    - button "2026-08-24" [ref=e180] [cursor=pointer]: "24"
                    - button "2026-08-25" [ref=e182] [cursor=pointer]: "25"
                    - button "2026-08-26" [ref=e184] [cursor=pointer]: "26"
                    - button "2026-08-27" [ref=e186] [cursor=pointer]: "27"
                    - button "2026-08-28" [ref=e188] [cursor=pointer]: "28"
                    - button "2026-08-29" [ref=e190] [cursor=pointer]: "29"
                    - button "2026-08-30" [ref=e192] [cursor=pointer]: "30"
                    - button "2026-08-31" [ref=e194] [cursor=pointer]: "31"
                - generic [ref=e195]:
                  - button "Cancel" [ref=e196] [cursor=pointer]
                  - button "Apply" [ref=e197] [cursor=pointer]
            - generic [ref=e198]:
              - generic [ref=e199]:
                - generic [ref=e200]: Nearby courts
                - generic [ref=e201]: 182 courts
              - generic [ref=e202]:
                - generic [ref=e203]: "Sort:"
                - 'button "Sort courts: Distance" [ref=e204] [cursor=pointer]':
                  - text: Distance
                  - img [ref=e205]
            - generic [ref=e207]:
              - button "📍 Turn on location for nearest courts" [ref=e208] [cursor=pointer]
              - button "⭐ Top Pick 3 Courts The Dink Lab 4.7 (64) Kawit / Tabon III / Robertson Plaza · Cavite • Indoor" [ref=e209] [cursor=pointer]:
                - generic [ref=e212]:
                  - generic [ref=e213]: ⭐ Top Pick
                  - generic [ref=e214]: 3 Courts
                - generic [ref=e215]:
                  - generic [ref=e216]:
                    - generic [ref=e217]: The Dink Lab
                    - generic [ref=e218]:
                      - img [ref=e219]
                      - generic [ref=e221]: "4.7"
                      - generic [ref=e222]: (64)
                  - generic [ref=e223]:
                    - img [ref=e224]
                    - text: Kawit / Tabon III / Robertson Plaza · Cavite
                    - generic [ref=e227]: •
                    - generic [ref=e228]: Indoor
              - generic [ref=e230]: More nearby
              - button "Private / Membership Celebrity Sports Club Old Balara / Capitol Hills · Quezon City 4.6 (128) 4 Courts Outdoor hard" [ref=e231] [cursor=pointer]:
                - generic [ref=e232]:
                  - generic [ref=e235]: Private / Membership
                  - generic [ref=e236]:
                    - generic [ref=e237]:
                      - generic [ref=e238]: Celebrity Sports Club
                      - generic [ref=e239]:
                        - img [ref=e240]
                        - text: Old Balara / Capitol Hills · Quezon City
                      - generic [ref=e243]:
                        - img [ref=e244]
                        - generic [ref=e246]: "4.6"
                        - generic [ref=e247]: (128)
                    - generic [ref=e248]:
                      - generic [ref=e249]: 4 Courts
                      - generic [ref=e250]: Outdoor
                      - generic [ref=e251]: hard
              - button "Tournament Registration SM Mall of Asia Pickleball (MOA Music Hall / Activity Center) Barangay 76 (SM MOA Complex) · Pasay 4.5 (41) 2 Courts Indoor portable court panels over music hall floor (event setup)" [ref=e252] [cursor=pointer]:
                - generic [ref=e253]:
                  - generic [ref=e256]: Tournament Registration
                  - generic [ref=e257]:
                    - generic [ref=e258]:
                      - generic [ref=e259]: SM Mall of Asia Pickleball (MOA Music Hall / Activity Center)
                      - generic [ref=e260]:
                        - img [ref=e261]
                        - text: Barangay 76 (SM MOA Complex) · Pasay
                      - generic [ref=e264]:
                        - img [ref=e265]
                        - generic [ref=e267]: "4.5"
                        - generic [ref=e268]: (41)
                    - generic [ref=e269]:
                      - generic [ref=e270]: 2 Courts
                      - generic [ref=e271]: Indoor
                      - generic [ref=e272]: portable court panels over music hall floor (event setup)
              - button "Per Session Banay-Banay Pickleball Lipa Banay-Banay (Lipa City) · Lipa 4.4 (18) 2 Courts Mixed hard" [ref=e273] [cursor=pointer]:
                - generic [ref=e274]:
                  - generic [ref=e277]: Per Session
                  - generic [ref=e278]:
                    - generic [ref=e279]:
                      - generic [ref=e280]: Banay-Banay Pickleball Lipa
                      - generic [ref=e281]:
                        - img [ref=e282]
                        - text: Banay-Banay (Lipa City) · Lipa
                      - generic [ref=e285]:
                        - img [ref=e286]
                        - generic [ref=e288]: "4.4"
                        - generic [ref=e289]: (18)
                    - generic [ref=e290]:
                      - generic [ref=e291]: 2 Courts
                      - generic [ref=e292]: Mixed
                      - generic [ref=e293]: hard
              - button "Per Player Bagong Bayan Picklers Guinhawa · Malolos 4.3 (22) 2 Courts Outdoor hard" [ref=e294] [cursor=pointer]:
                - generic [ref=e295]:
                  - generic [ref=e298]: Per Player
                  - generic [ref=e299]:
                    - generic [ref=e300]:
                      - generic [ref=e301]: Bagong Bayan Picklers
                      - generic [ref=e302]:
                        - img [ref=e303]
                        - text: Guinhawa · Malolos
                      - generic [ref=e306]:
                        - img [ref=e307]
                        - generic [ref=e309]: "4.3"
                        - generic [ref=e310]: (22)
                    - generic [ref=e311]:
                      - generic [ref=e312]: 2 Courts
                      - generic [ref=e313]: Outdoor
                      - generic [ref=e314]: hard
              - button "PHP (Daet Racquet Club) Courtside Amore Brgy. Camambugan · Daet hard" [ref=e315] [cursor=pointer]:
                - generic [ref=e316]:
                  - generic [ref=e319]: PHP
                  - generic [ref=e320]:
                    - generic [ref=e321]:
                      - generic [ref=e322]: (Daet Racquet Club) Courtside Amore
                      - generic [ref=e323]:
                        - img [ref=e324]
                        - text: Brgy. Camambugan · Daet
                    - generic [ref=e328]: hard
              - button "Per Court / Hour 24/7 Pickle Mandaluyong Plainview / San Rafael · Mandaluyong 1 Court Indoor hard" [ref=e329] [cursor=pointer]:
                - generic [ref=e330]:
                  - generic [ref=e333]: Per Court / Hour
                  - generic [ref=e334]:
                    - generic [ref=e335]:
                      - generic [ref=e336]: 24/7 Pickle Mandaluyong
                      - generic [ref=e337]:
                        - img [ref=e338]
                        - text: Plainview / San Rafael · Mandaluyong
                    - generic [ref=e341]:
                      - generic [ref=e342]: 1 Court
                      - generic [ref=e343]: Indoor
                      - generic [ref=e344]: hard
              - button "Per Session 2916 Pickleballers @ Guillermo Badminton & Pickleball Court (Bacarra) Bacarra (postal 2916) · Bacarra Mixed hard" [ref=e345] [cursor=pointer]:
                - generic [ref=e346]:
                  - generic [ref=e349]: Per Session
                  - generic [ref=e350]:
                    - generic [ref=e351]:
                      - generic [ref=e352]: 2916 Pickleballers @ Guillermo Badminton & Pickleball Court (Bacarra)
                      - generic [ref=e353]:
                        - img [ref=e354]
                        - text: Bacarra (postal 2916) · Bacarra
                    - generic [ref=e357]:
                      - generic [ref=e358]: Mixed
                      - generic [ref=e359]: hard
              - button "Varies (resort stay / court rental) ACE & E Resort Pickleball Lalakay (Springdale Garden Subdivision) · Los Baños 2 Courts Indoor hard (usa standard)" [ref=e360] [cursor=pointer]:
                - generic [ref=e361]:
                  - generic [ref=e364]: Varies (resort stay / court rental)
                  - generic [ref=e365]:
                    - generic [ref=e366]:
                      - generic [ref=e367]: ACE & E Resort Pickleball
                      - generic [ref=e368]:
                        - img [ref=e369]
                        - text: Lalakay (Springdale Garden Subdivision) · Los Baños
                    - generic [ref=e372]:
                      - generic [ref=e373]: 2 Courts
                      - generic [ref=e374]: Indoor
                      - generic [ref=e375]: hard (usa standard)
              - button "unknown Abra High School Gym Poblacion / Sports Complex Area · Bangued unknown" [ref=e376] [cursor=pointer]:
                - generic [ref=e377]:
                  - generic [ref=e380]: unknown
                  - generic [ref=e381]:
                    - generic [ref=e382]:
                      - generic [ref=e383]: Abra High School Gym
                      - generic [ref=e384]:
                        - img [ref=e385]
                        - text: Poblacion / Sports Complex Area · Bangued
                    - generic [ref=e389]: unknown
              - button "Per Player Actifit Sports Center Karuhatan · Valenzuela 2 Courts Indoor hard" [ref=e390] [cursor=pointer]:
                - generic [ref=e391]:
                  - generic [ref=e394]: Per Player
                  - generic [ref=e395]:
                    - generic [ref=e396]:
                      - generic [ref=e397]: Actifit Sports Center
                      - generic [ref=e398]:
                        - img [ref=e399]
                        - text: Karuhatan · Valenzuela
                    - generic [ref=e402]:
                      - generic [ref=e403]: 2 Courts
                      - generic [ref=e404]: Indoor
                      - generic [ref=e405]: hard
              - button "Per Hour (premium franchise) Activate Skypark Festival Mall Alabang Pickleball Alabang (Festival Mall - Skypark) · Muntinlupa Indoor hard (premium ac indoor)" [ref=e406] [cursor=pointer]:
                - generic [ref=e407]:
                  - generic [ref=e410]: Per Hour (premium franchise)
                  - generic [ref=e411]:
                    - generic [ref=e412]:
                      - generic [ref=e413]: Activate Skypark Festival Mall Alabang Pickleball
                      - generic [ref=e414]:
                        - img [ref=e415]
                        - text: Alabang (Festival Mall - Skypark) · Muntinlupa
                    - generic [ref=e418]:
                      - generic [ref=e419]: Indoor
                      - generic [ref=e420]: hard (premium ac indoor)
              - button "Per hour Activate Sports PH Lucena Lucena (Quezon) · Lucena City Indoor premium hard" [ref=e421] [cursor=pointer]:
                - generic [ref=e422]:
                  - generic [ref=e425]: Per hour
                  - generic [ref=e426]:
                    - generic [ref=e427]:
                      - generic [ref=e428]: Activate Sports PH Lucena
                      - generic [ref=e429]:
                        - img [ref=e430]
                        - text: Lucena (Quezon) · Lucena City
                    - generic [ref=e433]:
                      - generic [ref=e434]: Indoor
                      - generic [ref=e435]: premium hard
              - button "Per Hour (premium franchise) Activate Sports PH One Ayala (Makati) Ayala Center (One Ayala mall) · Makati Indoor hard (premium mall flooring)" [ref=e436] [cursor=pointer]:
                - generic [ref=e437]:
                  - generic [ref=e440]: Per Hour (premium franchise)
                  - generic [ref=e441]:
                    - generic [ref=e442]:
                      - generic [ref=e443]: Activate Sports PH One Ayala (Makati)
                      - generic [ref=e444]:
                        - img [ref=e445]
                        - text: Ayala Center (One Ayala mall) · Makati
                    - generic [ref=e448]:
                      - generic [ref=e449]: Indoor
                      - generic [ref=e450]: hard (premium mall flooring)
              - button "Private / Membership Alabang Country Club Alabang Country Club · Muntinlupa 4 Courts Outdoor hard" [ref=e451] [cursor=pointer]:
                - generic [ref=e452]:
                  - generic [ref=e455]: Private / Membership
                  - generic [ref=e456]:
                    - generic [ref=e457]:
                      - generic [ref=e458]: Alabang Country Club
                      - generic [ref=e459]:
                        - img [ref=e460]
                        - text: Alabang Country Club · Muntinlupa
                    - generic [ref=e463]:
                      - generic [ref=e464]: 4 Courts
                      - generic [ref=e465]: Outdoor
                      - generic [ref=e466]: hard
              - button "PHP Albay Pickleball Club @ Emmalene Iimuro Tennis Club Albay (Emmalene Iimuro Tennis Club) · Legazpi City Outdoor hard (tennis court)" [ref=e467] [cursor=pointer]:
                - generic [ref=e468]:
                  - generic [ref=e471]: PHP
                  - generic [ref=e472]:
                    - generic [ref=e473]:
                      - generic [ref=e474]: Albay Pickleball Club @ Emmalene Iimuro Tennis Club
                      - generic [ref=e475]:
                        - img [ref=e476]
                        - text: Albay (Emmalene Iimuro Tennis Club) · Legazpi City
                    - generic [ref=e479]:
                      - generic [ref=e480]: Outdoor
                      - generic [ref=e481]: hard (tennis court)
              - button "Per Head / Court Rental Amadea Resort and Pickleball Amadeo · Cavite Outdoor unknown" [ref=e482] [cursor=pointer]:
                - generic [ref=e483]:
                  - generic [ref=e486]: Per Head / Court Rental
                  - generic [ref=e487]:
                    - generic [ref=e488]:
                      - generic [ref=e489]: Amadea Resort and Pickleball
                      - generic [ref=e490]:
                        - img [ref=e491]
                        - text: Amadeo · Cavite
                    - generic [ref=e494]:
                      - generic [ref=e495]: Outdoor
                      - generic [ref=e496]: unknown
              - button "Pay to Play Arcovia Pickleball Club Arcovia City / C5 · Pasig Indoor hard" [ref=e497] [cursor=pointer]:
                - generic [ref=e498]:
                  - generic [ref=e501]: Pay to Play
                  - generic [ref=e502]:
                    - generic [ref=e503]:
                      - generic [ref=e504]: Arcovia Pickleball Club
                      - generic [ref=e505]:
                        - img [ref=e506]
                        - text: Arcovia City / C5 · Pasig
                    - generic [ref=e509]:
                      - generic [ref=e510]: Indoor
                      - generic [ref=e511]: hard
              - button "FREE Asingan Paddlers Pickleball Club Angela Valdez High School · Asingan 3 Courts Mixed hard (school court surface)" [ref=e512] [cursor=pointer]:
                - generic [ref=e513]:
                  - generic [ref=e516]: FREE
                  - generic [ref=e517]:
                    - generic [ref=e518]:
                      - generic [ref=e519]: Asingan Paddlers Pickleball Club
                      - generic [ref=e520]:
                        - img [ref=e521]
                        - text: Angela Valdez High School · Asingan
                    - generic [ref=e524]:
                      - generic [ref=e525]: 3 Courts
                      - generic [ref=e526]: Mixed
                      - generic [ref=e527]: hard (school court surface)
              - button "Per Player Athlete Central San Isidro · Cainta 7 Courts Indoor usapa tournament-grade" [ref=e528] [cursor=pointer]:
                - generic [ref=e529]:
                  - generic [ref=e532]: Per Player
                  - generic [ref=e533]:
                    - generic [ref=e534]:
                      - generic [ref=e535]: Athlete Central
                      - generic [ref=e536]:
                        - img [ref=e537]
                        - text: San Isidro · Cainta
                    - generic [ref=e540]:
                      - generic [ref=e541]: 7 Courts
                      - generic [ref=e542]: Indoor
                      - generic [ref=e543]: usapa tournament-grade
              - button "Per Player Per Open Play Session Athlete Central PH Cainta (Rizal's Biggest Pickleball Facility, 11 PB-capable courts) OAX Complex (KM 22 Ortigas Avenue Extension) · Cainta Indoor usapa tournament-grade (true tournament-grade playing surface built to official usapa standards - exceptional ball bounce, consistent speed, premium playing experience)" [ref=e544] [cursor=pointer]:
                - generic [ref=e545]:
                  - generic [ref=e548]: Per Player Per Open Play Session
                  - generic [ref=e549]:
                    - generic [ref=e550]:
                      - generic [ref=e551]: Athlete Central PH Cainta (Rizal's Biggest Pickleball Facility, 11 PB-capable courts)
                      - generic [ref=e552]:
                        - img [ref=e553]
                        - text: OAX Complex (KM 22 Ortigas Avenue Extension) · Cainta
                    - generic [ref=e556]:
                      - generic [ref=e557]: Indoor
                      - generic [ref=e558]: usapa tournament-grade (true tournament-grade playing surface built to official usapa standards - exceptional ball bounce, consistent speed, premium playing experience)
              - button "Per Player Ayala Heights Badminton Court Ayala Heights Village / Sultan Kudarat · Quezon City 1 Court Indoor hard court" [ref=e559] [cursor=pointer]:
                - generic [ref=e560]:
                  - generic [ref=e563]: Per Player
                  - generic [ref=e564]:
                    - generic [ref=e565]:
                      - generic [ref=e566]: Ayala Heights Badminton Court
                      - generic [ref=e567]:
                        - img [ref=e568]
                        - text: Ayala Heights Village / Sultan Kudarat · Quezon City
                    - generic [ref=e571]:
                      - generic [ref=e572]: 1 Court
                      - generic [ref=e573]: Indoor
                      - generic [ref=e574]: hard court
              - button "Per Hour Ayala Malls 30th (Pasig) Pickleball - 2nd Floor Ortigas Center (Meralco Avenue corner 30th Street) · Pasig Indoor hard (mall flooring)" [ref=e575] [cursor=pointer]:
                - generic [ref=e576]:
                  - generic [ref=e579]: Per Hour
                  - generic [ref=e580]:
                    - generic [ref=e581]:
                      - generic [ref=e582]: Ayala Malls 30th (Pasig) Pickleball - 2nd Floor
                      - generic [ref=e583]:
                        - img [ref=e584]
                        - text: Ortigas Center (Meralco Avenue corner 30th Street) · Pasig
                    - generic [ref=e587]:
                      - generic [ref=e588]: Indoor
                      - generic [ref=e589]: hard (mall flooring)
              - button "Per Player BF Multi-purpose Court Monte Vista Subdivision · Marikina 3 Courts Indoor hard" [ref=e590] [cursor=pointer]:
                - generic [ref=e591]:
                  - generic [ref=e594]: Per Player
                  - generic [ref=e595]:
                    - generic [ref=e596]:
                      - generic [ref=e597]: BF Multi-purpose Court
                      - generic [ref=e598]:
                        - img [ref=e599]
                        - text: Monte Vista Subdivision · Marikina
                    - generic [ref=e602]:
                      - generic [ref=e603]: 3 Courts
                      - generic [ref=e604]: Indoor
                      - generic [ref=e605]: hard
              - button "Per Player (Open Play) / Per Hour (Court Rental) Bacnotan Pickleball Club (BPC) - First Ever PB Court in Bacnotan Nagsaraboan (Bacnotan-San Gabriel Road) · Bacnotan Outdoor hard" [ref=e606] [cursor=pointer]:
                - generic [ref=e607]:
                  - generic [ref=e610]: Per Player (Open Play) / Per Hour (Court Rental)
                  - generic [ref=e611]:
                    - generic [ref=e612]:
                      - generic [ref=e613]: Bacnotan Pickleball Club (BPC) - First Ever PB Court in Bacnotan
                      - generic [ref=e614]:
                        - img [ref=e615]
                        - text: Nagsaraboan (Bacnotan-San Gabriel Road) · Bacnotan
                    - generic [ref=e618]:
                      - generic [ref=e619]: Outdoor
                      - generic [ref=e620]: hard
              - button "Per Session (varies by host) Batangas Pickleball Arena Batangas City · Batangas City Mixed competition surface (per reclub description)" [ref=e621] [cursor=pointer]:
                - generic [ref=e622]:
                  - generic [ref=e625]: Per Session (varies by host)
                  - generic [ref=e626]:
                    - generic [ref=e627]:
                      - generic [ref=e628]: Batangas Pickleball Arena
                      - generic [ref=e629]:
                        - img [ref=e630]
                        - text: Batangas City · Batangas City
                    - generic [ref=e633]:
                      - generic [ref=e634]: Mixed
                      - generic [ref=e635]: competition surface (per reclub description)
              - button "Per Player Blue Ridge Pickleball Club Project 4 / Blue Ridge B · Quezon City 6 Courts Indoor hard court" [ref=e636] [cursor=pointer]:
                - generic [ref=e637]:
                  - generic [ref=e640]: Per Player
                  - generic [ref=e641]:
                    - generic [ref=e642]:
                      - generic [ref=e643]: Blue Ridge Pickleball Club
                      - generic [ref=e644]:
                        - img [ref=e645]
                        - text: Project 4 / Blue Ridge B · Quezon City
                    - generic [ref=e648]:
                      - generic [ref=e649]: 6 Courts
                      - generic [ref=e650]: Indoor
                      - generic [ref=e651]: hard court
              - button "Per Hour (online booking) Bounce at Parqal Mall Pickleball Parañaque Tambo (Aseana City) · Parañaque Outdoor hard (multi-purpose sports flooring)" [ref=e652] [cursor=pointer]:
                - generic [ref=e653]:
                  - generic [ref=e656]: Per Hour (online booking)
                  - generic [ref=e657]:
                    - generic [ref=e658]:
                      - generic [ref=e659]: Bounce at Parqal Mall Pickleball Parañaque
                      - generic [ref=e660]:
                        - img [ref=e661]
                        - text: Tambo (Aseana City) · Parañaque
                    - generic [ref=e664]:
                      - generic [ref=e665]: Outdoor
                      - generic [ref=e666]: hard (multi-purpose sports flooring)
              - button "Per Session / Per Court Rental Bravo Pickleball Vista Mall Bataan Vista Mall Bataan · Balanga Indoor acrylic (pro-standard, tournament-grade)" [ref=e667] [cursor=pointer]:
                - generic [ref=e668]:
                  - generic [ref=e671]: Per Session / Per Court Rental
                  - generic [ref=e672]:
                    - generic [ref=e673]:
                      - generic [ref=e674]: Bravo Pickleball Vista Mall Bataan
                      - generic [ref=e675]:
                        - img [ref=e676]
                        - text: Vista Mall Bataan · Balanga
                    - generic [ref=e679]:
                      - generic [ref=e680]: Indoor
                      - generic [ref=e681]: acrylic (pro-standard, tournament-grade)
              - button "Free (or ₱30 earlier) Bulacan Sports Complex Guinhawa · Malolos 3 Courts Outdoor hard" [ref=e682] [cursor=pointer]:
                - generic [ref=e683]:
                  - generic [ref=e686]: Free (or ₱30 earlier)
                  - generic [ref=e687]:
                    - generic [ref=e688]:
                      - generic [ref=e689]: Bulacan Sports Complex
                      - generic [ref=e690]:
                        - img [ref=e691]
                        - text: Guinhawa · Malolos
                    - generic [ref=e694]:
                      - generic [ref=e695]: 3 Courts
                      - generic [ref=e696]: Outdoor
                      - generic [ref=e697]: hard
              - paragraph [ref=e698]: Showing top 30 of 182
  - dialog [ref=e699]:
    - generic [ref=e701]:
      - generic [ref=e702]:
        - heading [level=2] [ref=e703]: Create your free account
        - generic [ref=e704]: You'll need an account to continue. Browsing stays free — sign up takes a few seconds.
      - button [ref=e705] [cursor=pointer]:
        - img [ref=e707]
    - generic [ref=e710]:
      - list [ref=e711]:
        - listitem [ref=e712]:
          - img [ref=e715]
          - text: Join games and lock in your spot
        - listitem [ref=e717]:
          - img [ref=e720]
          - text: Create matches and start clubs
        - listitem [ref=e722]:
          - img [ref=e725]
          - text: Track your matches and streaks
      - button [ref=e727] [cursor=pointer]: Create free account
      - button [ref=e728] [cursor=pointer]: I already have an account
```

# Test source

```ts
  309 |   test('B.4 Venue list narrows after filter', async ({ page }) => {
  310 |     await goNearby(page);
  311 |     const before = await venueCount(page);
  312 |     expect(before).toBeGreaterThan(0);
  313 | 
  314 |     await pickShortcutDate(page, 'Tomorrow');
  315 |     await pickStartHour(page, 12); // noon
  316 |     await applyBtn(page).click();
  317 |     await page.waitForTimeout(3000);
  318 | 
  319 |     const after = await venueCount(page);
  320 |     expect(after).toBeLessThanOrEqual(before);
  321 |   });
  322 | 
  323 |   test('B.5 Multi-hour window filtering', async ({ page }) => {
  324 |     await goNearby(page);
  325 | 
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
> 409 |     expect(secondMonth).not.toBe(firstMonth);
      |                             ^ Error: expect(received).not.toBe(expected) // Object.is equality
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
  426 |     expect(Number(secondYear)).toBe(Number(firstYear) - 1);
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