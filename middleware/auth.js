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

module.exports = { requireAuth };
