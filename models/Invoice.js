const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    feePlans: [{
        planId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeePlan' },
        name: String,
        amount: Number
    }],
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['Draft', 'Issued', 'Paid', 'Overdue', 'Cancelled'], default: 'Draft' },
    issuedDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    note: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
