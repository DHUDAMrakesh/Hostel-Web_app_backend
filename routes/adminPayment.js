const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminPaymentController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken, requireRole('admin'));

// POST /api/admin/invoices/generate    — generate invoices for student(s)
router.post('/invoices/generate', ctrl.generateInvoice);

// GET  /api/admin/payments/all         — all payment transactions
router.get('/payments/all', ctrl.getAllPayments);

// GET  /api/admin/payments/reports     — financial reports
router.get('/payments/reports', ctrl.getReports);

module.exports = router;
