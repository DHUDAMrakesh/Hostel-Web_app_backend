/**
 * utils/whatsapp.js
 * Sends WhatsApp messages via Twilio.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in env.
 */

/**
 * Send a rent-due WhatsApp reminder to a student.
 * @param {string} phone     - Student phone number (e.g. "+919876543210")
 * @param {string} name      - Student name
 * @param {number} monthlyFee - Their monthly fee amount
 * @param {number} feeDues   - Current outstanding dues
 * @param {number} cycleNumber - Which billing cycle this is (1, 2, 3...)
 */
async function sendWhatsAppReminder(phone, name, monthlyFee, feeDues, cycleNumber = 1) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) {
        console.warn('[WhatsApp] Twilio credentials not set — skipping WhatsApp send.');
        return { skipped: true };
    }

    // Normalise phone: ensure it starts with "whatsapp:+<country_code>"
    let toNumber = phone.replace(/\s+/g, '').replace(/[^+\d]/g, '');
    if (!toNumber.startsWith('+')) toNumber = '+91' + toNumber; // default to India
    const to = `whatsapp:${toNumber}`;

    const body =
        `Hello ${name} 👋

This is a reminder from *HostelOS* 🏠

Your *30-day billing cycle #${cycleNumber}* ends today.

💰 Monthly Fee: ₹${Number(monthlyFee).toLocaleString('en-IN')}
⚠️ Outstanding Dues: ₹${Number(feeDues).toLocaleString('en-IN')}

Please make your payment at the earliest to avoid any inconvenience.

Thank you for staying with us!
— *HostelOS Management*`;

    try {
        const client = require('twilio')(accountSid, authToken);
        const message = await client.messages.create({ from, to, body });
        console.log(`[WhatsApp] ✓ Reminder sent to ${toNumber} — SID: ${message.sid}`);
        return { sid: message.sid, to: toNumber };
    } catch (err) {
        console.error(`[WhatsApp] ✗ Failed to send to ${toNumber}:`, err.message);
        throw err;
    }
}

module.exports = { sendWhatsAppReminder };
