const Pedido = require('../models/pedidoModel');
const ItemPedido = require('../models/itemPedidoModel');
const Cliente = require('../models/clienteModel');
const Produto = require('../models/produtoSequelizeModel');
const sequelize = require('../config/db');
const { Op } = require('sequelize');

const STATUS_VALIDOS = ['pendente', 'processando', 'enviado', 'entregue', 'cancelado'];
const FORMAS_PAGAMENTO = ['credito', 'debito', 'pix', 'boleto', 'dinheiro'];

const falha = (status, message) => Object.assign(new Error(message), { status });

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

            for (const item of itens) {
                const qtd = Number(item.quantidade);
                if (!Number.isInteger(qtd) || qtd < 1) {
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

                let valor_total = 0;
                const produtos = [];

                for (const item of itens) {
                    // Lock otimista impede venda concorrente além do estoque
                    const produto = await Produto.findByPk(item.produto_id, { transaction: t, lock: t.LOCK.UPDATE });
                    if (!produto) {
                        throw falha(404, `Produto ${item.produto_id} não encontrado`);
                    }

                    if (produto.estoque < item.quantidade) {
                        throw falha(400, `Estoque insuficiente para ${produto.nome}`);
                    }

                    valor_total += parseFloat(produto.preco) * item.quantidade;
                    produtos.push(produto);
                }

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
                        quantidade: Number(itens[i].quantidade),
                        preco_unitario: produtos[i].preco,
                    }, { transaction: t });

                    await produtos[i].decrement('estoque', { by: Number(itens[i].quantidade), transaction: t });
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

            const pedidos = await Pedido.findAll({
                where,
                include: [
                    {
                        model: Cliente,
                        attributes: { exclude: ['senha'] },
                    },
                ],
                order: [['data', 'DESC']],
            });

            res.json(pedidos);
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

            await pedido.update({ status });
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

                // Devolve o estoque dos itens antes de deletar
                const itens = await ItemPedido.findAll({ where: { pedido_id: req.params.id }, transaction: t });
                for (const item of itens) {
                    const produto = await Produto.findByPk(item.produto_id, { transaction: t, lock: t.LOCK.UPDATE });
                    if (produto) {
                        await produto.increment('estoque', { by: item.quantidade, transaction: t });
                    }
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

            const pedidos = await Pedido.findAll({
                where,
                attributes: ['id', 'data', 'status', 'valor_total', 'forma_pagamento'],
                include: [
                    { model: Cliente, attributes: ['nome'] },
                ],
                order: [['data', 'DESC']],
            });

            const totalVendas = pedidos.reduce((acc, p) => acc + parseFloat(p.valor_total), 0);
            const totalPedidos = pedidos.length;

            res.json({
                resumo: {
                    total_vendas: totalVendas,
                    total_pedidos: totalPedidos,
                    valor_medio: totalPedidos > 0 ? totalVendas / totalPedidos : 0,
                },
                pedidos,
            });
        } catch (err) {
            next(err);
        }
    },
};

module.exports = pedidoController;
