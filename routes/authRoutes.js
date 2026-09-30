const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');

const router = express.Router();

const LIMITE_PADRAO = 10;

// Configurável para que a suíte de integração possa exercitar vários fluxos de
// login sem ser barrada pelo próprio limitador que ela deveria testar
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.LOGIN_RATE_LIMIT) || LIMITE_PADRAO,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
});

router.get('/login', authController.renderLoginForm);
router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);

module.exports = router;
