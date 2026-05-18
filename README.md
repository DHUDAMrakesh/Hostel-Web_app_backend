# Hostel Management System - Server

This is the backend API for the Hostel Management System. It provides robust RESTful endpoints to manage hostel operations, handle role-based access control, process payments, and automate routine tasks.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JSON Web Tokens (JWT) & bcryptjs
- **File Uploads**: Multer
- **Task Scheduling**: node-cron
- **Email Services**: Nodemailer
- **PDF Generation**: PDFKit
- **Payments**: Razorpay Integration
- **SMS/Notifications**: Twilio

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed and a running [MongoDB](https://www.mongodb.com/) instance (local or Atlas).

### Installation

1. Navigate to the `server` directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Variables

Create a `.env` file in the root of the `server` directory and configure the following variables (example):

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/hostel_db
JWT_SECRET=your_jwt_secret_key
# Razorpay Credentials
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
# Nodemailer / SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_password
# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone
```

### Running the Server

To start the server in development mode (with auto-restart via nodemon):

```bash
npm run dev
```

To start the server in production mode:

```bash
npm start
```

### Seeding Initial Data

To quickly set up the database with dummy data (including test beds, students, food menu, and default users):

```bash
node seed.js
```

**Default Seeded Users:**
- Admin: `admin@hostel.com` / `Admin@123`
- Manager: `manager@hostel.com` / `Manager@123`
- Student: `student@hostel.com` / `Student@123`

To insert a standalone secondary admin into a separate admins collection, you can run:

```bash
node insertAdmin.js
```
*(Creates `admin04@hostel.com` / `Admin@12345`)*

## Features

- **Authentication & Authorization**: Secure login with JWT and role-based middleware (Admin, Manager, Student).
- **Automated Reminders**: Built-in cron jobs (`utils/scheduler.js`) for billing and fee dues.
- **Payment Processing**: Integration with Razorpay for handling student fee payments.
- **Reporting & Exports**: Generate automated PDF receipts and reports.
- **File Management**: Upload capabilities for user avatars or complaint attachments.
