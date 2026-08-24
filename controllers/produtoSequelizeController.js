const Produto = require('../models/produtoSequelizeModel');

const validarProduto = (body) => {
    const nome = (body.nome || '').trim();
    const preco = parseFloat(body.preco);
    const peso_kg = parseFloat(body.peso_kg);
    const estoque = body.estoque === undefined || body.estoque === '' ? 0 : Number(body.estoque);

    if (!nome) return { erro: 'O nome do produto é obrigatório' };
    if (isNaN(preco) || preco <= 0) return { erro: 'O preço deve ser um número maior que zero' };
    if (isNaN(peso_kg) || peso_kg <= 0) return { erro: 'O peso (kg) deve ser um número maior que zero' };
    if (!Number.isInteger(estoque) || estoque < 0) return { erro: 'O estoque deve ser um número inteiro maior ou igual a zero' };

    return {
        dados: {
            nome,
            descricao: (body.descricao || '').trim() || null,
            preco,
            peso_kg,
            estoque,
        },
    };
};

const produtoController = {

    createProduto: async (req, res, next) => {
        try {
            const { dados, erro } = validarProduto(req.body);
            if (erro) {
                return res.status(400).render('produtos/create', { erro });
            }

            await Produto.create(dados);
            res.redirect('/produtos');
        } catch (err) {
            next(err);
        }
    },

    getProdutoById: async (req, res, next) => {
        try {
            const produto = await Produto.findByPk(req.params.id);

            if (!produto) {
                return res.status(404).render('404');
            }

            res.render('produtos/show', { produto });
        } catch (err) {
            next(err);
        }
    },

    getAllProdutos: async (req, res, next) => {
        try {
            const produtos = await Produto.findAll({
                order: [['nome', 'ASC']],
            });

            res.render('produtos/index', { produtos });
        } catch (err) {
            next(err);
        }
    },

    renderCreateForm: (req, res) => {
        res.render('produtos/create', { erro: null });
    },

    renderEditForm: async (req, res, next) => {
        try {
            const produto = await Produto.findByPk(req.params.id);

            if (!produto) {
                return res.status(404).render('404');
            }

            res.render('produtos/edit', { produto, erro: null });
        } catch (err) {
            next(err);
        }
    },

    updateProduto: async (req, res, next) => {
        try {
            const produto = await Produto.findByPk(req.params.id);

            if (!produto) {
                return res.status(404).render('404');
            }

            const { dados, erro } = validarProduto(req.body);
            if (erro) {
                return res.status(400).render('produtos/edit', { produto, erro });
            }

            await produto.update(dados);
            res.redirect('/produtos');
        } catch (err) {
            next(err);
        }
    },

    deleteProduto: async (req, res, next) => {
        try {
            const produto = await Produto.findByPk(req.params.id);
            if (produto) {
                try {
                    await produto.destroy();
                } catch (err) {
                    // FK RESTRICT: produto com histórico de pedidos não pode ser excluído
                    if (err.name && err.name.includes('ForeignKeyConstraintError')) {
                        return res.status(400).send('Não é possível excluir um produto que possui pedidos registrados');
                    }
                    throw err;
                }
            }

            res.redirect('/produtos');
        } catch (err) {
            next(err);
        }
    },
};

module.exports = produtoController;
