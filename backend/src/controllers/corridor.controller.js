const GreenCorridor = require('../models/GreenCorridor');
const Hospital = require('../models/Hospital');
const Ambulance = require('../models/Ambulance');
const AuditLog = require('../models/AuditLog');
const { geocodePair } = require('../algorithms/geocodingService');
const { fetchRoutes } = require('../algorithms/osrmService');
const { evaluateRoutes } = require('../algorithms/emergencyCostEngine');
const Route = require('../models/Route');

// POST /api/corridors - Create green corridor request
// Accepts source/destination as hospital IDs OR location names
const createCorridor = async (req, res, next) => {
    try {
        const {
            destinationHospitalId, organType, urgencyLevel,
            ambulanceId, doctorInCharge, notes,
            sourceName, destinationName
        } = req.body;

        let sourceHospital, destHospital;

        // Option A: Hospital IDs provided (existing flow)
        if (req.body.sourceHospitalId || req.user.hospitalId) {
            sourceHospital = await Hospital.findOne({ hospitalId: req.body.sourceHospitalId || req.user.hospitalId });
            if (!sourceHospital) {
                return res.status(400).json({ success: false, message: 'Source hospital not found' });
            }
        }

        if (destinationHospitalId) {
            destHospital = await Hospital.findOne({ hospitalId: destinationHospitalId });
            if (!destHospital) {
                return res.status(400).json({ success: false, message: 'Destination hospital not found' });
            }
        }

        // Option B: Location names provided → geocode
        let geocodedSource, geocodedDest;
        if (sourceName && destinationName) {
            const geocoded = await geocodePair(sourceName, destinationName);
            geocodedSource = geocoded.source;
            geocodedDest = geocoded.destination;
        }

        // Build source/dest objects
        const srcData = sourceHospital ? {
            hospitalId: sourceHospital.hospitalId,
            name: sourceHospital.name,
            location: sourceHospital.location
        } : geocodedSource ? {
            hospitalId: 'GEOCODED',
            name: sourceName,
            location: {
                type: 'Point',
                coordinates: [geocodedSource.lng, geocodedSource.lat]
            }
        } : null;

        const destData = destHospital ? {
            hospitalId: destHospital.hospitalId,
            name: destHospital.name,
            location: destHospital.location
        } : geocodedDest ? {
            hospitalId: 'GEOCODED',
            name: destinationName,
            location: {
                type: 'Point',
                coordinates: [geocodedDest.lng, geocodedDest.lat]
            }
        } : null;

        if (!srcData || !destData) {
            return res.status(400).json({ success: false, message: 'Source and destination required (hospital IDs or location names)' });
        }

        // Get ambulance info if provided
        let ambulanceInfo = {};
        if (ambulanceId) {
            const ambulance = await Ambulance.findOne({ driverId: ambulanceId });
            if (ambulance) {
                ambulanceInfo = {
                    ambulanceId: ambulance._id.toString(),
                    driverId: ambulance.driverId,
                    vehicleNumber: ambulance.vehicleNumbers?.[0],
                    driverName: ambulance.driverName,
                    contactNumber: ambulance.contactNumber
                };
            }
        }

        // Fetch OSRM route & apply emergency cost
        const srcCoords = {
            lat: srcData.location.coordinates[1],
            lng: srcData.location.coordinates[0]
        };
        const destCoords = {
            lat: destData.location.coordinates[1],
            lng: destData.location.coordinates[0]
        };

        const osrmRoutes = await fetchRoutes(srcCoords, destCoords);
        const { bestRoute } = await evaluateRoutes(osrmRoutes, urgencyLevel || 'CRITICAL');

        // Create corridor with route embedded
        const corridor = await GreenCorridor.create({
            sourceHospital: srcData,
            destinationHospital: destData,
            organType,
            urgencyLevel,
            ambulance: ambulanceInfo,
            doctorInCharge,
            notes,
            requestedBy: req.user._id,
            selectedRoute: bestRoute ? {
                waypoints: bestRoute.waypoints,
                distance: bestRoute.distance,
                duration: bestRoute.duration,
                demoMode: bestRoute.demoMode
            } : undefined,
            predictedETA: bestRoute?.emergencyCost
        });

        // Save route to Route collection too
        if (bestRoute) {
            await Route.create({
                corridorId: corridor.corridorId,
                waypoints: bestRoute.waypoints,
                distance: bestRoute.distance,
                estimatedDuration: bestRoute.emergencyCost,
                routeType: 'PRIMARY',
                isSelected: true,
                trafficSignalsOnRoute: (bestRoute.signals || []).map(s => ({
                    signalId: s.id,
                    name: s.name,
                    location: { type: 'Point', coordinates: [s.position[1], s.position[0]] }
                }))
            });
        }

        await AuditLog.create({
            action: 'CORRIDOR_CREATED',
            userId: req.user._id,
            corridorId: corridor.corridorId,
            details: {
                organType, urgencyLevel,
                source: srcData.name, destination: destData.name,
                demoMode: bestRoute?.demoMode || false,
                emergencyCost: bestRoute?.emergencyCost
            },
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
            corridor,
            route: bestRoute ? {
                waypoints: bestRoute.waypoints,
                distance: bestRoute.distance,
                emergencyCost: bestRoute.emergencyCost,
                breakdown: bestRoute.breakdown,
                signals: bestRoute.signals,
                demoMode: bestRoute.demoMode
            } : null
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
