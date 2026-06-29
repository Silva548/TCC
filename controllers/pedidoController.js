const Pedido = require('../models/pedidoModel');
const ItemPedido = require('../models/itemPedidoModel');
const Cliente = require('../models/clienteModel');
const Produto = require('../models/produtoSequelizeModel');
const { Op } = require('sequelize');

const pedidoController = {

    createPedido: async (req, res) => {
        try {
            const { cliente_id, forma_pagamento, itens } = req.body;

            if (!cliente_id || !forma_pagamento) {
                return res.status(400).json({ 
                    error: 'cliente_id e forma_pagamento são obrigatórios' 
                });
            }

            // Verificar se cliente existe
            const cliente = await Cliente.findByPk(cliente_id);
            if (!cliente) {
                return res.status(404).json({ error: 'Cliente não encontrado' });
            }

            // Calcular valor total
            let valor_total = 0;
            if (itens && Array.isArray(itens)) {
                for (const item of itens) {
                    const produto = await Produto.findByPk(item.produto_id);
                    if (!produto) {
                        return res.status(404).json({ 
                            error: `Produto ${item.produto_id} não encontrado` 
                        });
                    }
                    
                    if (produto.estoque < item.quantidade) {
                        return res.status(400).json({ 
                            error: `Estoque insuficiente para ${produto.nome}` 
                        });
                    }
                    
                    valor_total += produto.preco * item.quantidade;
                }
            }

            const novoPedido = await Pedido.create({
                cliente_id,
                forma_pagamento,
                valor_total,
                status: 'pendente',
            });

            // Criar itens do pedido
            if (itens && Array.isArray(itens)) {
                for (const item of itens) {
                    const produto = await Produto.findByPk(item.produto_id);
                    
                    await ItemPedido.create({
                        pedido_id: novoPedido.id,
                        produto_id: item.produto_id,
                        quantidade: item.quantidade,
                        preco_unitario: produto.preco,
                    });

                    // Reduzir estoque
                    await produto.update({
                        estoque: produto.estoque - item.quantidade,
                    });
                }
            }

            res.status(201).json({ 
                message: 'Pedido criado com sucesso', 
                pedido: novoPedido 
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    getPedidoById: async (req, res) => {
        try {
            const pedidoId = req.params.id;

            const pedido = await Pedido.findByPk(pedidoId, {
                include: [
                    { 
                        model: Cliente,
                        attributes: { exclude: ['senha'] }
                    },
                    { 
                        model: ItemPedido,
                        include: [Produto]
                    }
                ],
            });

            if (!pedido) {
                return res.status(404).json({ message: 'Pedido não encontrado' });
            }

            res.json(pedido);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    getAllPedidos: async (req, res) => {
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
                        attributes: { exclude: ['senha'] }
                    }
                ],
                order: [['data', 'DESC']],
            });

            res.json(pedidos);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    updatePedidoStatus: async (req, res) => {
        try {
            const pedidoId = req.params.id;
            const { status } = req.body;

            const pedido = await Pedido.findByPk(pedidoId);
            if (!pedido) {
                return res.status(404).json({ message: 'Pedido não encontrado' });
            }

            const statusValidos = ['pendente', 'processando', 'enviado', 'entregue', 'cancelado'];
            if (!statusValidos.includes(status)) {
                return res.status(400).json({ 
                    error: 'Status inválido. Use: ' + statusValidos.join(', ') 
                });
            }

            await pedido.update({ status });
            res.json({ message: 'Status atualizado', pedido });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    deletePedido: async (req, res) => {
        try {
            const pedidoId = req.params.id;

            const pedido = await Pedido.findByPk(pedidoId);
            if (!pedido) {
                return res.status(404).json({ message: 'Pedido não encontrado' });
            }

            // Recuperar estoque dos itens antes de deletar
            const itens = await ItemPedido.findAll({ where: { pedido_id: pedidoId } });
            for (const item of itens) {
                const produto = await Produto.findByPk(item.produto_id);
                if (produto) {
                    await produto.update({
                        estoque: produto.estoque + item.quantidade,
                    });
                }
            }

            await pedido.destroy();
            res.json({ message: 'Pedido deletado com sucesso' });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    getRelatorioVendas: async (req, res) => {
        try {
            const { dataInicio, dataFim } = req.query;
            const where = {};

            if (dataInicio && dataFim) {
                where.data = {
                    [Op.between]: [new Date(dataInicio), new Date(dataFim)],
                };
            }

            const pedidos = await Pedido.findAll({
                where,
                attributes: [
                    'id',
                    'data',
                    'status',
                    'valor_total',
                    'forma_pagamento'
                ],
                include: [
                    { model: Cliente, attributes: ['nome'] }
                ],
                order: [['data', 'DESC']],
            });

            const totalVendas = pedidos.reduce((acc, p) => acc + parseFloat(p.valor_total), 0);
            const totalPedidos = pedidos.length;

            res.json({
                resumo: {
                    total_vendas: totalVendas,
                    total_pedidos: totalPedidos,
                    valor_medio: totalVendas / totalPedidos || 0,
                },
                pedidos,
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },
};

module.exports = pedidoController;
