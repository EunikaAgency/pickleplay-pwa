// Pickleballers API — first-name → gender inference (seed/backfill scripts only)
//
// A curated name list covering the seeded + imported data. This is a DATA-REPAIR
// helper, not product logic: it exists so one-off backfills can derive a gender
// for rows that predate the field. Real accounts state their own gender on the
// profile editor, which is required — never infer one for a live user when they
// can simply be asked.
//
// Extracted from fix-avatar-gender.ts so the avatar fix and the gender backfill
// share one list instead of drifting apart.

export const strip = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const FEMALE = new Set([
  'allyssa', 'aly', 'anna', 'anne', 'antonia', 'apolonia', 'aubree', 'avery', 'brooke',
  'carla', 'carol', 'cathy', 'chesney', 'clara', 'claudia', 'consuelo', 'eden', 'eliza',
  'elizabeth', 'ellen', 'ellie', 'emily', 'eunika', 'eva', 'felicia', 'fennie', 'gina',
  'giselle', 'graziella', 'hannah', 'harper', 'harley', 'heidi', 'ines', 'isabella', 'joyce',
  'judy', 'julia', 'katie', 'kristin', 'layla', 'leah', 'lena', 'louise', 'lourdes', 'madison',
  'malissa', 'margarita', 'mari', 'marie', 'martha', 'maya', 'mia', 'monica', 'nicole', 'nina',
  'noemie', 'pearl', 'piper', 'purificacion', 'rocio', 'ruby', 'sara', 'sarah', 'sydnee', 'tara',
  'thea', 'vicky', 'whitney', 'zoey', 'jojie', 'joy',
  // e2e fixture names (Alice/Carol/Olive) — see api/e2e/*.spec.ts
  'alice', 'olive',
].map(strip));

export const MALE = new Set([
  'abdelhakim', 'aitor', 'alberto', 'alexander', 'antoine', 'archie', 'armando', 'beau', 'benito',
  'benjo', 'billy', 'brad', 'bradley', 'brennan', 'cameron', 'carl', 'carter', 'charles', 'chris',
  'christian', 'cristian', 'cullen', 'dan', 'darrell', 'darren', 'dylan', 'edu', 'eduardo', 'eloy',
  'eric', 'ernesto', 'ethan', 'everett', 'federico', 'felix', 'fernando', 'glenn', 'herman',
  'hudson', 'hunter', 'ivan', 'jaime', 'jake', 'james', 'jarryd', 'javier', 'jeffrey', 'jeremy',
  'jesse', 'jobert', 'john', 'johnny', 'jonathan', 'joshua', 'julian', 'karl', 'kevin', 'kim',
  'lachlan', 'larry', 'leander', 'lee', 'lennon', 'lucas', 'manny', 'marco', 'mark', 'mason',
  'matthew', 'michael', 'micheal', 'mico', 'nathan', 'neil', 'nicolas', 'noah', 'noel', 'oscar',
  'owen', 'pao', 'paul', 'raphael', 'ray', 'rowan', 'russell', 'samuel', 'souhail', 'steve',
  'taran', 'tevin', 'thomas', 'timmothy', 'tony', 'troy', 'vicente', 'vittorio', 'willian',
  'xavier', 'yuri',
  // e2e fixture names (Bob/Dave) — see api/e2e/*.spec.ts
  'bob', 'dave',
].map(strip));

/** The first name, normalised — '' when there isn't one. */
export function firstNameOf(firstName?: string | null, displayName?: string | null): string {
  return strip((firstName || displayName || '').split(/\s+/)[0] || '');
}

/** null when the name matches neither list — the caller decides what to do with
 *  an unknown, rather than being silently handed a default. */
export function genderFromName(
  firstName?: string | null,
  displayName?: string | null,
): 'male' | 'female' | null {
  const first = firstNameOf(firstName, displayName);
  if (FEMALE.has(first)) return 'female';
  if (MALE.has(first)) return 'male';
  return null;
}
