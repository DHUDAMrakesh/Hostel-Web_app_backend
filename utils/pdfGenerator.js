const PDFDocument = require('pdfkit');
const fs = require('fs');

exports.generateReceipt = (payment, student, res) => {
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${payment._id}.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(20).text('Hostel Payment Receipt', { align: 'center' });
    doc.moveDown();

    // Info
    doc.fontSize(12);
    doc.text(`Receipt ID: ${payment._id}`);
    doc.text(`Date: ${new Date(payment.updatedAt).toLocaleDateString()}`);
    doc.moveDown();

    // Student Details
    doc.text(`Student Name: ${student.name}`);
    doc.text(`Room Number: ${student.roomNumber}`);
    doc.moveDown();

    // Payment Details
    doc.text(`Transaction ID: ${payment.razorpayPaymentId || 'N/A'}`);
    doc.text(`Payment Method: ${payment.paymentMethod}`);
    doc.text(`Amount Paid: Rs. ${payment.amount}`);
    doc.moveDown();

    // Status
    doc.fontSize(14).fillColor('green').text(`Status: ${payment.paymentStatus}`, { align: 'center' });

    // Footer
    doc.moveDown();
    doc.fontSize(10).fillColor('gray').text('This is a computer-generated document. No signature is required.', { align: 'center' });

    doc.end();
};
