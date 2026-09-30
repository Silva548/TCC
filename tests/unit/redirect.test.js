const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ehCaminhoSeguro, caminhoSeguro } = require('../../utils/redirect');

// Regressão de open redirect: o valor de `next` no POST /login vem do corpo da
// requisição, controlado pelo atacante, e vira o header Location do redirect de
// sucesso. Qualquer variante que o browser normalize para uma origem externa
// precisa ser recusada aqui.

test('caminhos internos são aceitos', () => {
    assert.equal(ehCaminhoSeguro('/'), true);
    assert.equal(ehCaminhoSeguro('/produtos'), true);
    assert.equal(ehCaminhoSeguro('/produtos?categoria_id=3&page=2'), true);
    assert.equal(ehCaminhoSeguro('/pedidos/1/edit'), true);
});

test('protocol-relative é recusado', () => {
    assert.equal(ehCaminhoSeguro('//evil.com'), false);
    assert.equal(ehCaminhoSeguro('//evil.com/x'), false);
});

test('URL absoluta com esquema é recusada', () => {
    assert.equal(ehCaminhoSeguro('http://evil.com'), false);
    assert.equal(ehCaminhoSeguro('https://evil.com/x'), false);
    assert.equal(ehCaminhoSeguro('javascript:alert(1)'), false);
    assert.equal(ehCaminhoSeguro('data:text/html,<script>alert(1)</script>'), false);
});

test('barra invertida é recusada', () => {
    // Alguns normalizadores de URL convergem "\" para "/" antes do redirect
    assert.equal(ehCaminhoSeguro('\\\\evil.com/x'), false);
    assert.equal(ehCaminhoSeguro('/produtos\\evil.com'), false);
});

test('caracteres de controle são recusados', () => {
    assert.equal(ehCaminhoSeguro('/produtos\r\nLocation: https://evil.com'), false);
    assert.equal(ehCaminhoSeguro('/produtos\nSet-Cookie: a=b'), false);
});

test('valores ausentes ou não-string são recusados', () => {
    assert.equal(ehCaminhoSeguro(''), false);
    assert.equal(ehCaminhoSeguro(undefined), false);
    assert.equal(ehCaminhoSeguro(null), false);
    assert.equal(ehCaminhoSeguro(123), false);
    assert.equal(ehCaminhoSeguro({}), false);
});

test('caminho sem barra inicial é recusado', () => {
    assert.equal(ehCaminhoSeguro('produtos'), false);
    assert.equal(ehCaminhoSeguro('evil.com/x'), false);
});

test('caminhoSeguro devolve o fallback para entradas inseguras', () => {
    assert.equal(caminhoSeguro('/produtos', '/'), '/produtos');
    assert.equal(caminhoSeguro('//evil.com', '/'), '/');
    assert.equal(caminhoSeguro('https://evil.com', '/'), '/');
    assert.equal(caminhoSeguro(undefined, '/produtos'), '/produtos');
    assert.equal(caminhoSeguro('', '/'), '/');
});