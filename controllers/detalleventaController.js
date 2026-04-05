const { DetalleVenta, Venta, Producto, Color, Talla } = require('../models');

// Obtener todos los detalles de venta
exports.getAllDetalleVentas = async (req, res) => {
    try {                                                                               // 1
        const detalleVentas = await DetalleVenta.findAll({                              // 2
            include: [                                                                  // 3
                { model: Venta, as: 'venta' },                                          // 4
                { model: Producto, as: 'producto' },                                    // 5
                { model: Color, as: 'color' },  // Incluir Color                        // 6
                { model: Talla, as: 'talla' }   // Incluir Talla                        // 7
            ]                                                                           // 8
        });                                                                             // 9
        res.json(detalleVentas);                                                        // 10
    } catch (error) {                                                                   // 11
        res.status(500).json({                                                          // 12
            message: 'Error al obtener detalles de venta',                              // 13
            error: error.message                                                        // 14
        });                                                                             // 15
    }                                                                                   // 16
};


// Obtener un detalle de venta por ID
exports.getDetalleVentaById = async (req, res) => {
    try {                                                                               // 1
        const detalleVenta = await DetalleVenta.findByPk(req.params.id, {               // 2
            include: [                                                                  // 3
                { model: Venta, as: 'venta' },                                          // 4
                { model: Producto, as: 'producto' },                                    // 5
                { model: Color, as: 'color' },  // Incluir Color                        // 6
                { model: Talla, as: 'talla' }   // Incluir Talla                        // 7
            ]                                                                           // 8
        });                                                                             // 9

        if (!detalleVenta) {                                                            // 10
            return res.status(404).json({ message: 'Detalle de venta no encontrado' }); // 11
        }                                                                               // 12

        res.json(detalleVenta);                                                         // 13
    } catch (error) {                                                                   // 14
        res.status(500).json({                                                          // 15
            message: 'Error al obtener detalle de venta',                               // 16
            error: error.message                                                        // 17
        });                                                                             // 18
    }                                                                                   // 19
};


exports.createDetalleVenta = async (req, res) => {
    try {                                                                               // 1
        const { VentaID, ProductoID, ColorID, TallaID, Cantidad, PrecioUnitario } = req.body; // 2

        // Validar que los campos obligatorios estén presentes                           
        if (!VentaID || !ProductoID || !Cantidad || !PrecioUnitario) {                  // 3
            return res.status(400).json({ error: "Faltan datos obligatorios" });        // 4
        }                                                                               // 5

        // Crear un nuevo detalle de venta                                               
        const nuevoDetalle = await DetalleVenta.create({                                // 6
            VentaID,                                                                    // 7
            ProductoID,                                                                 // 8
            ColorID,     // Guardamos el color seleccionado                             // 9
            TallaID,     // Guardamos la talla seleccionada                             // 10
            Cantidad,                                                                   // 11
            PrecioUnitario                                                              // 12
        });                                                                             // 13

        res.status(201).json({                                                          // 14
            message: 'Detalle de venta creado exitosamente',                            // 15
            detalleVenta: nuevoDetalle                                                  // 16
        });                                                                             // 17
    } catch (error) {                                                                   // 18
        res.status(500).json({                                                          // 19
            message: 'Error al crear detalle de venta',                                 // 20
            error: error.message                                                        // 21
        });                                                                             // 22
    }                                                                                   // 23
};


// Actualizar un detalle de venta
exports.updateDetalleVenta = async (req, res) => {
    try {                                                                               // 1
        const { ProductoID, ColorID, TallaID, Cantidad, PrecioUnitario } = req.body;    // 2

        // Buscar el detalle de venta por ID                                            
        const detalleVenta = await DetalleVenta.findByPk(req.params.id);                // 3

        if (!detalleVenta) {                                                            // 4
            return res.status(404).json({ message: 'Detalle de venta no encontrado' }); // 5
        }                                                                               // 6

        // Actualizar el detalle de venta con los nuevos valores                         
        await detalleVenta.update({                                                     // 7
            ProductoID: ProductoID || detalleVenta.ProductoID,                          // 8
            ColorID: ColorID || detalleVenta.ColorID,  // Actualizar el color           // 9
            TallaID: TallaID || detalleVenta.TallaID,  // Actualizar la talla           // 10
            Cantidad: Cantidad || detalleVenta.Cantidad,                                // 11
            PrecioUnitario: PrecioUnitario || detalleVenta.PrecioUnitario               // 12
        });                                                                             // 13

        res.json({                                                                      // 14
            message: 'Detalle de venta actualizado exitosamente',                       // 15
            detalleVenta                                                                // 16
        });                                                                             // 17
    } catch (error) {                                                                   // 18
        res.status(500).json({                                                          // 19
            message: 'Error al actualizar detalle de venta',                            // 20
            error: error.message                                                        // 21
        });                                                                             // 22
    }                                                                                   // 23
};


// Eliminar un detalle de venta
exports.deleteDetalleVenta = async (req, res) => {
    try {                                                                               // 1
        const detalleVenta = await DetalleVenta.findByPk(req.params.id);                // 2

        if (!detalleVenta) {                                                            // 3
            return res.status(404).json({ message: 'Detalle de venta no encontrado' }); // 4
        }                                                                               // 5

        await detalleVenta.destroy();                                                   // 6

        res.json({ message: 'Detalle de venta eliminado exitosamente' });               // 7
    } catch (error) {                                                                   // 8
        res.status(500).json({                                                          // 9
            message: 'Error al eliminar detalle de venta',                              // 10
            error: error.message                                                        // 11
        });                                                                             // 12
    }                                                                                   // 13
};
