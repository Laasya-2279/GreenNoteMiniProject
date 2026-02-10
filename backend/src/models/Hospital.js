const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
    hospitalId: {
        type: String,
        unique: true,
        required: true
    },
    name: {
        type: String,
        required: [true, 'Hospital name is required'],
        trim: true
    },
    address: {
        type: String,
        required: [true, 'Address is required']
    },
    contactNumber: {
        type: String,
        required: [true, 'Contact number is required']
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
    departments: [{
        type: String
    }],
    hasTransplantFacility: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

hospitalSchema.index({ location: '2dsphere' });

// Auto-generate hospitalId
hospitalSchema.pre('save', async function (next) {
    if (this.isNew && !this.hospitalId) {
        const count = await mongoose.model('Hospital').countDocuments();
        this.hospitalId = `H${String(count + 1).padStart(3, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Hospital', hospitalSchema);
