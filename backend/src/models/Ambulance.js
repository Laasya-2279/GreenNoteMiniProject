const mongoose = require('mongoose');

const ambulanceSchema = new mongoose.Schema({
    driverId: {
        type: String,
        unique: true,
        required: true
    },
    driverName: {
        type: String,
        required: [true, 'Driver name is required'],
        trim: true
    },
    contactNumber: {
        type: String,
        required: [true, 'Contact number is required']
    },
    email: {
        type: String,
        lowercase: true,
        trim: true
    },
    drivingLicenseNumber: {
        type: String,
        required: [true, 'License number is required']
    },
    photo: {
        type: String
    },
    vehicleNumbers: [{
        type: String,
        required: true
    }],
    currentLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: [0, 0]
        }
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    isOnDuty: {
        type: Boolean,
        default: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

ambulanceSchema.index({ currentLocation: '2dsphere' });

module.exports = mongoose.model('Ambulance', ambulanceSchema);
