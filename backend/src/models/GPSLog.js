const mongoose = require('mongoose');

const gpsLogSchema = new mongoose.Schema({
    corridorId: {
        type: String,
        ref: 'GreenCorridor',
        required: true
    },
    ambulanceId: {
        type: String,
        required: true
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
    accuracy: {
        type: Number
    },
    speed: {
        type: Number // m/s
    },
    heading: {
        type: Number // degrees
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

gpsLogSchema.index({ corridorId: 1, timestamp: -1 });
gpsLogSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('GPSLog', gpsLogSchema);
