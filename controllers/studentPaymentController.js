const PaymentService = require('../services/PaymentService');
const Invoice = require('../models/Invoice');
const Student = require('../models/Student');

// ─── Helper to unify error responses ─────────────────────────────────────────
const handleErr = (res, err) =>
    res.status(err.status || 500).json({ message: err.message || 'Internal server error.' });

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/student/invoices
// Returns Issued + Overdue invoices for the logged-in student
// ─────────────────────────────────────────────────────────────────────────────
exports.getStudentInvoices = async (req, res) => {
    try {
        const studentId = req.user._id;
        // Find student record via userId link
        const student = await Student.findOne({ userId: studentId });
        if (!student) return res.status(404).json({ message: 'Student profile not found.' });

        const invoices = await Invoice.find({
            studentId: student._id,
            status: { $in: ['Issued', 'Overdue', 'Pending'] }
        }).sort({ createdAt: -1 });

        res.json(invoices);
    } catch (err) { handleErr(res, err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/student/payments/create
// Body: { invoiceId?, paymentMethod, note? }
// If no invoiceId → advance payment using student.monthlyFee
// ─────────────────────────────────────────────────────────────────────────────
exports.createPayment = async (req, res) => {
    try {
        const userId = req.user._id;
        const student = await Student.findOne({ userId });
        if (!student) return res.status(404).json({ message: 'Student profile not found.' });

        const { invoiceId, paymentMethod, note, amount } = req.body;

        const payment = await PaymentService.createPayment(student._id, {
            invoiceId: invoiceId || null,
            // Advance payment: caller supplies amount, or fall back to monthlyFee
            amount: invoiceId ? undefined : (Number(amount) || student.monthlyFee),
            paymentMethod: paymentMethod || 'Mock',
            note: note || (invoiceId ? '' : (() => {
                const d = new Date();
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return `Advance – ${months[d.getMonth()]} ${d.getFullYear()}`;
            })())
        });

        res.status(201).json(payment);
    } catch (err) { handleErr(res, err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/student/payments/mock-success
// Body: { paymentId }
// ─────────────────────────────────────────────────────────────────────────────
exports.mockSuccess = async (req, res) => {
    try {
        const userId = req.user._id;
        const student = await Student.findOne({ userId });
        if (!student) return res.status(404).json({ message: 'Student profile not found.' });

        const { paymentId } = req.body;
        if (!paymentId) return res.status(400).json({ message: 'paymentId is required.' });

        const payment = await PaymentService.mockPaymentSuccess(paymentId, student._id);
        res.json({ message: 'Payment marked as successful.', payment });
    } catch (err) { handleErr(res, err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/student/payments/mock-failure
// Body: { paymentId }
// ─────────────────────────────────────────────────────────────────────────────
exports.mockFailure = async (req, res) => {
    try {
        const userId = req.user._id;
        const student = await Student.findOne({ userId });
        if (!student) return res.status(404).json({ message: 'Student profile not found.' });

        const { paymentId } = req.body;
        if (!paymentId) return res.status(400).json({ message: 'paymentId is required.' });

        const payment = await PaymentService.mockPaymentFailure(paymentId, student._id);
        res.json({ message: 'Payment marked as failed.', payment });
    } catch (err) { handleErr(res, err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/student/payments/history
// Returns all payment records for logged-in student, newest first
// ─────────────────────────────────────────────────────────────────────────────
exports.getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const student = await Student.findOne({ userId });
        if (!student) return res.status(404).json({ message: 'Student profile not found.' });

        const payments = await PaymentService.getPaymentHistory(student._id);
        res.json(payments);
    } catch (err) { handleErr(res, err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/student/payments/receipt/:paymentId
// Streams a PDF receipt for a successful payment
// ─────────────────────────────────────────────────────────────────────────────
exports.downloadReceipt = async (req, res) => {
    try {
        const userId = req.user._id;
        const student = await Student.findOne({ userId });
        if (!student) return res.status(404).json({ message: 'Student profile not found.' });

        await PaymentService.generateReceipt(req.params.paymentId, student._id, res);
    } catch (err) { handleErr(res, err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/student/payments/summary
// Returns fee overview for the logged-in student (used by dashboard)
// ─────────────────────────────────────────────────────────────────────────────
exports.getPaymentSummary = async (req, res) => {
    try {
        const userId = req.user._id;
        const student = await Student.findOne({ userId });
        if (!student) return res.status(404).json({ message: 'Student profile not found.' });

        const invoices = await Invoice.find({ studentId: student._id });
        const totalBilled = invoices.reduce((s, inv) => s + inv.totalAmount, 0);

        const payments = await PaymentService.getPaymentHistory(student._id);
        const totalPaid = payments
            .filter(p => p.paymentStatus === 'Success')
            .reduce((s, p) => s + p.amount, 0);

        res.json({
            totalFeeAmount: totalBilled || student.monthlyFee || 0,
            amountPaid: totalPaid,
            pendingAmount: student.feeDues || 0,
            monthlyFee: student.monthlyFee || 0,
            status: student.feeDues > 0 ? 'Pending' : 'Paid'
        });
    } catch (err) { handleErr(res, err); }
};
