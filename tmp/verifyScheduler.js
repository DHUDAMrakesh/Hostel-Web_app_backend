/**
 * test/verifyScheduler.js
 * Manual verification for the 30-day billing cycle logic.
 */
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Invoice = require('../models/Invoice');
const { runReminderJob, getCycleInfo } = require('../utils/scheduler');

const MONGO_URI = 'mongodb://localhost:27017/hostel_db';

async function test() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Create a dummy student with joinedDate = 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const testStudent = await Student.create({
        name: 'Test Automatic Billing',
        phone: '+919876543210',
        monthlyFee: 5500,
        feeDues: 0,
        joinedDate: thirtyDaysAgo
    });

    console.log(`Created test student "${testStudent.name}" with joinedDate 30 days ago.`);

    // 2. Verify cycle info
    const info = getCycleInfo(testStudent.joinedDate);
    console.log('Cycle Info:', info);

    if (info.isReminderDay) {
        console.log('Test PASSED: Today IS the reminder day.');
    } else {
        console.log('Test FAILED: Today IS NOT the reminder day.');
    }

    // 3. Run the reminder job
    console.log('Running reminder job…');
    await runReminderJob();

    // 4. Verify results
    const updatedStudent = await Student.findById(testStudent._id);
    console.log(`Updated Student Dues: ₹${updatedStudent.feeDues}`);

    const invoice = await Invoice.findOne({ studentId: testStudent._id });
    if (invoice) {
        console.log(`Generated Invoice Total: ₹${invoice.totalAmount}`);
        console.log(`Invoice Note: ${invoice.note}`);
    } else {
        console.log('No Invoice generated!');
    }

    // 5. Cleanup
    await Student.deleteOne({ _id: testStudent._id });
    await Invoice.deleteMany({ studentId: testStudent._id });
    console.log('Cleanup complete.');

    await mongoose.disconnect();
}

test().catch(console.error);
