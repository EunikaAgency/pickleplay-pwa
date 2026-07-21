import { Hono } from 'hono';
import { optionalAuth, requireAuth } from '../../shared/middleware/auth.js';
import {
  createGame, getGame, joinGame, leaveGame, requestLeave, approveLeave, approveJoin, rejectJoin, cancelJoinRequest, toggleGameInterest, kickPlayer, listGames, updateGame, deleteGame,
  inviteToGame, declineInvite,
  listGameMessages, sendGameMessage,
} from './games.controller.js';

const gamesRoutes = new Hono();

// Browse + detail are public (guests can window-shop); writes require auth.
gamesRoutes.get('/', optionalAuth, listGames);
gamesRoutes.post('/', requireAuth, createGame);
gamesRoutes.get('/:id', optionalAuth, getGame);
gamesRoutes.patch('/:id', requireAuth, updateGame);
gamesRoutes.delete('/:id', requireAuth, deleteGame);
gamesRoutes.post('/:id/join', requireAuth, joinGame);
gamesRoutes.post('/:id/leave', requireAuth, leaveGame);
gamesRoutes.post('/:id/interest', requireAuth, toggleGameInterest);  // Open Play "I'm Interested" toggle
gamesRoutes.post('/:id/request-leave', requireAuth, requestLeave);  // full+lobby-locked → ask host
gamesRoutes.post('/:id/approve-leave', requireAuth, approveLeave);  // host approves leave request
// Join approval. There's deliberately no `request-join`: POST /join IS the request
// on an approval-gated lobby (it branches server-side), so one door in — no client
// can sidestep the gate by picking the other endpoint.
gamesRoutes.post('/:id/approve-join', requireAuth, approveJoin);  // host admits a pending player
gamesRoutes.post('/:id/reject-join', requireAuth, rejectJoin);    // host declines a pending player
gamesRoutes.delete('/:id/join', requireAuth, cancelJoinRequest); // pending player withdraws their own request
gamesRoutes.post('/:id/kick', requireAuth, kickPlayer);  // host removes a player
gamesRoutes.post('/:id/invite', requireAuth, inviteToGame);    // participants invite players
gamesRoutes.delete('/:id/invite', requireAuth, declineInvite); // decline an invite
gamesRoutes.get('/:id/messages', requireAuth, listGameMessages);   // game group chat (roster)
gamesRoutes.post('/:id/messages', requireAuth, sendGameMessage);   // post to game chat (player.games.chat)

export default gamesRoutes;
