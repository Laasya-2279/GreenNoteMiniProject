const router = require('express').Router();
const { sendGPSUpdate, getCorridorForDriver, startCorridor, completeCorridor } = require('../controllers/ambulance.controller');
const auth = require('../middleware/auth.middleware');
const roleCheck = require('../middleware/roleCheck.middleware');

router.post('/gps', auth, roleCheck('AMBULANCE'), sendGPSUpdate);
router.get('/corridor/:id', auth, roleCheck('AMBULANCE', 'CONTROL_ROOM'), getCorridorForDriver);
router.post('/start/:id', auth, roleCheck('AMBULANCE'), startCorridor);
router.post('/complete/:id', auth, roleCheck('AMBULANCE'), completeCorridor);

module.exports = router;
