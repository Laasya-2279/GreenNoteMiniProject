module.exports = {
    jwtSecret: process.env.JWT_SECRET || 'greennote-secret-key-2024',
    jwtExpiry: '7d',
    refreshExpiry: '30d',
    otpExpiry: 10 * 60 * 1000, // 10 minutes
    saltRounds: 12
};
