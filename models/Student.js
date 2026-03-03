const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    month: { type: String },
    method: { type: String, enum: ['Cash', 'UPI', 'Bank Transfer', 'Card'], default: 'Cash' },
    status: { type: String, enum: ['Paid', 'Pending', 'Overdue'], default: 'Paid' },
    note: { type: String, default: '' },
    paidAt: { type: Date, default: Date.now },
});

const StudentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true },
    roomNumber: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    guardianName: { type: String, default: '' },
    emergencyContact: { type: String, default: '' },
    feeDues: { type: Number, default: 0 },
    monthlyFee: { type: Number, default: 5000 },
    payments: [PaymentSchema],
    joinedDate: { type: Date, default: Date.now },
});

// Indexes for fast lookups
StudentSchema.index({ userId: 1 });
StudentSchema.index({ roomNumber: 1 });
StudentSchema.index({ email: 1 });
StudentSchema.index({ name: 'text' }); // full-text search support

module.exports = mongoose.model('Student', StudentSchema);

