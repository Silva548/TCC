const { test } = require('node:test');
const assert = require('node:assert');
const { parsePaginacao, metadados } = require('../utils/paginacao');

test('valores padrão quando nada é informado', () => {
    assert.deepEqual(parsePaginacao(), { pagina: 1, limite: 20, offset: 0 });
    assert.deepEqual(parsePaginacao({}), { pagina: 1, limite: 20, offset: 0 });
});

test('respeita page e limit válidos', () => {
    const pag = parsePaginacao({ page: '3', limit: '10' });
    assert.equal(pag.pagina, 3);
    assert.equal(pag.limite, 10);
    assert.equal(pag.offset, 20);
});

test('entrada maliciosa ou inválida cai no padrão', () => {
    assert.deepEqual(parsePaginacao({ page: '-1', limit: 'abc' }), { pagina: 1, limite: 20, offset: 0 });
    assert.deepEqual(parsePaginacao({ page: 'NaN!', limit: '0' }), { pagina: 1, limite: 20, offset: 0 });
});

test('limit é limitado ao máximo permitido', () => {
    const pag = parsePaginacao({ limit: '999999' });
    assert.ok(pag.limite <= 50);
});

test('metadados calculam total de páginas corretamente', () => {
    assert.deepEqual(metadados({ pagina: 2, limite: 20 }, 45), {
        pagina: 2,
        limite: 20,
        total: 45,
        total_paginas: 3,
    });

    assert.deepEqual(metadados({ pagina: 1, limite: 20 }, 0), {
        pagina: 1,
        limite: 20,
        total: 0,
        total_paginas: 0,
    });
});
