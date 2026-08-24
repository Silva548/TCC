const express = require('express');
const categoriaController = require('../controllers/categoriaController');
const { validarIdParam } = require('../middleware/validate');
const router = express.Router();
router.param('id', validarIdParam);

router.get('/', categoriaController.getAllCategorias);
router.get('/new', categoriaController.renderCreateForm);
router.post('/', categoriaController.createCategoria);
router.get('/:id', categoriaController.getCategoriaById);
router.get('/:id/edit', categoriaController.renderEditForm);
router.put('/:id', categoriaController.updateCategoria);
router.delete('/:id', categoriaController.deleteCategoria);

module.exports = router;