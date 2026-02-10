const router = require('express').Router();
const { signup, login, verifyOTP, forgotPassword, getMe, resendOTP } = require('../controllers/auth.controller');
const auth = require('../middleware/auth.middleware');
const { signupValidation, loginValidation } = require('../middleware/validation.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');

router.post('/signup', authLimiter, signupValidation, signup);
router.post('/login', authLimiter, loginValidation, login);
router.post('/verify-otp', authLimiter, verifyOTP);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/resend-otp', authLimiter, resendOTP);
router.get('/me', auth, getMe);

module.exports = router;
