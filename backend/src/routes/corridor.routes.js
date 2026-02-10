const router = require('express').Router();
const { createCorridor, getCorridors, getCorridorById } = require('../controllers/corridor.controller');
const auth = require('../middleware/auth.middleware');
const roleCheck = require('../middleware/roleCheck.middleware');
const { corridorValidation } = require('../middleware/validation.middleware');

router.post('/', auth, roleCheck('HOSPITAL', 'CONTROL_ROOM'), corridorValidation, createCorridor);
router.get('/', auth, getCorridors);
router.get('/:id', auth, getCorridorById);

module.exports = router;
