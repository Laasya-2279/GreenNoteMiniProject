const router = require('express').Router();
const { getActiveCorridors, getAlerts } = require('../controllers/public.controller');

router.get('/corridors/active', getActiveCorridors);
router.get('/alerts', getAlerts);

module.exports = router;
