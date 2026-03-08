const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { verifyToken, requireRole } = require('../middleware/auth');

// ─── GET /api/announcements ─────────────────────────────────────────────────
// All authenticated users can read announcements
router.get('/', verifyToken, async (req, res) => {
    try {
        const announcements = await Announcement.find().sort({ createdAt: -1 });
        res.json(announcements);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/announcements ────────────────────────────────────────────────
// Admin + Manager: create a new announcement and notify all students
router.post('/', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { title, message, type } = req.body;
        if (!title || !message) {
            return res.status(400).json({ message: 'Title and message are required.' });
        }

        // Persist announcement
        const announcement = await Announcement.create({
            title,
            message,
            type: type || 'announcement',
            createdBy: req.user._id,
            createdByName: req.user.name,
        });

        // Fan-out: create a Notification for every student
        const students = await User.find({ role: 'student' }).select('_id');
        const TYPE_ICONS = { announcement: '📢', notice: '📋', alert: '🚨' };
        const icon = TYPE_ICONS[type] || '📢';

        if (students.length > 0) {
            const notifs = students.map(s => ({
                userId: s._id,
                type: 'other',
                title: `${icon} ${title}`,
                message,
                link: '/student/announcements',
            }));
            await Notification.insertMany(notifs);
        }

        res.status(201).json(announcement);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ─── DELETE /api/announcements/:id ─────────────────────────────────────────
// Admin + Manager: delete an announcement
router.delete('/:id', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const deleted = await Announcement.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Announcement not found.' });
        res.json({ message: 'Announcement deleted.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
