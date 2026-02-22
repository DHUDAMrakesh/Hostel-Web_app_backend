const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Send login credentials to a newly created student.
 * @param {string} to      - Student's email address
 * @param {string} name    - Student's full name
 * @param {string} email   - Login email (same as `to`)
 * @param {string} password - Auto-generated plain-text password
 */
async function sendCredentialsEmail(to, name, email, password) {
    const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f8faff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px 36px; text-align: center;">
        <div style="font-size: 28px; font-weight: 800; color: #fff; letter-spacing: -0.02em;">🏠 HostelOS</div>
        <div style="color: rgba(255,255,255,0.8); font-size: 14px; margin-top: 6px;">Hostel Management System</div>
      </div>

      <!-- Body -->
      <div style="padding: 32px 36px;">
        <p style="margin: 0 0 12px; font-size: 16px; color: #0f172a; font-weight: 600;">Hello, ${name} 👋</p>
        <p style="margin: 0 0 24px; font-size: 14px; color: #64748b; line-height: 1.6;">
          Your hostel account has been created. Use the credentials below to log in to the <strong>HostelOS</strong> student portal.
        </p>

        <!-- Credentials box -->
        <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
          <div style="margin-bottom: 14px;">
            <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Email (Username)</div>
            <div style="font-size: 15px; font-weight: 600; color: #0f172a;">${email}</div>
          </div>
          <div style="border-top: 1px solid #f1f5f9; padding-top: 14px;">
            <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Password</div>
            <div style="font-size: 18px; font-weight: 700; color: #4f46e5; letter-spacing: 0.05em; font-family: monospace;">${password}</div>
          </div>
        </div>

        <a href="http://localhost:5173/login"
           style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; font-size: 14px; font-weight: 700; border-radius: 10px; text-decoration: none; margin-bottom: 24px;">
          Login to HostelOS →
        </a>

        <p style="margin: 0; font-size: 13px; color: '#94a3b8'; line-height: 1.6; border-top: 1px solid #f1f5f9; padding-top: 20px;">
          🔒 Please change your password after your first login. If you did not expect this email, contact your hostel administrator.
        </p>
      </div>
    </div>`;

    await transporter.sendMail({
        from: `"HostelOS" <${process.env.EMAIL_USER}>`,
        to,
        subject: '🏠 Your HostelOS Login Credentials',
        html,
    });
}

module.exports = { sendCredentialsEmail };
