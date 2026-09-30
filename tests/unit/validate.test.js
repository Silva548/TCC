const { test } = require('node:test');
const assert = require('node:assert');
const { validarIdParam } = require('../../middleware/validate');

const criarRes = () => {
    const res = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        send(body) { this.body = body; return this; },
        json(payload) { this.jsonPayload = payload; return this; },
    };
    return res;
};

test('validarIdParam aceita IDs numéricos positivos', () => {
    ['1', '42', '999'].forEach((id) => {
        let chamado = false;
        validarIdParam({ params: {} }, criarRes(), () => { chamado = true; }, id);
        assert.equal(chamado, true, `ID "${id}" deveria ser aceito`);
    });
});

test('validarIdParam rejeita IDs inválidos', () => {
    ['-1', 'abc', '1.5', '1; DROP TABLE', '', null, undefined].forEach((id) => {
        const res = criarRes();
        const req = { accepts: () => 'html' };
        validarIdParam(req, res, () => assert.fail(`ID "${id}" não deveria passar`), id);
        assert.equal(res.statusCode, 400, `ID "${id}" deveria retornar 400`);
    });
});

test('validarIdParam responde JSON quando cliente aceita JSON', () => {
    const res = criarRes();
    const req = { accepts: () => 'json' };
    validarIdParam(req, res, () => assert.fail('não deveria passar'), 'abc');
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.jsonPayload, { error: 'ID inválido' });
});
