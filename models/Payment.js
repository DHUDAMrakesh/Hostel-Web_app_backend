const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
    {
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
        invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
        amount: { type: Number, required: true },
        paymentMethod: {
            type: String,
            enum: ['Mock', 'UPI', 'Card', 'NetBanking'],
            default: 'Mock'
        },
        paymentStatus: {
            type: String,
            enum: ['Pending', 'Success', 'Failed'],
            default: 'Pending'
        },
        transactionId: { type: String, default: null },
        note: { type: String, default: '' },
    },
    {
        timestamps: true   // auto-manages createdAt + updatedAt — no pre-save hook needed
    }
);

module.exports = mongoose.model('Payment', PaymentSchema);
