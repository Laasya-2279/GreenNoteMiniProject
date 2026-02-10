const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
    corridorId: {
        type: String,
        ref: 'GreenCorridor',
        required: true
    },
    waypoints: {
        type: [[Number]], // Array of [lat, lng]
        required: true
    },
    distance: {
        type: Number, // in meters
        required: true
    },
    estimatedDuration: {
        type: Number, // in seconds
        required: true
    },
    routeType: {
        type: String,
        enum: ['PRIMARY', 'ALTERNATE'],
        default: 'PRIMARY'
    },
    trafficSignalsOnRoute: [{
        signalId: String,
        name: String,
        location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: [Number]
        },
        distanceFromStart: Number
    }],
    isSelected: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

routeSchema.index({ corridorId: 1 });

module.exports = mongoose.model('Route', routeSchema);
