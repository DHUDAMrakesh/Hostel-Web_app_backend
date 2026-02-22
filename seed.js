const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Bed = require('./models/Bed');
const Student = require('./models/Student');
const FoodMenu = require('./models/FoodMenu');
const Facility = require('./models/Facility');
const User = require('./models/User');

require('dotenv').config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hostel_db';

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected for Seeding'))
    .catch(err => console.log(err));

const seedData = async () => {
    try {
        await Bed.deleteMany({});
        await Student.deleteMany({});
        await FoodMenu.deleteMany({});
        await Facility.deleteMany({});
        await User.deleteMany({});

        // ─── Seed Users ───────────────────────────────────────────────
        const hash = (pwd) => bcrypt.hash(pwd, 12);

        await User.insertMany([
            {
                name: 'Super Admin',
                email: 'admin@hostel.com',
                passwordHash: await hash('Admin@123'),
                role: 'admin',
            },
            {
                name: 'Manager Raj',
                email: 'manager@hostel.com',
                passwordHash: await hash('Manager@123'),
                role: 'manager',
            },
            {
                name: 'Student Sam',
                email: 'student@hostel.com',
                passwordHash: await hash('Student@123'),
                role: 'student',
            },
        ]);
        console.log('✓ Users seeded (admin, manager, student)');

        // Seed Beds
        const beds = [];
        for (let i = 1; i <= 20; i++) {
            beds.push({
                roomNumber: `10${Math.ceil(i / 2)}`,
                bedNumber: `B${i}`,
                isOccupied: i <= 12,
                type: i <= 10 ? 'Classic' : 'Premium'
            });
        }
        await Bed.insertMany(beds);

        // Seed Students
        const students = [
            { name: 'Rakesh', roomNumber: '101', feeDues: 5000 },
            { name: 'John', roomNumber: '101', feeDues: 0 },
            { name: 'Jane', roomNumber: '102', feeDues: 2000 },
            { name: 'Doe', roomNumber: '102', feeDues: 1500 }
        ];
        await Student.insertMany(students);

        // Seed Food Menu
        const menu = [
            { day: 'Monday', breakfast: 'Idli & Sambar', lunch: 'Rice, Dal, Curd', dinner: 'Chapati & Curry' },
            { day: 'Tuesday', breakfast: 'Puri & Bhaji', lunch: 'Rice, Sambar, Fry', dinner: 'Rice & Rasam' },
            { day: 'Wednesday', breakfast: 'Upma', lunch: 'Veg Biryani', dinner: 'Dosa' },
            { day: 'Thursday', breakfast: 'Dosa', lunch: 'Rice, Dal, Curd', dinner: 'Chapati & Dal' },
            { day: 'Friday', breakfast: 'Pongal', lunch: 'Rice, Sambar, Papad', dinner: 'Fried Rice' },
            { day: 'Saturday', breakfast: 'Vada', lunch: 'Rice, Rasam, Curd', dinner: 'Noodles' },
            { day: 'Sunday', breakfast: 'Bread Omelette', lunch: 'Chicken Biryani / Paneer Butter Masala', dinner: 'Egg Rice' }
        ];
        await FoodMenu.insertMany(menu);

        // Seed Facilities
        const facilities = [
            { name: 'Wi-Fi', description: 'High-speed internet access', iconName: 'Wifi' },
            { name: 'Laundry', description: 'Washing machines available', iconName: 'Shirt' },
            { name: 'Gym', description: 'Well-equipped gym', iconName: 'Dumbbell' },
            { name: 'Library', description: 'Study area with books', iconName: 'Book' },
            { name: 'Canteen', description: 'Hygienic food court', iconName: 'Coffee' }
        ];
        await Facility.insertMany(facilities);

        console.log('✓ All data seeded successfully');
        console.log('');
        console.log('─── Login Credentials ───────────────────────────');
        console.log('Admin   : admin@hostel.com   / Admin@123');
        console.log('Manager : manager@hostel.com / Manager@123');
        console.log('Student : student@hostel.com / Student@123');
        console.log('─────────────────────────────────────────────────');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedData();
