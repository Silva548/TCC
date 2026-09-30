// Content negotiation: decide se a resposta deve ser JSON ou HTML.
//
// O problema que resolve: req.accepts(['html','json']) devolve 'html' para
// qualquer cliente que mande `Accept: */*` — que é o padrão de curl, fetch e
// Postman sem header. Isso fazia a "API JSON" de /pedidos responder 302 para
// /login em vez de 401, e erros saírem como texto puro.
// Rotas que são API JSON por design. `originalUrl` (e não `req.path`) porque
// routers montados com app.use() reescrevem req.url, mas nunca originalUrl.
const ROTAS_JSON = [/^\/pedidos(\/|$)/i];

const caminhoDaRequisicao = (req) => (req.originalUrl || req.url || '').split('?')[0];

const ehRotaJson = (req) => ROTAS_JSON.some((padrao) => padrao.test(caminhoDaRequisicao(req)));

const headerAccept = (req) => (typeof req.get === 'function' && req.get('Accept')) || '';

// Um navegador manda "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8".
// Citar text/html é a declaração explícita de que a resposta deve ser uma página.
const citaHtml = (req) => /text\/html|application\/xhtml/i.test(headerAccept(req));

const citaJson = (req) =>
    (typeof req.is === 'function' && req.is('application/json')) ||
    /application\/json/i.test(headerAccept(req));

const ehJson = (req) => {
    // `undefined` = o chamador não se manifestou; o cabeçalho Accept decide.
    if (typeof req.respostaJson === 'boolean') {
        return req.respostaJson;
    }

    // Navegação explícita ganha, exceto se JSON também foi pedido: aí o
    // chamador é uma ferramenta de API e a rota JSON prevalece.
    if (citaHtml(req) && !citaJson(req)) {
        return false;
    }

    if (ehRotaJson(req) || citaJson(req)) {
        return true;
    }

    // Sem declaração (Accept ausente ou */*) em rota web: HTML, como antes.
    return typeof req.accepts === 'function' && req.accepts(['html', 'json']) === 'json';
};

// Resposta de erro padronizada: JSON quando o cliente espera JSON, HTML com
// layout quando é navegação de browser.
const erro = (res, req, status, mensagem) => {
    if (ehJson(req)) {
        return res.status(status).json({ error: mensagem });
    }
    return res.status(status).send(mensagem);
};

module.exports = { ehRotaJson, citaHtml, citaJson, ehJson, erro, ROTAS_JSON };
