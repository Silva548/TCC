const test = require('node:test');
const assert = require('node:assert/strict');

const { ehViolacaoDeChaveEstrangeira, codigoDoErro } = require('../../utils/dbErros');

// Regressão: os controllers tratavam a recusa do banco testando o nome da classe
// SequelizeForeignKeyConstraintError, que o banco nunca produz. O que chega é
// uma DatabaseError com o SQLSTATE do driver dentro, e o 400 previsto virava 500.
test('reconhece restrict_violation (23001) vindo do driver pg', () => {
    const err = {
        name: 'SequelizeDatabaseError',
        original: { code: '23001', constraint: 'produtos_categoria_id_fkey' },
    };
    assert.equal(ehViolacaoDeChaveEstrangeira(err), true);
});

test('reconhece foreign_key_violation (23503) em parent, sem original', () => {
    const err = { name: 'SequelizeDatabaseError', parent: { code: '23503' } };
    assert.equal(ehViolacaoDeChaveEstrangeira(err), true);
});

test('ainda aceita a classe do próprio Sequelize, caso o validador a lance', () => {
    assert.equal(ehViolacaoDeChaveEstrangeira({ name: 'SequelizeForeignKeyConstraintError' }), true);
});

test('não confunde CHECK (23514) nem unicidade (23505) com violação de FK', () => {
    assert.equal(ehViolacaoDeChaveEstrangeira({ name: 'SequelizeDatabaseError', original: { code: '23514' } }), false);
    assert.equal(ehViolacaoDeChaveEstrangeira({ name: 'SequelizeUniqueConstraintError', original: { code: '23505' } }), false);
});

test('não engole erros sem SQLSTATE nem undefined', () => {
    assert.equal(ehViolacaoDeChaveEstrangeira(undefined), false);
    assert.equal(ehViolacaoDeChaveEstrangeira(null), false);
    assert.equal(ehViolacaoDeChaveEstrangeira(new Error('boom')), false);
    assert.equal(ehViolacaoDeChaveEstrangeira({}), false);
    assert.equal(ehViolacaoDeChaveEstrangeira('23001'), false, 'string solta não é erro');
});

test('codigoDoErro lê original, cai para parent e devolve null sem nenhum', () => {
    assert.equal(codigoDoErro({ original: { code: '23001' } }), '23001');
    assert.equal(codigoDoErro({ parent: { code: '23503' } }), '23503');
    assert.equal(codigoDoErro({}), null);
    assert.equal(codigoDoErro(null), null);
});
