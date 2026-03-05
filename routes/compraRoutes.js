const express = require('express');
const router = express.Router();
const compraController = require('../controllers/compraController');
const { InventarioProducto, Color, Talla, Insumo, Producto } = require('../models');


router.get('/productos/:productoId/variantes', async (req, res) => {
    try {
        const { productoId } = req.params;

        console.log('Buscando variantes para ProductoID:', productoId);

        // Validar que el producto existe
        const producto = await Producto.findByPk(productoId, {
            attributes: ['ProductoID', 'Nombre', 'Descripcion', 'PrecioBase']
        });

        if (!producto) {
            console.error('Producto no encontrado:', productoId);
            return res.status(404).json({ 
                estado: false, 
                mensaje: `Producto con ID ${productoId} no encontrado` 
            });
        }

        console.log('Producto encontrado:', producto.Nombre);

        // Obtener variantes del producto
        const variantes = await InventarioProducto.findAll({
            where: { ProductoID: productoId },
            include: [
                { 
                    model: Color, 
                    as: 'color', 
                    attributes: ['ColorID', 'Nombre'] 
                },
                { 
                    model: Talla, 
                    as: 'talla', 
                    attributes: ['TallaID', 'Nombre', 'Precio'] 
                },
                { 
                    model: Insumo, 
                    as: 'tela', 
                    attributes: ['InsumoID', 'Nombre', 'PrecioTela'], 
                    required: false 
                }
            ],
            order: [
                ['Stock', 'DESC'],
                ['Estado', 'DESC']
            ]
        });

        console.log(`Variantes encontradas: ${variantes.length}`);

        res.json({ 
            estado: true, 
            producto, 
            variantes, 
            totalVariantes: variantes.length 
        });

    } catch (error) {
        console.error('Error al obtener variantes:', error);
        res.status(500).json({ 
            estado: false, 
            mensaje: 'Error al obtener variantes', 
            error: error.message 
        });
    }
});

router.get('/', compraController.getAllCompras);
router.post('/', compraController.createCompra);
router.get('/:id', compraController.getCompraById);          // Esta debe ir después de /productos/:id/variantes
router.put('/:id', compraController.updateCompra);
router.delete('/:id', compraController.deleteCompra);

module.exports = router;