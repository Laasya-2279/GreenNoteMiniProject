const mongoose = require('mongoose');

const trafficOfficerSchema = new mongoose.Schema({
    officerId: {
        type: String,
        unique: true,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true
    },
    assignedSignals: [{
        type: String,
        ref: 'TrafficSignal'
    }],
    zone: {
        type: String,
        trim: true
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

module.exports = mongoose.model('TrafficOfficer', trafficOfficerSchema);
