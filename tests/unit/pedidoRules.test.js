const { test } = require('node:test');
const assert = require('node:assert');
const {
    STATUS_VALIDOS,
    TRANSICOES_STATUS,
    transicaoValida,
    paraCentavos,
    calcularTotalCentavos,
    mediaEmCentavos,
} = require('../../utils/pedidoRules');

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
    // Indexado por produto_id, não por posição
    const produtos = new Map([
        [1, { preco: '19.99' }], // 3 x 1999 = 5997
        [2, { preco: '0.1' }],   // 2 x   10 =   20
    ]);

    assert.equal(calcularTotalCentavos(itens, produtos), 6017);
});

test('calcularTotalCentavos não confunde itens quando a ordem dos produtos difere', () => {
    // Regressão do estoque negativo: a agregação por produto muda o tamanho do
    // array, então qualquer alinhamento posicional passaria a associar a
    // quantidade ao preço do produto errado.
    const itens = [
        { produto_id: 7, quantidade: 2 },
        { produto_id: 9, quantidade: 5 },
    ];
    const produtos = new Map([
        [9, { preco: '10.00' }],
        [7, { preco: '3.00' }],
    ]);

    // 2 x 300 + 5 x 1000 = 5600
    assert.equal(calcularTotalCentavos(itens, produtos), 5600);
});

test('calcularTotalCentavos soma a mesma linha repetida', () => {
    const itens = [{ produto_id: 1, quantidade: 10 }];
    const produtos = new Map([[1, { preco: '2.50' }]]);

    assert.equal(calcularTotalCentavos(itens, produtos), 2500);
});

test('pedido vazio totaliza zero', () => {
    assert.equal(calcularTotalCentavos([], new Map()), 0);
});

// ---------------------------------------------------------------------------
// mediaEmCentavos
// ---------------------------------------------------------------------------

test('a média por pedido não devolve ruído de float', () => {
    // 310 / 7 é 44.285714285714285 em ponto flutuante; num campo de dinheiro,
    // esses 17 dígitos viram lixo na tela.
    assert.equal(mediaEmCentavos(310, 7), 44.29);
    assert.equal(String(mediaEmCentavos(310, 7)).length <= 5, true);
});

test('a média arredonda para duas casas, com o valor exato preservado', () => {
    assert.equal(mediaEmCentavos(100, 4), 25);
    assert.equal(mediaEmCentavos(10, 3), 3.33);
    assert.equal(mediaEmCentavos(10, 6), 1.67);
    assert.equal(mediaEmCentavos(0, 5), 0);
});

test('a média não quebra com quantidade zero, negativa ou lixo', () => {
    assert.equal(mediaEmCentavos(310, 0), 0);
    assert.equal(mediaEmCentavos(310, -2), 0);
    assert.equal(mediaEmCentavos(NaN, 5), 0);
    assert.equal(mediaEmCentavos(310, 'abc'), 0);
    assert.equal(mediaEmCentavos(undefined, undefined), 0);
});
