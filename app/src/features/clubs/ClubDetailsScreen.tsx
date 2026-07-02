import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { Segmented } from '../../shared/components/ui/Segmented';
import { GameShareCard } from '../../shared/components/ui/GameShareCard';
import { ClubChatPanel } from './ClubChatPanel';
import { LoadingSkeleton } from '../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../shared/components/ui/ErrorState';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { Button } from '../../shared/components/ui/Button';
import { Toast } from '../../shared/components/ui/Toast';
import { BottomSheet } from '../../shared/components/ui/BottomSheet';
import type { Navigate } from '../../shared/lib/navigation';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import {
  getClub, listClubMembers, listClubFeed, joinClub, leaveClub, deleteClub, createClubPost, reactClubPost, unreactClubPost,
  deleteClubPost, removeClubMember, listClubRequests, approveClubRequest, denyClubRequest, uploadClubMedia,
  listClubStaff, addClubStaff, removeClubStaff, searchOwnerStaff,
  apiUrl, apiImageUrl, getAccessToken,
  type ApiClub, type ApiClubMember, type ApiClubPost, type ApiClubRequest, type ClubAttachment,
  type ApiClubStaff,
} from '../../shared/lib/api';

/** A top-level feed post (the post-actions / edit / delete target). */
type PostRef = { post: ApiClubPost };

interface ClubDetailsScreenProps {
  clubId: string;
  /** Arrived via an invite link → greet the visitor with a "you're invited" modal. */
  invited?: boolean;
  onNavigate: Navigate;
  onBack: () => void;
}

type ClubTab = 'about' | 'feed' | 'chat' | 'staff';

// Remember the active tab per club so returning from a pushed screen (e.g. a
// single post) lands back on Feed instead of resetting to About on remount.
const clubTabMemory: Record<string, ClubTab> = {};

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
  const [staff, setStaff] = useState<ApiClubStaff[]>([]);
  const [feed, setFeed] = useState<ApiClubPost[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'notfound' | 'ready'>('loading');
  const [tab, setTab] = useState<ClubTab>(() => clubTabMemory[clubId] ?? 'about');
  const changeTab = (t: ClubTab) => { clubTabMemory[clubId] = t; setTab(t); };

  // Staff search state
  const [staffQuery, setStaffQuery] = useState('');
  const [staffResults, setStaffResults] = useState<{ id: string; displayName: string; avatarUrl?: string | null }[]>([]);
  const [staffSearching, setStaffSearching] = useState(false);
  const [addingStaffId, setAddingStaffId] = useState<string | null>(null);
  const staffSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [joinBusy, setJoinBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  // Photos/GIFs attached to the post being composed (uploaded on pick).
  const [draftAttachments, setDraftAttachments] = useState<ClubAttachment[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Full-screen image viewer (tap a post photo to open).
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });
  // Opened via an invite link → show the welcome prompt (only to non-members).
  const [showInvite, setShowInvite] = useState(!!invited);

  // Host moderation: pending join requests (private clubs), member removal,
  // and per-post edit/delete. All host/author actions are also enforced server-side.
  const [requests, setRequests] = useState<ApiClubRequest[]>([]);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [requestBusy, setRequestBusy] = useState<Record<string, boolean>>({});
  const [removeTarget, setRemoveTarget] = useState<ApiClubMember | null>(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [postActions, setPostActions] = useState<PostRef | null>(null);
  const [deletePostTarget, setDeletePostTarget] = useState<PostRef | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2000);
  };

  useEffect(() => {
    let alive = true;
    getClub(clubId)
      .then(async (c) => {
        if (!alive) return;
        setClub(c);
        setStatus('ready');
        const [m, f, r, s] = await Promise.all([
          listClubMembers(clubId).catch(() => [] as ApiClubMember[]),
          listClubFeed(clubId).catch(() => [] as ApiClubPost[]),
          c.isHost && c.visibility === 'private' ? listClubRequests(clubId).catch(() => [] as ApiClubRequest[]) : Promise.resolve([] as ApiClubRequest[]),
          c.isHost ? listClubStaff(clubId).catch(() => [] as ApiClubStaff[]) : Promise.resolve([] as ApiClubStaff[]),
        ]);
        if (!alive) return;
        setMembers(m);
        setFeed(f);
        setRequests(r);
        setStaff(s);
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
    else if (tab === 'about') listClubMembers(clubId).then(setMembers).catch(() => {});
  }, [tab, clubId, status]);

  // Live feed: subscribe to the club's realtime stream while the screen is open.
  // The server emits post.created/updated/deleted, reaction.changed and
  // member.joined; we coalesce them into a debounced refetch (the server is the
  // source of truth), so posts, likes, and new members from other people show up
  // without a reload. Optimistic local updates already covered the actor's own
  // actions; the refetch just reconciles to server truth.
  useEffect(() => {
    if (status !== 'ready') return;
    const token = getAccessToken();
    if (!token) return; // live updates need auth; guests view a static snapshot
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const es = new EventSource(apiUrl(`/api/v1/clubs/${clubId}/stream?token=${encodeURIComponent(token)}`));
    const reloadFeed = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (closed) return;
        listClubFeed(clubId).then((f) => { if (!closed) setFeed(f); }).catch(() => {});
      }, 350);
    };
    for (const ev of ['post.created', 'post.updated', 'post.deleted', 'reaction.changed']) es.addEventListener(ev, reloadFeed);
    es.addEventListener('member.joined', (e) => {
      try { const d = JSON.parse((e as MessageEvent).data); if (d?.memberCount != null) setClub((c) => (c ? { ...c, memberCount: d.memberCount } : c)); } catch { /* ignore */ }
      listClubMembers(clubId).then((m) => { if (!closed) setMembers(m); }).catch(() => {});
    });
    return () => { closed = true; if (timer) clearTimeout(timer); es.close(); };
  }, [clubId, status]);

  const canJoin = isLoggedIn && userHasPermission(currentUser, 'player.clubs.join');
  const canPost = !!club?.isMember && userHasPermission(currentUser, 'player.clubs.post');
  const canReact = isLoggedIn && userHasPermission(currentUser, 'player.clubs.react');
  // Member group chat (separate from the feed). Members + the host; the screen
  // itself is permission-gated, so only show the entry to permission holders.
  const canChat = !!club?.isMember && userHasPermission(currentUser, 'player.clubs.chat');

  const retry = () => { setStatus('loading'); setReloadKey((k) => k + 1); };

  // Re-pull club + members + feed in place (no skeleton flash) after a mutation.
  const refresh = async () => {
    try {
      const c = await getClub(clubId);
      setClub(c);
      const [m, f, r] = await Promise.all([
        listClubMembers(clubId).catch(() => [] as ApiClubMember[]),
        listClubFeed(clubId).catch(() => [] as ApiClubPost[]),
        c.isHost && c.visibility === 'private' ? listClubRequests(clubId).catch(() => [] as ApiClubRequest[]) : Promise.resolve([] as ApiClubRequest[]),
      ]);
      setMembers(m);
      setFeed(f);
      setRequests(r);
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

  // ── Staff management (host-only) ──
  const onStaffSearch = (q: string) => {
    setStaffQuery(q);
    if (staffSearchTimer.current) clearTimeout(staffSearchTimer.current);
    if (!q.trim() || !currentUser) { setStaffResults([]); setStaffSearching(false); return; }
    setStaffSearching(true);
    staffSearchTimer.current = setTimeout(async () => {
      try {
        const hits = await searchOwnerStaff(currentUser.id, q.trim());
        const existingIds = new Set(staff.map((s) => s.userId));
        setStaffResults(hits.filter((h: any) => !existingIds.has(h.id)));
      } catch { setStaffResults([]); }
      finally { setStaffSearching(false); }
    }, 350);
  };

  const onStaffFocus = () => {
    if (!staffQuery.trim() && staffResults.length === 0 && !staffSearching && currentUser) {
      setStaffSearching(true);
      searchOwnerStaff(currentUser.id).then((hits: any) => {
        const existingIds = new Set(staff.map((s) => s.userId));
        setStaffResults(hits.filter((h: any) => !existingIds.has(h.id)));
      }).catch(() => setStaffResults([]))
        .finally(() => setStaffSearching(false));
    }
  };

  const onAddStaff = async (userId: string) => {
    if (!club || addingStaffId) return;
    setAddingStaffId(userId);
    try {
      const created = await addClubStaff(club.id, userId);
      setStaff((s) => [...s, created]);
      setStaffQuery('');
      setStaffResults([]);
    } catch { /* ignore */ }
    finally { setAddingStaffId(null); }
  };

  const onRemoveStaff = async (staffId: string) => {
    try {
      await removeClubStaff(staffId);
      setStaff((s) => s.filter((m) => m.id !== staffId));
    } catch { /* ignore */ }
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
    if (!club || posting) return;
    const body = draft.trim();
    if (!body && draftAttachments.length === 0) return; // need text or a photo
    setPosting(true);
    try {
      const post = await createClubPost(club.id, body, undefined, draftAttachments.length ? draftAttachments : undefined);
      setFeed((f) => [post, ...f]);
      setDraft('');
      setDraftAttachments([]);
    } catch {
      /* keep the draft so the user can retry */
    } finally {
      setPosting(false);
    }
  };

  // Upload a picked photo/GIF and stage it on the post being composed.
  const pickPhoto = async (file: File | null | undefined) => {
    if (!club || !file) return;
    if (draftAttachments.length >= 10) { showToast('Up to 10 photos per post'); return; }
    setUploadingPhoto(true);
    try {
      const url = await uploadClubMedia(club.id, file);
      if (url) setDraftAttachments((a) => [...a, { type: file.type === 'image/gif' ? 'gif' : 'image', url }]);
      else showToast("Couldn't upload photo");
    } catch {
      showToast("Couldn't upload photo");
    } finally {
      setUploadingPhoto(false);
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

  // Host: approve/deny a pending join request. Approve creates the membership
  // server-side (+ bumps memberCount + notifies), so re-pull on approve.
  const decideRequest = async (req: ApiClubRequest, action: 'approve' | 'deny') => {
    if (!club || requestBusy[req.id]) return;
    setRequestBusy((m) => ({ ...m, [req.id]: true }));
    try {
      if (action === 'approve') await approveClubRequest(club.id, req.id);
      else await denyClubRequest(club.id, req.id);
      setRequests((rs) => rs.filter((r) => r.id !== req.id));
      if (action === 'approve') await refresh();
    } catch {
      showToast(action === 'approve' ? "Couldn't approve" : "Couldn't deny");
    } finally {
      setRequestBusy((m) => { const n = { ...m }; delete n[req.id]; return n; });
    }
  };

  // Host: remove a member (server blocks removing the host).
  const confirmRemoveMember = async () => {
    if (!club || !removeTarget || removingMember) return;
    setRemovingMember(true);
    try {
      await removeClubMember(club.id, removeTarget.userId);
      setMembers((ms) => ms.filter((m) => m.userId !== removeTarget.userId));
      setClub((c) => (c ? { ...c, memberCount: Math.max(0, c.memberCount - 1) } : c));
      setRemoveTarget(null);
    } catch {
      setRemoveTarget(null);
      showToast("Couldn't remove member");
    } finally {
      setRemovingMember(false);
    }
  };

  // Author or host: soft-delete a post or comment.
  const confirmDeletePost = async () => {
    const ref = deletePostTarget;
    if (!club || !ref || deletingPost) return;
    setDeletingPost(true);
    try {
      await deleteClubPost(club.id, ref.post.id);
      setFeed((f) => f.map((p) => (p.id === ref.post.id ? { ...p, isDeleted: true, body: null } : p)));
      setDeletePostTarget(null);
    } catch {
      setDeletePostTarget(null);
      showToast("Couldn't delete");
    } finally {
      setDeletingPost(false);
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

  // A host of a private club moderates join requests; a post is editable by its
  // author and deletable by the author or the host (mirrors the server gating).
  const hostManagesRequests = club.isHost && club.visibility === 'private';
  const isMyPost = (p: ApiClubPost) => !!currentUser && p.author?.id === currentUser.id;
  const canEditPost = (p: ApiClubPost) => isMyPost(p);
  const canDeletePost = (p: ApiClubPost) => isMyPost(p) || club.isHost;
  const canActOnPost = (p: ApiClubPost) => !p.isDeleted && (canEditPost(p) || canDeletePost(p));

  // The Chat tab is members-only; guard against a stale remembered 'chat' tab if
  // membership was lost.
  const tabOptions: { value: ClubTab; label: string }[] = [
    { value: 'about', label: 'About' },
    { value: 'feed', label: 'Feed' },
    ...(canChat ? [{ value: 'chat' as ClubTab, label: 'Chat' }] : []),
    ...(club.isHost ? [{ value: 'staff' as ClubTab, label: 'Staff' }] : []),
  ];
  const activeTab: ClubTab = (tab === 'chat' && !canChat) || (tab === 'staff' && !club.isHost) ? 'about' : tab;

  return (
    <div className={`scroll ${!club.isHost && !club.isMember ? 'pb-[110px]' : 'pb-[30px]'}`}>
      <div className="detail-hero h-[260px]!">
        <div
          className="img bg-[linear-gradient(135deg,#0035be_0%,#4d6dff_100%)]"
          style={club.coverImageUrl ? { backgroundImage: `url("${apiImageUrl(club.coverImageUrl)}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
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
                      <>
                        {hostManagesRequests && (
                          <button
                            role="menuitem"
                            type="button"
                            onClick={() => { setMenuOpen(false); setRequestsOpen(true); }}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-[14px] font-semibold text-[var(--ink)] active:bg-[var(--surface-2)] border-b-[0.5px] border-[var(--hairline)]"
                          >
                            <Icon name="groups" size={16} /> Manage requests{requests.length ? ` · ${requests.length}` : ''}
                          </button>
                        )}
                        <button
                          role="menuitem"
                          type="button"
                          onClick={() => { setMenuOpen(false); onNavigate('edit-club', { id: club.id }); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-[14px] font-semibold text-[var(--ink)] active:bg-[var(--surface-2)] border-b-[0.5px] border-[var(--hairline)]"
                        >
                          <Icon name="edit" size={16} /> Edit club
                        </button>
                        <button
                          role="menuitem"
                          type="button"
                          onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-[14px] font-semibold text-[var(--coral)] active:bg-[var(--surface-2)]"
                        >
                          <Icon name="logout" size={16} /> Delete club
                        </button>
                      </>
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
          value={activeTab}
          onChange={changeTab}
          options={tabOptions}
        />

        {/* Members get a live group chat as a third tab (separate from the feed). */}
        {activeTab === 'chat' && canChat && (
          <div className="mt-3">
            <ClubChatPanel clubId={club.id} onNavigate={onNavigate} />
          </div>
        )}

        <div className="mt-4">
          {activeTab === 'about' && (
            <div className="flex flex-col gap-4">
              {/* Host of a private club: pending join requests need a decision. */}
              {hostManagesRequests && requests.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRequestsOpen(true)}
                  className="w-full flex items-center gap-3 rounded-2xl bg-[var(--lime-soft)] px-4 py-3 text-left"
                >
                  <span className="w-9 h-9 shrink-0 rounded-xl bg-[var(--lime)] text-[var(--lime-ink)] flex items-center justify-center">
                    <Icon name="groups" size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading font-bold text-[14px] text-[var(--ink)]">
                      {requests.length} {requests.length === 1 ? 'person wants' : 'people want'} to join
                    </span>
                    <span className="block t-sm">Tap to review requests</span>
                  </span>
                  <Icon name="forward" size={16} />
                </button>
              )}

              <div className="about-card">
                <div className="t-eyebrow mb-1.5">About</div>
                <p>{club.description?.trim() || 'No description yet.'}</p>
              </div>

              <div>
                <div className="t-eyebrow mb-2">
                  {club.memberCount} member{club.memberCount === 1 ? '' : 's'}
                </div>
                {members.length === 0 ? (
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
                        {club.isHost && m.role !== 'host' && (
                          <button
                            type="button"
                            onClick={() => setRemoveTarget(m)}
                            className="ml-auto shrink-0 text-[13px] font-bold text-[var(--coral)] px-2.5 py-1.5 rounded-lg active:bg-[var(--surface-2)]"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="flex flex-col gap-4">
              {/* Staff list */}
              <div>
                <div className="t-eyebrow mb-2">
                  Staff · {staff.length}
                </div>
                {staff.length > 0 ? (
                  <div className="flex flex-col gap-2 mb-3">
                    {staff.map((s) => (
                      <div key={s.id} className="organizer m-0!">
                        <Avatar src={s.avatarUrl} name={s.displayName ?? 'Staff'} size={40} variant="blue" />
                        <div className="meta">
                          <div className="role capitalize">{s.staffRole || 'moderator'}</div>
                          <div className="name">{s.displayName ?? s.email ?? 'Staff'}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveStaff(s.id)}
                          className="ml-auto shrink-0 text-[13px] font-bold text-[var(--coral)] px-2.5 py-1.5 rounded-lg active:bg-[var(--surface-2)]"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3 t-sm mb-3">No staff assigned yet. Use the search below to add someone.</div>
                )}
              </div>

              {/* Search + add */}
              <div>
                <div className="t-eyebrow mb-2">Add a staff member</div>
                <div className="relative mb-1.5">
                  <input
                    className="control"
                    value={staffQuery}
                    onChange={(e) => onStaffSearch(e.target.value)}
                    onFocus={onStaffFocus}
                    placeholder="Search your staff accounts…"
                    autoComplete="off"
                  />
                  {staffSearching && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex animate-spin text-[var(--muted)]">
                      <Icon name="spinner" size={14} />
                    </span>
                  )}
                </div>
                {staffResults.length > 0 && (
                  <div className="rounded-xl border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] overflow-hidden mb-3">
                    {staffResults.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onAddStaff(p.id)}
                        disabled={addingStaffId === p.id}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--surface-2)] text-left disabled:opacity-50"
                      >
                        <Avatar name={p.displayName} src={p.avatarUrl} size={28} />
                        <span className="font-semibold text-[14px] text-[var(--ink)] truncate flex-1">{p.displayName}</span>
                        <Icon name="add" size={16} className="text-[var(--primary)]" />
                      </button>
                    ))}
                  </div>
                )}
                {!staffSearching && staffResults.length === 0 && staffQuery.trim() && (
                  <div className="t-sm text-[var(--muted)] mb-3">No staff accounts found. Create one in Owner → Staff first.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'feed' && (
            <>
              {canPost ? (
                // One grouped composer card (textarea + attachments + a bottom
                // toolbar with Photo on the left, send on the right) — Facebook/
                // Messenger style, rather than the photo button hanging on its own row.
                <div className="mb-4 rounded-[16px] bg-[var(--surface)] border border-[var(--field-border)] focus-within:border-[var(--lime)] px-3 pt-2.5 pb-2 transition-colors">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Share something with the club…"
                    rows={2}
                    maxLength={8000}
                    className="w-full bg-transparent outline-none text-[var(--ink)] resize-none"
                  />
                  {draftAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-1.5">
                      {draftAttachments.map((a, i) => (
                        <div key={a.url} className="relative w-16 h-16 rounded-xl overflow-hidden">
                          <img src={apiImageUrl(a.url)} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            aria-label="Remove photo"
                            onClick={() => setDraftAttachments((arr) => arr.filter((_, j) => j !== i))}
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/55 text-white flex items-center justify-center"
                          >
                            <Icon name="close" size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t-[0.5px] border-[var(--hairline)] pt-2">
                    <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
                    <button
                      type="button"
                      aria-label="Add photo"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto || draftAttachments.length >= 10}
                      className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[var(--muted)] active:bg-[var(--surface-2)] disabled:opacity-50"
                    >
                      <Icon name={uploadingPhoto ? 'spinner' : 'camera'} size={20} className={uploadingPhoto ? 'animate-spin' : ''} />
                      <span className="t-sm font-bold">{uploadingPhoto ? 'Uploading…' : 'Photo'}</span>
                    </button>
                    <button
                      aria-label="Post"
                      onClick={submitPost}
                      disabled={(!draft.trim() && draftAttachments.length === 0) || posting || uploadingPhoto}
                      className="w-9 h-9 shrink-0 rounded-full bg-[var(--lime)] text-[var(--lime-ink)] flex items-center justify-center disabled:opacity-40"
                    >
                      <Icon name={posting ? 'spinner' : 'send'} size={17} className={posting ? 'animate-spin' : ''} />
                    </button>
                  </div>
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
                        {canActOnPost(p) && (
                          <button
                            type="button"
                            onClick={() => setPostActions({ post: p })}
                            aria-label="Post options"
                            className="ml-auto shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[var(--muted)] active:bg-[var(--surface-2)]"
                          >
                            <Icon name="more" size={18} />
                          </button>
                        )}
                      </div>
                      <p
                        className="mt-2.5 whitespace-pre-wrap break-words cursor-pointer"
                        role="button"
                        onClick={() => onNavigate('club-post', { id: clubId, postId: p.id })}
                      >{p.isDeleted ? <em className="text-[var(--muted)]">deleted</em> : p.body}</p>
                      {/* Rich game share cards (Facebook-style link previews). */}
                      {!p.isDeleted && p.attachments?.filter((a): a is ClubAttachment & { type: 'game_link' } => a.type === 'game_link').map((a) => (
                        <GameShareCard key={a.gameId} attachment={a} onNavigate={onNavigate} />
                      ))}

                      {/* Photo / GIF attachments (filtered to non-game_link). */}
                      {!p.isDeleted && (() => {
                        const photos = p.attachments?.filter((a) => a.type !== 'game_link') ?? [];
                        if (photos.length === 0) return null;
                        return photos.length === 1 ? (
                          <button type="button" onClick={() => setLightbox(apiImageUrl(photos[0].url))} className="block w-full mt-2.5">
                            <img src={apiImageUrl(photos[0].url)} alt="Post attachment" loading="lazy" className="w-full h-auto max-h-[75vh] object-contain rounded-xl bg-[var(--surface-2)]" />
                          </button>
                        ) : (
                          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                            {photos.map((a, i) => (
                              <button key={a.url} type="button" onClick={() => setLightbox(apiImageUrl(a.url))} className="block">
                                <img src={apiImageUrl(a.url)} alt="Post attachment" loading="lazy" className="w-full aspect-square object-cover rounded-xl" />
                              </button>
                            ))}
                          </div>
                        );
                      })()}
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
                        <button
                          onClick={() => onNavigate('club-post', { id: clubId, postId: p.id })}
                          aria-label="Open post and comments"
                          className="inline-flex items-center gap-1.5 font-bold text-[var(--muted)]"
                        >
                          <Icon name="message" size={16} />
                          {p.replyCount > 0 ? `${p.replyCount} comment${p.replyCount === 1 ? '' : 's'}` : 'Comment'}
                        </button>
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

      {/* Full-screen image viewer — tap anywhere (or ✕) to close. */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightbox(null)}
            className="absolute top-[calc(12px+env(safe-area-inset-top))] right-4 w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center"
          >
            <Icon name="close" size={18} />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      {/* Host: review pending join requests for a private club. */}
      <BottomSheet
        open={requestsOpen}
        onClose={() => setRequestsOpen(false)}
        title="Join requests"
        subtitle={requests.length ? `${requests.length} pending` : undefined}
      >
        {requests.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface-2)] px-4 py-6 t-sm text-center">No pending requests.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((req) => (
              <div key={req.id} className="flex items-start gap-2.5">
                <Avatar src={req.avatarUrl} name={req.displayName ?? 'Player'} size={40} variant="blue" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{req.displayName ?? 'Player'}</div>
                  {req.message && <p className="t-sm mt-0.5 whitespace-pre-wrap break-words">{req.message}</p>}
                  <div className="t-sm">{relTime(req.createdAt)}</div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button type="button" onClick={() => decideRequest(req, 'approve')} disabled={!!requestBusy[req.id]} className="px-3 py-1.5 rounded-lg bg-[var(--lime)] text-[var(--lime-ink)] font-bold text-[13px] disabled:opacity-50">Approve</button>
                  <button type="button" onClick={() => decideRequest(req, 'deny')} disabled={!!requestBusy[req.id]} className="px-3 py-1.5 rounded-lg bg-[var(--surface-3)] text-[var(--ink)] font-bold text-[13px] disabled:opacity-50">Deny</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>

      {/* Author/host: edit or delete a post. */}
      <BottomSheet open={!!postActions} onClose={() => setPostActions(null)} title="Post">
        {postActions && (
          <div className="flex flex-col gap-1 pb-2">
            {canEditPost(postActions.post) && (
              <button
                type="button"
                onClick={() => { const ref = postActions; setPostActions(null); onNavigate('club-post-edit', { id: clubId, postId: ref.post.id }); }}
                className="w-full flex items-center gap-2.5 px-2 py-3 text-left text-[15px] font-semibold text-[var(--ink)] active:bg-[var(--surface-2)] rounded-xl"
              >
                <Icon name="edit" size={18} /> Edit post
              </button>
            )}
            <button
              type="button"
              onClick={() => { const ref = postActions; setPostActions(null); setDeletePostTarget(ref); }}
              className="w-full flex items-center gap-2.5 px-2 py-3 text-left text-[15px] font-semibold text-[var(--coral)] active:bg-[var(--surface-2)] rounded-xl"
            >
              <Icon name="close" size={18} /> Delete post
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Host: confirm removing a member. */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40" onClick={() => { if (!removingMember) setRemoveTarget(null); }}>
          <div role="dialog" aria-modal="true" className="w-full max-w-[340px] rounded-3xl bg-[var(--surface)] p-5 shadow-[var(--shadow-pop)]" onClick={(e) => e.stopPropagation()}>
            <div className="font-heading font-bold text-[17px] text-[var(--ink)]">Remove this member?</div>
            <div className="text-[13px] text-[var(--muted)] mt-1.5">
              {removeTarget.displayName ?? 'This member'} will be removed from {club.name}. They can ask to join again.
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setRemoveTarget(null)} disabled={removingMember} className="flex-1 h-11 rounded-xl bg-[var(--surface-3)] text-[var(--ink)] font-heading font-semibold text-[14px] disabled:opacity-50">Cancel</button>
              <button type="button" onClick={confirmRemoveMember} disabled={removingMember} className="flex-1 h-11 rounded-xl bg-[var(--coral)] text-white font-heading font-semibold text-[14px] flex items-center justify-center gap-1 disabled:opacity-50">
                {removingMember ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={15} /></span> Removing…</> : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Author/host: confirm deleting a post or comment. */}
      {deletePostTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40" onClick={() => { if (!deletingPost) setDeletePostTarget(null); }}>
          <div role="dialog" aria-modal="true" className="w-full max-w-[340px] rounded-3xl bg-[var(--surface)] p-5 shadow-[var(--shadow-pop)]" onClick={(e) => e.stopPropagation()}>
            <div className="font-heading font-bold text-[17px] text-[var(--ink)]">Delete this post?</div>
            <div className="text-[13px] text-[var(--muted)] mt-1.5">This removes it for everyone. This can’t be undone.</div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setDeletePostTarget(null)} disabled={deletingPost} className="flex-1 h-11 rounded-xl bg-[var(--surface-3)] text-[var(--ink)] font-heading font-semibold text-[14px] disabled:opacity-50">Cancel</button>
              <button type="button" onClick={confirmDeletePost} disabled={deletingPost} className="flex-1 h-11 rounded-xl bg-[var(--coral)] text-white font-heading font-semibold text-[14px] flex items-center justify-center gap-1 disabled:opacity-50">
                {deletingPost ? <><span className="inline-flex animate-spin"><Icon name="spinner" size={15} /></span> Deleting…</> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

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
