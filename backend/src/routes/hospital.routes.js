const router = require('express').Router();
const { getHospitals, getHospitalById, getAmbulances } = require('../controllers/hospital.controller');
const auth = require('../middleware/auth.middleware');

router.get('/', auth, getHospitals);
router.get('/ambulances', auth, getAmbulances);
router.get('/:id', auth, getHospitalById);

module.exports = router;
