const express = require('express');
const router = express.Router();
const FeePlan = require('../models/FeePlan');
const Invoice = require('../models/Invoice');
const Student = require('../models/Student');
const { verifyToken, requireRole } = require('../middleware/auth');

// ==========================================
// FEE PLANS (Admin Only)
// ==========================================

// Get all fee plans
router.get('/fee-plans', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const plans = await FeePlan.find().sort({ createdAt: -1 });
        res.json(plans);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create a new fee plan
router.post('/fee-plans', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const plan = new FeePlan(req.body);
        const saved = await plan.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Update a fee plan
router.put('/fee-plans/:id', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const updated = await FeePlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ message: 'Fee Plan not found' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a fee plan
router.delete('/fee-plans/:id', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const deleted = await FeePlan.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Fee Plan not found' });
        res.json({ message: 'Fee Plan deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// INVOICES (Admin acts primarily; Manager can view/pay potentially later)
// ==========================================

// Get all invoices (optionally filter by student)
router.get('/invoices', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const query = req.query.studentId ? { studentId: req.query.studentId } : {};
        const invoices = await Invoice.find(query)
            .populate('studentId', 'name roomNumber email')
            .sort({ createdAt: -1 });
        res.json(invoices);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Generate/Create an invoice
router.post('/invoices', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const { studentId, feePlanIds, note, dueDate } = req.body;

        // Fetch plans to calculate total
        const plans = await FeePlan.find({ _id: { $in: feePlanIds } });
        if (!plans.length) return res.status(400).json({ message: 'Invalid or missing Fee Plans' });

        let totalAmount = 0;
        const mappedPlans = plans.map(p => {
            totalAmount += p.amount;
            return { planId: p._id, name: p.name, amount: p.amount };
        });

        const invoice = new Invoice({
            studentId,
            feePlans: mappedPlans,
            totalAmount,
            dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
            note,
            status: 'Issued'
        });

        const saved = await invoice.save();

        // Also update student's fee dues to reflect new invoice
        await Student.findByIdAndUpdate(studentId, {
            $inc: { feeDues: totalAmount }
        });

        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Update invoice status (e.g., mark Paid, Cancelled)
router.patch('/invoices/:id/status', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Draft', 'Issued', 'Paid', 'Overdue', 'Cancelled'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

        const oldStatus = invoice.status;
        invoice.status = status;
        const updated = await invoice.save();

        // If changed to Cancelled from something else, reduce dues
        if (status === 'Cancelled' && oldStatus !== 'Cancelled') {
            await Student.findByIdAndUpdate(invoice.studentId, {
                $inc: { feeDues: -invoice.totalAmount }
            });
        }

        // Note: Paid status behavior is handled via actual `/students/:id/payments` routes
        // Usually creating a payment will automatically mark covering invoices as Paid, or vice versa
        // We'll keep this loosely coupled for now

        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete an invoice (Admin only)
router.delete('/invoices/:id', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

        // If it was Issued/Overdue/Draft (but not Paid/Cancelled maybe), we subtract from dues
        if (invoice.status !== 'Cancelled' && invoice.status !== 'Paid') {
            await Student.findByIdAndUpdate(invoice.studentId, {
                $inc: { feeDues: -invoice.totalAmount }
            });
        }

        await Invoice.findByIdAndDelete(req.params.id);
        res.json({ message: 'Invoice deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// FINANCIAL REPORTS (Admin Only)
// ==========================================
router.get('/reports', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        // Aggregate total revenue (sum of all Payment arrays across all Students)
        const students = await Student.find({}, 'payments feeDues');

        let totalCollected = 0;
        let totalOutstanding = 0;

        students.forEach(s => {
            // Only count 'Paid' status directly
            const paid = s.payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + Number(p.amount), 0);
            totalCollected += paid;
            totalOutstanding += Number(s.feeDues) || 0;
        });

        const activePlans = await FeePlan.countDocuments();
        const activeInvoices = await Invoice.countDocuments({ status: { $in: ['Issued', 'Overdue'] } });

        res.json({
            totalCollected,
            totalOutstanding,
            activePlans,
            activeInvoices
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
