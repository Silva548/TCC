const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User } = require('../models');
const { parsePaginacao, metadados } = require('../utils/paginacao');
const { excedeTexto } = require('../utils/limites');

const ROLES_VALIDOS = ['admin', 'user'];

// Impede que o sistema fique sem nenhum administrador capaz de gerenciar usuários.
// Função externa (e não método do literal) porque o controller usa arrow functions,
// onde `this` não referencia o próprio objeto.
const contarAdmins = async (excluirId = null) => {
    const where = { role: 'admin' };
    if (excluirId !== null) {
        where.id = { [Op.ne]: excluirId };
    }
    return User.count({ where });
};

const userController = {
    renderCreateForm: (req, res) => {
        res.render('users/create', { erro: null, body: null });
    },

    createUser: async (req, res, next) => {
        try {
            const { username, password, role } = req.body;

            if (!username || !username.trim() || !password) {
                return res.status(400).render('users/create', {
                    erro: 'Usuário e senha são obrigatórios',
                    // `password` nunca é reenviado ao formulário
                    body: { username, role },
                });
            }

            const limite = excedeTexto('usuario', 'username', username.trim());
            if (limite) {
                return res.status(400).render('users/create', {
                    erro: limite,
                    body: { username, role },
                });
            }

            if (password.length < 6) {
                return res.status(400).render('users/create', {
                    erro: 'A senha deve ter no mínimo 6 caracteres',
                    body: { username, role },
                });
            }

            await User.create({
                username: username.trim(),
                password: await bcrypt.hash(password, 10),
                role: ROLES_VALIDOS.includes(role) ? role : 'user',
            });

            res.redirect('/users');
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).render('users/create', {
                    erro: 'Nome de usuário já cadastrado',
                    body: { username: req.body.username, role: req.body.role },
                });
            }
            next(err);
        }
    },

    getAllUsers: async (req, res, next) => {
        try {
            const pag = parsePaginacao(req.query);
            const { rows: users, count } = await User.findAndCountAll({
                order: [['username', 'ASC']],
                attributes: { exclude: ['password'] },
                limit: pag.limite,
                offset: pag.offset,
            });

            res.render('users/index', {
                users,
                paginacao: metadados(pag, count),
            });
        } catch (err) {
            next(err);
        }
    },

    getUserById: async (req, res, next) => {
        try {
            const user = await User.findByPk(req.params.id, {
                attributes: { exclude: ['password'] },
            });

            if (!user) {
                return res.status(404).render('404');
            }

            res.render('users/show', { user });
        } catch (err) {
            next(err);
        }
    },

    renderEditForm: async (req, res, next) => {
        try {
            const user = await User.findByPk(req.params.id, {
                attributes: { exclude: ['password'] },
            });

            if (!user) {
                return res.status(404).render('404');
            }

            res.render('users/edit', { user, erro: null, body: null });
        } catch (err) {
            next(err);
        }
    },

    updateUser: async (req, res, next) => {
        try {
            const userId = req.params.id;
            const user = await User.findByPk(userId);

            if (!user) {
                return res.status(404).render('404');
            }

            const { username, password, role } = req.body;
            // `password` nunca é reenviado ao formulário
            const body = { username, role };

            if (!username || !username.trim()) {
                return res.status(400).render('users/edit', {
                    user,
                    erro: 'O nome de usuário é obrigatório',
                    body,
                });
            }

            const limite = excedeTexto('usuario', 'username', username.trim());
            if (limite) {
                return res.status(400).render('users/edit', {
                    user,
                    erro: limite,
                    body,
                });
            }

            // Rebaixar o único admin deixaria o sistema sem gestão de usuários
            const rebaixandoUltimoAdmin = user.role === 'admin'
                && ROLES_VALIDOS.includes(role)
                && role !== 'admin'
                && (await contarAdmins(user.id)) === 0;

            if (rebaixandoUltimoAdmin) {
                return res.status(400).render('users/edit', {
                    user,
                    erro: 'Não é possível rebaixar o único administrador do sistema',
                    body,
                });
            }

            const dados = {
                username: username.trim(),
                role: ROLES_VALIDOS.includes(role) ? role : user.role,
            };

            // Só altera a senha se uma nova for informada
            if (password && password.trim() !== '') {
                if (password.length < 6) {
                    return res.status(400).render('users/edit', {
                        user,
                        erro: 'A nova senha deve ter no mínimo 6 caracteres',
                        body,
                    });
                }
                dados.password = await bcrypt.hash(password, 10);
            }

            await user.update(dados);
            res.redirect('/users');
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                // Re-busca a entidade completa: renderizar apenas { id } faria o
                // formulário voltar em branco
                const atual = await User.findByPk(req.params.id);
                return res.status(400).render('users/edit', {
                    user: atual || { id: req.params.id },
                    erro: 'Nome de usuário já cadastrado',
                    body: { username: req.body.username, role: req.body.role },
                });
            }
            next(err);
        }
    },

    deleteUser: async (req, res, next) => {
        try {
            // Impede que o usuário logado exclua a própria conta
            if (String(req.session.userId) === String(req.params.id)) {
                return res.status(400).send('Você não pode excluir sua própria conta enquanto está autenticado');
            }

            const user = await User.findByPk(req.params.id);
            if (!user) {
                return res.redirect('/users');
            }

            // Impede que o sistema fique sem nenhum administrador
            if (user.role === 'admin' && (await contarAdmins(user.id)) === 0) {
                return res.status(400).send('Não é possível excluir o único administrador do sistema');
            }

            await user.destroy();
            res.redirect('/users');
        } catch (err) {
            next(err);
        }
    },

    searchUsers: async (req, res, next) => {
        try {
            const raw = (req.query.search || '');
            const escaped = raw
                .replace(/\\/g, '\\\\')
                .replace(/%/g, '\\%')
                .replace(/_/g, '\\_');

            const pag = parsePaginacao(req.query);
            const { rows: users, count } = await User.findAndCountAll({
                where: {
                    username: {
                        [Op.iLike]: `%${escaped}%`,
                    },
                },
                attributes: { exclude: ['password'] },
                limit: pag.limite,
                offset: pag.offset,
            });

            res.json({ users, paginacao: metadados(pag, count) });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = userController;
