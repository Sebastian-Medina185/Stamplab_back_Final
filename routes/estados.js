const express = require('express');
const router = express.Router();
const estadoController = require('../controllers/estadoController');

// ⬇RUTA TEMPORAL - BORRAR DESPUÉS DE USARLA
router.get('/seed', async (req, res) => {
    try {
        const { Estado } = require('../models');
        await Estado.bulkCreate([
            { Nombre: 'Pendiente', Tipo: 'cotizacion', Descripcion: 'Cotización recibida, esperando revisión' },
            { Nombre: 'Aprobada', Tipo: 'cotizacion', Descripcion: 'Cotización aprobada por el equipo' },
            { Nombre: 'Cancelada', Tipo: 'cotizacion', Descripcion: 'Cotización cancelada' },
            { Nombre: 'Pendiente', Tipo: 'venta', Descripcion: 'Venta registrada, pendiente de procesar' },
            { Nombre: 'Pagada', Tipo: 'venta', Descripcion: 'Pago confirmado' },
            { Nombre: 'En Producción', Tipo: 'venta', Descripcion: 'Pedido en proceso de producción' },
            { Nombre: 'Lista para Entrega', Tipo: 'venta', Descripcion: 'Pedido listo para entregar' },
            { Nombre: 'Entregada', Tipo: 'venta', Descripcion: 'Pedido entregado al cliente' },
            { Nombre: 'Cancelada', Tipo: 'venta', Descripcion: 'Venta cancelada' },
        ]);
        res.json({ ok: true, mensaje: '✅ Estados insertados correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// RUTA TEMPORAL - BORRAR DESPUÉS DE USARLA

router.get('/', estadoController.getAllEstados);
router.get('/tipo/:tipo', estadoController.getEstadosByTipo);
router.get('/:id', estadoController.getEstadoById);
router.post('/', estadoController.createEstado);
router.put('/:id', estadoController.updateEstado);
router.delete('/:id', estadoController.deleteEstado);

module.exports = router;