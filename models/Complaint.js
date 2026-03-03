const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentName: { type: String, required: true },
    roomNumber: { type: String, default: '—' },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
        type: String,
        enum: ['maintenance', 'food', 'cleanliness', 'security', 'noise', 'other'],
        default: 'other',
    },
    status: {
        type: String,
        enum: ['pending', 'in-review', 'resolved'],
        default: 'pending',
    },
}, { timestamps: true });

// Indexes for fast lookups
ComplaintSchema.index({ userId: 1, createdAt: -1 });
ComplaintSchema.index({ status: 1 });

module.exports = mongoose.model('Complaint', ComplaintSchema);

