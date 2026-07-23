import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import { AdminScreen, AdminStat, adminNumber } from './AdminScaffold';
import {
  getDataJob, getDataStatus, runDataSeed, runDataTruncate,
  type DataJob, type DataStatus, type TruncateResult,
} from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

const POLL_MS = 1500;

function bytesLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

const STEP_ICON: Record<string, string> = {
  pending: 'radio_button_unchecked',
  running: 'progress_activity',
  done: 'check_circle',
  failed: 'cancel',
  skipped: 'remove_circle_outline',
};

const STEP_COLOR: Record<string, string> = {
  pending: 'var(--muted)',
  running: 'var(--blue)',
  done: 'var(--lime-ink, var(--blue))',
  failed: 'var(--coral)',
  skipped: 'var(--muted)',
};

/**
 * Admin console: seed and reset the database.
 *
 * Two operations the launch needs — wipe the platform down to a publishable
 * blank state, and rebuild the whole demo dataset from the seed pipeline. Both
 * are long-running, so they start a server-side job that this screen polls.
 *
 * The wipe demands the typed confirm phrase AND the admin's password, and
 * defaults its preview toggle to a dry run. Gated by `admin.settings.manage`.
 */
export function AdminDataToolsScreen({ onNavigate }: Props) {
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'idle' | 'error'>('loading');
  const [showAllCollections, setShowAllCollections] = useState(false);

  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(new Set());
  const [job, setJob] = useState<DataJob | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [wipeOpen, setWipeOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [sweepUploads, setSweepUploads] = useState(true);
  const [wiping, setWiping] = useState(false);
  const [wipeResult, setWipeResult] = useState<TruncateResult | null>(null);

  const reqId = useRef(0);
  const logRef = useRef<HTMLPreElement>(null);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const s = await getDataStatus();
      if (id !== reqId.current) return;
      setStatus(s);
      // Every step on by default — a partial seed is the exception, not the norm.
      setSelectedSteps((prev) => (prev.size ? prev : new Set(s.seedSteps.map((x) => x.key))));
      if (s.job) setJob(s.job);
      setLoadState('idle');
    } catch {
      if (id !== reqId.current) return;
      setLoadState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Poll a running job, streaming only the log lines we don't have yet.
  useEffect(() => {
    if (job?.status !== 'running') return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const next = await getDataJob(job.id, job.logTotal);
        if (cancelled) return;
        setJob((prev) => (prev ? { ...next, log: [...prev.log, ...next.log] } : next));
        if (next.status !== 'running') void load();
      } catch { /* keep the last known state and retry on the next tick */ }
    }, POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [job?.status, job?.id, job?.logTotal, load]);

  // Follow the tail as the job writes.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job?.log.length]);

  async function startSeed() {
    setActionError(null);
    setStarting(true);
    try {
      setJob(await runDataSeed([...selectedSteps]));
    } catch (e) {
      setActionError((e as Error).message || 'Could not start the seed');
    }
    setStarting(false);
  }

  async function submitWipe() {
    setActionError(null);
    setWiping(true);
    try {
      const result = await runDataTruncate({ confirm: confirmText, password, dryRun, sweepUploads });
      setWipeResult(result);
      setWipeOpen(false);
      setPassword('');
      setConfirmText('');
      if (!result.dryRun) void load();
    } catch (e) {
      setActionError((e as Error).message || 'The wipe failed');
    }
    setWiping(false);
  }

  const busy = job?.status === 'running' || starting || wiping;
  const armed = !!status && confirmText === status.confirmPhrase && password.length > 0;
  const countOf = (name: string) => status?.collections.find((c) => c.name === name)?.count ?? 0;
  const shownCollections = showAllCollections
    ? status?.collections ?? []
    : (status?.collections ?? []).filter((c) => c.count > 0);

  const header = (
    <AdminScreen
      onBack={() => onNavigate('admin-hub')}
      title="Data tools"
      subtitle="Seed the demo dataset, or wipe the database clean for launch."
      onRefresh={() => void load()}
    >
      {loadState === 'error' && (
        <section className="card p-4 mt-4">
          <p className="font-bold">Couldn't load the database snapshot</p>
          <p className="t-sm mt-1">Check your connection and try again.</p>
          <button type="button" className="chip font-bold mt-3" onClick={() => void load()}>Retry</button>
        </section>
      )}

      {status && (
        <>
          {/* ── Snapshot ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <AdminStat label="Users" value={adminNumber(countOf('users'))} icon="people" />
            <AdminStat label="Venues" value={adminNumber(countOf('venues'))} icon="stadium" tone="var(--amber)" />
            <AdminStat label="Games" value={adminNumber(countOf('games'))} icon="sports_tennis" tone="var(--coral)" />
            <AdminStat label="Bookings" value={adminNumber(countOf('bookings'))} icon="event_available" />
          </div>

          <section className="card p-4 mt-4">
            <h2 className="hd-2 flex items-center gap-2"><Icon name="database" size={18} /> Database</h2>
            <p className="t-sm mt-1">
              {adminNumber(status.totalCollections)} collections · {adminNumber(status.totalDocuments)} documents
            </p>
            <div className="mt-3 max-h-64 overflow-y-auto">
              {shownCollections.map((c) => (
                <div key={c.name} className="flex items-center gap-2 py-1.5 border-b-[0.5px] border-[var(--hairline)] last:border-0">
                  <span className="text-[13px] flex-1 truncate">{c.name}</span>
                  {c.disposition !== 'wiped' && (
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide shrink-0"
                      style={{ color: c.disposition === 'preserved' ? 'var(--blue)' : 'var(--amber)' }}
                    >
                      {c.disposition === 'preserved' ? 'kept' : 'admin only'}
                    </span>
                  )}
                  <span className="text-[13px] font-bold tabular-nums shrink-0">{adminNumber(c.count)}</span>
                </div>
              ))}
            </div>
            <button type="button" className="chip font-bold mt-3" onClick={() => setShowAllCollections((v) => !v)}>
              {showAllCollections ? 'Hide empty collections' : `Show all ${status.totalCollections}`}
            </button>
          </section>

          {/* ── What survives a wipe ─────────────────────────────── */}
          <section className="card p-4 mt-4">
            <h2 className="hd-2 flex items-center gap-2"><Icon name="shield" size={18} /> Never deleted</h2>
            <ul className="t-sm mt-2 space-y-2">
              <li className="flex items-start gap-2">
                <Icon name="admin_panel_settings" size={14} className="mt-0.5 shrink-0" />
                <span>
                  <b>Admin accounts</b> — {status.preserved.users.map((u) => u.email).filter(Boolean).join(', ') || 'none found'}
                  {' '}(plus their roles, devices and push registrations).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="shield_person" size={14} className="mt-0.5 shrink-0" />
                <span><b>Roles &amp; permissions</b> — the <code>roles</code> collection. Nothing recreates it from code.</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="settings" size={14} className="mt-0.5 shrink-0" />
                <span><b>App settings</b> — fees, pricing mode, plan tiers, and the email BCC configuration.</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="mail" size={14} className="mt-0.5 shrink-0" />
                <span>
                  <b>SMTP credentials</b> — the mailer signs in with a Gmail token stored in{' '}
                  <code>{status.preserved.smtpTokenFile.path}</code> on disk
                  {status.preserved.smtpTokenFile.exists ? '' : ' (not present yet)'}, so no database
                  operation can reach it.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="image" size={14} className="mt-0.5 shrink-0" />
                <span>
                  <b>Imported venue photos</b> — <code>uploads/{status.preserved.uploadDirsSkipped.join(', ')}/</code> is
                  source data for the seeder, so the uploads sweep never walks into it.
                </span>
              </li>
            </ul>
          </section>

          {/* ── Seed ─────────────────────────────────────────────── */}
          <section className="card p-4 mt-4">
            <h2 className="hd-2 flex items-center gap-2"><Icon name="eco" size={18} /> Run the seeder</h2>
            <p className="t-sm mt-1">
              Steps run in order — each one depends on the ones above it. The run stops at the first failure.
            </p>

            <div className="mt-3">
              {status.seedSteps.map((step, i) => {
                const on = selectedSteps.has(step.key);
                return (
                  <label key={step.key} className="flex cursor-pointer items-start gap-3 py-2 border-b-[0.5px] border-[var(--hairline)] last:border-0">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={busy}
                      onChange={() => setSelectedSteps((prev) => {
                        const next = new Set(prev);
                        if (on) next.delete(step.key); else next.add(step.key);
                        return next;
                      })}
                      className="mt-1 size-4 shrink-0 accent-[var(--blue)]"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold">
                        {i + 1}. {step.label}
                        {step.network && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--amber)' }}>
                            needs internet
                          </span>
                        )}
                      </p>
                      <p className="t-sm">{step.why}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" className="chip font-bold" disabled={busy}
                onClick={() => setSelectedSteps(new Set(status.seedSteps.map((s) => s.key)))}>Select all</button>
              <button type="button" className="chip font-bold" disabled={busy}
                onClick={() => setSelectedSteps(new Set())}>Clear</button>
            </div>

            <button
              type="button"
              disabled={busy || selectedSteps.size === 0}
              onClick={() => void startSeed()}
              className="mt-4 w-full rounded-2xl bg-[var(--blue)] px-4 py-3 font-bold text-white disabled:opacity-40"
            >
              {job?.status === 'running' && job.kind === 'seed'
                ? 'Seeding…'
                : `Run ${selectedSteps.size} of ${status.seedSteps.length} seed steps`}
            </button>
          </section>

          {/* ── Job progress ─────────────────────────────────────── */}
          {job && (
            <section className="card p-4 mt-4">
              <h2 className="hd-2 flex items-center gap-2">
                <Icon name="terminal" size={18} />
                {job.kind === 'seed' ? 'Seed run' : 'Wipe'}
                <span
                  className="ml-auto text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: STEP_COLOR[job.status === 'done' ? 'done' : job.status === 'failed' ? 'failed' : 'running'] }}
                >
                  {job.status}
                </span>
              </h2>

              <div className="mt-3">
                {job.steps.map((s) => (
                  <div key={s.key} className="flex items-center gap-2 py-1.5">
                    <span style={{ color: STEP_COLOR[s.status] }} className={s.status === 'running' ? 'animate-spin' : ''}>
                      <Icon name={STEP_ICON[s.status] ?? 'circle'} size={16} />
                    </span>
                    <span className={`text-[13px] flex-1 truncate ${s.status === 'skipped' ? 'opacity-50' : ''}`}>{s.label}</span>
                    {s.durationMs != null && (
                      <span className="t-sm tabular-nums shrink-0">{Math.round(s.durationMs / 1000)}s</span>
                    )}
                  </div>
                ))}
              </div>

              {job.error && <p className="t-sm mt-2" style={{ color: 'var(--coral)' }}>{job.error}</p>}

              <pre
                ref={logRef}
                className="mt-3 max-h-72 overflow-auto rounded-xl bg-black/85 p-3 text-[11px] leading-relaxed text-[#d6e2ff] whitespace-pre-wrap"
              >
                {job.log.join('\n') || 'Waiting for output…'}
              </pre>
            </section>
          )}

          {/* ── Last wipe report ─────────────────────────────────── */}
          {wipeResult && (
            <section className="card p-4 mt-4">
              <h2 className="hd-2 flex items-center gap-2">
                <Icon name={wipeResult.dryRun ? 'visibility' : 'delete_sweep'} size={18} />
                {wipeResult.dryRun ? 'Dry run — nothing was deleted' : 'Wipe complete'}
              </h2>
              <p className="t-sm mt-1">
                {adminNumber(wipeResult.totalDeleted)} document{wipeResult.totalDeleted === 1 ? '' : 's'}{' '}
                {wipeResult.dryRun ? 'would be removed' : 'removed'} · {adminNumber(wipeResult.totalKept)} kept
                {wipeResult.uploads.swept > 0 && (
                  <> · {wipeResult.uploads.swept} upload{wipeResult.uploads.swept === 1 ? '' : 's'} ({bytesLabel(wipeResult.uploads.bytes)})
                    {wipeResult.uploads.trashDir ? ` moved to ${wipeResult.uploads.trashDir}` : ' would be swept'}</>
                )}
              </p>
              <div className="mt-3 max-h-56 overflow-y-auto">
                {wipeResult.collections.filter((c) => c.before > 0).map((c) => (
                  <div key={c.name} className="flex items-center gap-2 py-1 border-b-[0.5px] border-[var(--hairline)] last:border-0">
                    <span className="text-[13px] flex-1 truncate">{c.name}</span>
                    {c.kept > 0 && <span className="t-sm shrink-0">{adminNumber(c.kept)} kept</span>}
                    <span
                      className="text-[13px] font-bold tabular-nums shrink-0"
                      style={{ color: c.deleted > 0 ? 'var(--coral)' : 'var(--muted)' }}
                    >
                      −{adminNumber(c.deleted)}
                    </span>
                  </div>
                ))}
              </div>
              <button type="button" className="chip font-bold mt-3" onClick={() => setWipeResult(null)}>Dismiss</button>
            </section>
          )}

          {/* ── Danger zone ──────────────────────────────────────── */}
          <section className="card p-4 mt-4 mb-8 border-[1.5px] border-[var(--coral)]">
            <h2 className="hd-2 flex items-center gap-2" style={{ color: 'var(--coral)' }}>
              <Icon name="warning" size={18} /> Danger zone
            </h2>
            <p className="t-sm mt-1">
              Empties every collection except the ones listed above. Use this to publish on a clean
              database. Rehearse it as a dry run first — the preview reports exactly what would go.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => { setWipeOpen(true); setActionError(null); }}
              className="mt-4 w-full rounded-2xl border-[1.5px] border-[var(--coral)] px-4 py-3 font-bold disabled:opacity-40"
              style={{ color: 'var(--coral)' }}
            >
              Wipe all data…
            </button>
          </section>
        </>
      )}

      {actionError && !wipeOpen && (
        <p className="t-sm mb-8" style={{ color: 'var(--coral)' }}>{actionError}</p>
      )}
    </AdminScreen>
  );

  return (
    <>
      {header}

      <BottomSheet
        open={wipeOpen}
        onClose={() => { if (!wiping) setWipeOpen(false); }}
        title={dryRun ? 'Preview a full wipe' : 'Wipe all data'}
        subtitle={dryRun
          ? 'Reports what would be deleted. Nothing is touched.'
          : 'This cannot be undone. Everything except the preserved list is deleted.'}
        footer={
          <button
            type="button"
            disabled={!armed || wiping}
            onClick={() => void submitWipe()}
            className="w-full rounded-2xl px-4 py-3 font-bold text-white disabled:opacity-40"
            style={{ background: dryRun ? 'var(--blue)' : 'var(--coral)' }}
          >
            {wiping ? 'Working…' : dryRun ? 'Run preview' : 'Delete everything'}
          </button>
        }
      >
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] border-[var(--hairline)] p-3">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--blue)]" />
            <div>
              <p className="text-[13px] font-bold">Preview only (dry run)</p>
              <p className="t-sm">Counts what would go without deleting it.</p>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] border-[var(--hairline)] p-3">
            <input type="checkbox" checked={sweepUploads} onChange={(e) => setSweepUploads(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--blue)]" />
            <div>
              <p className="text-[13px] font-bold">Also sweep unreferenced uploads</p>
              <p className="t-sm">
                Moves orphaned files out of <code>uploads/</code> into a timestamped trash folder —
                never deleted outright, and never the imported venue photos.
              </p>
            </div>
          </label>

          <div className="field">
            <label className="lbl" htmlFor="wipe-confirm">Type <b>{status?.confirmPhrase}</b> to confirm</label>
            <input
              id="wipe-confirm"
              className="control"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={status?.confirmPhrase}
              autoCapitalize="characters"
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label className="lbl" htmlFor="wipe-password">Your password</label>
            <input
              id="wipe-password"
              className="control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <p className="t-sm mt-1">Re-entered so a forgotten open session can't wipe the platform.</p>
          </div>

          {actionError && <p className="t-sm" style={{ color: 'var(--coral)' }}>{actionError}</p>}
        </div>
      </BottomSheet>
    </>
  );
}
