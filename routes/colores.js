const express = require('express');
const router = express.Router();
const colorController = require('../controllers/colorController');

// Rutas CRUD de colores
router.get('/', colorController.getAllColores);
router.get('/:id', colorController.getColorById);
router.post('/', colorController.createColor);
router.put('/:id', colorController.updateColor);     
router.delete('/:id', colorController.deleteColor);

module.exports = router;