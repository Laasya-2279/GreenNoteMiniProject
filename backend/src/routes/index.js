const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/corridors', require('./corridor.routes'));
router.use('/hospitals', require('./hospital.routes'));
router.use('/controlroom', require('./controlroom.routes'));
router.use('/ambulance', require('./ambulance.routes'));
router.use('/traffic', require('./traffic.routes'));
router.use('/public', require('./public.routes'));

// Route calculation & geocoding
const { calculateRoute, geocodeLocation, getSignalsOnRoute, getRoutesForCorridor } = require('../controllers/route.controller');
const auth = require('../middleware/auth.middleware');

router.post('/routes/calculate', auth, calculateRoute);
router.get('/routes/geocode', auth, geocodeLocation);
router.get('/signals/on-route', auth, getSignalsOnRoute);
router.get('/routes/:corridorId', auth, getRoutesForCorridor);

// Health check
router.get('/health', (req, res) => {
    res.json({ success: true, message: 'GreenNote API is running', timestamp: new Date() });
});

module.exports = router;
