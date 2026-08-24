const crypto = require('crypto');

const csrfSetup = (req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
};

const verifyCsrf = (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return next();
    }

    const token = req.body && req.body._csrf;
    if (!token || !req.session || token !== req.session.csrfToken) {
        return res.status(403).send('Token CSRF inválido ou ausente');
    }

    next();
};

module.exports = { csrfSetup, verifyCsrf };
