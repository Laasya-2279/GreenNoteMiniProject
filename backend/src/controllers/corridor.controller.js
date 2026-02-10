const GreenCorridor = require('../models/GreenCorridor');
const Hospital = require('../models/Hospital');
const Ambulance = require('../models/Ambulance');
const AuditLog = require('../models/AuditLog');

// POST /api/corridors - Create green corridor request
const createCorridor = async (req, res, next) => {
    try {
        const {
            destinationHospitalId, organType, urgencyLevel,
            ambulanceId, doctorInCharge, notes
        } = req.body;

        // Get source hospital (logged in user's hospital)
        const sourceHospital = await Hospital.findOne({ hospitalId: req.body.sourceHospitalId || req.user.hospitalId });
        if (!sourceHospital) {
            return res.status(400).json({ success: false, message: 'Source hospital not found' });
        }

        const destHospital = await Hospital.findOne({ hospitalId: destinationHospitalId });
        if (!destHospital) {
            return res.status(400).json({ success: false, message: 'Destination hospital not found' });
        }

        // Get ambulance info if provided
        let ambulanceInfo = {};
        if (ambulanceId) {
            const ambulance = await Ambulance.findOne({ driverId: ambulanceId });
            if (ambulance) {
                ambulanceInfo = {
                    ambulanceId: ambulance._id.toString(),
                    driverId: ambulance.driverId,
                    vehicleNumber: ambulance.vehicleNumbers[0],
                    driverName: ambulance.driverName,
                    contactNumber: ambulance.contactNumber
                };
            }
        }

        const corridor = await GreenCorridor.create({
            sourceHospital: {
                hospitalId: sourceHospital.hospitalId,
                name: sourceHospital.name,
                location: sourceHospital.location
            },
            destinationHospital: {
                hospitalId: destHospital.hospitalId,
                name: destHospital.name,
                location: destHospital.location
            },
            organType,
            urgencyLevel,
            ambulance: ambulanceInfo,
            doctorInCharge,
            notes,
            requestedBy: req.user._id
        });

        await AuditLog.create({
            action: 'CORRIDOR_CREATED',
            userId: req.user._id,
            corridorId: corridor.corridorId,
            details: { organType, urgencyLevel, source: sourceHospital.name, destination: destHospital.name },
            ipAddress: req.ip
        });

        // Emit WebSocket event
        const io = req.app.get('io');
        if (io) {
            io.to('control_room').emit('corridor_status', {
                type: 'NEW_REQUEST',
                corridor
            });
        }

        res.status(201).json({
            success: true,
            message: 'Green corridor request created',
            corridor
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/corridors
const getCorridors = async (req, res, next) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.user.role === 'HOSPITAL' && req.user.hospitalId) {
            filter.$or = [
                { 'sourceHospital.hospitalId': req.user.hospitalId },
                { 'destinationHospital.hospitalId': req.user.hospitalId }
            ];
        }

        const corridors = await GreenCorridor.find(filter)
            .sort({ createdAt: -1 })
            .populate('requestedBy', 'name email')
            .populate('approvedBy', 'name email');

        res.json({ success: true, corridors });
    } catch (error) {
        next(error);
    }
};

// GET /api/corridors/:id
const getCorridorById = async (req, res, next) => {
    try {
        const corridor = await GreenCorridor.findOne({ corridorId: req.params.id })
            .populate('requestedBy', 'name email')
            .populate('approvedBy', 'name email');

        if (!corridor) {
            return res.status(404).json({ success: false, message: 'Corridor not found' });
        }

        res.json({ success: true, corridor });
    } catch (error) {
        next(error);
    }
};

module.exports = { createCorridor, getCorridors, getCorridorById };
