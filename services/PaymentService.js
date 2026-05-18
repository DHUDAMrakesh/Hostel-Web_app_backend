const crypto = require('crypto');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { generateReceipt } = require('../utils/pdfGenerator');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a unique mock transaction ID */
const genTxnId = () =>
    'TXN' + Date.now() + crypto.randomBytes(4).toString('hex').toUpperCase();

// ─────────────────────────────────────────────────────────────────────────────
// PaymentService
// Designed so the mock logic can be swapped for Razorpay without touching controllers.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new Pending payment record.
 *
 * @param {string}  studentId
 * @param {object}  opts            - { invoiceId?, amount?, paymentMethod, note }
 * @returns {Payment}
 */
exports.createPayment = async (studentId, opts = {}) => {
    const { invoiceId, amount: manualAmount, paymentMethod = 'Mock', note = '' } = opts;

    let amount = manualAmount;

    // If invoiceId supplied — validate and guard against duplicate/already-paid
    if (invoiceId) {
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) throw Object.assign(new Error('Invoice not found.'), { status: 404 });
        if (invoice.status === 'Paid') throw Object.assign(new Error('This invoice is already paid.'), { status: 400 });
        if (String(invoice.studentId) !== String(studentId))
            throw Object.assign(new Error('Invoice does not belong to this student.'), { status: 403 });

        // Guard duplicate pending payment for same invoice
        const existing = await Payment.findOne({ invoiceId, paymentStatus: 'Pending' });
        if (existing) throw Object.assign(new Error('A pending payment already exists for this invoice.'), { status: 409 });

        amount = invoice.totalAmount;
    }

    if (!amount || amount <= 0)
        throw Object.assign(new Error('Amount must be a positive number.'), { status: 400 });

    const payment = new Payment({
        studentId,
        invoiceId: invoiceId || null,
        amount,
        paymentMethod,
        paymentStatus: 'Pending',
        transactionId: genTxnId(),   // pre-assigned; finalised on Success
        note
    });

    await payment.save();
    return payment;
};

/**
 * Mark a Pending payment as Success.
 * - Updates invoice → Paid (if linked)
 * - Reduces student.feeDues
 * - Sends in-app notification
 *
 * @param {string} paymentId
 * @param {string} studentId   - from JWT (security: only owner can simulate)
 */
exports.mockPaymentSuccess = async (paymentId, studentId) => {
    const payment = await Payment.findOne({ _id: paymentId, studentId });
    if (!payment) throw Object.assign(new Error('Payment not found.'), { status: 404 });
    if (payment.paymentStatus === 'Success')
        throw Object.assign(new Error('Payment is already marked as successful.'), { status: 400 });
    if (payment.paymentStatus === 'Failed')
        throw Object.assign(new Error('Failed payments cannot be re-processed. Create a new payment.'), { status: 400 });

    payment.paymentStatus = 'Success';
    await payment.save();

    // Update linked invoice
    if (payment.invoiceId) {
        await Invoice.findByIdAndUpdate(payment.invoiceId, { status: 'Paid' });
    }

    // Reduce student dues
    const student = await Student.findById(studentId);
    if (student) {
        student.feeDues = Math.max(0, (student.feeDues || 0) - payment.amount);
        await student.save();
    }

    // In-app notification — only if student has a linked User account
    try {
        if (student && student.userId) {
            await Notification.create({
                userId: student.userId,
                type: 'payment',
                title: 'Payment Successful',
                message: `Rs. ${payment.amount} payment confirmed. Txn: ${payment.transactionId}`,
                link: '/student/fees',
            });
        }
    } catch (_) { /* notifications are non-critical */ }

    return payment;
};

/**
 * Mark a Pending payment as Failed.
 *
 * @param {string} paymentId
 * @param {string} studentId
 */
exports.mockPaymentFailure = async (paymentId, studentId) => {
    const payment = await Payment.findOne({ _id: paymentId, studentId });
    if (!payment) throw Object.assign(new Error('Payment not found.'), { status: 404 });
    if (payment.paymentStatus === 'Success')
        throw Object.assign(new Error('Successful payments cannot be marked as failed.'), { status: 400 });
    if (payment.paymentStatus === 'Failed')
        throw Object.assign(new Error('Payment is already marked as failed.'), { status: 400 });

    payment.paymentStatus = 'Failed';
    await payment.save();
    return payment;
};

/**
 * Fetch payment history for a student, newest first.
 *
 * @param {string} studentId
 */
exports.getPaymentHistory = async (studentId) => {
    return Payment.find({ studentId })
        .sort({ createdAt: -1 })
        .populate('invoiceId', 'totalAmount dueDate status');
};

/**
 * Stream a PDF receipt for a successful payment to `res`.
 *
 * @param {string}   paymentId
 * @param {string}   studentId
 * @param {Response} res
 */
exports.generateReceipt = async (paymentId, studentId, res) => {
    const payment = await Payment.findOne({ _id: paymentId, studentId, paymentStatus: 'Success' });
    if (!payment) throw Object.assign(new Error('Successful payment not found.'), { status: 404 });

    const student = await Student.findById(studentId);
    if (!student) throw Object.assign(new Error('Student not found.'), { status: 404 });

    generateReceipt(payment, student, res);
};
