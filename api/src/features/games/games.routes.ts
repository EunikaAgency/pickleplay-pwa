import { Hono } from 'hono';
import { optionalAuth, requireAuth } from '../../shared/middleware/auth.js';
import {
  createGame, getGame, joinGame, leaveGame, kickPlayer, listGames, updateGame, deleteGame, inviteToGame,
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
gamesRoutes.post('/:id/kick', requireAuth, kickPlayer);  // host removes a player
gamesRoutes.post('/:id/invite', requireAuth, inviteToGame);  // host invites players
gamesRoutes.get('/:id/messages', requireAuth, listGameMessages);   // game group chat (roster)
gamesRoutes.post('/:id/messages', requireAuth, sendGameMessage);   // post to game chat (player.games.chat)

export default gamesRoutes;
