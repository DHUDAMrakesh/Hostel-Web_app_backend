const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const Bed = require('../models/Bed');
const Student = require('../models/Student');
const FoodMenu = require('../models/FoodMenu');
const Facility = require('../models/Facility');
const { verifyToken, requireRole } = require('../middleware/auth');

// ─── Multer setup ───
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── Stats (all authenticated roles) ───
router.get('/stats', verifyToken, async (req, res) => {
    try {
        const totalBeds = await Bed.countDocuments();
        const occupiedBeds = await Bed.countDocuments({ isOccupied: true });
        const availableBeds = totalBeds - occupiedBeds;
        const students = await Student.find();
        const feeDues = students.reduce((acc, s) => acc + s.feeDues, 0);
        res.json({ totalBeds, occupiedBeds, availableBeds, feeDues });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── Food Menu ───

// Upload image → admin + manager only
router.post('/menu/upload', verifyToken, requireRole('admin', 'manager'), upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    res.json({ url: `/uploads/${req.file.filename}` });
});

// GET all days — all authenticated roles
router.get('/menu', verifyToken, async (req, res) => {
    try {
        const menu = await FoodMenu.find().sort({ day: 1 });
        res.json(menu);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST create day — admin + manager
router.post('/menu', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { day, breakfast, breakfastImg, lunch, lunchImg, dinner, dinnerImg } = req.body;
        const entry = new FoodMenu({ day, breakfast, breakfastImg, lunch, lunchImg, dinner, dinnerImg });
        const saved = await entry.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PUT update day — admin + manager
router.put('/menu/:id', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { day, breakfast, breakfastImg, lunch, lunchImg, dinner, dinnerImg } = req.body;
        const updated = await FoodMenu.findByIdAndUpdate(
            req.params.id,
            { day, breakfast, breakfastImg, lunch, lunchImg, dinner, dinnerImg },
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ message: 'Day not found' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE day — admin + manager
router.delete('/menu/:id', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const deleted = await FoodMenu.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Day not found' });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── Facilities ───
// GET — all authenticated roles
router.get('/facilities', verifyToken, async (req, res) => {
    try {
        const facilities = await Facility.find();
        res.json(facilities);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST/PUT/DELETE facilities — admin + manager
router.post('/facilities', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const facility = new Facility(req.body);
        const saved = await facility.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put('/facilities/:id', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const updated = await Facility.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updated) return res.status(404).json({ message: 'Facility not found' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.delete('/facilities/:id', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const deleted = await Facility.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Facility not found' });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── Students ───

// GET all students — admin + manager
router.get('/students', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const students = await Student.find().sort({ name: 1 });
        res.json(students);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST create student — admin + manager
router.post('/students', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        if (!name || !email) {
            return res.status(400).json({ message: 'Name and email are required.' });
        }

        const User = require('../models/User');
        const bcrypt = require('bcryptjs');
        const { sendCredentialsEmail } = require('../utils/mailer');

        // Check if a login account already exists
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({ message: 'A user account with this email already exists.' });
        }

        // Auto-generate a random 10-char password
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
        const plainPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const passwordHash = await bcrypt.hash(plainPassword, 12);

        // Create User login account
        const user = await User.create({ name, email, passwordHash, role: 'student' });

        // Create Student record linked to the user
        const student = new Student({
            userId: user._id,
            name,
            email,
            phone: phone || '',
            roomNumber: '',
            feeDues: 0,
            monthlyFee: 5000,
        });
        const saved = await student.save();

        // Send credentials email (non-blocking)
        sendCredentialsEmail(email, name, email, plainPassword)
            .then(() => console.log(`[Mailer] ✓ Credentials sent to ${email}`))
            .catch(err => console.error('[Mailer] Failed to send credentials email:', err.message));

        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PUT update student — admin + manager
router.put('/students/:id', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { name, roomNumber, email, phone, feeDues, monthlyFee } = req.body;
        const updated = await Student.findByIdAndUpdate(
            req.params.id,
            { name, roomNumber, email, phone, feeDues, monthlyFee },
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ message: 'Student not found' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE student — admin only
router.delete('/students/:id', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const deleted = await Student.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Student not found' });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── Payments (sub-resource of student) — admin + manager ───

// POST add payment
router.post('/students/:id/payments', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ message: 'Student not found' });
        const { amount, month, method, status, note } = req.body;
        student.payments.push({ amount, month, method, status, note });
        if (status === 'Paid') {
            student.feeDues = Math.max(0, student.feeDues - Number(amount));
        }
        const saved = await student.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a payment record — admin + manager
router.delete('/students/:id/payments/:pid', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ message: 'Student not found' });
        student.payments = student.payments.filter(p => p._id.toString() !== req.params.pid);
        const saved = await student.save();
        res.json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
