const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { verifyCsrf, csrfSetup } = require('../../middleware/csrf');

const criarRes = () => {
    const res = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        send(body) { this.body = body; return this; },
    };
    return res;
};

test('verifyCsrf ignora métodos GET', () => {
    let chamado = false;
    const req = { method: 'GET', body: {} };
    verifyCsrf(req, criarRes(), () => { chamado = true; });
    assert.equal(chamado, true);
});

test('verifyCsrf bloqueia POST sem token CSRF', () => {
    const res = criarRes();
    const req = { method: 'POST', body: {}, session: { csrfToken: 'abc' } };
    verifyCsrf(req, res, () => assert.fail('deveria bloquear'));
    assert.equal(res.statusCode, 403);
});

test('verifyCsrf bloqueia POST com token inválido', () => {
    const res = criarRes();
    const req = { method: 'POST', body: { _csrf: 'token_errado' }, session: { csrfToken: 'token_correto' } };
    verifyCsrf(req, res, () => assert.fail('deveria bloquear'));
    assert.equal(res.statusCode, 403);
});

test('verifyCsrf aceita POST com token válido', () => {
    const token = crypto.randomBytes(32).toString('hex');
    let chamado = false;
    const req = { method: 'POST', body: { _csrf: token }, session: { csrfToken: token } };
    verifyCsrf(req, criarRes(), () => { chamado = true; });
    assert.equal(chamado, true);
});

test('verifyCsrf bloqueia DELETE sem sessão', () => {
    const res = criarRes();
    const req = { method: 'DELETE', body: { _csrf: 'x' }, session: null };
    verifyCsrf(req, res, () => assert.fail('deveria bloquear'));
    assert.equal(res.statusCode, 403);
});

test('csrfSetup cria token se não existe na sessão', () => {
    const session = {};
    const res = { locals: {} };
    csrfSetup({ session }, res, () => {});
    assert.ok(session.csrfToken, 'token deveria ter sido criado');
    assert.equal(res.locals.csrfToken, session.csrfToken);
});

test('csrfSetup preserva token existente', () => {
    const token = crypto.randomBytes(32).toString('hex');
    const session = { csrfToken: token };
    const res = { locals: {} };
    csrfSetup({ session }, res, () => {});
    assert.equal(session.csrfToken, token);
    assert.equal(res.locals.csrfToken, token);
});
