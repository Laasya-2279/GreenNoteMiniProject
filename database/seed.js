const path = require('path');
const backendDir = path.join(__dirname, '..', 'backend');

// Load modules from backend's node_modules
const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
    try {
        return originalResolve.call(this, request, parent, ...args);
    } catch (e) {
        return originalResolve.call(this, request, { ...parent, paths: [path.join(backendDir, 'node_modules')] }, ...args);
    }
};

require('dotenv').config({ path: path.join(backendDir, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../backend/src/config/database');

// Models
const User = require('../backend/src/models/User');
const Hospital = require('../backend/src/models/Hospital');
const Ambulance = require('../backend/src/models/Ambulance');
const TrafficSignal = require('../backend/src/models/TrafficSignal');
const FederatedModel = require('../backend/src/models/FederatedModel');

const seedData = async () => {
    try {
        await connectDB();
        console.log('🌱 Starting seed...\n');

        // Clear existing data
        await Promise.all([
            User.deleteMany({}),
            Hospital.deleteMany({}),
            Ambulance.deleteMany({}),
            TrafficSignal.deleteMany({}),
            FederatedModel.deleteMany({})
        ]);
        console.log('✅ Cleared existing data');

        // 1. Create Hospitals (Kochi, India)
        const hospitals = await Hospital.insertMany([
            {
                hospitalId: 'H001',
                name: 'Lisie Hospital',
                address: 'Lisie Junction, Kochi, Kerala 682018',
                contactNumber: '+91-484-2402044',
                location: { type: 'Point', coordinates: [76.288166, 9.988078] },
                departments: ['Cardiology', 'Nephrology', 'Neurology', 'Transplant Surgery'],
                hasTransplantFacility: true
            },
            {
                hospitalId: 'H002',
                name: 'Aster Medcity',
                address: 'Kuttisahib Rd, Cheranalloor, Kochi, Kerala 682027',
                contactNumber: '+91-484-6699999',
                location: { type: 'Point', coordinates: [76.276458, 10.043952] },
                departments: ['Cardiology', 'Oncology', 'Transplant Surgery', 'Emergency'],
                hasTransplantFacility: true
            },
            {
                hospitalId: 'H003',
                name: 'Renai Medicity',
                address: 'Palarivattom, Kochi, Kerala 682025',
                contactNumber: '+91-484-2808000',
                location: { type: 'Point', coordinates: [76.277422, 10.006681] },
                departments: ['Urology', 'Nephrology', 'Cardiology', 'General Surgery'],
                hasTransplantFacility: true
            }
        ]);
        console.log(`✅ Created ${hospitals.length} hospitals`);

        // 2. Create Users
        const users = await User.create([
            {
                email: 'admin@greennote.com',
                password: 'admin@123',
                role: 'CONTROL_ROOM',
                name: 'Admin Control Room',
                phone: '+91-9876543210',
                isVerified: true,
                isActive: true
            },
            {
                email: 'hospital@demo.com',
                password: 'hospital@123',
                role: 'HOSPITAL',
                name: 'Dr. Rajesh Kumar',
                phone: '+91-9876543211',
                isVerified: true,
                isActive: true,
                hospitalId: 'H001'
            },
            {
                email: 'driver@demo.com',
                password: 'driver@123',
                role: 'AMBULANCE',
                name: 'Suresh Nair',
                phone: '+91-9876543212',
                isVerified: true,
                isActive: true
            },
            {
                email: 'traffic@demo.com',
                password: 'traffic@123',
                role: 'TRAFFIC',
                name: 'Inspector Vijay',
                phone: '+91-9876543213',
                isVerified: true,
                isActive: true
            },
            {
                email: 'public@demo.com',
                password: 'public@123',
                role: 'PUBLIC',
                name: 'John Public',
                phone: '+91-9876543214',
                isVerified: true,
                isActive: true
            }
        ]);
        console.log(`✅ Created ${users.length} users`);

        // 3. Create Ambulances
        const driverUser = users.find(u => u.role === 'AMBULANCE');
        const ambulances = await Ambulance.create([
            {
                driverId: 'DRV001',
                driverName: 'Suresh Nair',
                contactNumber: '+91-9876543212',
                email: 'driver@demo.com',
                drivingLicenseNumber: 'KL-01-2020-0012345',
                vehicleNumbers: ['KL-07-AE-1234', 'KL-07-AE-5678'],
                currentLocation: { type: 'Point', coordinates: [76.288166, 9.988078] },
                isAvailable: true,
                isOnDuty: false,
                userId: driverUser._id
            },
            {
                driverId: 'DRV002',
                driverName: 'Anil Menon',
                contactNumber: '+91-9876543220',
                email: 'anil@demo.com',
                drivingLicenseNumber: 'KL-01-2019-0054321',
                vehicleNumbers: ['KL-07-AF-9012'],
                currentLocation: { type: 'Point', coordinates: [76.276458, 10.043952] },
                isAvailable: true,
                isOnDuty: false
            }
        ]);
        console.log(`✅ Created ${ambulances.length} ambulances`);

        // 4. Create Traffic Signals
        const signals = await TrafficSignal.insertMany([
            {
                signalId: 'SIG001',
                name: 'Kaloor Junction',
                location: { type: 'Point', coordinates: [76.3014861, 9.9954740] },
                signalType: '4-way',
                zone: 'Kochi Central',
                isOperational: true,
                currentState: 'RED'
            },
            {
                signalId: 'SIG002',
                name: 'Palarivattom Signal',
                location: { type: 'Point', coordinates: [76.289544, 9.992308] },
                signalType: '4-way',
                zone: 'Kochi Central',
                isOperational: true,
                currentState: 'RED'
            },
            {
                signalId: 'SIG003',
                name: 'Edappally Junction',
                location: { type: 'Point', coordinates: [76.290310, 10.025730] },
                signalType: '4-way',
                zone: 'Kochi North',
                isOperational: true,
                currentState: 'RED'
            },
            {
                signalId: 'SIG004',
                name: 'Vyttila Junction',
                location: { type: 'Point', coordinates: [76.320580, 9.969430] },
                signalType: '4-way',
                zone: 'Kochi South',
                isOperational: true,
                currentState: 'GREEN'
            },
            {
                signalId: 'SIG005',
                name: 'MG Road Signal',
                location: { type: 'Point', coordinates: [76.288600, 9.983200] },
                signalType: 'T-junction',
                zone: 'Kochi Central',
                isOperational: true,
                currentState: 'RED'
            }
        ]);
        console.log(`✅ Created ${signals.length} traffic signals`);

        // 5. Create Federated Learning Model (initial)
        const model = await FederatedModel.create({
            version: 1,
            biases: { morning: 15, afternoon: 25, night: 5 },
            samples: { morning: 10, afternoon: 15, night: 5 },
            accuracy: { meanAbsoluteError: 12.5, meanSquaredError: 225, totalPredictions: 30 },
            isActive: true
        });
        console.log('✅ Created initial federated learning model');

        console.log('\n🎉 Seed completed successfully!\n');
        console.log('📋 Demo Credentials:');
        console.log('   Control Room: admin@greennote.com / admin@123');
        console.log('   Hospital:     hospital@demo.com / hospital@123');
        console.log('   Ambulance:    driver@demo.com / driver@123');
        console.log('   Traffic:      traffic@demo.com / traffic@123');
        console.log('   Public:       public@demo.com / public@123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seed error:', error);
        process.exit(1);
    }
};

seedData();
