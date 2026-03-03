const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const { verifyToken, requireRole } = require('../middleware/auth');
const { sendReminderToStudent, runReminderJob, getCycleInfo } = require('../utils/scheduler');

// Get all notifications for the logged-in user
router.get('/', verifyToken, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Mark a notification as read
router.patch('/:id/read', verifyToken, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { isRead: true },
            { new: true }
        );
        if (!notification) return res.status(404).json({ message: 'Notification not found' });
        res.json(notification);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Mark all notifications as read
router.patch('/read-all', verifyToken, async (req, res) => {
    try {
        await Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true });
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete a notification
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!notification) return res.status(404).json({ message: 'Notification not found' });
        res.json({ message: 'Notification deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// ─── POST /api/notifications/send-reminder/:studentId ─────────────────────
// Admin/Manager: manually trigger a WhatsApp + in-app reminder to one student
router.post('/send-reminder/:studentId', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const student = await Student.findById(req.params.studentId);
        if (!student) return res.status(404).json({ message: 'Student not found.' });
        if (!student.phone) return res.status(400).json({ message: 'Student has no phone number on record.' });

        const result = await sendReminderToStudent(student);
        res.json({ message: `Reminder sent to ${student.name}.`, result });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── GET /api/notifications/reminders-due ─────────────────────────────────
// Admin/Manager: preview which students have a cycle ending today
router.get('/reminders-due', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const students = await Student.find({ phone: { $exists: true, $ne: '' } }).lean();
        const due = students
            .map(s => ({ ...s, ...getCycleInfo(s.joinedDate) }))
            .filter(s => s.isReminderDay)
            .map(s => ({
                _id: s._id,
                name: s.name,
                phone: s.phone,
                roomNumber: s.roomNumber,
                monthlyFee: s.monthlyFee,
                feeDues: s.feeDues,
                cycleNumber: s.cycleNumber,
                daysSinceJoining: s.daysSinceJoining,
            }));
        res.json(due);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/notifications/run-reminder-job ─────────────────────────────
// Admin only: manually trigger the full daily reminder job
router.post('/run-reminder-job', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const results = await runReminderJob();
        res.json({ message: `Job complete. Sent ${results.length} reminder(s).`, results });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
