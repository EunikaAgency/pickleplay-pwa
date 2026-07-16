# PickleFeed — Global Player Newsfeed

**Date:** July 15, 2026
**Branch:** main
**Status:** ✅ Shipped

---

## What it is

PickleFeed is a Threads/Facebook-style global newsfeed on the Social tab. Players can post text, like, comment, repost each other's posts, and share public games, open-play sessions, and clubs into the feed as tappable cards so other players can discover and join them.

The Social tab now has three sections: **PickleFeed · Clubs · Friends** — PickleFeed is the default landing.

## Features shipped

| Feature | Details |
|---|---|
| Text posts | Compose popup (Facebook-style), body up to 8000 chars |
| Like / Unlike | Optimistic toggle, idempotent per-post per-user |
| Comments | Full comment thread on the permalink page, sticky composer |
| Repost | Quote another player's post with optional caption |
| Share cards | Game, Open Play, Club — server-enriched snapshots, tappable to view/join |
| Auto-linkify | URLs in post bodies become clickable blue links |
| Share to feed | Buttons on GameDetailsScreen + ClubDetailsScreen hero |
| Author edit/delete | ⋯ menu → edit inline / delete with confirm |

## Files changed

### Backend — new `api/src/features/feed/`

| File | Role |
|---|---|
| `feed.model.ts` | `FeedPost` (recursive post+reply), `FeedPostReaction`, attachment schema (game / open_play / club) |
| `feed.controller.ts` | 8 handlers — listFeed (cursor), getPost, listReplies, createPost (enriches cards server-side), edit/delete/reaction |
| `feed.routes.ts` | `/api/v1/feed` — public read, auth-gated write (no new permission needed) |

Registered in `routes/index.ts` + `/lists` catalogue updated.

### Frontend — `app/src/features/social/`

| File | Role |
|---|---|
| `SocialScreen.tsx` | 3-tab segmented: PickleFeed · Clubs · Friends, feed default |
| `FeedPanel.tsx` | Cursor-paginated post list + "What's new?" / Create New Post trigger |
| `FeedPostCard.tsx` | Post card — avatar, author, body, like/comment/repost/share row |
| `FeedComposerSheet.tsx` | Compose popup with Game/OpenPlay/Club attachment pickers |
| `FeedPostScreen.tsx` | Permalink — post + comments + sticky composer |
| `FeedShareCard.tsx` | Rich tappable card for shared game/open-play/club |
| `RepostQuote.tsx` | Quoted original inside a repost |
| `feedTime.tsx` | `relTime()` + `linkifyBody()` (auto-detects URLs → clickable) |

Also touched:
- `shared/lib/api.ts` — `FEED_PREFIX`, `ApiFeedPost`, `FeedAttachment`, 8 client functions
- `shared/lib/navigation.ts` — `feed-post` screen + `?tab=feed` URL param
- `App.tsx` — render + tab wiring
- `games/GameDetailsScreen.tsx` — "Share to PickleFeed" button
- `clubs/ClubDetailsScreen.tsx` — "Share to PickleFeed" button
- `shared/styles/v2.css` — `.feed-composer-trigger` styles

### API Endpoints

```
GET    /api/v1/feed                         optionalAuth   listFeed (cursor)
POST   /api/v1/feed/posts                   requireAuth    createPost
GET    /api/v1/feed/posts/:postId           optionalAuth   getPost + replies
GET    /api/v1/feed/posts/:postId/replies   optionalAuth   listReplies (cursor)
POST   /api/v1/feed/posts/:postId/react     requireAuth    like (idempotent)
DELETE /api/v1/feed/posts/:postId/react     requireAuth    unlike
PATCH  /api/v1/feed/posts/:postId           requireAuth    editPost (author-only)
DELETE /api/v1/feed/posts/:postId           requireAuth    deletePost (author-only, soft-delete)
```

## Verification

- **API e2e:** `api/e2e/feed.sh` — 28/28 passing (text post, like/unlike, comment, game share card, open-play share card, club share card, repost, author-only edit/delete, bad share 404, unauth 401)
- **App typecheck:** 0 errors in feed files
- **App lint:** 0 errors in feed files (3 pre-existing in FriendsPanel)

## Screenshots

<!-- Add screenshots here -->

