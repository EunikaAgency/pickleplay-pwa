import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import {
  checkout, createPayment, getPayment, listPayments, updatePayment, verifyPayment,
  listMyReceipts, getReceipt, updateReceipt, listVenueReceipts, issueReceipt,
  generateSettlement, listSettlements, updateSettlement,
  listOwnerSettlements, getOwnerBalance, listOwnerFinance,
  listPayoutMethods, createPayoutMethod, deletePayoutMethod,
  listPendingRefunds, settleRefund,
} from './payments.controller.js';

const paymentsRoutes = new Hono();

paymentsRoutes.use('/*', requireAuth);

// Static segments MUST come before :id matchers.

// Receipts
paymentsRoutes.get('/receipts/mine', listMyReceipts);
paymentsRoutes.post('/receipts', issueReceipt);
paymentsRoutes.get('/receipts/:id', getReceipt);
paymentsRoutes.patch('/receipts/:id', updateReceipt);

// Owner finance — BIR receipts + VAT roll-up across the owner's venues
paymentsRoutes.get('/owner/finance', listOwnerFinance);

// Owner settlements + payout methods
paymentsRoutes.get('/owner/settlements/balance', getOwnerBalance);
paymentsRoutes.get('/owner/settlements', listOwnerSettlements);
paymentsRoutes.get('/owner/payout-methods', listPayoutMethods);
paymentsRoutes.post('/owner/payout-methods', createPayoutMethod);
paymentsRoutes.delete('/owner/payout-methods/:id', deletePayoutMethod);

// Admin settlements
paymentsRoutes.post('/admin/settlements/generate', generateSettlement);
paymentsRoutes.get('/admin/settlements', listSettlements);
paymentsRoutes.patch('/admin/settlements/:id', updateSettlement);

// Venue-scoped receipts
paymentsRoutes.get('/venues/:id/receipts', listVenueReceipts);

// Refund queue — outstanding money owed back (static segment before :id).
paymentsRoutes.get('/refunds/pending', listPendingRefunds);

// Payments (with :id matchers last)
paymentsRoutes.get('/', listPayments);
paymentsRoutes.post('/', createPayment);
paymentsRoutes.post('/checkout', checkout);
paymentsRoutes.get('/:id', getPayment);
paymentsRoutes.patch('/:id', updatePayment);
paymentsRoutes.post('/:id/verify', verifyPayment);
paymentsRoutes.post('/:id/refund', settleRefund);

export default paymentsRoutes;
