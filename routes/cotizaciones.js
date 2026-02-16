// routes/cotizaciones.js
const express = require('express');
const router = express.Router();
const cotizacionController = require('../controllers/cotizacionController');

// GET /api/cotizaciones - Obtener todas las cotizaciones
router.get('/', cotizacionController.getAllCotizaciones);

// GET /api/cotizaciones/:id - Obtener una cotización por ID
router.get('/:id', cotizacionController.getCotizacionById);

// PUT /api/cotizaciones/:id - Actualizar una cotización
router.put('/:id', cotizacionController.updateCotizacion);

// DELETE /api/cotizaciones/:id - Eliminar una cotización
router.delete('/:id', cotizacionController.deleteCotizacion);


// RUTA INTELIGENTE (la más importante para el landing)
router.post('/inteligente', cotizacionController.createCotizacionInteligente);

// RUTA COMPLETA (desde Dashboard - admin crea cotización manual)
router.post('/completa', cotizacionController.createCotizacionCompleta);

// Convertir cotización aprobada a venta (con descuento de stock)
router.post('/:cotizacionID/convertir-a-venta', cotizacionController.convertirCotizacionAVenta);

// NUEVA RUTA: Cancelar cotización (devuelve stock si es necesario)
router.put('/:cotizacionID/cancelar', cotizacionController.cancelarCotizacion);

// Nueva Ruta
router.get('/usuario/:documentoID', cotizacionController.getCotizacionesByUsuario);

module.exports = router;
