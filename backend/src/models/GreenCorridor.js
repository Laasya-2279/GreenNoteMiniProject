const mongoose = require('mongoose');

const greenCorridorSchema = new mongoose.Schema({
    corridorId: {
        type: String,
        unique: true,
        required: true
    },
    sourceHospital: {
        hospitalId: { type: String, required: true },
        name: { type: String, required: true },
        location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], required: true }
        }
    },
    destinationHospital: {
        hospitalId: { type: String, required: true },
        name: { type: String, required: true },
        location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], required: true }
        }
    },
    organType: {
        type: String,
        enum: ['Heart', 'Kidney', 'Liver', 'Lungs', 'Pancreas', 'Intestine', 'Cornea', 'Tissue'],
        required: [true, 'Organ type is required']
    },
    urgencyLevel: {
        type: String,
        enum: ['STABLE', 'CRITICAL', 'VERY_CRITICAL'],
        required: [true, 'Urgency level is required']
    },
    ambulance: {
        ambulanceId: String,
        driverId: String,
        vehicleNumber: String,
        driverName: String,
        contactNumber: String
    },
    selectedRoute: {
        routeId: String,
        distance: Number,
        estimatedDuration: Number,
        waypoints: [[Number]]
    },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'],
        default: 'PENDING'
    },
    predictedETA: {
        type: Number // in seconds
    },
    actualDuration: {
        type: Number // in seconds
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    doctorInCharge: {
        name: String,
        phone: String,
        specialization: String
    },
    rejectionReason: String,
    startedAt: Date,
    completedAt: Date,
    notes: String
}, {
    timestamps: true
});

// Auto-generate corridorId: GC + YYYYMMDD + 3-digit sequence
// Use pre('validate') so corridorId is set BEFORE Mongoose validation runs
greenCorridorSchema.pre('validate', async function (next) {
    if (this.isNew && !this.corridorId) {
        const today = new Date();
        const dateStr = today.getFullYear().toString() +
            String(today.getMonth() + 1).padStart(2, '0') +
            String(today.getDate()).padStart(2, '0');

        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        const count = await mongoose.model('GreenCorridor').countDocuments({
            createdAt: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        });

        this.corridorId = `GC${dateStr}${String(count + 1).padStart(3, '0')}`;
    }
    next();
});

greenCorridorSchema.index({ status: 1 });
greenCorridorSchema.index({ 'sourceHospital.hospitalId': 1 });
greenCorridorSchema.index({ 'destinationHospital.hospitalId': 1 });

module.exports = mongoose.model('GreenCorridor', greenCorridorSchema);
