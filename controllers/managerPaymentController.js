const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Student = require('../models/Student');

const handleErr = (res, err) =>
    res.status(err.status || 500).json({ message: err.message || 'Internal server error.' });

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/payments/students
// Returns payment summary for all students (manager's view)
// ─────────────────────────────────────────────────────────────────────────────
exports.getStudentsPaymentStatus = async (req, res) => {
    try {
        const students = await Student.find().select('name email roomNumber feeDues monthlyFee');

        const results = await Promise.all(students.map(async (s) => {
            const latestPayment = await Payment.findOne({ studentId: s._id })
                .sort({ createdAt: -1 })
                .select('amount paymentStatus transactionId paymentMethod createdAt');

            const openInvoices = await Invoice.countDocuments({
                studentId: s._id,
                status: { $in: ['Issued', 'Overdue'] }
            });

            return {
                studentId: s._id,
                name: s.name,
                email: s.email,
                roomNumber: s.roomNumber,
                feeDues: s.feeDues,
                monthlyFee: s.monthlyFee,
                openInvoices,
                latestPayment: latestPayment || null
            };
        }));

        res.json(results);
    } catch (err) { handleErr(res, err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/manager/payments/pending
// Returns students who have at least one unpaid invoice
// ─────────────────────────────────────────────────────────────────────────────
exports.getPendingPayments = async (req, res) => {
    try {
        // Aggregate students with open invoices
        const pendingInvoices = await Invoice.find({
            status: { $in: ['Issued', 'Overdue'] }
        }).populate('studentId', 'name email roomNumber feeDues');

        // Deduplicate by student
        const map = new Map();
        for (const inv of pendingInvoices) {
            if (!inv.studentId) continue;
            const sid = String(inv.studentId._id);
            if (!map.has(sid)) {
                map.set(sid, {
                    student: inv.studentId,
                    invoices: []
                });
            }
            map.get(sid).invoices.push({
                _id: inv._id,
                totalAmount: inv.totalAmount,
                dueDate: inv.dueDate,
                status: inv.status
            });
        }

        res.json([...map.values()]);
    } catch (err) { handleErr(res, err); }
};
