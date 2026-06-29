import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Button } from '../../shared/components/ui/Button';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { OwnerSection } from './components/OwnerSection';
import { listVenues, submitVenueClaim, uploadClaimMedia, getMyClaims, resubmitClaim, apiImageUrl, entityId, ApiError, type ApiVenue, type VenueClaim } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface ClaimVenueScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

// One line of human-readable location for a venue row.
function addressOf(v: ApiVenue): string {
  return v.fullAddress || [v.area, v.city, v.region].filter(Boolean).join(', ') || 'Location not listed';
}

export function ClaimVenueScreen({ onBack }: ClaimVenueScreenProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiVenue[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const reqId = useRef(0);

  // The venue the owner picked to claim (null = still on the search step).
  const [selected, setSelected] = useState<ApiVenue | null>(null);
  const [proof, setProof] = useState('');
  const [links, setLinks] = useState('');
  // Identity verification fields  --  collected upfront so the admin review has
  // everything they need to confirm the person behind the claim.
  const [legalName, setLegalName] = useState('');
  const [claimantRole, setClaimantRole] = useState('');
  const [claimantContact, setClaimantContact] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // V5: File upload for proof documents.
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // V6: Claim status tracking  --  fetched on mount to show in-progress claims.
  const [myClaims, setMyClaims] = useState<VenueClaim[]>([]);
  const [resubmitting, setResubmitting] = useState(false);

  // Debounced directory search, scoped to unclaimed listings. All state updates
  // run inside the timer/promise (never synchronously in the effect body), and a
  // request-id guard drops stale responses so a slow page can't overwrite a newer
  // query's results.
  useEffect(() => {
    const q = query.trim();
    // Ignore a single character (too noisy); keep whatever is already shown.
    if (q.length === 1) return;
    const id = ++reqId.current;
    const t = setTimeout(() => {
      if (id !== reqId.current) return;
      setSearchStatus('loading');
      // Always show genuinely-claimable listings (unclaimed AND no pending claim).
      // Empty query → the default browse list; ≥2 chars → narrowed by search.
      listVenues({ search: q.length >= 2 ? q : undefined, state: 'unclaimed', excludePendingClaims: true, pageSize: 20 })
        .then((page) => { if (id === reqId.current) { setResults(page.items); setSearchStatus('idle'); } })
        .catch(() => { if (id === reqId.current) setSearchStatus('error'); });
    }, q.length >= 2 ? 300 : 0);
    return () => clearTimeout(t);
  }, [query]);

  // V6: Once the claim is submitted, refresh the claimant's claims so the
  // success screen shows their latest status. Hoisted to the top level (gated on
  // `submitted`) so the hook order stays stable across the search/success steps.
  useEffect(() => {
    if (!submitted) return;
    getMyClaims().then((c) => setMyClaims(c)).catch(() => {});
  }, [submitted]);

  const pick = (v: ApiVenue) => {
    setSelected(v);
    setProof('');
    setLinks('');
    setLegalName('');
    setClaimantRole('');
    setClaimantContact('');
    setSubmitStatus('idle');
    setErrMsg('');
  };

  const proofOk = proof.trim().length >= 10;

  const submit = async () => {
    if (!selected || !proofOk) return;
    const linksFromText = links.split('\n').map((s) => s.trim()).filter(Boolean);
    const proofDocumentUrls = [...linksFromText, ...uploadedFiles.map((f) => f.url)].slice(0, 5);
    setSubmitStatus('submitting');
    setErrMsg('');
    try {
      await submitVenueClaim({
        venueId: entityId(selected),
        proofDescription: proof.trim(),
        proofDocumentUrls: proofDocumentUrls.length ? proofDocumentUrls : undefined,
        claimantLegalName: legalName.trim() || undefined,
        claimantRole: claimantRole.trim() || undefined,
        claimantContact: claimantContact.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitStatus('error');
      setErrMsg(
        err instanceof ApiError && err.status === 409
          ? (err.message || 'This venue already has a pending or approved claim.')
          : err instanceof ApiError && err.status === 403
            ? 'You don\'t have permission to claim venues.'
            : err instanceof ApiError && err.status === 401
              ? 'Your session expired -- sign in again.'
              : 'Could not submit your claim. Try again in a moment.',
      );
    }
  };

  // Back arrow steps form → search → out of the screen.
  const onHeaderBack = selected && !submitted ? () => setSelected(null) : onBack;
  const backIcon = 'back' as const;

  const header = (
    <ScreenHeader
      onBack={onHeaderBack}
      backIcon={backIcon}
      eyebrow="Owner console"
      title="Claim a venue"
      subtitle="Find your venue in our directory and claim it as the owner."
      className="sticky top-0 z-20 -mx-5 px-5 bg-[var(--bg)] border-b-[0.5px] border-[var(--hairline)]"
    />
  );

  if (submitted) {
    const resubmit = async (claimId: string) => {
      setResubmitting(true);
      try {
        await resubmitClaim(claimId, { proofDescription: proof.trim() || undefined, proofDocumentUrls: uploadedFiles.map((f) => f.url).length ? uploadedFiles.map((f) => f.url) : undefined });
        const updated = await getMyClaims();
        setMyClaims(updated);
      } catch { /* ignore */ }
      finally { setResubmitting(false); }
    };
    return (
      <div className="scroll safe-top safe-bottom px-5">
        {header}
        <div className="mt-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-[var(--lime)] text-[var(--lime-ink)] flex items-center justify-center mb-4">
            <Icon name="check" size={32} />
          </div>
          <div className="hd-2 mb-1.5">Claim submitted</div>
          <p className="t-sm max-w-[320px] mx-auto mb-6">
            Thanks! Our team will review your claim for <strong className="text-[var(--ink)]">{selected?.displayName}</strong>. You'll be notified once it's approved.
          </p>
          {myClaims.length > 0 && (
            <div className="mb-6 space-y-3 text-left">
              {myClaims.map((c) => (
                <div key={c.id} className="rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-bold text-[var(--ink)]">{c.venueName || 'Unknown venue'}</div>
                      <div className={`text-[12px] font-semibold mt-0.5 ${
                        c.status === 'approved' ? 'text-[var(--lime-ink)]' :
                        c.status === 'rejected' ? 'text-[var(--coral)]' :
                        c.status === 'needs_info' ? 'text-[var(--blue)]' :
                        'text-[var(--amber)]'}`}>
                        {c.status === 'pending' ? 'Pending review' :
                         c.status === 'approved' ? 'Approved' :
                         c.status === 'rejected' ? 'Rejected' :
                         'More info needed'}
                      </div>
                    </div>
                  </div>
                  {c.status === 'needs_info' && c.reviewNotes && (
                    <div className="mt-2 text-[12px] font-semibold text-[var(--muted)]">Reviewer: {c.reviewNotes}</div>
                  )}
                  {c.status === 'needs_info' && (
                    <button type="button" className="chip mt-2 text-[13px] font-semibold" disabled={resubmitting}
                      onClick={() => resubmit(c.id!)}>
                      {resubmitting ? 'Resubmitting...' : 'Resubmit with more info'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <Button fullWidth onClick={onBack}>Back to your venues</Button>
        </div>
      </div>
    );
  }

  if (selected) {
    const img = apiImageUrl(selected.image || selected.mainImageUrl);
    return (
      <div className="scroll safe-top safe-bottom px-5">
        {header}
        <div className="space-y-4">
          <OwnerSection title="You're claiming" icon="storefront">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-lg bg-[var(--surface-2)] overflow-hidden shrink-0 flex items-center justify-center text-[var(--muted)]">
                {img ? <img src={img} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <Icon name="storefront" size={22} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[15px] text-[var(--ink)] truncate">{selected.displayName}</div>
                <div className="t-sm truncate">{addressOf(selected)}</div>
              </div>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="mt-3 t-sm font-semibold text-[var(--primary)]">Choose a different venue</button>
          </OwnerSection>

          <OwnerSection title="Proof of ownership" icon="verified" description="Tell us who you are and how you're connected to this venue so our team can verify your claim.">
            <div className="field p-0! mb-3">
              <label className="lbl">Your legal name</label>
              <input
                className="control"
                value={legalName}
                maxLength={120}
                onChange={(e) => { setLegalName(e.target.value); if (submitStatus === 'error') setSubmitStatus('idle'); }}
                placeholder="Your full legal name (e.g. Juan dela Cruz)"
              />
            </div>
            <div className="field p-0! mb-3">
              <label className="lbl">Your role at this venue</label>
              <input
                className="control"
                value={claimantRole}
                maxLength={60}
                onChange={(e) => { setClaimantRole(e.target.value); if (submitStatus === 'error') setSubmitStatus('idle'); }}
                placeholder="e.g. Owner, General Manager, Head Coach"
              />
            </div>
            <div className="field p-0! mb-3">
              <label className="lbl">Contact for verification</label>
              <input
                className="control"
                value={claimantContact}
                maxLength={160}
                onChange={(e) => { setClaimantContact(e.target.value); if (submitStatus === 'error') setSubmitStatus('idle'); }}
                placeholder="e.g. +63 912 345 6789 or business email"
              />
              <div className="t-sm mt-1">Our team may reach out at this number or email to confirm.</div>
            </div>
            <div className="field p-0! mb-3">
              <label className="lbl">How are you connected to this venue?</label>
              <textarea
                className="control"
                rows={4}
                value={proof}
                maxLength={2000}
                onChange={(e) => { setProof(e.target.value); if (submitStatus === 'error') setSubmitStatus('idle'); }}
                placeholder="e.g. I'm the owner/manager. Our official Facebook page, business permit, or a staff email can confirm it."
              />
              <div className="t-sm mt-1">{proofOk ? `${proof.trim().length} characters` : 'At least 10 characters.'}</div>
            </div>
            <div className="field p-0!">
              <label className="lbl">Proof links (optional)</label>
              <textarea
                className="control"
                rows={3}
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder={'One link per line (max 5)\nhttps://facebook.com/your-venue\nhttps://your-site.com'}
              />
              <div className="t-sm mt-1">Official page, website, or a document link  --  anything that confirms ownership.</div>
            </div>
            {/* V5: File upload  --  scanned IDs, business permits, etc. */}
            <div className="field p-0!">
              <label className="lbl">Upload documents</label>
              <input type="file" ref={fileRef} accept="image/*" capture="environment"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const result = await uploadClaimMedia(file);
                    if (result?.url) setUploadedFiles((prev) => [...prev, { name: file.name, url: result.url! }]);
                  } catch { /* silently ignore */ }
                  finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
                }}
                style={{ display: 'none' }} />
              <button type="button" className="chip w-fit mt-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Icon name="add_a_photo" size={16} /> {uploading ? 'Uploading...' : 'Add photo'}
              </button>
              {uploadedFiles.map((f, i) => (
                <div key={i} className="mt-1 flex items-center gap-2 text-[13px] font-semibold text-[var(--ink)]">
                  <Icon name="check_circle" size={14} className="text-[var(--lime-ink)] shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <button type="button" className="text-[var(--coral)] ml-auto shrink-0" onClick={() => setUploadedFiles((prev) => prev.filter((_, j) => j !== i))}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </OwnerSection>

          {errMsg && <div className="t-sm text-[var(--coral)] font-bold text-center">{errMsg}</div>}
          <Button type="button" fullWidth onClick={submit} disabled={!proofOk || submitStatus === 'submitting'}>
            {submitStatus === 'submitting' ? 'Submitting...' : 'Submit claim'}
          </Button>
        </div>
      </div>
    );
  }

  // Search step.
  return (
    <div className="scroll safe-top safe-bottom px-5">
      {header}

      <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-[var(--primary-tint)] px-4 py-3">
        <Icon name="help" size={18} className="shrink-0 text-[var(--primary)] mt-0.5" />
        <p className="text-[13px] text-[var(--ink-2)]">Claiming links an existing directory listing to your account. Our team reviews each claim before it's approved  --  no duplicate listing needed.</p>
      </div>

      <div className="field p-0! mb-4">
        <label className="lbl">Search the directory</label>
        <div className="relative">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
          <input
            className="control pl-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by venue name or area"
            autoFocus
          />
        </div>
      </div>

      {searchStatus === 'loading' ? (
        <LoadingSkeleton variant="card" count={4} />
      ) : searchStatus === 'error' ? (
        <EmptyState icon="error" title="Couldn't load venues" description="We couldn't reach the directory. Check your connection and try again." />
      ) : results.length === 0 ? (
        <EmptyState
          icon="search"
          title={query.trim() ? 'No match found' : 'No claimable venues'}
          description={query.trim()
            ? 'No unclaimed listing matches that. Try another name or area  --  or create it instead.'
            : 'There are no unclaimed directory listings to claim right now. If yours isn’t here, create it instead.'}
        />
      ) : (
        <>
          <div className="t-eyebrow mb-2">{query.trim() ? 'Matches' : 'Unclaimed venues'} · {results.length}{!query.trim() && results.length >= 20 ? '+' : ''}</div>
          <div className="space-y-3">
          {results.map((v) => {
            const img = apiImageUrl(v.image || v.mainImageUrl);
            return (
              <button
                key={v.id || v.slug}
                type="button"
                onClick={() => pick(v)}
                className="w-full text-left rounded-xl border-[0.5px] border-[var(--hairline)] p-3 flex items-center gap-3 active:scale-[.99] transition-transform"
              >
                <div className="h-12 w-12 rounded-lg bg-[var(--surface-2)] overflow-hidden shrink-0 flex items-center justify-center text-[var(--muted)]">
                  {img ? <img src={img} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <Icon name="storefront" size={20} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{v.displayName}</div>
                  <div className="t-sm truncate">{addressOf(v)}</div>
                </div>
                <span className="inline-flex items-center gap-0.5 text-[var(--primary)] font-bold text-[13px] shrink-0">Claim <Icon name="chevron_right" size={16} /></span>
              </button>
            );
          })}
          </div>
        </>
      )}
    </div>
  );
}
