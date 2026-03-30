const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.post('/login', ctrl.login);
router.post('/logout', requireAuth, ctrl.logout);
router.get('/me', ctrl.me);

// User management — admin only
router.get('/users', requireAdmin, ctrl.getUsers);
router.post('/users', requireAdmin, ctrl.createUser);
router.put('/users/:id', requireAdmin, ctrl.updateUser);
router.delete('/users/:id', requireAdmin, ctrl.deleteUser);

module.exports = router;
