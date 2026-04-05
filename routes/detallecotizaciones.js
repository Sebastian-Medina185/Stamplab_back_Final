const express = require('express');
const router = express.Router();
const detallecotizacionController = require('../controllers/detallecotizacionController');

// GET /api/detallecotizaciones - Obtener todos los detalles de cotización
router.get('/', detallecotizacionController.getAllDetalleCotizaciones);

// GET /api/detallecotizaciones/:id - Obtener un detalle de cotización por ID
router.get('/:id', detallecotizacionController.getDetalleCotizacionById);

// POST /api/detallecotizaciones - Crear un detalle de cotización
router.post('/', detallecotizacionController.createDetalleCotizacion);

// PUT /api/detallecotizaciones/:id - Actualizar un detalle de cotización
router.put('/:id', detallecotizacionController.updateDetalleCotizacion);

// DELETE /api/detallecotizaciones/:id - Eliminar un detalle de cotización
router.delete('/:id', detallecotizacionController.deleteDetalleCotizacion);



module.exports = router;