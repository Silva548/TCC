const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');

// Hash dummy: garante tempo de resposta constante mesmo quando o usuário não existe,
// impedindo enumeração de usuários por análise de tempo
const HASH_DUMMY = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const authController = {
    renderLoginForm: (req, res) => {
        if (req.session.userId) {
            return res.redirect('/');
        }

        // Token CSRF gerado sob demanda (só quando o formulário é exibido),
        // evitando criar sessão em toda visita anônima
        if (!req.session.csrfToken) {
            req.session.csrfToken = crypto.randomBytes(32).toString('hex');
        }

        const erro = req.session.flashError || null;
        delete req.session.flashError;
        res.render('login', { erro, csrfToken: req.session.csrfToken });
    },

    login: async (req, res, next) => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                req.session.flashError = 'Informe usuário e senha';
                return res.redirect('/login');
            }

            const user = await User.findOne({ where: { username } });
            const senhaValida = await bcrypt.compare(password, (user && user.password) || HASH_DUMMY);

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
