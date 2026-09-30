const { Cliente, Pedido } = require('../models');
const { Op } = require('sequelize');
const { parsePaginacao, metadados } = require('../utils/paginacao');
const { excedeTexto } = require('../utils/limites');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIPOS_VALIDOS = ['B2C', 'B2B'];

const validarCliente = (body) => {
    const nome = (body.nome || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const documento = (body.documento || '').trim();
    const telefone = (body.telefone || '').trim();

    for (const campo of ['nome', 'email', 'documento', 'telefone']) {
        const limite = excedeTexto('cliente', campo, { nome, email, documento, telefone }[campo]);
        if (limite) return { erro: limite };
    }

    if (!nome) return { erro: 'O nome é obrigatório' };
    if (!email || !EMAIL_REGEX.test(email)) return { erro: 'Informe um e-mail válido' };
    if (!documento) return { erro: 'O documento é obrigatório' };

    return {
        dados: {
            nome,
            email,
            documento,
            telefone: telefone || null,
            tipo: TIPOS_VALIDOS.includes(body.tipo) ? body.tipo : 'B2C',
        },
    };
};

const clienteController = {

    createCliente: async (req, res, next) => {
        try {
            const { dados, erro } = validarCliente(req.body);
            if (erro) {
                return res.status(400).render('clientes/create', { erro, body: req.body });
            }

            await Cliente.create(dados);
            res.redirect('/clientes');
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).render('clientes/create', { erro: 'E-mail ou documento já cadastrado', body: req.body });
            }
            next(err);
        }
    },

    getClienteById: async (req, res, next) => {
        try {
            const cliente = await Cliente.findByPk(req.params.id, {
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
            const pag = parsePaginacao(req.query);
            const { rows: clientes, count } = await Cliente.findAndCountAll({
                order: [['nome', 'ASC']],
                limit: pag.limite,
                offset: pag.offset,
            });

            res.render('clientes/index', {
                clientes,
                paginacao: metadados(pag, count),
            });
        } catch (err) {
            next(err);
        }
    },

    renderCreateForm: (req, res) => {
        // `body` precisa existir: as views leem `body && body.campo` e o EJS
        // compila com with(locals), então uma referência a `body` fora das
        // locals cai no escopo global e lança ReferenceError (HTTP 500).
        res.render('clientes/create', { erro: null, body: null });
    },

    renderEditForm: async (req, res, next) => {
        try {
            const cliente = await Cliente.findByPk(req.params.id, {
            });

            if (!cliente) {
                return res.status(404).render('404');
            }

            res.render('clientes/edit', { cliente, erro: null, body: null });
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
                return res.status(400).render('clientes/edit', { cliente, erro, body: req.body });
            }

            await cliente.update(dados);
            res.redirect('/clientes');
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                // Re-busca a entidade completa: renderizar apenas { id } faria o
                // formulário voltar em branco e apagar o que o usuário digitou
                const atual = await Cliente.findByPk(req.params.id);
                return res.status(400).render('clientes/edit', {
                    cliente: atual || { id: req.params.id },
                    erro: 'E-mail ou documento já cadastrado',
                    body: req.body,
                });
            }
            next(err);
        }
    },

    deleteCliente: async (req, res, next) => {
        try {
            const cliente = await Cliente.findByPk(req.params.id);
            if (!cliente) {
                return res.status(404).render('404');
            }

            const pedidos = await Pedido.count({ where: { cliente_id: cliente.id } });
            if (pedidos > 0) {
                return res.status(400).send(
                    `Não é possível excluir este cliente: existem ${pedidos} pedido(s) vinculado(s). Cancele ou exclua os pedidos antes.`
                );
            }

            await cliente.destroy();
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

            const escaped = nome
                .replace(/\\/g, '\\\\')
                .replace(/%/g, '\\%')
                .replace(/_/g, '\\_');

            const pag = parsePaginacao(req.query);
            const { rows: clientes, count } = await Cliente.findAndCountAll({
                where: {
                    nome: {
                        [Op.iLike]: `%${escaped}%`,
                    },
                },
                limit: pag.limite,
                offset: pag.offset,
            });

            res.json({ clientes, paginacao: metadados(pag, count) });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = clienteController;
