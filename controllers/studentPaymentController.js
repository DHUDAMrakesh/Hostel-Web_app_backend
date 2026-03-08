const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { generateReceipt } = require('../utils/pdfGenerator');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_12345',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret_12345'
});

exports.getPaymentSummary = async (req, res) => {
    try {
        const studentId = req.user.id;
        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ message: 'Student not found.' });

        // Calculate total amounts based on invoices
        const invoices = await Invoice.find({ studentId });
        const totalBilled = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

        // Calculate amount paid from the new Payment collection + existing manual subdocs if needed
        const payments = await Payment.find({ studentId, paymentStatus: 'Success' });
        const totalPaidOnline = payments.reduce((sum, p) => sum + p.amount, 0);

        // Also consider legacy/manual payments inside the Student document
        const totalPaidManual = student.payments
            .filter(p => p.status === 'Paid')
            .reduce((sum, p) => sum + Number(p.amount), 0);

        const totalPaid = totalPaidOnline + totalPaidManual;

        res.json({
            totalFeeAmount: totalBilled || (student.monthlyFee || 0), // fallback to monthly
            amountPaid: totalPaid,
            pendingAmount: student.feeDues || 0,
            dueDate: invoices.length > 0 ? invoices[invoices.length - 1].dueDate : null,
            status: student.feeDues > 0 ? 'Pending' : 'Paid'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getPaymentHistory = async (req, res) => {
    try {
        const studentId = req.user.id;
        const payments = await Payment.find({ studentId }).sort({ createdAt: -1 });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createRazorpayOrder = async (req, res) => {
    const { amount, invoiceId } = req.body;
    const studentId = req.user.id;

    if (!amount) return res.status(400).json({ message: 'Amount is required.' });

    try {
        const options = {
            amount: amount * 100, // Razorpay expects amount in paise
            currency: 'INR',
            receipt: `rcpt_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        const newPayment = new Payment({
            studentId,
            invoiceId,
            amount,
            razorpayOrderId: order.id,
            paymentStatus: 'Pending'
        });
        await newPayment.save();

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_12345'
        });
    } catch (error) {
        console.error('Razorpay order creation error:', error);
        res.status(500).json({ message: 'Failed to create Razorpay order.' });
    }
};

exports.verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    try {
        const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
        if (!payment) return res.status(404).json({ message: 'Payment record not found.' });
        if (payment.paymentStatus === 'Success') return res.status(400).json({ message: 'Payment already verified.' });

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'secret_12345')
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            payment.paymentStatus = 'Success';
            payment.razorpayPaymentId = razorpay_payment_id;
            payment.razorpaySignature = razorpay_signature;
            await payment.save();

            // 1. Update Student Dues
            const student = await Student.findById(payment.studentId);
            if (student) {
                student.feeDues = Math.max(0, (student.feeDues || 0) - payment.amount);
                await student.save();
            }

            // 2. Update Invoice to Paid if applicable
            if (payment.invoiceId) {
                const invoice = await Invoice.findById(payment.invoiceId);
                if (invoice) {
                    invoice.status = 'Paid';
                    await invoice.save();
                }
            }

            // 3. Send Notification to Student
            const notification = new Notification({
                recipient: student._id,
                recipientModel: 'Student',
                title: 'Payment Successful',
                message: `Your payment of ₹${payment.amount} was successful. Transaction ID: ${razorpay_payment_id}`,
                type: 'payment',
                relatedId: payment._id,
                onModel: 'Payment'
            });
            await notification.save();

            res.json({ message: 'Payment verified successfully.' });
        } else {
            payment.paymentStatus = 'Failed';
            await payment.save();
            res.status(400).json({ message: 'Invalid payment signature.' });
        }
    } catch (error) {
        console.error('Verification Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.downloadReceipt = async (req, res) => {
    try {
        const paymentId = req.params.paymentId;
        const studentId = req.user.id;

        const payment = await Payment.findOne({ _id: paymentId, studentId, paymentStatus: 'Success' });
        if (!payment) return res.status(404).json({ message: 'Valid payment not found.' });

        const student = await Student.findById(studentId);

        generateReceipt(payment, student, res);
    } catch (error) {
        console.error('Download Receipt Error:', error);
        res.status(500).json({ message: 'Failed to generate receipt.' });
    }
};
