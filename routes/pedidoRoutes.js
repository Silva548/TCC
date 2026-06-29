const express = require('express');
const pedidoController = require('../controllers/pedidoController');
const router = express.Router();

router.post('/', pedidoController.createPedido);
router.get('/', pedidoController.getAllPedidos);
router.get('/relatorio/vendas', pedidoController.getRelatorioVendas);
router.get('/:id', pedidoController.getPedidoById);
router.put('/:id/status', pedidoController.updatePedidoStatus);
router.delete('/:id', pedidoController.deletePedido);

module.exports = router;
