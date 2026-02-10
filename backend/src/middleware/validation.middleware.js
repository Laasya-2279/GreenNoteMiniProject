const { body, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors: errors.array().map(e => e.msg)
        });
    }
    next();
};

const signupValidation = [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('role').isIn(['HOSPITAL', 'CONTROL_ROOM', 'TRAFFIC', 'AMBULANCE', 'PUBLIC']).withMessage('Invalid role'),
    validate
];

const loginValidation = [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
    validate
];

const corridorValidation = [
    body('destinationHospitalId').notEmpty().withMessage('Destination hospital is required'),
    body('organType').isIn(['Heart', 'Kidney', 'Liver', 'Lungs', 'Pancreas', 'Intestine', 'Cornea', 'Tissue']).withMessage('Invalid organ type'),
    body('urgencyLevel').isIn(['STABLE', 'CRITICAL', 'VERY_CRITICAL']).withMessage('Invalid urgency level'),
    validate
];

module.exports = { validate, signupValidation, loginValidation, corridorValidation };
