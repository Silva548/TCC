const bcrypt = require('bcryptjs');
const User = require('../models/userModel');

const authController = {
    renderLoginForm: (req, res) => {
        if (req.session.userId) {
            return res.redirect('/');
        }

        const erro = req.session.flashError || null;
        delete req.session.flashError;
        res.render('login', { erro });
    },

    login: async (req, res, next) => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                req.session.flashError = 'Informe usuário e senha';
                return res.redirect('/login');
            }

            const user = await User.findOne({ where: { username } });
            const senhaValida = user && await bcrypt.compare(password, user.password);

            if (!senhaValida) {
                req.session.flashError = 'Usuário ou senha inválidos';
                return res.redirect('/login');
            }

            // Regenera a sessão para prevenir session fixation,
            // mantendo o token CSRF válido
            const { csrfToken } = req.session;
            req.session.regenerate((err) => {
                if (err) {
                    return next(err);
                }
                req.session.csrfToken = csrfToken;
                req.session.userId = user.id;
                req.session.username = user.username;
                req.session.role = user.role;

                const destino = req.session.returnTo || '/';
                delete req.session.returnTo;
                res.redirect(destino);
            });
        } catch (err) {
            next(err);
        }
    },

    logout: (req, res) => {
        req.session.destroy(() => res.redirect('/login'));
    },
};

module.exports = authController;
