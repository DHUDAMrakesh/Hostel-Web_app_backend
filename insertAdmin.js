/**
 * insertAdmin.js
 * One-time script to seed an admin into the SEPARATE 'admins' collection.
 * Usage: node insertAdmin.js
 *
 * Requires MONGO_URI to be set (reads from .env via dotenv).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('Error: MONGO_URI is not defined in environment variables.');
    process.exit(1);
}

async function insertAdmin() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB.');

        // Check if an admin with this email already exists in the admins collection
        const ADMIN_EMAIL = 'admin04@hostel.com';
        const existingAdmin = await Admin.findOne({ email: ADMIN_EMAIL });

        if (existingAdmin) {
            console.log(`Admin with email "${ADMIN_EMAIL}" already exists in the admins collection.`);
            await mongoose.disconnect();
            process.exit(0);
        }

        // Hash the password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash('Admin@12345', saltRounds);

        // Create admin in the separate 'admins' collection
        const admin = new Admin({
            name: 'Main Admin4',
            email: 'admin04@hostel.com',
            passwordHash,
            role: 'admin',
        });

        await admin.save();
        console.log('Admin created successfully in the admins collection.');

    } catch (err) {
        console.error('Error inserting admin:', err.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

insertAdmin();
