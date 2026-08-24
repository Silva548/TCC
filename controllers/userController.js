const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
const { parsePaginacao, metadados } = require('../utils/paginacao');

const ROLES_VALIDOS = ['admin', 'user'];

const userController = {
    renderCreateForm: (req, res) => {
        res.render('users/create', { erro: null });
    },

    createUser: async (req, res, next) => {
        try {
            const { username, password, role } = req.body;

            if (!username || !username.trim() || !password) {
                return res.status(400).render('users/create', { erro: 'Usuário e senha são obrigatórios' });
            }
            if (password.length < 6) {
                return res.status(400).render('users/create', { erro: 'A senha deve ter no mínimo 6 caracteres' });
            }

            await User.create({
                username: username.trim(),
                password: await bcrypt.hash(password, 10),
                role: ROLES_VALIDOS.includes(role) ? role : 'user',
            });

            res.redirect('/users');
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).render('users/create', { erro: 'Nome de usuário já cadastrado' });
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

            res.render('users/edit', { user, erro: null });
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

            if (!username || !username.trim()) {
                return res.status(400).render('users/edit', { user, erro: 'O nome de usuário é obrigatório' });
            }

            const dados = {
                username: username.trim(),
                role: ROLES_VALIDOS.includes(role) ? role : user.role,
            };

            // Só altera a senha se uma nova for informada
            if (password && password.trim() !== '') {
                if (password.length < 6) {
                    return res.status(400).render('users/edit', { user, erro: 'A nova senha deve ter no mínimo 6 caracteres' });
                }
                dados.password = await bcrypt.hash(password, 10);
            }

            await user.update(dados);
            res.redirect('/users');
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).render('users/edit', { user: { id: req.params.id }, erro: 'Nome de usuário já cadastrado' });
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
            if (user) {
                await user.destroy();
            }

            res.redirect('/users');
        } catch (err) {
            next(err);
        }
    },

    searchUsers: async (req, res, next) => {
        try {
            const search = (req.query.search || '').replace(/[%_\\]/g, '');

            const users = await User.findAll({
                where: {
                    username: {
                        [require('sequelize').Op.like]: `%${search}%`,
                    },
                },
                attributes: { exclude: ['password'] },
            });

            res.json({ users });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = userController;
