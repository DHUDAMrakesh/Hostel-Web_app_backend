const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
        type: String,
        enum: ['announcement', 'notice', 'alert'],
        default: 'announcement',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
});

AnnouncementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);
