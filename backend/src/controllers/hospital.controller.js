const Hospital = require('../models/Hospital');
const Ambulance = require('../models/Ambulance');

// GET /api/hospitals
const getHospitals = async (req, res, next) => {
    try {
        const hospitals = await Hospital.find({ isActive: true }).sort({ name: 1 });
        res.json({ success: true, hospitals });
    } catch (error) {
        next(error);
    }
};

// GET /api/hospitals/:id
const getHospitalById = async (req, res, next) => {
    try {
        const hospital = await Hospital.findOne({ hospitalId: req.params.id });
        if (!hospital) {
            return res.status(404).json({ success: false, message: 'Hospital not found' });
        }
        res.json({ success: true, hospital });
    } catch (error) {
        next(error);
    }
};

// GET /api/hospitals/ambulances - get ambulances
const getAmbulances = async (req, res, next) => {
    try {
        const ambulances = await Ambulance.find({ isAvailable: true }).sort({ driverName: 1 });
        res.json({ success: true, ambulances });
    } catch (error) {
        next(error);
    }
};

module.exports = { getHospitals, getHospitalById, getAmbulances };
