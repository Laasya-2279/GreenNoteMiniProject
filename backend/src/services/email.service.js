const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    auth: {
        user: process.env.SMTP_USER || 'test@ethereal.email',
        pass: process.env.SMTP_PASS || 'testpass'
    }
});

const sendOTPEmail = async (email, otp) => {
    const mailOptions = {
        from: '"GreenNote" <noreply@greennote.com>',
        to: email,
        subject: 'GreenNote - Email Verification OTP',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #059669; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">🏥 GreenNote</h1>
          <p style="color: #d1fae5; margin: 5px 0 0;">Green Corridor Management System</p>
        </div>
        <div style="padding: 30px; background: #f0fdf4; border-radius: 0 0 8px 8px;">
          <h2 style="color: #065f46;">Verify Your Email</h2>
          <p>Your OTP for email verification is:</p>
          <div style="background: #059669; color: white; font-size: 32px; font-weight: bold; text-align: center; 
                      padding: 15px; border-radius: 8px; letter-spacing: 8px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #6b7280; font-size: 14px;">This OTP expires in 10 minutes. Do not share it with anyone.</p>
        </div>
      </div>
    `
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email send error:', error.message);
        return false;
    }
};

const sendPasswordResetEmail = async (email, resetToken) => {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    const mailOptions = {
        from: '"GreenNote" <noreply@greennote.com>',
        to: email,
        subject: 'GreenNote - Password Reset',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #059669; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">🏥 GreenNote</h1>
        </div>
        <div style="padding: 30px; background: #f0fdf4; border-radius: 0 0 8px 8px;">
          <h2 style="color: #065f46;">Reset Password</h2>
          <p>Click the link below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; 
             text-decoration: none; border-radius: 6px; margin: 15px 0;">Reset Password</a>
          <p style="color: #6b7280; font-size: 14px;">This link expires in 1 hour.</p>
        </div>
      </div>
    `
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email send error:', error.message);
        return false;
    }
};

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = { sendOTPEmail, sendPasswordResetEmail, generateOTP };
