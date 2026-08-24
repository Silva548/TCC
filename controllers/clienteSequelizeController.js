const Cliente = require('../models/clienteModel');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIPOS_VALIDOS = ['B2C', 'B2B'];

const validarCliente = (body, { obrigarsSenha = false } = {}) => {
    const nome = (body.nome || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const documento = (body.documento || '').trim();

    if (!nome) return { erro: 'O nome é obrigatório' };
    if (!email || !EMAIL_REGEX.test(email)) return { erro: 'Informe um e-mail válido' };
    if (!documento) return { erro: 'O documento é obrigatório' };

    if (obrigarsSenha && (!body.senha || body.senha.length < 6)) {
        return { erro: 'A senha deve ter no mínimo 6 caracteres' };
    }

    if (body.senha && body.senha.length > 0 && body.senha.length < 6) {
        return { erro: 'A nova senha deve ter no mínimo 6 caracteres' };
    }

    return {
        dados: {
            nome,
            email,
            documento,
            telefone: (body.telefone || '').trim() || null,
            tipo: TIPOS_VALIDOS.includes(body.tipo) ? body.tipo : 'B2C',
        },
    };
};

const clienteController = {

    createCliente: async (req, res, next) => {
        try {
            const { dados, erro } = validarCliente(req.body, { obrigarsSenha: true });
            if (erro) {
                return res.status(400).render('clientes/create', { erro });
            }

            await Cliente.create({
                ...dados,
                senha: await bcrypt.hash(req.body.senha, 10),
            });

            res.redirect('/clientes');
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).render('clientes/create', { erro: 'E-mail ou documento já cadastrado' });
            }
            next(err);
        }
    },

    getClienteById: async (req, res, next) => {
        try {
            const cliente = await Cliente.findByPk(req.params.id, {
                attributes: { exclude: ['senha'] },
            });

            if (!cliente) {
                return res.status(404).render('404');
            }

            res.render('clientes/show', { cliente });
        } catch (err) {
            next(err);
        }
    },

    getAllClientes: async (req, res, next) => {
        try {
            const clientes = await Cliente.findAll({
                order: [['nome', 'ASC']],
                attributes: { exclude: ['senha'] },
            });

            res.render('clientes/index', { clientes });
        } catch (err) {
            next(err);
        }
    },

    renderCreateForm: (req, res) => {
        res.render('clientes/create', { erro: null });
    },

    renderEditForm: async (req, res, next) => {
        try {
            const cliente = await Cliente.findByPk(req.params.id, {
                attributes: { exclude: ['senha'] },
            });

            if (!cliente) {
                return res.status(404).render('404');
            }

            res.render('clientes/edit', { cliente, erro: null });
        } catch (err) {
            next(err);
        }
    },

    updateCliente: async (req, res, next) => {
        try {
            const clienteId = req.params.id;
            const cliente = await Cliente.findByPk(clienteId);

            if (!cliente) {
                return res.status(404).render('404');
            }

            const { dados, erro } = validarCliente(req.body);
            if (erro) {
                return res.status(400).render('clientes/edit', { cliente, erro });
            }

            // Só altera a senha se uma nova for informada
            if (req.body.senha && req.body.senha.trim() !== '') {
                dados.senha = await bcrypt.hash(req.body.senha, 10);
            }

            await cliente.update(dados);
            res.redirect('/clientes');
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).render('clientes/edit', { cliente: { id: req.params.id }, erro: 'E-mail ou documento já cadastrado' });
            }
            next(err);
        }
    },

    deleteCliente: async (req, res, next) => {
        try {
            const cliente = await Cliente.findByPk(req.params.id);
            if (cliente) {
                await cliente.destroy();
            }

            res.redirect('/clientes');
        } catch (err) {
            next(err);
        }
    },

    searchByName: async (req, res, next) => {
        try {
            const nome = (req.query.nome || '').trim();

            if (!nome) {
                return res.status(400).json({ error: 'Nome para busca é obrigatório' });
            }

            const clientes = await Cliente.findAll({
                where: {
                    nome: {
                        [Op.like]: `%${nome.replace(/[%_\\]/g, '')}%`,
                    },
                },
                attributes: { exclude: ['senha'] },
            });

            res.json(clientes);
        } catch (err) {
            next(err);
        }
    },
};

module.exports = clienteController;
