const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/managerPaymentController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken, requireRole('manager', 'admin'));

// GET /api/manager/payments/students   — all students' payment status
router.get('/students', ctrl.getStudentsPaymentStatus);

// GET /api/manager/payments/pending    — students with unpaid invoices
router.get('/pending', ctrl.getPendingPayments);

module.exports = router;
