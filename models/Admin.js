const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
        type: String,
        enum: ['admin'],
        default: 'admin',
    },
    createdAt: { type: Date, default: Date.now },
});

// Stored in the "admins" collection
module.exports = mongoose.model('Admin', AdminSchema);
