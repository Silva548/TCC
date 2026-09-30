// Camada HTML de /pedidos. Atende o mesmo path da API JSON: quem decide o
// formato é routes/pedidoRoutes.js, via req.respostaJson.
//
// Não duplica regra de negócio — criar/mudar status/excluir delegam ao mesmo
// services/pedidoService.js usado pela API.

const { Pedido, ItemPedido, Cliente, Produto } = require('../models');
const { Op } = require('sequelize');
// A formatação (moeda, data, rótulo de status) fica em app.locals.formatadores
// e é usada pelas views; o controller não precisa dela.
const { STATUS_VALIDOS, FORMAS_PAGAMENTO, TRANSICOES_STATUS } = require('../utils/pedidoRules');
const { parsePaginacao, metadados } = require('../utils/paginacao');
const { criarPedido, mudarStatus, excluirPedido, normalizarItens, itensDoFormulario } = require('../services/pedidoService');

// Linhas fixas do formulário: o usuário preenche só o que precisa, sem
// JavaScript. Seis é o suficiente para a maioria dos pedidos e mantém a
// página utilizável no celular.
const LINHAS_ITEM = 6;

const ordemItens = (itens = []) =>
    [...itens].sort((a, b) => (a.produto_id || 0) - (b.produto_id || 0));

// Recarrega os <select> do formulário. Chamado tanto no primeiro acesso
// quanto ao reenviar o form com erro, para o usuário não perder as opções.
const opcoesDoFormulario = async () => {
    const [clientes, produtos] = await Promise.all([
        Cliente.findAll({ order: [['nome', 'ASC']], attributes: ['id', 'nome'] }),
        // Produto sem estoque não aparece: selecioná-lo só produziria erro de
        // "estoque insuficiente" na submissão.
        Produto.findAll({
            where: { estoque: { [Op.gt]: 0 } },
            order: [['nome', 'ASC']],
            attributes: ['id', 'nome', 'preco', 'estoque'],
        }),
    ]);

    return { clientes, produtos, formasPagamento: FORMAS_PAGAMENTO, linhasItem: LINHAS_ITEM };
};

// Mensagens de retorno por query string, em vez de sessão de flash: o app não
// tem middleware de flash e criar um só para isto seria mais código do que a
// própria mensagem. As chaves são fixas (nunca o texto), então o valor
// interpolado na view vem de uma lista fechada.
const AVISOS = {
    criado: 'Pedido criado com sucesso.',
    atualizado: 'Status do pedido atualizado.',
    excluido: 'Pedido excluído.',
};

const avisoDaUrl = (req) => AVISOS[req.query.msg] || null;

const erroDaUrl = (req) => (typeof req.query.erro === 'string' && req.query.erro ? req.query.erro : null);

const pedidoViewController = {

    index: async (req, res, next) => {
        try {
            const status = STATUS_VALIDOS.includes(req.query.status) ? req.query.status : null;
            const where = status ? { status } : {};
            const pag = parsePaginacao(req.query);

            const { rows: pedidos, count: total } = await Pedido.findAndCountAll({
                where,
                include: [{ model: Cliente, attributes: ['nome'] }],
                order: [['data', 'DESC']],
                limit: pag.limite,
                offset: pag.offset,
                distinct: true,
            });

            res.render('pedidos/index', {
                pedidos,
                statusFiltro: status,
                statusValidos: STATUS_VALIDOS,
                paginacao: metadados(pag, total),
                caminhoBase: '/pedidos',
                queryExtra: status ? `&status=${encodeURIComponent(status)}` : '',
                aviso: avisoDaUrl(req),
            });
        } catch (err) {
            next(err);
        }
    },

    newForm: async (req, res, next) => {
        try {
            const opcoes = await opcoesDoFormulario();
            res.render('pedidos/new', { erro: null, body: {}, itensPreenchidos: [], ...opcoes });
        } catch (err) {
            next(err);
        }
    },

    create: async (req, res, next) => {
        try {
            const { cliente_id, forma_pagamento } = req.body;
            const itens = normalizarItens(req.body);

            const pedido = await criarPedido({ cliente_id, forma_pagamento, itens });

            res.redirect(`/pedidos/${pedido.id}?msg=criado`);
        } catch (err) {
            // Erro de validação volta para o formulário com o que o usuário
            // já digitou; erro de infraestrutura sobe para o handler global.
            if (!err.status || err.status >= 500) {
                return next(err);
            }

            // Se a própria leitura das linhas falhar (metade preenchida), o
            // formulário volta vazio em vez de quebrar: o erro do pedido já
            // explica o problema.
            const itens = (() => {
                try {
                    return itensDoFormulario(req.body);
                } catch {
                    return [];
                }
            })();

            const opcoes = await opcoesDoFormulario();
            res.status(err.status).render('pedidos/new', {
                erro: err.message,
                body: req.body,
                itensPreenchidos: itens,
                ...opcoes,
            });
        }
    },

    show: async (req, res, next) => {
        try {
            const pedido = await Pedido.findByPk(req.params.id, {
                include: [
                    { model: Cliente, attributes: ['id', 'nome'] },
                    { model: ItemPedido, include: [Produto] },
                ],
            });

            if (!pedido) {
                return res.status(404).render('404');
            }

            res.render('pedidos/show', {
                pedido,
                itens: ordemItens(pedido.ItemPedidos),
                // Só as transições permitidas entram no formulário: oferecer
                // "entregue" a partir de "pendente" só geraria erro de validação.
                proximosStatus: TRANSICOES_STATUS[pedido.status] || [],
                aviso: avisoDaUrl(req),
                erro: erroDaUrl(req),
            });
        } catch (err) {
            next(err);
        }
    },

    mudarStatus: async (req, res, next) => {
        try {
            await mudarStatus(req.params.id, req.body.status);
            res.redirect(`/pedidos/${req.params.id}?msg=atualizado`);
        } catch (err) {
            if (!err.status || err.status >= 500) {
                return next(err);
            }

            // Reexibe o pedido com o motivo da recusa, em vez de redirecionar
            // para a lista e perder o contexto.
            const pedido = await Pedido.findByPk(req.params.id, {
                include: [
                    { model: Cliente, attributes: ['id', 'nome'] },
                    { model: ItemPedido, include: [Produto] },
                ],
            });

            if (!pedido) {
                return res.status(404).render('404');
            }

            res.status(err.status).render('pedidos/show', {
                pedido,
                itens: ordemItens(pedido.ItemPedidos),
                proximosStatus: TRANSICOES_STATUS[pedido.status] || [],
                erro: err.message,
            });
        }
    },

    excluir: async (req, res, next) => {
        try {
            await excluirPedido(req.params.id);
            res.redirect('/pedidos?msg=excluido');
        } catch (err) {
            if (!err.status || err.status >= 500) {
                return next(err);
            }
            res.redirect(`/pedidos/${req.params.id}?erro=${encodeURIComponent(err.message)}`);
        }
    },
};

module.exports = pedidoViewController;
module.exports.LINHAS_ITEM = LINHAS_ITEM;
module.exports.ordemItens = ordemItens;
