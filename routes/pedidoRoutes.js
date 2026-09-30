const express = require('express');
const pedidoController = require('../controllers/pedidoController');
const pedidoViewController = require('../controllers/pedidoViewController');
const { validarIdParam, validarQueryInteiro } = require('../middleware/validate');
const { ehJson, erro } = require('../utils/responder');
const { STATUS_VALIDOS } = require('../utils/pedidoRules');

const router = express.Router();
router.param('id', validarIdParam);

// ?cliente_id= e ?status= são validados na entrada. Sem isso, um status
// inválido devolvia 200 com lista vazia e um cliente_id não numérico estourava
// erro de tipo do Postgres (HTTP 500).
const validarStatusQuery = (req, res, next) => {
    if (req.query.status && !STATUS_VALIDOS.includes(req.query.status)) {
        return erro(res, req, 400, `Status inválido. Use: ${STATUS_VALIDOS.join(', ')}`);
    }
    next();
};

// Decide o formato da resposta e entrega ao controller correspondente.
//
// A ordem de decisão é:
//   1. ?format=html|json — escape explícito do cliente. Resolve o caso do
//      navegador: um link de download ou um fetch sem cabeçalho caem em
//      `Accept: */*` e receberiam JSON, exibido como texto na tela.
//   2. cabeçalho Accept. É o que mantém a API compatível: curl, Postman e o
//      frontend existente mandam `Accept: */*` ou `application/json` e
//      continuam recebendo JSON, sem precisar consultar a documentação.
//
// A decisão mora AQUI, dentro do despachante, e não em middlewares separados
// por rota: quando estava separada, esquecer de declarar a rota fazia o
// req.respostaJson ficar undefined e o pedido POST caía silenciosamente no
// controller HTML, devolvendo 302 no lugar de 201 para a API. Com a decisão
// colada no despachante, não existe como esquecer.
const decideFormato = (req) => {
    const pedido = String(req.query.format || '').toLowerCase();
    if (pedido === 'json') return true;
    if (pedido === 'html') return false;
    return ehJson(req);
};

const responder = (json, html) => (req, res, next) => {
    if (req.respostaJson === undefined) {
        req.respostaJson = decideFormato(req);
    }
    return (req.respostaJson ? json : html)(req, res, next);
};

// Força um formato, ignorando ?format= e o Accept. Usado onde não existe
// alternative em HTML: a tela de novo pedido e o relatório de vendas.
const soHtml = (handler) => (req, res, next) => {
    req.respostaJson = false;
    return handler(req, res, next);
};

const soJson = (handler) => (req, res, next) => {
    req.respostaJson = true;
    return handler(req, res, next);
};

router.get('/', validarQueryInteiro('cliente_id'), validarStatusQuery, responder(pedidoController.getAllPedidos, pedidoViewController.index));
router.get('/new', soHtml(pedidoViewController.newForm));
router.post('/', responder(pedidoController.createPedido, pedidoViewController.create));
// O relatório de vendas é só API por enquanto: ele não tem view, e
// despachá-lo para a listagem mostraria dados diferentes dos pedidos sem
// avisar. Navegar para cá num browser baixa o JSON — mesmo comportamento de
// antes desta mudança.
router.get('/relatorio/vendas', soJson(pedidoController.getRelatorioVendas));
router.get('/:id', responder(pedidoController.getPedidoById, pedidoViewController.show));
router.put('/:id/status', responder(pedidoController.updatePedidoStatus, pedidoViewController.mudarStatus));
router.delete('/:id', responder(pedidoController.deletePedido, pedidoViewController.excluir));

module.exports = router;
