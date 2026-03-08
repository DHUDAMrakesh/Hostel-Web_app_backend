/**
 * utils/scheduler.js
 *
 * Fully automatic daily cron job — fires at 09:00 AM IST every day.
 * For every student whose 30-day billing cycle ends today it will:
 *   1. Create an in-app Notification
 *   2. Send a WhatsApp message (via Twilio — if credentials set + phone available)
 *   3. Send a fee-reminder Email (via nodemailer — always runs as fallback)
 *
 * No admin action needed. Starts automatically when the server boots.
 */

const cron = require('node-cron');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const Invoice = require('../models/Invoice');
const { sendWhatsAppReminder } = require('./whatsapp');

const CYCLE_DAYS = 30;

/* ─── Cycle helper ──────────────────────────────────────────────────────────── */
/**
 * Given a joinedDate, return whether today is exactly on a 30-day cycle boundary.
 * Uses IST-aware date arithmetic.
 */
function getCycleInfo(joinedDate) {
    // Work in IST (UTC+5:30) so the boundary lines up with the user's day
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    const joinedIST = new Date(new Date(joinedDate).getTime() + IST_OFFSET_MS);

    // Truncate to calendar day (IST midnight)
    const todayDay = Math.floor(nowIST.getTime() / 86400000);
    const joinedDay = Math.floor(joinedIST.getTime() / 86400000);

    const daysSinceJoining = todayDay - joinedDay;

    if (daysSinceJoining <= 0) return { cycleNumber: 0, isReminderDay: false };

    const isReminderDay = daysSinceJoining % CYCLE_DAYS === 0;
    const cycleNumber = Math.floor(daysSinceJoining / CYCLE_DAYS);

    return { cycleNumber, isReminderDay, daysSinceJoining };
}

/* ─── Email reminder ────────────────────────────────────────────────────────── */
async function sendFeeReminderEmail(email, name, monthlyFee, feeDues, cycleNumber) {
    if (!email) return { skipped: true, reason: 'no email' };
    try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

        const html = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#f8faff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 36px;text-align:center;">
            <div style="font-size:26px;font-weight:800;color:#fff;">🏠 HostelOS</div>
            <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">Monthly Fee Reminder</div>
          </div>
          <div style="padding:28px 36px;">
            <p style="margin:0 0 8px;font-size:16px;color:#0f172a;font-weight:600;">Hello, ${name} 👋</p>
            <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.7;">
              Your <strong>30-day billing cycle #${cycleNumber}</strong> ends today.
              Please make your payment at the earliest to avoid any inconvenience.
            </p>
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 22px;margin-bottom:20px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                <span style="font-size:13px;color:#64748b;">Monthly Fee</span>
                <span style="font-size:15px;font-weight:700;color:#4f46e5;">₹${Number(monthlyFee).toLocaleString('en-IN')}</span>
              </div>
              <div style="border-top:1px solid #f1f5f9;padding-top:10px;display:flex;justify-content:space-between;">
                <span style="font-size:13px;color:#64748b;">Outstanding Dues</span>
                <span style="font-size:15px;font-weight:700;color:${feeDues > 0 ? '#e11d48' : '#059669'};">₹${Number(feeDues).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <a href="http://localhost:5173/student/fees" style="display:inline-block;padding:11px 26px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:13px;font-weight:700;border-radius:10px;text-decoration:none;">
              View My Fees →
            </a>
            <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:16px;">
              This is an automated reminder from HostelOS. Please do not reply to this email.
            </p>
          </div>
        </div>`;

        await transporter.sendMail({
            from: `"HostelOS" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `💰 Fee Reminder — Cycle #${cycleNumber} ends today`,
            html,
        });

        console.log(`[Scheduler] ✓ Email reminder sent to ${email}`);
        return { sent: true };
    } catch (err) {
        console.error(`[Scheduler] ✗ Email failed for ${email}:`, err.message);
        return { error: err.message };
    }
}

/* ─── Core job ──────────────────────────────────────────────────────────────── */
/**
 * Runs daily. Finds ALL students whose 30-day cycle ends today.
 * Sends in-app notification + WhatsApp (if phone) + email (if email).
 * Returns array of per-student results for logging / API response.
 */
async function runReminderJob() {
    console.log('[Scheduler] ⏰ Running monthly fee reminder job…');

    // Fetch ALL students (phone + no-phone) — we'll email even those without phones
    const students = await Student.find({}).lean();

    const results = [];

    for (const student of students) {
        const { cycleNumber, isReminderDay } = getCycleInfo(student.joinedDate);

        if (!isReminderDay) continue;

        // ── Idempotency Check ────────────────────────────────────────────────
        // Check if we already generated an automated invoice for this student + cycle
        const existingInvoice = await Invoice.findOne({
            studentId: student._id,
            note: `Automated Billing — Cycle #${cycleNumber}`
        });

        if (existingInvoice) {
            console.log(`[Scheduler] ℹ Cycle #${cycleNumber} already billed for "${student.name}". Skipping automated generation.`);
        } else {
            console.log(`[Scheduler] ⚡ Generating automated bill for "${student.name}" (cycle #${cycleNumber})`);

            // 1. Create the Invoice
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 5); // Due in 5 days

            const newInvoice = await Invoice.create({
                studentId: student._id,
                totalAmount: student.monthlyFee,
                feePlans: [{
                    name: `Monthly Hostel Fee (Cycle #${cycleNumber})`,
                    amount: student.monthlyFee
                }],
                status: 'Issued',
                dueDate: dueDate,
                note: `Automated Billing — Cycle #${cycleNumber}`
            });

            // 2. Increment Student Dues
            await Student.findByIdAndUpdate(student._id, {
                $inc: { feeDues: student.monthlyFee }
            });

            // Update local student object for the notification below
            student.feeDues += student.monthlyFee;
        }

        const result = {
            studentId: student._id,
            name: student.name,
            cycleNumber,
            channels: [],
        };

        // ── Notifications ────────────────────────────────────────────────────
        try {
            if (student.userId) {
                await Notification.create({
                    userId: student.userId,
                    type: 'payment',
                    title: '💰 Monthly Fee Due',
                    message: `Your 30-day billing cycle #${cycleNumber} ends today. Bill Generated: ₹${student.monthlyFee}. Total outstanding: ₹${student.feeDues}.`,
                    link: '/student/fees',
                });
                result.channels.push('in-app');
            }
        } catch (err) {
            console.error(`[Scheduler] In-app notification error for ${student.name}:`, err.message);
        }

        if (student.phone) {
            try {
                await sendWhatsAppReminder(
                    student.phone,
                    student.name,
                    student.monthlyFee,
                    student.feeDues,
                    cycleNumber,
                );
                result.channels.push('whatsapp');
            } catch (err) {
                result.whatsappError = err.message;
                console.error(`[Scheduler] WhatsApp error for ${student.name}:`, err.message);
            }
        }

        if (student.email) {
            const emailResult = await sendFeeReminderEmail(
                student.email,
                student.name,
                student.monthlyFee,
                student.feeDues,
                cycleNumber,
            );
            if (emailResult.sent) result.channels.push('email');
        }

        results.push(result);
    }

    const summary = results.map(r => `${r.name} (${r.channels.join(', ') || 'no channels'})`).join('; ');
    console.log(`[Scheduler] ✅ Job complete. ${results.length} student(s) notified${results.length ? ': ' + summary : '.'}`);

    return results;
}

/* ─── Single student send (admin manual trigger) ────────────────────────────── */
async function sendReminderToStudent(student) {
    const { cycleNumber } = getCycleInfo(student.joinedDate);
    const effectiveCycle = Math.max(cycleNumber, 1);

    const channels = [];

    // In-app
    if (student.userId) {
        await Notification.create({
            userId: student.userId,
            type: 'payment',
            title: '💰 Monthly Fee Reminder',
            message: `Fee reminder sent by admin. Monthly fee: ₹${student.monthlyFee}. Outstanding dues: ₹${student.feeDues}.`,
            link: '/student/fees',
        });
        channels.push('in-app');
    }

    // WhatsApp
    if (student.phone) {
        try {
            await sendWhatsAppReminder(student.phone, student.name, student.monthlyFee, student.feeDues, effectiveCycle);
            channels.push('whatsapp');
        } catch (_) { }
    }

    // Email
    if (student.email) {
        const r = await sendFeeReminderEmail(student.email, student.name, student.monthlyFee, student.feeDues, effectiveCycle);
        if (r.sent) channels.push('email');
    }

    return { channels, cycleNumber: effectiveCycle };
}

/* ─── Cron startup ──────────────────────────────────────────────────────────── */
/**
 * Start the automatic scheduler.
 * Fires at exactly 09:00 AM IST (Asia/Kolkata) every day.
 * node-cron interprets the expression in the given timezone.
 */
function startScheduler() {
    // '0 9 * * *' with timezone Asia/Kolkata = 09:00 AM IST every day
    cron.schedule('0 9 * * *', async () => {
        try {
            await runReminderJob();
        } catch (err) {
            console.error('[Scheduler] ❌ Unexpected error:', err.message);
        }
    }, {
        timezone: 'Asia/Kolkata',
    });

    console.log('[Scheduler] ✅ Auto-reminder started — fires every day at 09:00 AM IST');
    console.log('[Scheduler]    Channels: In-app notification + WhatsApp (if phone) + Email (if email)');
}

module.exports = { startScheduler, runReminderJob, sendReminderToStudent, getCycleInfo };
