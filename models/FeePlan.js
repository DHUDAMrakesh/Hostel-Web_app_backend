const mongoose = require('mongoose');

const FeePlanSchema = new mongoose.Schema({
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    frequency: { type: String, enum: ['Monthly', 'Yearly', 'One-time'], default: 'Monthly' },
    description: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FeePlan', FeePlanSchema);
