console.log('--- Server Script Starting ---');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// dotenv.config();
console.log('Config skipped (manual override)');

const app = express();
console.log('App created');
const PORT = 5001;
process.env.PORT = 5001;
process.env.JWT_SECRET = 'hostel_rbac_super_secret_key_2026';
process.env.JWT_EXPIRES_IN = '7d';
process.env.EMAIL_USER = 'dhudamrakesh0@gmail.com';
process.env.EMAIL_PASS = 'bycnejhbblrecwjr';
process.env.MONGO_URI = 'mongodb://localhost:27017/hostel_db';
// Twilio WhatsApp — set these in .env for production
if (!process.env.TWILIO_ACCOUNT_SID) process.env.TWILIO_ACCOUNT_SID = '';
if (!process.env.TWILIO_AUTH_TOKEN) process.env.TWILIO_AUTH_TOKEN = '';
if (!process.env.TWILIO_WHATSAPP_FROM) process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';


// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Middleware
app.use(compression()); // gzip all responses
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Rate limiting — 200 req / 15 min per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please slow down.' },
});
app.use('/api', limiter);

// Non-blocking request logging
const logStream = fs.createWriteStream(path.join(__dirname, 'requests.log'), { flags: 'a' });
app.use((req, res, next) => {
    const log = `${new Date().toISOString()} - ${req.method} ${req.url}\n`;
    process.stdout.write(log);
    logStream.write(log);  // async, non-blocking
    next();
});


// Serve uploaded images
app.use('/uploads', express.static(uploadsDir));

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hostel_db';
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log(`MongoDB Connected → ${MONGO_URI}`);
        // Start the WhatsApp reminder scheduler after DB is ready
        const { startScheduler } = require('./utils/scheduler');
        startScheduler();
    })
    .catch(err => console.log('MongoDB connection error:', err));

// Import Routes
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const notificationRoutes = require('./routes/notifications');
const announcementRoutes = require('./routes/announcements');
const financeRoutes = require('./routes/finance');
const studentPaymentRoutes = require('./routes/studentPayment');

// Auth routes FIRST (more specific), then student, then general API routes
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/student/payments', studentPaymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    res.send('Hostel Management API is running');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
