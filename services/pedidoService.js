// Regras de escrita de pedido — a única implementação.
//
// A API JSON e a UI web (HTML) atendem no mesmo path `/pedidos`, então as
// duas chamam estas funções em vez de repetir a lógica. A duplicação seria
// especialmente perigosa aqui: a agregação de itens repetidos por produto e
// a validação de estoque já tiveram um bug real (estoque negativo), e uma
// segunda cópia poderia reintroduzi-lo só no caminho do navegador.

const { Pedido, ItemPedido, Cliente, Produto, sequelize } = require('../models');
const { Op } = require('sequelize');
const {
    STATUS_VALIDOS,
    FORMAS_PAGAMENTO,
    TIPOS_ENTREGA,
    MODALIDADE_PADRAO,
    transicaoValida,
    precoDaModalidade,
    calcularTotalCentavos,
} = require('../utils/pedidoRules');

const falha = (status, message) => Object.assign(new Error(message), { status });

const devolverEstoque = async (pedidoId, t) => {
    const itens = await ItemPedido.findAll({
        where: { pedido_id: pedidoId },
        transaction: t,
        attributes: ['produto_id', 'quantidade'],
    });

    if (!itens.length) return;

    // Uma única leitura para todos os produtos em vez de um findByPk por item:
    // o N+1 segurava uma transação aberta (com lock) enquanto fazia consultas
    // em série, alongando a janela de contenção de estoque.
    const produtos = await Produto.findAll({
        where: { id: { [Op.in]: itens.map((i) => i.produto_id) } },
        transaction: t,
        lock: t.LOCK.UPDATE,
    });

    const porId = new Map(produtos.map((p) => [p.id, p]));

    for (const item of itens) {
        const produto = porId.get(item.produto_id);
        if (produto) {
            await produto.increment('estoque', { by: item.quantidade, transaction: t });
        }
    }
};

// Une as linhas do formulário em [{ produto_id, quantidade }], descartando as
// linhas deixadas em branco (o formulário tem linhas fixas para o usuário poder
// preencher só o que precisa).
const itensDoFormulario = (body = {}) => {
    const produtos = body.item_produto_id || [];
    const quantidades = body.item_quantidade || [];
    const itens = [];

    const tamanho = Math.max(
        Array.isArray(produtos) ? produtos.length : 0,
        Array.isArray(quantidades) ? quantidades.length : 0,
        0
    );

    for (let i = 0; i < tamanho; i++) {
        const produto = Array.isArray(produtos) ? produtos[i] : produtos;
        const quantidade = Array.isArray(quantidades) ? quantidades[i] : quantidades;
        const produtoLimpo = String(produto ?? '').trim();
        const quantidadeLimpa = String(quantidade ?? '').trim();

        // Linha totalmente vazia: ignorada. Meia linha preenchida: erro, senão
        // o usuário perde o produto escolhido sem perceber.
        if (!produtoLimpo && !quantidadeLimpa) continue;
        if (!produtoLimpo) throw falha(400, 'Informe o produto de todos os itens preenchidos');
        if (!quantidadeLimpa) throw falha(400, 'Informe a quantidade de todos os itens preenchidos');

        itens.push({ produto_id: produtoLimpo, quantidade: quantidadeLimpa });
    }

    return itens;
};

// Aceita tanto o array da API ({ produto_id, quantidade }) quanto as linhas
// indexadas do formulário (item_produto_id[]/item_quantidade[]).
const normalizarItens = (body) =>
    Array.isArray(body.itens) ? body.itens : itensDoFormulario(body);

const criarPedido = async ({ cliente_id, forma_pagamento, tipo_entrega, itens }) => {
    if (!cliente_id || !forma_pagamento) {
        throw falha(400, 'cliente_id e forma_pagamento são obrigatórios');
    }

    if (!FORMAS_PAGAMENTO.includes(forma_pagamento)) {
        throw falha(400, 'Forma de pagamento inválida. Use: ' + FORMAS_PAGAMENTO.join(', '));
    }

    // Sem valor explícito, o pedido é uma entrega — o modo mais comum e o que
    // o sistema assumia antes de a coluna existir.
    const modalidade = tipo_entrega || MODALIDADE_PADRAO;
    if (!TIPOS_ENTREGA.includes(modalidade)) {
        throw falha(400, 'Tipo de entrega inválido. Use: ' + TIPOS_ENTREGA.join(', '));
    }

    if (!Array.isArray(itens) || itens.length === 0) {
        throw falha(400, 'O pedido deve ter pelo menos um item');
    }

    // Agrega por produto ANTES de tocar no banco.
    //
    // Sem isto, um pedido com o mesmo produto em duas linhas validaria a mesma
    // linha travada contra o estoque ainda inteiro duas vezes (o decrement só
    // acontece depois, no segundo laço). Com estoque 8 e itens
    // [{p1,5},{p1,5}], ambas as validações passariam e o estoque final seria
    // -2.
    const porProduto = new Map();

    for (const item of itens) {
        const quantidade = Number(item.quantidade);
        const produto_id = Number(item.produto_id);

        if (!Number.isInteger(quantidade) || quantidade < 1) {
            throw falha(400, 'A quantidade de cada item deve ser um número inteiro maior que zero');
        }
        if (!Number.isInteger(produto_id) || produto_id < 1) {
            throw falha(400, 'produto_id inválido');
        }

        porProduto.set(produto_id, (porProduto.get(produto_id) || 0) + quantidade);
    }

    // Transação garante consistência entre pedido, itens e estoque
    const t = await sequelize.transaction();
    try {
        const cliente = await Cliente.findByPk(cliente_id, { transaction: t, lock: t.LOCK.UPDATE });
        if (!cliente) {
            throw falha(404, 'Cliente não encontrado');
        }

        // Índice por produto_id: calcularTotalCentavos e a gravação dos itens
        // passam a olhar pelo id, não por posição no array.
        const produtos = new Map();

        for (const [produtoId, quantidadeTotal] of porProduto) {
            // Lock pessimista impede venda concorrente além do estoque
            const produto = await Produto.findByPk(produtoId, { transaction: t, lock: t.LOCK.UPDATE });
            if (!produto) {
                throw falha(404, `Produto ${produtoId} não encontrado`);
            }

            if (produto.estoque < quantidadeTotal) {
                throw falha(
                    400,
                    `Estoque insuficiente para ${produto.nome}: disponível ${produto.estoque}, solicitado ${quantidadeTotal}`
                );
            }

            produtos.set(produtoId, produto);
        }

        // Total calculado em centavos e convertido de volta para decimal,
        // usando o preço da modalidade escolhida no pedido.
        const valor_total = calcularTotalCentavos(
            [...porProduto].map(([produto_id, quantidade]) => ({ produto_id, quantidade })),
            produtos,
            modalidade
        ) / 100;

        const novoPedido = await Pedido.create({
            cliente_id,
            forma_pagamento,
            tipo_entrega: modalidade,
            valor_total,
            status: 'pendente',
        }, { transaction: t });

        for (const [produtoId, quantidade] of porProduto) {
            const produto = produtos.get(produtoId);

            await ItemPedido.create({
                pedido_id: novoPedido.id,
                produto_id: produtoId,
                quantidade,
                preco_unitario: precoDaModalidade(produto, modalidade),
            }, { transaction: t });

            await produto.decrement('estoque', { by: quantidade, transaction: t });
        }

        await t.commit();
        return novoPedido;
    } catch (err) {
        await t.rollback();
        throw err;
    }
};

const mudarStatus = async (id, status) => {
    if (!STATUS_VALIDOS.includes(status)) {
        throw falha(400, 'Status inválido. Use: ' + STATUS_VALIDOS.join(', '));
    }

    // Leitura, validação da transição e escrita na MESMA transação, com lock
    // pessimista na linha do pedido. Sem isso, duas requisições simultâneas
    // validariam a mesma transição a partir da mesma leitura obsoleta, e um
    // cancelamento poderia devolver estoque em duplicidade.
    const t = await sequelize.transaction();
    let pedido;

    try {
        pedido = await Pedido.findByPk(id, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!pedido) {
            throw falha(404, 'Pedido não encontrado');
        }

        if (!transicaoValida(pedido.status, status)) {
            throw falha(
                400,
                `Transição inválida: "${pedido.status}" → "${status}"`
            );
        }

        // Cancelamento devolve os itens ao estoque
        if (status === 'cancelado') {
            await devolverEstoque(pedido.id, t);
        }

        await pedido.update({ status }, { transaction: t });
        await t.commit();
        return pedido;
    } catch (err) {
        await t.rollback();
        throw err;
    }
};

const excluirPedido = async (id) => {
    const t = await sequelize.transaction();

    try {
        const pedido = await Pedido.findByPk(id, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!pedido) {
            throw falha(404, 'Pedido não encontrado');
        }

        // Pedidos já cancelados tiveram o estoque devolvido no cancelamento
        if (pedido.status !== 'cancelado') {
            await devolverEstoque(pedido.id, t);
        }

        await pedido.destroy({ transaction: t });
        await t.commit();
    } catch (err) {
        await t.rollback();
        throw err;
    }
};

module.exports = {
    falha,
    criarPedido,
    mudarStatus,
    excluirPedido,
    normalizarItens,
    itensDoFormulario,
    devolverEstoque,
};
