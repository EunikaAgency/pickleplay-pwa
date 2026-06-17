import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Segmented } from '../../shared/components/ui/Segmented';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { Button } from '../../shared/components/ui/Button';
import { Toast } from '../../shared/components/ui/Toast';
import type { Navigate } from '../../shared/lib/navigation';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import {
  getClub, listClubMembers, listClubFeed, joinClub, leaveClub, deleteClub, createClubPost, reactClubPost, unreactClubPost,
  type ApiClub, type ApiClubMember, type ApiClubPost,
} from '../../shared/lib/api';

interface ClubDetailsScreenProps {
  clubId: string;
  /** Arrived via an invite link → greet the visitor with a "you're invited" modal. */
  invited?: boolean;
  onNavigate: Navigate;
  onBack: () => void;
}

type ClubTab = 'about' | 'members' | 'feed';

/** "2h" / "3d" / "Jun 8" from an ISO string. */
function relTime(iso?: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ClubDetailsScreen({ clubId, invited, onNavigate, onBack }: ClubDetailsScreenProps) {
  const currentUser = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const [club, setClub] = useState<ApiClub | null>(null);
  const [members, setMembers] = useState<ApiClubMember[]>([]);
  const [feed, setFeed] = useState<ApiClubPost[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'notfound' | 'ready'>('loading');
  const [tab, setTab] = useState<ClubTab>('about');

  const [joinBusy, setJoinBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });
  // Opened via an invite link → show the welcome prompt (only to non-members).
  const [showInvite, setShowInvite] = useState(!!invited);

  useEffect(() => {
    let alive = true;
    getClub(clubId)
      .then(async (c) => {
        if (!alive) return;
        setClub(c);
        setStatus('ready');
        const [m, f] = await Promise.all([
          listClubMembers(clubId).catch(() => [] as ApiClubMember[]),
          listClubFeed(clubId).catch(() => [] as ApiClubPost[]),
        ]);
        if (!alive) return;
        setMembers(m);
        setFeed(f);
      })
      .catch((e) => {
        if (!alive) return;
        setStatus(e && /404|not found/i.test(String(e.message)) ? 'notfound' : 'error');
      });
    return () => { alive = false; };
  }, [clubId, reloadKey]);

  // Re-pull the feed / members when the user switches into those tabs, so posts,
  // likes, and joins from other members show up without a full screen reload.
  useEffect(() => {
    if (status !== 'ready') return;
    if (tab === 'feed') listClubFeed(clubId).then(setFeed).catch(() => {});
    else if (tab === 'members') listClubMembers(clubId).then(setMembers).catch(() => {});
  }, [tab, clubId, status]);

  const canJoin = isLoggedIn && userHasPermission(currentUser, 'player.clubs.join');
  const canPost = !!club?.isMember && userHasPermission(currentUser, 'player.clubs.post');
  const canReact = isLoggedIn && userHasPermission(currentUser, 'player.clubs.react');

  const retry = () => { setStatus('loading'); setReloadKey((k) => k + 1); };

  // Re-pull club + members + feed in place (no skeleton flash) after a mutation.
  const refresh = async () => {
    try {
      setClub(await getClub(clubId));
      const [m, f] = await Promise.all([
        listClubMembers(clubId).catch(() => [] as ApiClubMember[]),
        listClubFeed(clubId).catch(() => [] as ApiClubPost[]),
      ]);
      setMembers(m);
      setFeed(f);
    } catch {
      /* keep what's on screen */
    }
  };

  const toggleMembership = async () => {
    if (!club || joinBusy) return;
    setJoinBusy(true);
    try {
      if (club.isMember) await leaveClub(club.id);
      else await joinClub(club.id);
      await refresh();
    } catch {
      /* leave prior state */
    } finally {
      setJoinBusy(false);
    }
  };

  // Share an invite link to the club. The URL (`/clubs/<slug>`) deep-links the PWA
  // to this page, where the recipient can join. Native share sheet on mobile,
  // clipboard + toast everywhere else.
  const shareInvite = async () => {
    if (!club) return;
    setMenuOpen(false);
    const url = `${window.location.origin}/clubs/${club.slug || club.id}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: club.name, text: `Join ${club.name} on PickleBallers`, url });
      } catch {
        /* user dismissed the share sheet — no-op */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard unavailable */
    }
    setToast({ show: true, message: 'Invite link copied' });
    setTimeout(() => setToast({ show: false, message: '' }), 2000);
  };

  // Host-only: delete the club (the "host can't leave" copy points here). The
  // server enforces host-ownership + cascades members/posts; we just return home.
  const handleDelete = async () => {
    if (!club || deleting) return;
    setDeleting(true);
    try {
      await deleteClub(club.id);
      onBack();
    } catch {
      setDeleting(false);
    }
  };

  const submitPost = async () => {
    if (!club || !draft.trim() || posting) return;
    setPosting(true);
    try {
      const post = await createClubPost(club.id, draft.trim());
      setFeed((f) => [post, ...f]);
      setDraft('');
    } catch {
      /* keep the draft so the user can retry */
    } finally {
      setPosting(false);
    }
  };

  const toggleReact = async (post: ApiClubPost) => {
    if (!canReact) return;
    const liked = post.viewerReacted;
    // Optimistic toggle.
    setFeed((f) => f.map((p) => (p.id === post.id ? { ...p, viewerReacted: !liked, reactionCount: p.reactionCount + (liked ? -1 : 1) } : p)));
    try {
      if (liked) await unreactClubPost(club!.id, post.id);
      else await reactClubPost(club!.id, post.id);
    } catch {
      // Revert on failure.
      setFeed((f) => f.map((p) => (p.id === post.id ? { ...p, viewerReacted: liked, reactionCount: p.reactionCount + (liked ? 1 : -1) } : p)));
    }
  };

  if (status === 'loading') {
    return (
      <div className="scroll safe-top safe-bottom px-4">
        <LoadingSkeleton variant="block" count={1} />
        <div className="mt-3"><LoadingSkeleton variant="card" count={3} /></div>
      </div>
    );
  }
  if (status === 'notfound') {
    return <div className="scroll safe-top safe-bottom"><EmptyState icon="groups" title="Club not found" description="This club may have been removed." action={{ label: 'Back', onPress: onBack }} /></div>;
  }
  if (status === 'error' || !club) {
    return <div className="scroll safe-top safe-bottom"><ErrorState title="Couldn't load this club" message="We couldn't fetch the club page. Tap to retry." onRetry={retry} /></div>;
  }

  // Member/host states are non-actionable here — leaving (member) and deleting
  // (host) live in the ⋯ menu. The button only drives the positive Join action.
  const joinLabel = club.isHost
    ? 'You host this club'
    : club.isMember
      ? 'Joined'
      : club.joinRequestStatus === 'pending'
        ? 'Request pending'
        : 'Join club';
  const joinDisabled = club.isHost || club.isMember || joinBusy || club.joinRequestStatus === 'pending' || !canJoin;

  return (
    <div className={`scroll ${!club.isHost && !club.isMember ? 'pb-[110px]' : 'pb-[30px]'}`}>
      <div className="detail-hero h-[260px]!">
        <div
          className="img bg-[linear-gradient(135deg,#0035be_0%,#4d6dff_100%)]"
          style={club.coverImageUrl ? { backgroundImage: `url(${club.coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        />
        <div className="grad" />
        <div className="top-controls">
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <Icon name="back" size={18} />
          </button>
          <div className="flex items-center gap-2">
            <button className="icon-btn" onClick={shareInvite} aria-label="Share invite link">
              <Icon name="share" size={16} />
            </button>
            {(club.isHost || club.isMember) && (
            <div className="relative">
              <button
                className="icon-btn"
                aria-label="Club options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <Icon name="more" size={18} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-[5]" onClick={() => setMenuOpen(false)} />
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] z-[6] min-w-[168px] rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-pop)] overflow-hidden"
                  >
                    {club.isHost ? (
                      <button
                        role="menuitem"
                        type="button"
                        onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-[14px] font-semibold text-[var(--coral)] active:bg-[var(--surface-2)]"
                      >
                        <Icon name="logout" size={16} /> Delete club
                      </button>
                    ) : (
                      <button
                        role="menuitem"
                        type="button"
                        disabled={joinBusy}
                        onClick={() => { setMenuOpen(false); toggleMembership(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-[14px] font-semibold text-[var(--coral)] active:bg-[var(--surface-2)] disabled:opacity-50"
                      >
                        <Icon name="logout" size={16} /> {joinBusy ? 'Leaving…' : 'Leave club'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            )}
          </div>
        </div>
        <div className="info">
          <div className="tag-row">
            {club.visibility === 'private' && <span className="tag">Private</span>}
            <span className="tag lime">{club.memberCount} member{club.memberCount === 1 ? '' : 's'}</span>
          </div>
          <h1>{club.name}</h1>
          {club.host?.displayName && (
            <div className="mt-2.5 text-[13px] opacity-95">Hosted by {club.host.displayName}</div>
          )}
        </div>
      </div>

      <div className="detail-body">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'about', label: 'About' },
            { value: 'members', label: `Members` },
            { value: 'feed', label: 'Feed' },
          ]}
        />

        <div className="mt-4">
          {tab === 'about' && (
            <div className="about-card">
              <div className="t-eyebrow mb-1.5">About</div>
              <p>{club.description?.trim() || 'No description yet.'}</p>
            </div>
          )}

          {tab === 'members' && (
            members.length === 0 ? (
              <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">No members to show.</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {members.map((m) => (
                  <div key={m.id} className="organizer m-0!">
                    <Avatar src={m.avatarUrl} name={m.displayName ?? 'Member'} size={40} variant="blue" />
                    <div className="meta">
                      <div className="role capitalize">{m.role}</div>
                      <div className="name">{m.displayName ?? 'Member'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'feed' && (
            <>
              {canPost ? (
                <div className="flex gap-2.5 mb-4">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Share something with the club…"
                    rows={2}
                    maxLength={8000}
                    className="flex-1 px-3.5 py-2.5 rounded-[14px] bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] outline-none text-[var(--ink)] resize-none"
                  />
                  <button
                    aria-label="Post"
                    onClick={submitPost}
                    disabled={!draft.trim() || posting}
                    className="w-11 self-stretch rounded-[14px] bg-[var(--lime)] text-[var(--lime-ink)] flex items-center justify-center disabled:opacity-50"
                  >
                    <Icon name={posting ? 'spinner' : 'send'} size={18} className={posting ? 'animate-spin' : ''} />
                  </button>
                </div>
              ) : (
                !club.isMember && <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm mb-4">Join this club to post and react.</div>
              )}

              {feed.length === 0 ? (
                <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm">No posts yet — be the first to say hi.</div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {feed.map((p) => (
                    <div key={p.id} className="about-card m-0!">
                      <div className="flex items-center gap-2.5">
                        <Avatar src={p.author?.avatarUrl} name={p.author?.displayName ?? 'Player'} size={36} variant="blue" />
                        <div className="min-w-0">
                          <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{p.author?.displayName ?? 'Player'}</div>
                          <div className="t-sm">{relTime(p.createdAt)}</div>
                        </div>
                      </div>
                      <p className="mt-2.5 whitespace-pre-wrap break-words">{p.isDeleted ? <em className="text-[var(--muted)]">deleted</em> : p.body}</p>
                      <div className="mt-2.5 flex items-center gap-4 t-sm">
                        <button
                          onClick={() => toggleReact(p)}
                          disabled={!canReact}
                          aria-pressed={p.viewerReacted}
                          aria-label={p.viewerReacted ? 'Unlike this post' : 'Like this post'}
                          className={`inline-flex items-center gap-1.5 font-bold ${p.viewerReacted ? 'text-[var(--coral)]' : 'text-[var(--muted)]'} disabled:opacity-60`}
                        >
                          <Icon name={p.viewerReacted ? 'heart' : 'heart_o'} size={16} />
                          {p.reactionCount > 0 ? p.reactionCount : 'Like'}
                        </button>
                        <span className="inline-flex items-center gap-1.5 text-[var(--muted)] font-bold">
                          <Icon name="message" size={16} />
                          {p.replyCount > 0 ? p.replyCount : 0}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Join is a sticky bottom CTA (members/hosts manage via the ⋯ menu instead). */}
      {!club.isHost && !club.isMember && (
        <div className="fixed left-3 right-3 bottom-[calc(14px+env(safe-area-inset-bottom))] z-40 max-w-[480px] mx-auto">
          <Button fullWidth disabled={joinDisabled} onClick={toggleMembership}>
            <Icon name="plus" size={16} />
            {joinBusy ? 'Saving…' : joinLabel}
          </Button>
        </div>
      )}

      <Toast message={toast.message} show={toast.show} />

      {/* Invite-link welcome — shown to non-members who opened a shared club link. */}
      {showInvite && club && !club.isMember && !club.isHost && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40"
          onClick={() => setShowInvite(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-[360px] rounded-3xl bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-pop)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--lime-soft)] text-[var(--lime-ink)] flex items-center justify-center">
              <Icon name="groups" size={28} />
            </div>
            <div className="font-heading font-bold text-[20px] text-[var(--ink)] mt-3">You're invited!</div>
            <div className="text-[14px] text-[var(--muted)] mt-1.5">
              {club.host?.displayName ? `${club.host.displayName} invited you to join ` : 'You’ve been invited to join '}
              <span className="font-semibold text-[var(--ink)]">{club.name}</span>
              {club.visibility === 'private' ? ' — your request will be sent to the host.' : '.'}
            </div>
            <div className="flex flex-col gap-2 mt-5">
              <Button
                fullWidth
                disabled={joinBusy}
                onClick={async () => {
                  if (!isLoggedIn) { onNavigate('login'); return; }
                  await toggleMembership();
                  setShowInvite(false);
                }}
              >
                {joinBusy
                  ? 'Joining…'
                  : !isLoggedIn
                    ? 'Sign in to join'
                    : club.visibility === 'private'
                      ? 'Request to join'
                      : 'Join club'}
              </Button>
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="py-2 text-[14px] font-bold text-[var(--muted)]"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40"
          onClick={() => { if (!deleting) setConfirmDelete(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-[340px] rounded-3xl bg-[var(--surface)] p-5 shadow-[var(--shadow-pop)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-heading font-bold text-[17px] text-[var(--ink)]">Delete this club?</div>
            <div className="text-[13px] text-[var(--muted)] mt-1.5">
              This permanently removes the club, its members, and every post for everyone. This can’t be undone.
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 h-11 rounded-xl bg-[var(--surface-3)] text-[var(--ink)] font-heading font-semibold text-[14px] disabled:opacity-50"
              >
                Keep club
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-11 rounded-xl bg-[var(--coral)] text-white font-heading font-semibold text-[14px] flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {deleting
                  ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={15} /></span> Deleting…</>
                  : 'Delete club'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
