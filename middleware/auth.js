const { ehJson, erro } = require('../utils/responder');

const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }

    if (ehJson(req)) {
        return res.status(401).json({ error: 'Não autenticado' });
    }

    // O destino vai na query em vez de na sessão: gravar req.session aqui
    // marcaria a sessão como modificada e o express-session persistiria um
    // registro para todo visitante anônimo que tomar 401, que é justamente o
    // que saveUninitialized:false existe para evitar.
    // O valor é revalidado em utils/redirect.js antes de virar Location
    // (originalUrl pode ser "//evil.com", request-target protocol-relative).
    const next_ = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?next=${next_}`);
};

// Reidrata a identidade do usuário a partir do banco, uma vez por requisição.
//
// Sem isso, `role` e `username` na sessão viram uma fotografia do momento do
// login. Rebaixar um admin (userController.updateUser) não alterava a sessão
// já aberta: ele continuava com role='admin' e requireRole o deixava gerenciar
// usuários pelo TTL inteiro da sessão (2h). O mesmo valia para um rename de
// username, que só apareceria na navbar após um novo login.
//
// Custo: um SELECT por requisição autenticada. Alternativas — invalidar as
// sessões na tabela "session" a cada mudança, ou versionar credenciais —
// trocam esse SELECT por consistência eventual; a leitura resolve na hora.
const carregarUsuario = async (req, res, next) => {
    const { User } = require('../models');
    const userId = req.session && req.session.userId;

    if (!userId) {
        return next();
    }

    try {
        const user = await User.findByPk(userId, { attributes: ['id', 'username', 'role'] });

        if (!user) {
            // Conta removida com a sessão ainda viva: derruba a sessão em vez de
            // deixar um requireAuth pro Based num userId que não existe mais.
            return req.session.destroy(() => {
                res.clearCookie('sessionId');
                if (ehJson(req)) {
                    return res.status(401).json({ error: 'Não autenticado' });
                }
                res.redirect('/login');
            });
        }

        req.session.username = user.username;
        req.session.role = user.role;
        next();
    } catch (err) {
        next(err);
    }
};

const requireRole = (role) => (req, res, next) => {
    if (!req.session || req.session.role !== role) {
        return erro(res, req, 403, 'Acesso restrito a administradores');
    }
    next();
};

module.exports = { requireAuth, requireRole, carregarUsuario };