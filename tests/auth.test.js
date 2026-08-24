const { test } = require('node:test');
const assert = require('node:assert');
const { requireAuth, requireRole } = require('../middleware/auth');

// Stubs mínimos de req/res/next
const criarReq = ({ userId, role, aceita = 'html' }) => ({
    session: userId ? { userId, role } : {},
    accepts: () => aceita,
    originalUrl: '/original',
});

const criarRes = () => {
    const res = {
        statusCode: null,
        body: null,
        redirectUrl: null,
        jsonPayload: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.jsonPayload = payload; return this; },
        send(body) { this.body = body; return this; },
        redirect(url) { this.redirectUrl = url; return this; },
    };
    return res;
};

test('requireAuth permite usuário autenticado', () => {
    const req = criarReq({ userId: 1 });
    let chamado = false;
    requireAuth(req, criarRes(), () => { chamado = true; });
    assert.equal(chamado, true);
});

test('requireAuth redireciona anônimo para /login', () => {
    const req = criarReq({});
    const res = criarRes();
    requireAuth(req, res, () => assert.fail('não deveria passar'));
    assert.equal(res.redirectUrl, '/login');
    assert.equal(req.session.returnTo, '/original');
});

test('requireAuth devolve 401 JSON para clientes de API', () => {
    const req = criarReq({ aceita: 'json' });
    const res = criarRes();
    requireAuth(req, res, () => assert.fail('não deveria passar'));
    assert.equal(res.statusCode, 401);
});

test('requireRole bloqueia papel diferente com 403', () => {
    const req = criarReq({ userId: 1, role: 'user' });
    const res = criarRes();
    requireRole('admin')(req, res, () => assert.fail('não deveria passar'));
    assert.equal(res.statusCode, 403);
});

test('requireRole permite papel correto', () => {
    const req = criarReq({ userId: 1, role: 'admin' });
    let chamado = false;
    requireRole('admin')(req, criarRes(), () => { chamado = true; });
    assert.equal(chamado, true);
});
