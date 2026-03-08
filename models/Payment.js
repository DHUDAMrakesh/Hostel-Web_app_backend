const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, default: 'Razorpay' },
    paymentStatus: { type: String, enum: ['Pending', 'Success', 'Failed'], default: 'Pending' },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

PaymentSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Payment', PaymentSchema);
