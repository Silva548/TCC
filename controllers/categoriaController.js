const Categoria = require('../models/categoriaModel');
const { parsePaginacao, metadados } = require('../utils/paginacao');

const categoriaController = {
    renderCreateForm: (req, res) => {
        res.render('categorias/create', { erro: null });
    },

    createCategoria: async (req, res, next) => {
        try {
            const nome = (req.body.nome || '').trim();

            if (!nome) {
                return res.status(400).render('categorias/create', { erro: 'O nome da categoria é obrigatório' });
            }

            await Categoria.create({ nome });
            res.redirect('/categorias');
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).render('categorias/create', { erro: 'Já existe uma categoria com esse nome' });
            }
            next(err);
        }
    },

    getAllCategorias: async (req, res, next) => {
        try {
            const pag = parsePaginacao(req.query);
            const { rows: categorias, count } = await Categoria.findAndCountAll({
                order: [['nome', 'ASC']],
                limit: pag.limite,
                offset: pag.offset,
            });

            res.render('categorias/index', {
                categorias,
                paginacao: metadados(pag, count),
            });
        } catch (err) {
            next(err);
        }
    },

    getCategoriaById: async (req, res, next) => {
        try {
            const categoria = await Categoria.findByPk(req.params.id);

            if (!categoria) {
                return res.status(404).render('404');
            }

            res.render('categorias/show', { categoria });
        } catch (err) {
            next(err);
        }
    },

    renderEditForm: async (req, res, next) => {
        try {
            const categoria = await Categoria.findByPk(req.params.id);

            if (!categoria) {
                return res.status(404).render('404');
            }

            res.render('categorias/edit', { categoria, erro: null });
        } catch (err) {
            next(err);
        }
    },

    updateCategoria: async (req, res, next) => {
        try {
            const categoria = await Categoria.findByPk(req.params.id);

            if (!categoria) {
                return res.status(404).render('404');
            }

            const nome = (req.body.nome || '').trim();

            if (!nome) {
                return res.status(400).render('categorias/edit', { categoria, erro: 'O nome da categoria é obrigatório' });
            }

            await categoria.update({ nome });
            res.redirect('/categorias');
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).render('categorias/edit', { categoria: { id: req.params.id }, erro: 'Já existe uma categoria com esse nome' });
            }
            next(err);
        }
    },

    deleteCategoria: async (req, res, next) => {
        try {
            const categoria = await Categoria.findByPk(req.params.id);
            if (categoria) {
                await categoria.destroy();
            }

            res.redirect('/categorias');
        } catch (err) {
            next(err);
        }
    },
};

module.exports = categoriaController;
