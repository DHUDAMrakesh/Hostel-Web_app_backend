const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const { verifyToken, requireRole } = require('../middleware/auth');
const { sendCredentialsEmail, sendOtpEmail } = require('../utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'hostel_super_secret_key_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

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

        if (user.is2FAEnabled) {
            // Generate OTP for login
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            user.resetPasswordOTP = otp;
            user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
            await user.save();

            await sendOtpEmail(user.email, user.name, otp);

            return res.json({ mfaRequired: true, email: user.email });
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

// ─── POST /api/auth/verify-2fa ──────────────────────────────────────────────
router.post('/verify-2fa', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required.' });

        const user = await User.findOne({
            email,
            resetPasswordOTP: otp,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired OTP.' });
        }

        // Clear OTP
        user.resetPasswordOTP = null;
        user.resetPasswordExpires = null;
        await user.save();

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
    const { _id, name, email, role, is2FAEnabled, createdAt } = req.user;
    res.json({ id: _id, name, email, role, is2FAEnabled, createdAt });
});

// ─── GET /api/auth/users ───────────────────────────────────────────────────
// Admin only: list all user accounts
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

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────
// Generate OTP and send via email
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required.' });

        const user = await User.findOne({ email });
        if (!user) {
            // Return 200 even if user not found for security (don't leak registered emails)
            // But for a hostel app, we might want to be more helpful. Let's stick to 200.
            return res.json({ message: 'If an account exists with this email, an OTP has been sent.' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        user.resetPasswordOTP = otp;
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        await sendOtpEmail(user.email, user.name, otp);

        res.json({ message: 'OTP sent to your email.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/auth/verify-otp ──────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required.' });

        const user = await User.findOne({
            email,
            resetPasswordOTP: otp,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired OTP.' });
        }

        res.json({ message: 'OTP verified.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/auth/reset-password ──────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: 'Email, OTP and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters.' });
        }

        const user = await User.findOne({
            email,
            resetPasswordOTP: otp,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired OTP.' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        user.passwordHash = passwordHash;
        user.resetPasswordOTP = null;
        user.resetPasswordExpires = null;
        await user.save();

        res.json({ message: 'Password reset successful. You can now log in.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/auth/2fa/request-setup ──────────────────────────────────────
router.post('/2fa/request-setup', verifyToken, async (req, res) => {
    console.log('2FA Setup Request from:', req.user?.email);
    try {
        const user = req.user;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        user.resetPasswordOTP = otp;
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
        await user.save();
        console.log('OTP saved for setup. Attempting to send email...');

        await sendOtpEmail(user.email, user.name, otp);
        console.log('2FA Setup OTP sent successfully.');
        res.json({ message: 'Verification code sent to your email.' });
    } catch (err) {
        console.error('2FA Setup Request Error:', err);
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/auth/2fa/confirm-setup ──────────────────────────────────────
router.post('/2fa/confirm-setup', verifyToken, async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp) return res.status(400).json({ message: 'OTP is required.' });

        const user = req.user;
        if (user.resetPasswordOTP !== otp || user.resetPasswordExpires < Date.now()) {
            return res.status(400).json({ message: 'Invalid or expired code.' });
        }

        user.is2FAEnabled = true;
        user.resetPasswordOTP = null;
        user.resetPasswordExpires = null;
        await user.save();

        res.json({ message: '2FA has been enabled successfully.', is2FAEnabled: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── PATCH /api/auth/2fa/toggle ────────────────────────────────────────────
router.patch('/2fa/toggle', verifyToken, async (req, res) => {
    try {
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') return res.status(400).json({ message: 'enabled (boolean) is required.' });

        // If trying to enable, we should probably use the confirm-setup route instead.
        // But for backward compatibility or simple disabling:
        if (enabled) {
            return res.status(400).json({ message: 'Please use the setup verification flow to enable 2FA.' });
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { is2FAEnabled: false },
            { new: true }
        ).select('-passwordHash');

        res.json({ message: '2FA disabled', is2FAEnabled: user.is2FAEnabled });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
