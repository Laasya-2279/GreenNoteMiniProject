const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { jwtSecret, jwtExpiry, otpExpiry } = require('../config/auth');
const { sendOTPEmail, sendPasswordResetEmail, generateOTP } = require('../services/email.service');

// POST /api/auth/signup
const signup = async (req, res, next) => {
    try {
        const { email, password, name, phone, role } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const otp = generateOTP();
        const user = await User.create({
            email, password, name, phone,
            role: role || 'PUBLIC',
            otp,
            otpExpiry: new Date(Date.now() + otpExpiry)
        });

        // Send OTP email (non-blocking)
        sendOTPEmail(email, otp).catch(err => console.error('OTP email failed:', err));

        await AuditLog.create({
            action: 'USER_SIGNUP',
            userId: user._id,
            details: { email, role: user.role },
            ipAddress: req.ip
        });

        const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: jwtExpiry });

        res.status(201).json({
            success: true,
            message: 'Account created. Please verify your email with OTP.',
            token,
            user
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/auth/login
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (!user.isActive) {
            return res.status(403).json({ success: false, message: 'Account deactivated' });
        }

        const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: jwtExpiry });

        await AuditLog.create({
            action: 'USER_LOGIN',
            userId: user._id,
            details: { email },
            ipAddress: req.ip
        });

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/auth/verify-otp
const verifyOTP = async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'Email already verified' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        if (new Date() > user.otpExpiry) {
            return res.status(400).json({ success: false, message: 'OTP has expired' });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        await AuditLog.create({
            action: 'USER_VERIFIED',
            userId: user._id,
            details: { email },
            ipAddress: req.ip
        });

        res.json({ success: true, message: 'Email verified successfully' });
    } catch (error) {
        next(error);
    }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ success: true, message: 'If a matching account exists, a reset email has been sent' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save();

        sendPasswordResetEmail(email, resetToken).catch(err => console.error('Reset email failed:', err));

        res.json({ success: true, message: 'If a matching account exists, a reset email has been sent' });
    } catch (error) {
        next(error);
    }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({ success: true, user });
    } catch (error) {
        next(error);
    }
};

// POST /api/auth/resend-otp
const resendOTP = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'Email already verified' });
        }

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = new Date(Date.now() + otpExpiry);
        await user.save();

        sendOTPEmail(email, otp).catch(err => console.error('OTP email failed:', err));

        res.json({ success: true, message: 'OTP resent successfully' });
    } catch (error) {
        next(error);
    }
};

module.exports = { signup, login, verifyOTP, forgotPassword, getMe, resendOTP };
