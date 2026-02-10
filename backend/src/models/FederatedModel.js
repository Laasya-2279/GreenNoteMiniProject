const mongoose = require('mongoose');

const federatedModelSchema = new mongoose.Schema({
    version: {
        type: Number,
        required: true,
        default: 1
    },
    biases: {
        morning: { type: Number, default: 0 },
        afternoon: { type: Number, default: 0 },
        night: { type: Number, default: 0 }
    },
    samples: {
        morning: { type: Number, default: 0 },
        afternoon: { type: Number, default: 0 },
        night: { type: Number, default: 0 }
    },
    accuracy: {
        meanAbsoluteError: { type: Number, default: 0 },
        meanSquaredError: { type: Number, default: 0 },
        totalPredictions: { type: Number, default: 0 }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('FederatedModel', federatedModelSchema);
