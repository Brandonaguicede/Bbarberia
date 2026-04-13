const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/appointmentsController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/stats', requireAdmin, ctrl.getStats);
router.get('/available-slots', ctrl.getAvailableSlots);
router.get('/', requireAuth, ctrl.getAll);
router.get('/:id', requireAuth, ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', requireAdmin, ctrl.update);
router.patch('/:id/status', requireAdmin, ctrl.updateStatus);
router.delete('/:id', requireAdmin, ctrl.remove);

module.exports = router;
