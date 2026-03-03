const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const Notification = require('../models/Notification');
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
// Returns rooms from the actual Bed collection (managed by admin)
router.get('/rooms/available', async (req, res) => {
    try {
        const Bed = require('../models/Bed');

        // Get all beds from the DB
        const beds = await Bed.find().sort({ roomNumber: 1, bedNumber: 1 });

        // Group by roomNumber
        const roomMap = {};
        for (const bed of beds) {
            if (!roomMap[bed.roomNumber]) {
                roomMap[bed.roomNumber] = {
                    number: bed.roomNumber,
                    type: bed.type,        // Classic | Premium
                    beds: [],
                };
            }
            roomMap[bed.roomNumber].beds.push(bed);
        }

        // Derive floor from first digit(s), capacity, availability
        const rooms = Object.values(roomMap).map(r => {
            const totalBeds = r.beds.length;
            const occupiedBeds = r.beds.filter(b => b.isOccupied).length;
            const available = occupiedBeds < totalBeds;

            // Infer floor from leading digit(s) of roomNumber, fallback to 1
            const floorMatch = r.number.match(/^(\d+)/);
            const floor = floorMatch ? Math.floor(Number(floorMatch[1]) / 100) || 1 : 1;

            // Map Classic/Premium → Single/Double/Triple for display compat
            const typeLabel = totalBeds === 1 ? 'Single' : totalBeds === 2 ? 'Double' : totalBeds <= 4 ? 'Triple' : 'Dormitory';

            return {
                number: r.number,
                floor,
                type: typeLabel,
                roomType: r.type,   // Classic | Premium
                capacity: totalBeds,
                occupiedBeds,
                available,
            };
        });

        res.json(rooms);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// ─── POST /api/student/book ────────────────────────────────────────────────
// Book a room for the logged-in student. Syncs Bed occupancy with admin rooms.
router.post('/book', async (req, res) => {
    try {
        const Bed = require('../models/Bed');
        const { roomNumber, phone, guardianName, emergencyContact } = req.body;
        if (!roomNumber) return res.status(400).json({ message: 'Room number is required.' });

        // Verify the room exists in the Bed collection and has a free bed
        const freeBed = await Bed.findOne({ roomNumber, isOccupied: false });
        if (!freeBed) return res.status(409).json({ message: 'No available beds in this room. Please choose another.' });

        let student = await Student.findOne({ userId: req.user.id });
        const user = await User.findById(req.user.id);

        if (student) {
            // If changing rooms — free the old bed
            if (student.roomNumber && student.roomNumber !== roomNumber) {
                await Bed.findOneAndUpdate(
                    { roomNumber: student.roomNumber, isOccupied: true },
                    { isOccupied: false }
                );
            }
            student.roomNumber = roomNumber;
            if (phone) student.phone = phone;
            if (guardianName) student.guardianName = guardianName;
            if (emergencyContact) student.emergencyContact = emergencyContact;
            await student.save();
        } else {
            student = await Student.create({
                userId: req.user.id,
                name: user.name,
                email: user.email,
                phone: phone || '',
                guardianName: guardianName || '',
                emergencyContact: emergencyContact || '',
                roomNumber,
                feeDues: 5000,
                monthlyFee: 5000,
            });
        }

        // Mark a bed in the new room as occupied
        freeBed.isOccupied = true;
        await freeBed.save();

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
        console.log(`[Complaint] Created: ${complaint._id} by ${user.name}`);

        const admins = await User.find({ role: { $in: ['admin', 'manager'] } });
        console.log(`[Complaint] Notifying ${admins.length} admins`);
        for (const admin of admins) {
            await Notification.create({
                userId: admin._id,
                type: 'complaint',
                title: 'New Complaint Raised',
                message: `${user.name} raised a complaint: "${title}"`,
                link: '/admin/complaints'
            });
        }

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
