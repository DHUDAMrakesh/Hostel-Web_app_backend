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
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // linked login account
    name: { type: String, required: true },
    roomNumber: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    feeDues: { type: Number, default: 0 },
    monthlyFee: { type: Number, default: 5000 },
    payments: [PaymentSchema],
    joinedDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Student', StudentSchema);
