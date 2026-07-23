// Pickleballers API — What a full truncate must NOT delete.
//
// The wipe is deliberately deny-by-default in reverse: it enumerates every
// collection Mongo reports and clears it, so a collection added tomorrow is
// wiped tomorrow without anyone remembering to list it. The only thing that
// needs maintaining is the *exception* list below.
//
// If you add a model whose rows must survive a wipe, add it here AND to the
// "Never deleted" card in the app's AdminDataToolsScreen — the card is what the
// admin reads before typing the confirmation, so an undocumented exception is
// as bad as a missing one.

/** Collections left completely untouched. */
export const KEEP_WHOLE = [
  // The RBAC catalogue. There is no bootstrap that recreates these from code —
  // `seedSystemRoles()` only inserts what's missing by key, and the permission
  // arrays live nowhere else. Wiping this locks every admin out of the console.
  'roles',
  // The global singleton: payment test mode, service/transaction fees, pricing
  // mode, partner plan tiers — and `emailBccEnabled`/`emailBccAddress`, the only
  // email configuration that lives in the database at all.
  'appsettings',
] as const;

/**
 * Collections cleared except for rows belonging to a preserved user, keyed by
 * the field that holds the user id. `users` itself is scoped by `_id`.
 *
 * These are the account's own auth surface: without them a preserved admin
 * keeps their password but loses their role grants and push registrations.
 */
export const SCOPE_TO_KEPT_USERS: Record<string, string> = {
  users: '_id',
  userroles: 'userId',
  userdevices: 'userId',
  pushsubscriptions: 'userId',
  fcmtokens: 'userId',
};

/** Mongo's own bookkeeping — never ours to touch. */
export function isSystemCollection(name: string): boolean {
  return name.startsWith('system.');
}

// ─── Uploads ────────────────────────────────────────────────────────────────

/**
 * Sub-paths of `uploads/` the sweep must never walk into.
 *
 * `images/` holds the venue photo tree that `import-real-data.ts` copies out of
 * `real-data/handoff/images/`. It is SOURCE DATA for the re-seed, not user
 * content — deleting it means the seeder can never restore those photos.
 */
export const UPLOAD_SWEEP_SKIP_DIRS = ['images'];

/** Swept files are moved here rather than unlinked, so a mistake is recoverable. */
export const UPLOAD_TRASH_PREFIX = '.trash-';
