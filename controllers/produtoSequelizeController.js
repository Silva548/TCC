const { Produto, Categoria } = require('../models');
const { parsePaginacao, metadados } = require('../utils/paginacao');
const { excedeTexto, excedeDecimal } = require('../utils/limites');
const { redirecionarComErro, erroDaUrl } = require('../utils/responder');
const { ehViolacaoDeChaveEstrangeira } = require('../utils/dbErros');

// Linhas de embalagem e pesos oferecidos nos filtros da listagem. São listas
// fechadas: qualquer valor fora delas é recusado com 400, em vez de virar um
// WHERE que não casa com nada.
const EMBALAGENS = ['premium', 'basica'];
const PESOS_DISPONIVEIS = [5, 3];

const validarProduto = (body) => {
    const nome = (body.nome || '').trim();
    const preco_entrega = parseFloat(body.preco_entrega);
    const preco_retirada = parseFloat(body.preco_retirada);
    const embalagem = (body.embalagem || '').trim();
    const peso_kg = parseFloat(body.peso_kg);
    const estoque = body.estoque === undefined || body.estoque === '' ? 0 : Number(body.estoque);
    const categoriaRaw = (body.categoria_id || '').trim();

    const limite = excedeTexto('produto', 'nome', nome) || excedeTexto('produto', 'embalagem', embalagem);
    if (limite) return { erro: limite };

    if (!nome) return { erro: 'O nome do produto é obrigatório' };
    if (isNaN(preco_entrega) || preco_entrega <= 0) return { erro: 'O preço de entrega deve ser um número maior que zero' };
    if (isNaN(preco_retirada) || preco_retirada <= 0) return { erro: 'O preço de retirada deve ser um número maior que zero' };
    if (!EMBALAGENS.includes(embalagem)) return { erro: 'A embalagem deve ser premium ou basica' };
    if (isNaN(peso_kg) || peso_kg <= 0) return { erro: 'O peso (kg) deve ser um número maior que zero' };
    if (!Number.isInteger(estoque) || estoque < 0) return { erro: 'O estoque deve ser um número inteiro maior ou igual a zero' };

    const limiteDecimal =
        excedeDecimal('preco_entrega', preco_entrega) ||
        excedeDecimal('preco_retirada', preco_retirada) ||
        excedeDecimal('peso_kg', peso_kg);
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
            preco_entrega,
            preco_retirada,
            embalagem,
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
            if (ehViolacaoDeChaveEstrangeira(err)) {
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

            // Filtro por linha de embalagem (premium/basica)
            if (req.query.embalagem) {
                if (!EMBALAGENS.includes(req.query.embalagem)) {
                    throw Object.assign(new Error('Embalagem inválida'), { status: 400 });
                }
                where.embalagem = req.query.embalagem;
            }

            // Filtro por peso (5kg ou 3kg)
            if (req.query.peso_kg) {
                const peso = Number(req.query.peso_kg);
                if (!Number.isFinite(peso) || peso <= 0) {
                    throw Object.assign(new Error('Peso inválido'), { status: 400 });
                }
                where.peso_kg = peso;
            }

            const { rows: produtos, count } = await Produto.findAndCountAll({
                where,
                include: [{ model: Categoria, as: 'Categoria', attributes: ['id', 'nome'] }],
                order: [['nome', 'ASC']],
                limit: pag.limite,
                offset: pag.offset,
            });

            const categorias = await listarCategorias();

            // Preserva os filtros ativos ao trocar de página.
            const params = new URLSearchParams();
            if (req.query.categoria_id) params.set('categoria_id', req.query.categoria_id);
            if (req.query.embalagem) params.set('embalagem', req.query.embalagem);
            if (req.query.peso_kg) params.set('peso_kg', req.query.peso_kg);
            const queryExtra = params.toString() ? `&${params.toString()}` : '';

            res.render('produtos/index', {
                produtos,
                categorias,
                embalagens: EMBALAGENS,
                pesosDisponiveis: PESOS_DISPONIVEIS,
                categoriaFiltro: req.query.categoria_id || '',
                embalagemFiltro: req.query.embalagem || '',
                pesoFiltro: req.query.peso_kg || '',
                paginacao: metadados(pag, count),
                queryExtra,
                erro: erroDaUrl(req),
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
            if (ehViolacaoDeChaveEstrangeira(err)) {
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
                    if (ehViolacaoDeChaveEstrangeira(err)) {
                        return redirecionarComErro(
                            res,
                            '/produtos',
                            'Não é possível excluir um produto que possui pedidos registrados'
                        );
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
