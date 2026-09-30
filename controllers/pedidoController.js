const { Pedido, ItemPedido, Cliente } = require('../models');
// Op vem do pacote sequelize, não de models/index.js — models/index.js
// exporta os models, e `Op` vindo de lá é undefined em silêncio (o ESLint não
// acusa, porque parece uma propriedade definida).
const { Op, fn, col } = require('sequelize');
const { periodoRelatorio } = require('../utils/periodo');
const { parsePaginacao, metadados } = require('../utils/paginacao');
const {
    falha,
    criarPedido,
    mudarStatus,
    excluirPedido,
    normalizarItens,
} = require('../services/pedidoService');

// Camada JSON de /pedidos. A escrita (criar, mudar status, excluir) mora em
// services/pedidoService.js e é compartilhada com a UI web — ver o comentário
// do serviço sobre por que a lógica não pode ser duplicada.
const pedidoController = {

    createPedido: async (req, res, next) => {
        try {
            const { cliente_id, forma_pagamento } = req.body;
            const itens = normalizarItens(req.body);

            const novoPedido = await criarPedido({ cliente_id, forma_pagamento, itens });

            res.status(201).json({
                message: 'Pedido criado com sucesso',
                pedido: novoPedido,
            });
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
                    },
                    {
                        model: ItemPedido,
                        include: ['Produto'],
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
            const pedido = await mudarStatus(req.params.id, req.body.status);
            res.json({ message: 'Status atualizado', pedido });
        } catch (err) {
            next(err);
        }
    },

    deletePedido: async (req, res, next) => {
        try {
            await excluirPedido(req.params.id);
            res.json({ message: 'Pedido deletado com sucesso' });
        } catch (err) {
            next(err);
        }
    },

    getRelatorioVendas: async (req, res, next) => {
        try {
            const { dataInicio, dataFim } = req.query;
            const where = {};

            if (dataInicio || dataFim) {
                if (!dataInicio || !dataFim) {
                    throw falha(400, 'Informe dataInicio e dataFim para filtrar o período');
                }

                const { erro, inicio, fim } = periodoRelatorio(dataInicio, dataFim);
                if (erro) {
                    throw falha(400, erro);
                }

                // Intervalo semiaberto [inicio, fim): cobre o dia inteiro
                // sem depender de hora e sem sofrer com milissegundos.
                where.data = { [Op.gte]: inicio, [Op.lt]: fim };
            }

            // Pedido cancelado não é venda: fora do resumo e fora da listagem.
            where.status = { [Op.ne]: 'cancelado' };

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
