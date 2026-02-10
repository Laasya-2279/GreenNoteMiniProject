const mongoose = require('mongoose');

const trafficSignalSchema = new mongoose.Schema({
    signalId: {
        type: String,
        unique: true,
        required: true
    },
    name: {
        type: String,
        required: [true, 'Signal name is required'],
        trim: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    signalType: {
        type: String,
        enum: ['4-way', 'T-junction', 'Y-junction', 'Roundabout', 'Pedestrian'],
        default: '4-way'
    },
    zone: {
        type: String,
        trim: true
    },
    isOperational: {
        type: Boolean,
        default: true
    },
    currentState: {
        type: String,
        enum: ['RED', 'GREEN', 'YELLOW'],
        default: 'RED'
    },
    overriddenBy: {
        corridorId: String,
        overriddenAt: Date,
        originalState: String
    }
}, {
    timestamps: true
});

trafficSignalSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('TrafficSignal', trafficSignalSchema);
