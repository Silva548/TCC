// Valida que req.params.id é um inteiro positivo.
// Uso: router.param('id', validarIdParam)
const { erro } = require('../utils/responder');

const ehInteiroPositivo = (valor) => {
    if (typeof valor !== 'string' && typeof valor !== 'number') return false;
    return /^\d+$/.test(String(valor)) && Number(valor) > 0;
};

const validarIdParam = (req, res, next, id) => {
    if (!ehInteiroPositivo(id)) {
        return erro(res, req, 400, 'ID inválido');
    }
    next();
};

// Query params chegam como string; um valor não-numérico viraria erro de tipo
// do Postgres (HTTP 500) em vez de validação de entrada (HTTP 400).
// Uso: router.get('/', validarQueryInteiro('cliente_id'), handler)
const validarQueryInteiro = (nome) => (req, res, next) => {
    const bruto = req.query[nome];

    if (bruto === undefined || bruto === '') {
        return next();
    }

    // query repetida (?id=1&id=2) chega como array
    const valor = Array.isArray(bruto) ? bruto[0] : bruto;

    if (!ehInteiroPositivo(valor)) {
        return erro(res, req, 400, `Parâmetro "${nome}" inválido`);
    }

    next();
};

module.exports = { validarIdParam, validarQueryInteiro, ehInteiroPositivo };
