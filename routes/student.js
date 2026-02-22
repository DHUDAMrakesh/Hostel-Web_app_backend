const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { verifyToken, requireRole } = require('../middleware/auth');

// All routes here: verifyToken + student role only
router.use(verifyToken, requireRole('student'));

// ─── GET /api/student/me ───────────────────────────────────────────────────
// Returns the student's own profile (linked via userId)
router.get('/me', async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.user.id });
        res.json(student || null);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── GET /api/student/rooms/available ─────────────────────────────────────
// Returns rooms not yet fully occupied
// We generate rooms 101–340 (floors 1-3, 40 rooms/floor, capacity 2 each)
// and mark ones already occupied.
router.get('/rooms/available', async (req, res) => {
    try {
        // Get all occupied room numbers
        const occupied = await Student.distinct('roomNumber', { roomNumber: { $ne: '' } });
        const occupiedSet = new Set(occupied);

        // Generate a fixed set of rooms
        const rooms = [];
        const floors = [1, 2, 3];
        for (const floor of floors) {
            for (let room = 1; room <= 10; room++) {
                const num = `${floor}0${room <= 9 ? '0' + room : room}`;
                const isOccupied = occupiedSet.has(num);
                rooms.push({
                    number: num,
                    floor,
                    type: room <= 4 ? 'Single' : room <= 8 ? 'Double' : 'Triple',
                    capacity: room <= 4 ? 1 : room <= 8 ? 2 : 3,
                    available: !isOccupied,
                });
            }
        }
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/student/book ────────────────────────────────────────────────
// Book a room for the logged-in student. Creates or updates Student record.
router.post('/book', async (req, res) => {
    try {
        const { roomNumber, phone } = req.body;
        if (!roomNumber) return res.status(400).json({ message: 'Room number is required.' });

        // Check if room is already taken
        const taken = await Student.findOne({ roomNumber, userId: { $ne: req.user.id } });
        if (taken) return res.status(409).json({ message: 'This room is already occupied. Please choose another.' });

        // Check if this user already has a profile
        let student = await Student.findOne({ userId: req.user.id });

        const user = await User.findById(req.user.id);

        if (student) {
            // Update room
            student.roomNumber = roomNumber;
            if (phone) student.phone = phone;
            await student.save();
        } else {
            // Create profile linked to user
            student = await Student.create({
                userId: req.user.id,
                name: user.name,
                email: user.email,
                phone: phone || '',
                roomNumber,
                feeDues: 5000, // first month due on booking
                monthlyFee: 5000,
            });
        }

        res.json(student);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/student/pay ─────────────────────────────────────────────────
// Record a fee payment for the logged-in student
router.post('/pay', async (req, res) => {
    try {
        const { amount, method, month, note } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount.' });

        const student = await Student.findOne({ userId: req.user.id });
        if (!student) return res.status(404).json({ message: 'Student profile not found. Please book a room first.' });

        student.payments.push({ amount, method: method || 'UPI', month: month || '', note: note || '', status: 'Paid' });
        student.feeDues = Math.max(0, (student.feeDues || 0) - amount);
        await student.save();

        res.json(student);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── GET /api/student/complaints ──────────────────────────────────────────
// Get all complaints raised by this student
router.get('/complaints', async (req, res) => {
    try {
        const complaints = await Complaint.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(complaints);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/student/complaints ─────────────────────────────────────────
// Raise a new complaint
router.post('/complaints', async (req, res) => {
    try {
        const { title, description, category } = req.body;
        if (!title || !description) return res.status(400).json({ message: 'Title and description are required.' });

        const student = await Student.findOne({ userId: req.user.id });
        const user = await User.findById(req.user.id);

        const complaint = await Complaint.create({
            userId: req.user.id,
            studentName: user.name,
            roomNumber: student?.roomNumber || '—',
            title,
            description,
            category: category || 'other',
        });

        res.status(201).json(complaint);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── PATCH /api/student/profile ───────────────────────────────────────────
// Update name and phone for the logged-in student
router.patch('/profile', async (req, res) => {
    try {
        const { name, phone } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        if (name) user.name = name.trim();
        await user.save();

        let student = await Student.findOne({ userId: req.user.id });
        if (student) {
            if (name) student.name = name.trim();
            if (phone !== undefined) student.phone = phone;
            await student.save();
        }

        res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role }, student });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── PATCH /api/student/password ──────────────────────────────────────────
// Change password: verify current password, set new one
const bcrypt = require('bcryptjs');
router.patch('/password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both current and new password are required.' });
        if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters.' });

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const match = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!match) return res.status(401).json({ message: 'Current password is incorrect.' });

        user.passwordHash = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: 'Password changed successfully.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
