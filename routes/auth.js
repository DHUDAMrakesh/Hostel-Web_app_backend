const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'hostel_super_secret_key_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

const Student = require('../models/Student');

// ─── POST /api/auth/register ───────────────────────────────────────────────
// Public. Creates a student account. Only admin can elevate roles via /users.
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email and password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters.' });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = await User.create({ name, email, passwordHash, role: 'student' });

        // Auto-create a Student record linked to this user account
        await Student.create({
            userId: user._id,
            name: user.name,
            email: user.email,
            roomNumber: '',      // empty until they book a room
            feeDues: 0,
            monthlyFee: 5000,
        });

        const token = generateToken(user);

        res.status(201).json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// ─── POST /api/auth/login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = generateToken(user);
        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── GET /api/auth/me ──────────────────────────────────────────────────────
router.get('/me', verifyToken, (req, res) => {
    const { _id, name, email, role, createdAt } = req.user;
    res.json({ id: _id, name, email, role, createdAt });
});

// ─── GET /api/auth/users ───────────────────────────────────────────────────
// Admin only: list all user accounts
const { requireRole } = require('../middleware/auth');
router.get('/users', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/auth/users ──────────────────────────────────────────────────
// Admin only: create a manager or another admin
router.post('/users', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'name, email, password and role are required.' });
        }
        if (!['admin', 'manager', 'student'].includes(role)) {
            return res.status(400).json({ message: 'Role must be admin, manager, or student.' });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = await User.create({ name, email, passwordHash, role });

        res.status(201).json({
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── DELETE /api/auth/users/:id ───────────────────────────────────────────
// Admin only: remove a user account
router.delete('/users/:id', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot delete your own account.' });
        }
        const deleted = await User.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'User not found.' });
        res.json({ message: 'User deleted.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── PATCH /api/auth/users/:id/role ───────────────────────────────────────
// Admin only: change a user's role
router.patch('/users/:id/role', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const { role } = req.body;
        if (!['admin', 'manager', 'student'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role.' });
        }
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        ).select('-passwordHash');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
