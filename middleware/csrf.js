const crypto = require('crypto');

const csrfSetup = (req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
};

// Comparação em tempo constante para impedir timing attacks
const compararTokens = (recebido, esperado) => {
    if (typeof recebido !== 'string' || typeof esperado !== 'string') {
        return false;
    }

    // Token vazio jamais é válido
    if (recebido.length === 0 || esperado.length === 0) {
        return false;
    }

    const a = Buffer.from(recebido, 'utf8');
    const b = Buffer.from(esperado, 'utf8');

    if (a.length !== b.length) {
        // Queima o mesmo tempo antes de retornar
        crypto.timingSafeEqual(a, a);
        return false;
    }

    return crypto.timingSafeEqual(a, b);
};

const verifyCsrf = (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return next();
    }

    const token = req.body && req.body._csrf;
    if (!token || !req.session || !compararTokens(token, req.session.csrfToken)) {
        return res.status(403).send('Token CSRF inválido ou ausente');
    }

    next();
};

module.exports = { csrfSetup, verifyCsrf, compararTokens };
