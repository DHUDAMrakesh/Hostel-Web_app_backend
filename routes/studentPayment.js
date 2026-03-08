const express = require('express');
const router = express.Router();
const studentPaymentController = require('../controllers/studentPaymentController');
const { verifyToken, requireRole } = require('../middleware/auth');

// Protect all these routes for the 'student' role
router.use(verifyToken);
router.use(requireRole('student'));

// Setup endpoints as specified by the requirements
router.get('/summary', studentPaymentController.getPaymentSummary);
router.get('/history', studentPaymentController.getPaymentHistory);
router.post('/create-order', studentPaymentController.createRazorpayOrder);
router.post('/verify', studentPaymentController.verifyPayment);
router.get('/receipt/:paymentId', studentPaymentController.downloadReceipt);

module.exports = router;
