const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }

    if (req.accepts(['html', 'json']) === 'json') {
        return res.status(401).json({ error: 'Não autenticado' });
    }

    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
};

const requireRole = (role) => (req, res, next) => {
    if (!req.session || req.session.role !== role) {
        const message = 'Acesso restrito a administradores';
        if (req.accepts(['html', 'json']) === 'json') {
            return res.status(403).json({ error: message });
        }
        return res.status(403).send(message);
    }
    next();
};

module.exports = { requireAuth, requireRole };
