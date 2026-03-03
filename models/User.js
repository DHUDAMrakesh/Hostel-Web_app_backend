const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, default: '' },
    role: {
        type: String,
        enum: ['admin', 'manager', 'student'],
        default: 'student',
    },
    resetPasswordOTP: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    is2FAEnabled: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);

