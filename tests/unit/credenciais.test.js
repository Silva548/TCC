const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const { SENHAS_PADRAO_CONHECIDAS, usaSenhaPadraoConhecida } = require('../../utils/credenciais');

test('reconhece a senha padrão conhecida', async () => {
    const hash = await bcrypt.hash('admin123', 4);
    assert.equal(await usaSenhaPadraoConhecida({ password: hash }), true);
});

test('não acusa uma senha forte qualquer', async () => {
    const hash = await bcrypt.hash('uma-senha-aleatoria-bem-longa', 4);
    assert.equal(await usaSenhaPadraoConhecida({ password: hash }), false);
});

test('trata hash ausente, vazio ou malformado sem estourar', async () => {
    assert.equal(await usaSenhaPadraoConhecida(undefined), false);
    assert.equal(await usaSenhaPadraoConhecida(null), false);
    assert.equal(await usaSenhaPadraoConhecida({}), false);
    assert.equal(await usaSenhaPadraoConhecida({ password: null }), false);
    assert.equal(await usaSenhaPadraoConhecida({ password: '' }), false);
    // bcrypt.compare com lixo devolve false, mas o ponto é não propagar erro
    assert.equal(await usaSenhaPadraoConhecida({ password: 'nao-e-um-hash' }), false);
});

test('lista de senhas vazia não acusa ninguém', async () => {
    const hash = await bcrypt.hash('admin123', 4);
    assert.equal(await usaSenhaPadraoConhecida({ password: hash }, []), false);
    assert.equal(await usaSenhaPadraoConhecida({ password: hash }, null), false);
});

test('a lista padrão contém admin123', () => {
    assert.ok(SENHAS_PADRAO_CONHECIDAS.includes('admin123'));
});
