const Cliente = require('../models/clienteModel');
const bcrypt = require('bcrypt');

const clienteController = {

    createCliente: async (req, res) => {
        try {
            const { nome, email, senha, documento, telefone, tipo } = req.body;

            // Validação básica
            if (!nome || !email || !senha || !documento) {
                return res.status(400).json({ 
                    error: 'Nome, email, senha e documento são obrigatórios' 
                });
            }

            // Hash da senha
            const senhaCriptografada = await bcrypt.hash(senha, 10);

            const novoCliente = {
                nome,
                email,
                senha: senhaCriptografada,
                documento,
                telefone: telefone || null,
                tipo: tipo || 'B2C',
            };

            await Cliente.create(novoCliente);
            res.redirect('/clientes');
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ 
                    error: 'Email ou documento já cadastrado' 
                });
            }
            return res.status(500).json({ error: err.message });
        }
    },

    getClienteById: async (req, res) => {
        try {
            const clienteId = req.params.id;

            const cliente = await Cliente.findByPk(clienteId);
            if (!cliente) {
                return res.status(404).json({ message: 'Cliente não encontrado' });
            }
            res.render('clientes/show', { cliente });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    getAllClientes: async (req, res) => {
        try {
            const clientes = await Cliente.findAll({
                order: [['nome', 'ASC']],
                attributes: { exclude: ['senha'] }, // Não retorna a senha
            });

            res.render('clientes/index', { clientes });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    renderCreateForm: (req, res) => {
        res.render('clientes/create');
    },

    renderEditForm: async (req, res) => {
        try {
            const clienteId = req.params.id;

            const cliente = await Cliente.findByPk(clienteId);
            if (!cliente) {
                return res.status(404).json({ message: 'Cliente não encontrado' });
            }

            res.render('clientes/edit', { cliente });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    updateCliente: async (req, res) => {
        try {
            const clienteId = req.params.id;

            const cliente = await Cliente.findByPk(clienteId);
            if (!cliente) {
                return res.status(404).json({ message: 'Cliente não encontrado' });
            }

            const { nome, email, documento, telefone, tipo } = req.body;

            const clienteAtualizado = {
                nome,
                email,
                documento,
                telefone: telefone || null,
                tipo,
            };

            // Se foi fornecida uma nova senha, criptografa
            if (req.body.senha && req.body.senha.trim() !== '') {
                clienteAtualizado.senha = await bcrypt.hash(req.body.senha, 10);
            }

            await cliente.update(clienteAtualizado);
            res.redirect('/clientes');
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ 
                    error: 'Email ou documento já cadastrado' 
                });
            }
            return res.status(500).json({ error: err.message });
        }
    },

    deleteCliente: async (req, res) => {
        try {
            const clienteId = req.params.id;

            const cliente = await Cliente.findByPk(clienteId);
            if (!cliente) {
                return res.status(404).json({ message: 'Cliente não encontrado' });
            }

            await cliente.destroy();
            res.redirect('/clientes');
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    searchByName: async (req, res) => {
        try {
            const { nome } = req.query;

            if (!nome) {
                return res.status(400).json({ error: 'Nome para busca é obrigatório' });
            }

            const clientes = await Cliente.findAll({
                where: {
                    nome: {
                        [require('sequelize').Op.like]: `%${nome}%`,
                    },
                },
                attributes: { exclude: ['senha'] },
            });

            res.json(clientes);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },
};

module.exports = clienteController;
