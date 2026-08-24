const Pedido = require('../models/pedidoModel');
const ItemPedido = require('../models/itemPedidoModel');
const Cliente = require('../models/clienteModel');
const Produto = require('../models/produtoSequelizeModel');
const sequelize = require('../config/db');
const { Op, fn, col } = require('sequelize');
const { STATUS_VALIDOS, FORMAS_PAGAMENTO, transicaoValida, calcularTotalCentavos } = require('../utils/pedidoRules');
const { parsePaginacao, metadados } = require('../utils/paginacao');

const falha = (status, message) => Object.assign(new Error(message), { status });

const devolverEstoque = async (pedidoId, t) => {
    const itens = await ItemPedido.findAll({ where: { pedido_id: pedidoId }, transaction: t });
    for (const item of itens) {
        const produto = await Produto.findByPk(item.produto_id, { transaction: t, lock: t.LOCK.UPDATE });
        if (produto) {
            await produto.increment('estoque', { by: item.quantidade, transaction: t });
        }
    }
};

const pedidoController = {

    createPedido: async (req, res, next) => {
        try {
            const { cliente_id, forma_pagamento, itens } = req.body;

            if (!cliente_id || !forma_pagamento) {
                throw falha(400, 'cliente_id e forma_pagamento são obrigatórios');
            }

            if (!FORMAS_PAGAMENTO.includes(forma_pagamento)) {
                throw falha(400, 'Forma de pagamento inválida. Use: ' + FORMAS_PAGAMENTO.join(', '));
            }

            if (!Array.isArray(itens) || itens.length === 0) {
                throw falha(400, 'O pedido deve ter pelo menos um item');
            }

            // Normaliza as quantidades uma única vez
            for (const item of itens) {
                item.quantidade = Number(item.quantidade);
                if (!Number.isInteger(item.quantidade) || item.quantidade < 1) {
                    throw falha(400, 'A quantidade de cada item deve ser um número inteiro maior que zero');
                }
                if (!Number.isInteger(Number(item.produto_id))) {
                    throw falha(400, 'produto_id inválido');
                }
            }

            // Transação garante consistência entre pedido, itens e estoque
            const t = await sequelize.transaction();
            try {
                const cliente = await Cliente.findByPk(cliente_id, { transaction: t, lock: t.LOCK.UPDATE });
                if (!cliente) {
                    throw falha(404, 'Cliente não encontrado');
                }

                const produtos = [];

                for (const item of itens) {
                    // Lock pessimista impede venda concorrente além do estoque
                    const produto = await Produto.findByPk(item.produto_id, { transaction: t, lock: t.LOCK.UPDATE });
                    if (!produto) {
                        throw falha(404, `Produto ${item.produto_id} não encontrado`);
                    }

                    if (produto.estoque < item.quantidade) {
                        throw falha(400, `Estoque insuficiente para ${produto.nome}`);
                    }

                    produtos.push(produto);
                }

                // Total calculado em centavos e convertido de volta para decimal
                const valor_total = calcularTotalCentavos(itens, produtos) / 100;

                const novoPedido = await Pedido.create({
                    cliente_id,
                    forma_pagamento,
                    valor_total,
                    status: 'pendente',
                }, { transaction: t });

                for (let i = 0; i < itens.length; i++) {
                    await ItemPedido.create({
                        pedido_id: novoPedido.id,
                        produto_id: itens[i].produto_id,
                        quantidade: itens[i].quantidade,
                        preco_unitario: produtos[i].preco,
                    }, { transaction: t });

                    await produtos[i].decrement('estoque', { by: itens[i].quantidade, transaction: t });
                }

                await t.commit();

                res.status(201).json({
                    message: 'Pedido criado com sucesso',
                    pedido: novoPedido,
                });
            } catch (err) {
                await t.rollback();
                throw err;
            }
        } catch (err) {
            next(err);
        }
    },

    getPedidoById: async (req, res, next) => {
        try {
            const pedido = await Pedido.findByPk(req.params.id, {
                include: [
                    {
                        model: Cliente,
                        attributes: { exclude: ['senha'] },
                    },
                    {
                        model: ItemPedido,
                        include: [Produto],
                    },
                ],
            });

            if (!pedido) {
                return res.status(404).json({ message: 'Pedido não encontrado' });
            }

            res.json(pedido);
        } catch (err) {
            next(err);
        }
    },

    getAllPedidos: async (req, res, next) => {
        try {
            const { status, cliente_id } = req.query;
            const where = {};

            if (status) where.status = status;
            if (cliente_id) where.cliente_id = cliente_id;

            const pag = parsePaginacao(req.query);

            const { rows: pedidos, count: total } = await Pedido.findAndCountAll({
                where,
                include: [
                    {
                        model: Cliente,
                        attributes: { exclude: ['senha'] },
                    },
                ],
                order: [['data', 'DESC']],
                limit: pag.limite,
                offset: pag.offset,
                distinct: true,
            });

            res.json({
                pedidos,
                paginacao: metadados(pag, total),
            });
        } catch (err) {
            next(err);
        }
    },

    updatePedidoStatus: async (req, res, next) => {
        try {
            const pedido = await Pedido.findByPk(req.params.id);
            if (!pedido) {
                return res.status(404).json({ message: 'Pedido não encontrado' });
            }

            const { status } = req.body;

            if (!STATUS_VALIDOS.includes(status)) {
                throw falha(400, 'Status inválido. Use: ' + STATUS_VALIDOS.join(', '));
            }

            if (!transicaoValida(pedido.status, status)) {
                throw falha(
                    400,
                    `Transição inválida: "${pedido.status}" → "${status}"`
                );
            }

            // Cancelamento devolve os itens ao estoque
            if (status === 'cancelado') {
                const t = await sequelize.transaction();
                try {
                    await devolverEstoque(pedido.id, t);
                    await pedido.update({ status }, { transaction: t });
                    await t.commit();
                } catch (err) {
                    await t.rollback();
                    throw err;
                }
            } else {
                await pedido.update({ status });
            }

            res.json({ message: 'Status atualizado', pedido });
        } catch (err) {
            next(err);
        }
    },

    deletePedido: async (req, res, next) => {
        try {
            const t = await sequelize.transaction();
            try {
                const pedido = await Pedido.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
                if (!pedido) {
                    await t.rollback();
                    return res.status(404).json({ message: 'Pedido não encontrado' });
                }

                // Pedidos já cancelados tiveram o estoque devolvido no momento do cancelamento
                if (pedido.status !== 'cancelado') {
                    await devolverEstoque(pedido.id, t);
                }

                await pedido.destroy({ transaction: t });
                await t.commit();

                res.json({ message: 'Pedido deletado com sucesso' });
            } catch (err) {
                await t.rollback();
                throw err;
            }
        } catch (err) {
            next(err);
        }
    },

    getRelatorioVendas: async (req, res, next) => {
        try {
            const { dataInicio, dataFim } = req.query;
            const where = {};

            if (dataInicio && dataFim) {
                const inicio = new Date(dataInicio);
                const fim = new Date(dataFim);

                if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
                    throw falha(400, 'Datas inválidas. Use o formato AAAA-MM-DD');
                }

                where.data = { [Op.between]: [inicio, fim] };
            }

            const pag = parsePaginacao(req.query);

            // Agregados calculados no banco, sem carregar todos os registros
            const [agregado] = await Pedido.findAll({
                where,
                attributes: [
                    [fn('COALESCE', fn('SUM', col('valor_total')), 0), 'total_vendas'],
                    [fn('COUNT', col('id')), 'total_pedidos'],
                ],
                raw: true,
            });

            const pedidos = await Pedido.findAll({
                where,
                attributes: ['id', 'data', 'status', 'valor_total', 'forma_pagamento'],
                include: [
                    { model: Cliente, attributes: ['nome'] },
                ],
                order: [['data', 'DESC']],
                limit: pag.limite,
                offset: pag.offset,
            });

            const totalVendas = parseFloat(agregado.total_vendas);
            const totalPedidos = parseInt(agregado.total_pedidos, 10);

            res.json({
                resumo: {
                    total_vendas: totalVendas,
                    total_pedidos: totalPedidos,
                    valor_medio: totalPedidos > 0 ? totalVendas / totalPedidos : 0,
                },
                paginacao: metadados(pag, totalPedidos),
                pedidos,
            });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = pedidoController;
