const {
    DetalleCotizacion,
    Cotizacion,
    Producto,
    CotizacionTecnica,
    CotizacionTalla,
    CotizacionColor,
    CotizacionInsumo,
    Tecnica,
    Talla,
    Color,
    Insumo,
    Parte
} = require('../models');

// Obtener todos los detalles de cotización
exports.getAllDetalleCotizaciones = async (req, rpes) => {
    try {
        const detalleCotizaciones = await DetalleCotizacion.findAll({
            include: [
                { model: Cotizacion, as: 'cotizacion' },
                { model: Producto, as: 'producto' },
                {
                    model: CotizacionTecnica,
                    as: 'tecnicas',
                    include: [
                        { model: Tecnica, as: 'tecnica' },
                        { model: Parte, as: 'parte' }
                    ]
                },
                {
                    model: CotizacionTalla,
                    as: 'tallas',
                    include: [{ model: Talla, as: 'talla' }]
                },
                {
                    model: CotizacionColor,
                    as: 'colores',
                    include: [{ model: Color, as: 'color' }]
                },
                {
                    model: CotizacionInsumo,
                    as: 'insumos',
                    include: [{ model: Insumo, as: 'insumo' }]
                }
            ]
        });
        res.json(detalleCotizaciones);
    } catch (error) {
        res.status(500).json({
            message: 'Error al obtener detalles de cotización',
            error: error.message
        });
    }
};

// Obtener un detalle de cotización por ID
exports.getDetalleCotizacionById = async (req, res) => {
    try {
        const detalleCotizacion = await DetalleCotizacion.findByPk(req.params.id, {
            include: [
                { model: Cotizacion, as: 'cotizacion' },
                { model: Producto, as: 'producto' },
                {
                    model: CotizacionTecnica,
                    as: 'tecnicas',
                    include: [
                        { model: Tecnica, as: 'tecnica' },
                        { model: Parte, as: 'parte' }
                    ]
                },
                {
                    model: CotizacionTalla,
                    as: 'tallas',
                    include: [{ model: Talla, as: 'talla' }]
                },
                {
                    model: CotizacionColor,
                    as: 'colores',
                    include: [{ model: Color, as: 'color' }]
                },
                {
                    model: CotizacionInsumo,
                    as: 'insumos',
                    include: [{ model: Insumo, as: 'insumo' }]
                }
            ]
        });

        if (!detalleCotizacion) {
            return res.status(404).json({ message: 'Detalle de cotización no encontrado' });
        }

        res.json(detalleCotizacion);
    } catch (error) {
        res.status(500).json({
            message: 'Error al obtener detalle de cotización',
            error: error.message
        });
    }
};

// Crear un detalle de cotización
exports.createDetalleCotizacion = async (req, res) => {
    try {
        const { CotizacionID, ProductoID, Cantidad, TraePrenda, PrendaDescripcion } = req.body;

        // Validar que la cotización existe
        const cotizacion = await Cotizacion.findByPk(CotizacionID);
        if (!cotizacion) {
            return res.status(404).json({
                message: 'Cotización no encontrada',
                CotizacionID: CotizacionID
            });
        }

        // Validar que el producto existe
        const producto = await Producto.findByPk(ProductoID);
        if (!producto) {
            return res.status(404).json({
                message: 'Producto no encontrado',
                ProductoID: ProductoID
            });
        }

        const nuevoDetalle = await DetalleCotizacion.create({
            CotizacionID,
            ProductoID,
            Cantidad,
            TraePrenda: TraePrenda || false,
            PrendaDescripcion
        });

        res.status(201).json({
            message: 'Detalle de cotización creado exitosamente',
            detalleCotizacion: nuevoDetalle
        });
    } catch (error) {
        console.error('Error completo:', error);
        res.status(500).json({
            message: 'Error al crear detalle de cotización',
            error: error.message
        });
    }
};

// Actualizar un detalle de cotización
exports.updateDetalleCotizacion = async (req, res) => {
    try {
        const { ProductoID, Cantidad, TraePrenda, PrendaDescripcion, PrecioUnitario } = req.body;

        const detalleCotizacion = await DetalleCotizacion.findByPk(req.params.id);

        if (!detalleCotizacion) {
            return res.status(404).json({ message: 'Detalle de cotización no encontrado' });
        }

        // Si se va a actualizar el ProductoID, validar que existe
        if (ProductoID && ProductoID !== detalleCotizacion.ProductoID) {
            const producto = await Producto.findByPk(ProductoID);
            if (!producto) {
                return res.status(404).json({
                    message: 'Producto no encontrado',
                    ProductoID: ProductoID
                });
            }
        }

        await detalleCotizacion.update({
            ProductoID: ProductoID || detalleCotizacion.ProductoID,
            Cantidad: Cantidad || detalleCotizacion.Cantidad,
            TraePrenda: TraePrenda !== undefined ? TraePrenda : detalleCotizacion.TraePrenda,
            PrendaDescripcion: PrendaDescripcion || detalleCotizacion.PrendaDescripcion,
            PrecioUnitario: PrecioUnitario !== undefined ? PrecioUnitario : detalleCotizacion.PrecioUnitario  // ← agregar
        });

        if (PrecioUnitario !== undefined) {
            const { calcularValorTotalCotizacion } = require('./cotizacionController');
            await calcularValorTotalCotizacion(detalleCotizacion.CotizacionID);
        }

        res.json({
            message: 'Detalle de cotización actualizado exitosamente',
            detalleCotizacion
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error al actualizar detalle de cotización',
            error: error.message
        });
    }
};

// Eliminar un detalle de cotización
exports.deleteDetalleCotizacion = async (req, res) => {
    try {
        const detalleCotizacion = await DetalleCotizacion.findByPk(req.params.id);

        if (!detalleCotizacion) {
            return res.status(404).json({ message: 'Detalle de cotización no encontrado' });
        }

        await detalleCotizacion.destroy();

        res.json({ message: 'Detalle de cotización eliminado exitosamente' });
    } catch (error) {
        res.status(500).json({
            message: 'Error al eliminar detalle de cotización',
            error: error.message
        });
    }
};