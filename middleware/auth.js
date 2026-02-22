const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'hostel_super_secret_key_change_in_production';

/**
 * Middleware: Verify JWT token from Authorization header.
 * Attaches req.user = { id, name, email, role } on success.
 */
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided. Access denied.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        // Fetch fresh user from DB to ensure account still exists / role hasn't changed
        const user = await User.findById(decoded.id).select('-passwordHash');
        if (!user) {
            return res.status(401).json({ message: 'User no longer exists.' });
        }

        req.user = user;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired. Please log in again.' });
        }
        return res.status(401).json({ message: 'Invalid token.' });
    }
};

/**
 * Middleware factory: Require one of the given roles.
 * Must be used AFTER verifyToken.
 * Usage: requireRole('admin', 'manager')
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated.' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Access denied. Requires one of: [${roles.join(', ')}]. Your role: ${req.user.role}.`,
            });
        }
        next();
    };
};

module.exports = { verifyToken, requireRole };
