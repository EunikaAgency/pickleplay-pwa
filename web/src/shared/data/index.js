import venues from '../../../dummies/venues.json';
import courts from '../../../dummies/courts.json';
import games from '../../../dummies/games.json';
import clubs from '../../../dummies/clubs.json';
import users from '../../../dummies/users.json';
import bookings from '../../../dummies/bookings.json';
import cities from '../../../dummies/cities.json';
import coaches from '../../../dummies/coaches.json';
import groups from '../../../dummies/groups.json';
import news from '../../../dummies/news.json';
import notifications from '../../../dummies/notifications.json';
import payments from '../../../dummies/payments.json';
import pricing from '../../../dummies/pricing.json';
import reviews from '../../../dummies/reviews.json';
import messages from '../../../dummies/messages.json';

export function getVenues() { return venues; }
export function getVenue(slug) { return venues.find(v => v.slug === slug); }
export function getCourts(venueId) { return courts.filter(c => c.venueId === venueId); }

export function getGames() { return games; }
export function getGame(id) { return games.find(g => g.id === id); }
export function getGamesByVenue(venueId) { return games.filter(g => g.venueId === venueId); }

export function getClubs() { return clubs; }
export function getClub(slug) { return clubs.find(c => c.slug === slug); }

export function getUsers() { return users; }
export function getUser(id) { return users.find(u => u.id === id); }

export function getBookings() { return bookings; }
export function getBooking(id) { return bookings.find(b => b.id === id); }
export function getBookingsByUser(userId) { return bookings.filter(b => b.userId === userId); }

export function getGroups() { return groups; }
export function getGroup(id) { return groups.find(g => g.id === id); }

export function getPayments() { return payments; }
export function getPayment(id) { return payments.find(p => p.id === id); }

export function getPricingPlans() { return pricing.plans || pricing; }

export { venues, courts, games, clubs, users, bookings, cities, coaches, groups, news, notifications, payments, pricing, reviews, messages };
