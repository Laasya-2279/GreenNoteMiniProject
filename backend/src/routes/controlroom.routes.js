const router = require('express').Router();
const {
    getPendingRequests, approveRequest, rejectRequest,
    getActiveCorridors, getAuditLogs
} = require('../controllers/controlroom.controller');
const auth = require('../middleware/auth.middleware');
const roleCheck = require('../middleware/roleCheck.middleware');

router.get('/requests', auth, roleCheck('CONTROL_ROOM'), getPendingRequests);
router.patch('/requests/:id/approve', auth, roleCheck('CONTROL_ROOM'), approveRequest);
router.patch('/requests/:id/reject', auth, roleCheck('CONTROL_ROOM'), rejectRequest);
router.get('/corridors/active', auth, roleCheck('CONTROL_ROOM'), getActiveCorridors);
router.get('/audit-logs', auth, roleCheck('CONTROL_ROOM'), getAuditLogs);

module.exports = router;
