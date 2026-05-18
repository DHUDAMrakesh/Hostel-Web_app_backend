const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Student = require('../models/Student');
const FeePlan = require('../models/FeePlan');

const handleErr = (res, err) =>
    res.status(err.status || 500).json({ message: err.message || 'Internal server error.' });

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/invoices/generate
// Body: { studentId?, feePlanIds, dueDate?, note? }
// If studentId missing → generate for ALL students
// ─────────────────────────────────────────────────────────────────────────────
exports.generateInvoice = async (req, res) => {
    try {
        const { studentId, feePlanIds, dueDate, note } = req.body;

        if (!feePlanIds || !Array.isArray(feePlanIds) || feePlanIds.length === 0)
            return res.status(400).json({ message: 'feePlanIds array is required.' });

        const plans = await FeePlan.find({ _id: { $in: feePlanIds } });
        if (!plans.length) return res.status(400).json({ message: 'No valid fee plans found.' });

        let totalAmount = 0;
        const mappedPlans = plans.map(p => {
            totalAmount += p.amount;
            return { planId: p._id, name: p.name, amount: p.amount };
        });

        const defaultDueDate = dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const createForStudent = async (sid) => {
            const invoice = new Invoice({
                studentId: sid,
                feePlans: mappedPlans,
                totalAmount,
                dueDate: defaultDueDate,
                note: note || '',
                status: 'Issued'
            });
            await invoice.save();
            await Student.findByIdAndUpdate(sid, { $inc: { feeDues: totalAmount } });
            return invoice;
        };

        if (studentId) {
            const invoice = await createForStudent(studentId);
            return res.status(201).json({ invoicesCreated: 1, invoices: [invoice] });
        }

        // Bulk — all students
        const allStudents = await Student.find({}, '_id');
        const invoices = await Promise.all(allStudents.map(s => createForStudent(s._id)));
        res.status(201).json({ invoicesCreated: invoices.length, invoices });
    } catch (err) { handleErr(res, err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/payments/all
// Returns all payment records, populated with student info
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllPayments = async (req, res) => {
    try {
        const payments = await Payment.find()
            .sort({ createdAt: -1 })
            .populate('studentId', 'name email roomNumber')
            .populate('invoiceId', 'totalAmount dueDate status');
        res.json(payments);
    } catch (err) { handleErr(res, err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/payments/reports
// Returns aggregated financial report
// ─────────────────────────────────────────────────────────────────────────────
exports.getReports = async (req, res) => {
    try {
        // Total revenue from successful mock payments
        const successAgg = await Payment.aggregate([
            { $match: { paymentStatus: 'Success' } },
            { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
        ]);
        const totalRevenue = successAgg[0]?.totalRevenue || 0;

        // Total pending dues across all students
        const duesAgg = await Student.aggregate([
            { $group: { _id: null, totalPending: { $sum: '$feeDues' } } }
        ]);
        const totalPending = duesAgg[0]?.totalPending || 0;

        // Payment count by status
        const statusCounts = await Payment.aggregate([
            { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
        ]);
        const countMap = {};
        statusCounts.forEach(s => { countMap[s._id] = s.count; });

        // Revenue by payment method
        const methodRevenue = await Payment.aggregate([
            { $match: { paymentStatus: 'Success' } },
            { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } },
            { $sort: { total: -1 } }
        ]);

        // Room/hostel-wise breakdown (rooms with most collection)
        const roomRevenue = await Payment.aggregate([
            { $match: { paymentStatus: 'Success' } },
            {
                $lookup: {
                    from: 'students',
                    localField: 'studentId',
                    foreignField: '_id',
                    as: 'student'
                }
            },
            { $unwind: '$student' },
            {
                $group: {
                    _id: '$student.roomNumber',
                    totalCollected: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { totalCollected: -1 } },
            { $limit: 20 }
        ]);

        // Recent 5 successful transactions
        const recent = await Payment.find({ paymentStatus: 'Success' })
            .sort({ updatedAt: -1 })
            .limit(5)
            .populate('studentId', 'name roomNumber');

        const activeInvoices = await Invoice.countDocuments({ status: { $in: ['Issued', 'Overdue'] } });

        res.json({
            totalRevenue,
            totalPending,
            activeInvoices,
            paymentCounts: {
                success: countMap.Success || 0,
                pending: countMap.Pending || 0,
                failed: countMap.Failed || 0,
                total: (countMap.Success || 0) + (countMap.Pending || 0) + (countMap.Failed || 0)
            },
            methodRevenue,
            hostelWise: roomRevenue,
            recentTransactions: recent
        });
    } catch (err) { handleErr(res, err); }
};
