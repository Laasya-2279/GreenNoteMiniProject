const router = require('express').Router();
const { getActiveCorridors, getSignals, overrideSignal, restoreSignal } = require('../controllers/traffic.controller');
const auth = require('../middleware/auth.middleware');
const roleCheck = require('../middleware/roleCheck.middleware');

router.get('/corridors/active', auth, roleCheck('TRAFFIC', 'CONTROL_ROOM'), getActiveCorridors);
router.get('/signals', auth, roleCheck('TRAFFIC', 'CONTROL_ROOM'), getSignals);
router.patch('/signals/:id', auth, roleCheck('TRAFFIC', 'CONTROL_ROOM'), overrideSignal);
router.patch('/signals/:id/restore', auth, roleCheck('TRAFFIC', 'CONTROL_ROOM'), restoreSignal);

module.exports = router;
