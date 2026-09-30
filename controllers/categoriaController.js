const { Categoria } = require('../models');
const { parsePaginacao, metadados } = require('../utils/paginacao');
const { excedeTexto } = require('../utils/limites');
const { redirecionarComErro, erroDaUrl } = require('../utils/responder');
const { ehViolacaoDeChaveEstrangeira } = require('../utils/dbErros');

// Validação compartilhada entre create e update, para os dois caminhos
// recusarem o mesmo conjunto de entradas.
const validarNome = (body) => {
    const nome = (body.nome || '').trim();

    const limite = excedeTexto('categoria', 'nome', nome);
    if (limite) return { erro: limite };
    if (!nome) return { erro: 'O nome da categoria é obrigatório' };

    return { nome };
};

const categoriaController = {
    renderCreateForm: (req, res) => {
        res.render('categorias/create', { erro: null, body: null });
    },

    createCategoria: async (req, res, next) => {
        try {
            const { nome, erro } = validarNome(req.body);
            if (erro) {
                return res.status(400).render('categorias/create', { erro, body: req.body });
            }

            await Categoria.create({ nome });
            res.redirect('/categorias');
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).render('categorias/create', { erro: 'Já existe uma categoria com esse nome', body: req.body });
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
                erro: erroDaUrl(req),
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

            res.render('categorias/edit', { categoria, erro: null, body: null });
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

            const { nome, erro } = validarNome(req.body);
            if (erro) {
                return res.status(400).render('categorias/edit', { categoria, erro, body: req.body });
            }

            await categoria.update({ nome });
            res.redirect('/categorias');
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                // Re-busca a entidade completa: renderizar apenas { id } faria o
                // formulário voltar em branco
                const atual = await Categoria.findByPk(req.params.id);
                return res.status(400).render('categorias/edit', {
                    categoria: atual || { id: req.params.id },
                    erro: 'Já existe uma categoria com esse nome',
                    body: req.body,
                });
            }
            next(err);
        }
    },

    deleteCategoria: async (req, res, next) => {
        try {
            const categoria = await Categoria.findByPk(req.params.id);
            if (categoria) {
                try {
                    await categoria.destroy();
                } catch (err) {
                    if (ehViolacaoDeChaveEstrangeira(err)) {
                        return redirecionarComErro(
                            res,
                            '/categorias',
                            'Não é possível excluir esta categoria: existem produtos vinculados. Altere a categoria dos produtos antes.'
                        );
                    }
                    throw err;
                }
            }

            res.redirect('/categorias');
        } catch (err) {
            next(err);
        }
    },
};

module.exports = categoriaController;
