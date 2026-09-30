const { Produto, Categoria } = require('../models');
const { parsePaginacao, metadados } = require('../utils/paginacao');
const { excedeTexto, excedeDecimal } = require('../utils/limites');

const validarProduto = (body) => {
    const nome = (body.nome || '').trim();
    const preco = parseFloat(body.preco);
    const peso_kg = parseFloat(body.peso_kg);
    const estoque = body.estoque === undefined || body.estoque === '' ? 0 : Number(body.estoque);
    const categoriaRaw = (body.categoria_id || '').trim();

    const limite = excedeTexto('produto', 'nome', nome);
    if (limite) return { erro: limite };

    if (!nome) return { erro: 'O nome do produto é obrigatório' };
    if (isNaN(preco) || preco <= 0) return { erro: 'O preço deve ser um número maior que zero' };
    if (isNaN(peso_kg) || peso_kg <= 0) return { erro: 'O peso (kg) deve ser um número maior que zero' };
    if (!Number.isInteger(estoque) || estoque < 0) return { erro: 'O estoque deve ser um número inteiro maior ou igual a zero' };

    const limiteDecimal = excedeDecimal('preco', preco) || excedeDecimal('peso_kg', peso_kg);
    if (limiteDecimal) return { erro: limiteDecimal };

    // Categoria é opcional; string vazia significa "Sem categoria"
    let categoria_id = null;
    if (categoriaRaw !== '') {
        categoria_id = Number(categoriaRaw);
        if (!Number.isInteger(categoria_id) || categoria_id < 1) {
            return { erro: 'Categoria inválida' };
        }
    }

    return {
        dados: {
            nome,
            descricao: (body.descricao || '').trim() || null,
            preco,
            peso_kg,
            estoque,
            categoria_id,
        },
    };
};

// Carrega as categorias para popular o <select> dos formulários
const listarCategorias = () => Categoria.findAll({ order: [['nome', 'ASC']] });

const produtoController = {

    createProduto: async (req, res, next) => {
        try {
            const { dados, erro } = validarProduto(req.body);
            if (erro) {
                const categorias = await listarCategorias();
                return res.status(400).render('produtos/create', { erro, categorias, body: req.body });
            }

            await Produto.create(dados);
            res.redirect('/produtos');
        } catch (err) {
            if (err.name === 'SequelizeForeignKeyConstraintError') {
                const categorias = await listarCategorias();
                return res.status(400).render('produtos/create', {
                    erro: 'A categoria informada não existe',
                    categorias,
                    body: req.body,
                });
            }
            next(err);
        }
    },

    getProdutoById: async (req, res, next) => {
        try {
            const produto = await Produto.findByPk(req.params.id, {
                include: [{ model: Categoria, as: 'Categoria', attributes: ['id', 'nome'] }],
            });

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
            const pag = parsePaginacao(req.query);
            const where = {};

            // Filtro por categoria; categoria_id precisa ser inteiro positivo
            if (req.query.categoria_id) {
                const categoria_id = Number(req.query.categoria_id);
                if (!Number.isInteger(categoria_id) || categoria_id < 1) {
                    throw Object.assign(new Error('Categoria inválida'), { status: 400 });
                }
                where.categoria_id = categoria_id;
            }

            const { rows: produtos, count } = await Produto.findAndCountAll({
                where,
                include: [{ model: Categoria, as: 'Categoria', attributes: ['id', 'nome'] }],
                order: [['nome', 'ASC']],
                limit: pag.limite,
                offset: pag.offset,
            });

            const categorias = await listarCategorias();

            res.render('produtos/index', {
                produtos,
                categorias,
                categoriaFiltro: req.query.categoria_id || '',
                paginacao: metadados(pag, count),
            });
        } catch (err) {
            next(err);
        }
    },

    renderCreateForm: async (req, res, next) => {
        try {
            res.render('produtos/create', {
                erro: null,
                categorias: await listarCategorias(),
                body: null,
            });
        } catch (err) {
            next(err);
        }
    },

    renderEditForm: async (req, res, next) => {
        try {
            const produto = await Produto.findByPk(req.params.id);

            if (!produto) {
                return res.status(404).render('404');
            }

            res.render('produtos/edit', {
                produto,
                categorias: await listarCategorias(),
                erro: null,
                body: null,
            });
        } catch (err) {
            next(err);
        }
    },

    updateProduto: async (req, res, next) => {
        // Declarado fora do try para ser acessível no catch
        let produto = null;

        try {
            produto = await Produto.findByPk(req.params.id);

            if (!produto) {
                return res.status(404).render('404');
            }

            const { dados, erro } = validarProduto(req.body);
            if (erro) {
                return res.status(400).render('produtos/edit', {
                    produto,
                    categorias: await listarCategorias(),
                    erro,
                    body: req.body,
                });
            }

            await produto.update(dados);
            res.redirect('/produtos');
        } catch (err) {
            if (err.name === 'SequelizeForeignKeyConstraintError') {
                const atual = produto || await Produto.findByPk(req.params.id);
                return res.status(400).render('produtos/edit', {
                    produto: atual,
                    categorias: await listarCategorias(),
                    erro: 'A categoria informada não existe',
                    body: req.body,
                });
            }
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
