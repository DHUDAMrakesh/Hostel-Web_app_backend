const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// GET /api/health
// Checks server and database connectivity
router.get('/', async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState;
        // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
        const isDbConnected = dbStatus === 1;

        if (!isDbConnected) {
            return res.status(503).json({
                status: 'unhealthy',
                server: 'online',
                database: 'offline',
                dbState: dbStatus
            });
        }

        res.json({
            status: 'healthy',
            server: 'online',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;
