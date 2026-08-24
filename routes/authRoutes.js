const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
});

router.get('/login', authController.renderLoginForm);
router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);

module.exports = router;
