const express = require('express');
const clienteController = require('../controllers/clienteSequelizeController');
const { validarIdParam } = require('../middleware/validate');
const router = express.Router();
router.param('id', validarIdParam);

router.get('/', clienteController.getAllClientes);
router.get('/new', clienteController.renderCreateForm);
router.post('/', clienteController.createCliente);
router.get('/search', clienteController.searchByName);
router.get('/:id', clienteController.getClienteById);
router.get('/:id/edit', clienteController.renderEditForm);
router.put('/:id', clienteController.updateCliente);
router.delete('/:id', clienteController.deleteCliente);

module.exports = router;
