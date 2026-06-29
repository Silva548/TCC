const Produto = require('../models/produtoSequelizeModel');

const produtoController = {

    createProduto: async (req, res) => {
        try {
            const newProduto = {
                nome: req.body.nome,
                descricao: req.body.descricao,
                preco: req.body.preco,
                peso_kg: req.body.peso_kg,
                estoque: req.body.estoque || 0,
            };

            await Produto.create(newProduto);
            res.redirect('/produtos');
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    getProdutoById: async (req, res) => {
        try {
            const produtoId = req.params.id;

            const produto = await Produto.findByPk(produtoId);
            if (!produto) {
                return res.status(404).json({ message: 'Produto não encontrado' });
            }
            res.render('produtos/show', { produto });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    getAllProdutos: async (req, res) => {
        try {
            const produtos = await Produto.findAll({
                order: [['nome', 'ASC']],
            });

            res.render('produtos/index', { produtos });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    renderCreateForm: (req, res) => {
        res.render('produtos/create');
    },

    renderEditForm: async (req, res) => {
        try {
            const produtoId = req.params.id;

            const produto = await Produto.findByPk(produtoId);
            if (!produto) {
                return res.status(404).json({ message: 'Produto não encontrado' });
            }

            res.render('produtos/edit', { produto });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    updateProduto: async (req, res) => {
        try {
            const produtoId = req.params.id;

            const produto = await Produto.findByPk(produtoId);
            if (!produto) {
                return res.status(404).json({ message: 'Produto não encontrado' });
            }

            // Validação: impedir que o estoque fique negativo
            const novoEstoque = parseInt(req.body.estoque);
            if (novoEstoque < 0) {
                return res.status(400).json({ 
                    error: 'O estoque não pode ser negativo' 
                });
            }

            const updatedProduto = {
                nome: req.body.nome,
                descricao: req.body.descricao,
                preco: req.body.preco,
                peso_kg: req.body.peso_kg,
                estoque: novoEstoque,
            };

            await produto.update(updatedProduto);
            res.redirect('/produtos');
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    deleteProduto: async (req, res) => {
        try {
            const produtoId = req.params.id;

            const produto = await Produto.findByPk(produtoId);
            if (!produto) {
                return res.status(404).json({ message: 'Produto não encontrado' });
            }

            await produto.destroy();
            res.redirect('/produtos');
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },
};

module.exports = produtoController;
