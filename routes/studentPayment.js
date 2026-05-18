const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/studentPaymentController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken, requireRole('student'));

// GET  /api/student/invoices               — pending invoices
router.get('/invoices', ctrl.getStudentInvoices);

// GET  /api/student/payments/summary       — fee overview (dashboard)
router.get('/payments/summary', ctrl.getPaymentSummary);

// POST /api/student/payments/create        — initiate payment
router.post('/payments/create', ctrl.createPayment);

// POST /api/student/payments/mock-success  — simulate success
router.post('/payments/mock-success', ctrl.mockSuccess);

// POST /api/student/payments/mock-failure  — simulate failure
router.post('/payments/mock-failure', ctrl.mockFailure);

// GET  /api/student/payments/history       — payment history
router.get('/payments/history', ctrl.getPaymentHistory);

// GET  /api/student/payments/receipt/:id   — download PDF receipt
router.get('/payments/receipt/:paymentId', ctrl.downloadReceipt);

module.exports = router;
