const { test } = require('node:test');
const assert = require('node:assert');
const { compararTokens } = require('../middleware/csrf');

test('tokens idênticos passam', () => {
    const token = 'a'.repeat(64);
    assert.equal(compararTokens(token, token), true);
});

test('tokens diferentes falham', () => {
    const a = 'a'.repeat(64);
    const b = 'b'.repeat(63) + 'c';
    assert.equal(compararTokens(a, b), false);
});

test('tamanhos diferentes falham sem lançar erro', () => {
    assert.equal(compararTokens('curto', 'muito mais longo'), false);
});

test('entradas não-string são rejeitadas', () => {
    assert.equal(compararTokens(undefined, 'token'), false);
    assert.equal(compararTokens(null, null), false);
    assert.equal(compararTokens(123, 123), false);
    assert.equal(compararTokens({}, {}), false);
});

test('token vazio ou ausente falha', () => {
    assert.equal(compararTokens('', ''), false);
});
