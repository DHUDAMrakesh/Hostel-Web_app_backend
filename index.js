console.log('--- Server Script Starting ---');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

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


// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    const log = `${new Date().toISOString()} - ${req.method} ${req.url}\n`;
    console.log(log.trim());
    fs.appendFileSync(path.join(__dirname, 'requests.log'), log);
    next();
});

// Serve uploaded images
app.use('/uploads', express.static(uploadsDir));

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hostel_db';
mongoose.connect(MONGO_URI)
    .then(() => console.log(`MongoDB Connected → ${MONGO_URI}`))
    .catch(err => console.log('MongoDB connection error:', err));

// Import Routes
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');

// Auth routes FIRST (more specific), then student, then general API routes
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    res.send('Hostel Management API is running');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
