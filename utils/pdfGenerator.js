const PDFDocument = require('pdfkit');

/**
 * Generate a payment receipt PDF and pipe it directly to `res`.
 * Works for both mock and real (Razorpay-style) payment records.
 */
exports.generateReceipt = (payment, student, res) => {
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename=receipt-${payment._id}.pdf`
    );

    doc.pipe(res);

    // ── Header ────────────────────────────────────────────────
    doc.fontSize(22).font('Helvetica-Bold').text('Hostel Payment Receipt', { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica').fillColor('gray')
        .text('This is a computer-generated receipt. No signature required.', { align: 'center' });
    doc.moveDown(1);

    // ── Divider ───────────────────────────────────────────────
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.8);

    // ── Receipt & date ────────────────────────────────────────
    doc.fontSize(12).fillColor('black').font('Helvetica-Bold').text('Receipt Details', { underline: true });
    doc.moveDown(0.3);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(payment.updatedAt || payment.createdAt);
    const dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    doc.font('Helvetica').fontSize(11);
    doc.text(`Receipt ID    : ${payment._id}`);
    doc.text(`Date          : ${dateStr}`);
    doc.moveDown(0.8);

    // ── Student Details ───────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(12).text('Student Details', { underline: true });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11);
    doc.text(`Student Name  : ${student.name}`);
    doc.text(`Room Number   : ${student.roomNumber || 'N/A'}`);
    doc.text(`Email         : ${student.email || 'N/A'}`);
    doc.moveDown(0.8);

    // ── Payment Details ───────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(12).text('Payment Details', { underline: true });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11);
    doc.text(`Transaction ID  : ${payment.transactionId || 'N/A'}`);
    doc.text(`Payment Method  : ${payment.paymentMethod}`);
    doc.text(`Amount Paid     : ₹${payment.amount.toLocaleString('en-IN')}`);
    if (payment.note) doc.text(`Note            : ${payment.note}`);
    doc.moveDown(1);

    // ── Status stamp ─────────────────────────────────────────
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.8);
    doc.fontSize(16).font('Helvetica-Bold')
        .fillColor(payment.paymentStatus === 'Success' ? 'green' : 'red')
        .text(`Status: ${payment.paymentStatus}`, { align: 'center' });

    doc.end();
};
