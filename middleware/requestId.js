const crypto = require('crypto');

// Identificador de correlação por requisição: aceito o X-Request-Id enviado pelo
// cliente (útil quando há proxy/CDN na frente) ou gero um novo. Aparece nos logs
// e no header de resposta, permitindo rastrear uma requisição ponta a ponta.
const requestId = (req, res, next) => {
    const recebido = req.get('X-Request-Id');

    // Aceita apenas valores seguros para log (evita injeção de log/header)
    const id = recebido && /^[\w.:-]{1,128}$/.test(recebido)
        ? recebido
        : crypto.randomUUID();

    req.id = id;
    res.locals.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
};

module.exports = { requestId };
