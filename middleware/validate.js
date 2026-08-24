// Valida que req.params.id é um inteiro positivo.
// Uso: router.param('id', validarIdParam)
const validarIdParam = (req, res, next, id) => {
    if (!/^\d+$/.test(id)) {
        const message = 'ID inválido';
        if (req.accepts(['html', 'json']) === 'json') {
            return res.status(400).json({ error: message });
        }
        return res.status(400).send(message);
    }
    next();
};

module.exports = { validarIdParam };
