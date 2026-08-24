const { test } = require('node:test');
const assert = require('node:assert');
const {
    STATUS_VALIDOS,
    TRANSICOES_STATUS,
    transicaoValida,
    paraCentavos,
    calcularTotalCentavos,
} = require('../utils/pedidoRules');

test('status válidos cobrem todas as chaves das transições', () => {
    for (const status of STATUS_VALIDOS) {
        assert.ok(Array.isArray(TRANSICOES_STATUS[status]), `faltando transições de ${status}`);
    }
});

test('transições válidas são aceitas', () => {
    assert.equal(transicaoValida('pendente', 'processando'), true);
    assert.equal(transicaoValida('pendente', 'cancelado'), true);
    assert.equal(transicaoValida('processando', 'enviado'), true);
    assert.equal(transicaoValida('enviado', 'entregue'), true);
    assert.equal(transicaoValida('enviado', 'cancelado'), true);
});

test('transições inválidas ou reversas são rejeitadas', () => {
    assert.equal(transicaoValida('entregue', 'pendente'), false);
    assert.equal(transicaoValida('cancelado', 'processando'), false);
    assert.equal(transicaoValida('entregue', 'qualquer-coisa'), false);
    assert.equal(transicaoValida('pendente', 'entregue'), false); // pulando etapas
    assert.equal(transicaoValida('status-inexistente', 'pendente'), false);
});

test('paraCentavos evita erros de ponto flutuante', () => {
    // Casos clássicos que quebrariam aritmética binária direta
    assert.equal(paraCentavos(0.1 + 0.2), 30);
    assert.equal(paraCentavos('19.99'), 1999);
    assert.equal(paraCentavos(10), 1000);
    assert.equal(paraCentavos('0.05'), 5);
});

test('calcularTotalCentavos soma quantidade x preço sem perda de precisão', () => {
    const itens = [
        { produto_id: 1, quantidade: 3 },
        { produto_id: 2, quantidade: 2 },
    ];
    const produtos = [
        { preco: '19.99' }, // 5997
        { preco: '0.1' },   // 20
    ];

    assert.equal(calcularTotalCentavos(itens, produtos), 6017);
});

test('pedido vazio totaliza zero', () => {
    assert.equal(calcularTotalCentavos([], []), 0);
});
