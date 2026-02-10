const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: [
            'CORRIDOR_CREATED', 'CORRIDOR_APPROVED', 'CORRIDOR_REJECTED',
            'CORRIDOR_STARTED', 'CORRIDOR_COMPLETED', 'CORRIDOR_CANCELLED',
            'SIGNAL_OVERRIDE', 'SIGNAL_RESTORED',
            'GPS_UPDATE', 'ROUTE_CALCULATED', 'ROUTE_SELECTED',
            'USER_LOGIN', 'USER_SIGNUP', 'USER_VERIFIED',
            'AMBULANCE_ASSIGNED', 'ETA_UPDATED', 'MODEL_UPDATED'
        ]
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    corridorId: String,
    details: {
        type: mongoose.Schema.Types.Mixed
    },
    ipAddress: String,
    userAgent: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ corridorId: 1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
