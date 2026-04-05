const {
    Cotizacion, DetalleCotizacion, Estado, Usuario, CotizacionTecnica,
    CotizacionTalla, CotizacionColor, CotizacionInsumo, Tecnica, Talla,
    Color, Insumo, Producto, Parte, Venta, DetalleVenta, InventarioProducto, sequelize
} = require('../models');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');

function obtenerNombreProducto(detalle) {
    if (detalle.TraePrenda) return "Prenda llevada por el cliente";
    return detalle.producto?.Nombre || "Producto sin especificar";
}

// ============================================
// FUNCIÓN PRINCIPAL: CREAR COTIZACIÓN INTELIGENTE
// ============================================
exports.createCotizacionInteligente = async (req, res) => {
    try {                                                                               // 1
        const { DocumentoID, FechaCotizacion, detalles } = req.body;                    // 2
        if (!DocumentoID) {                                                             // 3
            return res.status(400).json({ message: 'DocumentoID es obligatorio' });     // 4
        }                                                                               // 5
        if (!detalles || detalles.length === 0) {                                       // 6
            return res.status(400).json({ message: 'Debe incluir al menos un producto' }); // 7
        }                                                                               // 8
        const usuario = await Usuario.findByPk(DocumentoID);                            // 9
        if (!usuario) {                                                                 // 10
            return res.status(404).json({ message: 'Usuario no encontrado' });          // 11
        }                                                                               // 12
        const tieneDiseños = detalles.some(detalle =>                                   // 13
            detalle.tecnicas && Array.isArray(detalle.tecnicas) && detalle.tecnicas.length > 0 // 14
        );                                                                              // 15
        if (!tieneDiseños) {                                                            // 16
            return await crearVentaDirecta(req, res, { DocumentoID, FechaCotizacion, detalles, usuario }); // 17
        } else {                                                                        // 18
            return await crearCotizacionConDiseños(req, res, {
                DocumentoID, FechaCotizacion,
                detalles, usuario
            }); // 19
        }                                                                               // 20
    } catch (error) {                                                                   // 21
        console.error('ERROR EN COTIZACIÓN INTELIGENTE:', error.message);               // 22
        res.status(500).json({                                                          // 23
            message: 'Error al procesar la solicitud',                                  // 24
            error: error.message,                                                       // 25
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined     // 26
        });                                                                             // 27
    }                                                                                   // 28
};


// ============================================
// CREAR VENTA DIRECTA (SIN DISEÑOS) - CON FIX TraePrenda
// ============================================
async function crearVentaDirecta(req, res, { DocumentoID, FechaCotizacion, detalles, usuario }) {
    try {                                                                               // 1
        let subtotal = 0;                                                               // 2
        const detallesCalculados = [];                                                  // 3
        for (const detalle of detalles) {                                               // 4
            if (detalle.TraePrenda) continue;                                           // 5
            const colorID = detalle.colores?.[0]?.ColorID;                              // 6
            const tallaID = detalle.tallas?.[0]?.TallaID;                               // 7
            const telaID = detalle.insumos?.[0]?.InsumoID;                              // 8
            const cantidad = parseInt(detalle.Cantidad);                                // 9
            if (!colorID || !tallaID) return res.status(400).json({ message: 'Se requiere Color y Talla' }); // 10
            const whereConditions = { ProductoID: detalle.ProductoID, ColorID: colorID, TallaID: tallaID }; // 11
            if (telaID !== undefined && telaID !== null) whereConditions.TelaID = telaID; // 12
            const variante = await InventarioProducto.findOne({ where: whereConditions }); // 13
            if (!variante) return res.status(400).json({ message: `No existe variante en inventario` }); // 14
            if (variante.Stock < cantidad) return res.status(400).json({ message: `Stock insuficiente` }); // 15
        }                                                                               // 16
        for (const detalle of detalles) {                                               // 17
            if (detalle.TraePrenda) {                                                   // 18
                subtotal += 0;                                                          // 19
                detallesCalculados.push({
                    ProductoID: null, ColorID: null, TallaID: null,
                    TelaID: null, Cantidad: parseInt(detalle.Cantidad),
                    PrecioUnitario: 0, TraePrenda: true, PrendaDescripcion:
                        detalle.PrendaDescripcion || ""
                }); // 20
                continue;                                                               // 21
            }                                                                           // 22
            const producto = await Producto.findByPk(detalle.ProductoID);               // 23
            if (!producto) throw new Error(`Producto ${detalle.ProductoID} no encontrado`); // 24
            const tallaID = detalle.tallas?.[0]?.TallaID;                               // 25
            const insumoID = detalle.insumos?.[0]?.InsumoID;                            // 26
            const colorID = detalle.colores?.[0]?.ColorID;                              // 27
            const precioUnitario = (parseFloat(producto.PrecioBase) || 0) +
                (parseFloat((await Talla.findByPk(tallaID))?.Precio) || 0) +
                (parseFloat((await Insumo.findByPk(insumoID))?.PrecioTela) || 0); // 28
            subtotal += precioUnitario * detalle.Cantidad;                              // 29
            detallesCalculados.push({
                ProductoID: detalle.ProductoID,
                ColorID: colorID || null, TallaID: tallaID || null,
                TelaID: insumoID || null, Cantidad: detalle.Cantidad,
                PrecioUnitario: precioUnitario, TraePrenda: false, PrendaDescripcion: ""
            }); // 30
        }                                                                               // 31
        const nuevaVenta = await Venta.create({
            DocumentoID,
            FechaVenta: FechaCotizacion || new Date(), Subtotal:
                subtotal, Total: subtotal, EstadoID: 8
        }); // 32
        for (const detalle of detallesCalculados) {                                     // 33
            await DetalleVenta.create({
                VentaID: nuevaVenta.VentaID,
                ProductoID: detalle.ProductoID, ColorID: detalle.ColorID,
                TallaID: detalle.TallaID, ...(detalle.TelaID ?
                    { TelaID: detalle.TelaID } : {}),
                Cantidad: detalle.Cantidad, PrecioUnitario: detalle.PrecioUnitario
            }); // 34
        }                                                                               // 35
        for (const detalle of detallesCalculados) {                                     // 36
            if (detalle.TraePrenda || !detalle.ColorID || !detalle.TallaID) continue;   // 37
            const whereConditions = {
                ProductoID: detalle.ProductoID,
                ColorID: detalle.ColorID, TallaID: detalle.TallaID
            }; // 38
            if (detalle.TelaID) whereConditions.TelaID = detalle.TelaID;                // 39
            await InventarioProducto.decrement('Stock', {
                by: detalle.Cantidad, where: whereConditions
            }); // 40
        }                                                                               // 41
        return res.status(201).json({
            tipo: 'venta',
            message: 'Venta pendiente creada exitosamente',
            venta: nuevaVenta, detalles: detallesCalculados
        }); // 42
    } catch (error) {                                                                   // 43
        throw error;                                                                    // 44
    }                                                                                   // 45
}


// ============================================
// CREAR COTIZACIÓN CON DISEÑOS (SIN DESCUENTO DE STOCK)
// ============================================
async function crearCotizacionConDiseños(req, res, { DocumentoID, FechaCotizacion, detalles, usuario }) {
    try {                                                                               // 1
        const nuevaCotizacion = await Cotizacion.create({                               // 2
            DocumentoID, FechaCotizacion: FechaCotizacion || new Date(),                // 3
            ValorTotal: 0, EstadoID: 1                                                  // 4
        });                                                                             // 5
        for (let i = 0; i < detalles.length; i++) {                                     // 6
            const detalle = detalles[i];                                                // 7
            const nuevoDetalle = await DetalleCotizacion.create({                       // 8
                CotizacionID: nuevaCotizacion.CotizacionID, ProductoID: detalle.ProductoID, // 9
                Cantidad: detalle.Cantidad, TraePrenda: Boolean(detalle.TraePrenda),    // 10
                PrendaDescripcion: detalle.PrendaDescripcion || null                    // 11
            });                                                                         // 12
            if (detalle.tecnicas?.length > 0) {                                         // 13
                await CotizacionTecnica.bulkCreate(detalle.tecnicas.map(t => ({         // 14
                    DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID,              // 15
                    TecnicaID: t.TecnicaID, ParteID: t.ParteID, ImagenDiseño: t.ImagenDiseño, // 16
                    Observaciones: t.Observaciones, CostoTecnica: t.CostoTecnica || 0   // 17
                })));                                                                   // 18
            }                                                                           // 19
            if (!detalle.TraePrenda) {                                                  // 20
                if (detalle.tallas?.length > 0) await CotizacionTalla.bulkCreate(detalle.
                    tallas.map(t => ({
                        DetalleCotizacionID: nuevoDetalle.
                            DetalleCotizacionID, TallaID: t.TallaID, Cantidad:
                            t.Cantidad, PrecioTalla: t.PrecioTalla || 0
                    }))); // 21
                if (detalle.colores?.length > 0) await CotizacionColor.bulkCreate(detalle.
                    colores.map(c => ({
                        DetalleCotizacionID: nuevoDetalle.
                            DetalleCotizacionID, ColorID: c.ColorID, Cantidad: c.Cantidad
                    }))); // 22
                if (detalle.insumos?.length > 0) await CotizacionInsumo.bulkCreate(detalle.
                    insumos.map(i => ({
                        DetalleCotizacionID: nuevoDetalle.
                            DetalleCotizacionID, InsumoID: i.InsumoID, CantidadRequerida:
                            i.CantidadRequerida
                    }))); // 23
            }                                                                           // 24
        }                                                                               // 25
        const cotizacionCompleta = await Cotizacion.findByPk(nuevaCotizacion.CotizacionID, { // 26
            include: [                                                                  // 27
                { model: Usuario, as: 'usuario' }, { model: Estado, as: 'estado' },     // 28
                {
                    model: DetalleCotizacion, as: 'detalles', include: [{
                        model:
                            Producto, as: 'producto'
                    }, {
                        model: CotizacionTecnica, as: 'tecnicas',
                        include: [{ model: Tecnica, as: 'tecnica' }, {
                            model:
                                Parte, as: 'parte'
                        }]
                    }, {
                        model: CotizacionTalla, as: 'tallas',
                        include: [{ model: Talla, as: 'talla' }]
                    },
                    {
                        model: CotizacionColor, as: 'colores', include: [{
                            model: Color, as: 'color'
                        }]
                    }, {
                        model: CotizacionInsumo,
                        as: 'insumos', include: [{ model: Insumo, as: 'insumo' }]
                    }]
                } // 29
            ]                                                                           // 30
        });                                                                             // 31
        return res.status(201).json({ tipo: 'cotizacion', message: 'Cotización creada exitosamente', cotizacion: cotizacionCompleta }); // 32
    } catch (error) {                                                                   // 33
        throw error;                                                                    // 34
    }                                                                                   // 35
}


// ============================================
// CONVERTIR COTIZACIÓN A VENTA - CON FIX TraePrenda
// ============================================
exports.convertirCotizacionAVenta = async (req, res) => {
    try {                                                                               // 1
        const { cotizacionID } = req.params;                                            // 2
        const cotizacion = await Cotizacion.findByPk(cotizacionID, {                    // 3
            include: [                                                                  // 4
                {
                    model: DetalleCotizacion, as: 'detalles', include: [                  // 5
                        { model: Producto, as: 'producto' },                            // 6
                        {
                            model: CotizacionTalla, as: 'tallas', include: [{
                                model: Talla,
                                as: 'talla'
                            }]
                        }, // 7
                        {
                            model: CotizacionColor, as: 'colores', include: [{
                                model: Color, as: 'color'
                            }]
                        }, // 8
                        {
                            model: CotizacionInsumo, as: 'insumos', include: [{
                                model: Insumo, as: 'insumo'
                            }]
                        }, // 9
                        {
                            model: CotizacionTecnica, as: 'tecnicas', include: [{
                                model: Tecnica, as: 'tecnica'
                            }, { model: Parte, as: 'parte' }]
                        } // 10
                    ]
                },                                                                 // 11
                { model: Usuario, as: 'usuario' }, { model: Estado, as: 'estado' }      // 12
            ]                                                                           // 13
        });                                                                             // 14
        if (!cotizacion) return res.status(404).json({ message: 'Cotización no encontrada', cotizacionID }); // 15
        if (cotizacion.EstadoID !== 2) return res.status(400).json({
            message: 'Solo se pueden convertir cotizaciones aprobadas'
        }); // 16
        if (!cotizacion.detalles || cotizacion.detalles.length === 0) return res.status(400).json({
            message: 'La cotización no tiene productos asociados'
        }); // 17
        for (const detalle of cotizacion.detalles) {                                    // 18
            const traePrenda = Boolean(detalle.TraePrenda);                             // 19
            if (traePrenda) continue;                                                   // 20
            const colorID = detalle.colores?.[0]?.ColorID;                              // 21
            const tallaID = detalle.tallas?.[0]?.TallaID;                               // 22
            if (!colorID || !tallaID) continue;                                         // 23
            const telaID = detalle.insumos?.[0]?.InsumoID || null;                      // 24
            const whereStock = { ProductoID: detalle.ProductoID, ColorID: colorID, TallaID: tallaID }; // 25
            if (telaID) whereStock.TelaID = telaID;                                     // 26
            const variante = await InventarioProducto.findOne({ where: whereStock });   // 27
        }                                                                               // 28
        const nuevaVenta = await Venta.create({                                         // 29
            DocumentoID: cotizacion.DocumentoID, FechaVenta: new Date(),                // 30
            Subtotal: cotizacion.ValorTotal, Total: cotizacion.ValorTotal, EstadoID: 8  // 31
        });                                                                             // 32
        for (const detalle of cotizacion.detalles) {                                    // 33
            const traePrenda = Boolean(detalle.TraePrenda);                             // 34
            const tallaID = detalle.tallas?.[0]?.TallaID || null;                       // 35
            const colorID = detalle.colores?.[0]?.ColorID || null;                      // 36
            const telaID = detalle.insumos?.[0]?.InsumoID || null;                      // 37
            const precioBase = parseFloat(detalle.producto?.PrecioBase) || 0;           // 38
            const precioTalla = parseFloat(detalle.tallas?.[0]?.talla?.Precio) || 0;    // 39
            const precioTela = parseFloat(detalle.insumos?.[0]?.insumo?.PrecioTela) || 0; // 40
            const costoTecnicas = detalle.tecnicas?.reduce((sum, t) => sum + (parseFloat(t.CostoTecnica) || 0), 0) || 0; // 41
            const precioUnitario = traePrenda ? 0 : (precioBase + precioTalla + precioTela + costoTecnicas); // 42
            await DetalleVenta.create({                                                 // 43
                VentaID: nuevaVenta.VentaID, ProductoID: detalle.ProductoID,            // 44
                ColorID: colorID, TallaID: tallaID, Cantidad: detalle.Cantidad, PrecioUnitario: precioUnitario // 45
            });                                                                         // 46
            if (!traePrenda && colorID && tallaID) {                                    // 47
                const whereDecrement = { ProductoID: detalle.ProductoID, ColorID: colorID, TallaID: tallaID }; // 48
                if (telaID) whereDecrement.TelaID = telaID;                             // 49
                const variante = await InventarioProducto.findOne({ where: whereDecrement }); // 50
                if (variante && variante.Stock >= detalle.Cantidad) {                   // 51
                    await InventarioProducto.decrement('Stock', { by: detalle.Cantidad, where: whereDecrement }); // 52
                }                                                                       // 53
            }                                                                           // 54
        }                                                                               // 55
        await cotizacion.update({ EstadoID: 5 });                                       // 56
        return res.status(201).json({
            message: 'Cotización convertida a venta exitosamente', venta: nuevaVenta,
            cotizacionID: cotizacion.CotizacionID
        }); // 57
    } catch (error) {                                                                   // 58
        res.status(500).json({ message: 'Error al convertir cotización', error: error.message }); // 59
    }                                                                                   // 60
};


// ============================================
// ENDPOINT: VER IMAGEN DE DISEÑO
// Sirve la imagen guardada en disco del diseño de una técnica de cotización
// ============================================
exports.getImagenDiseno = async (req, res) => {
    try {
        const { filename } = req.params;
        // Ajusta esta ruta según donde tu backend guarda las imágenes de diseño
        const uploadsDir = path.join(__dirname, '..', 'uploads', 'disenos');
        const filePath = path.join(uploadsDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Imagen no encontrada', filename });
        }

        return res.sendFile(filePath);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener imagen', error: error.message });
    }
};

// ============================================
// CREAR COTIZACIÓN COMPLETA (Dashboard)
// ============================================
exports.createCotizacionCompleta = async (req, res) => {
    try {                                                                               // 1
        const { DocumentoID, FechaCotizacion, ValorTotal, detalles } = req.body;        // 2
        if (!DocumentoID) return res.status(400).json({ message: 'DocumentoID es obligatorio' }); // 3
        if (!detalles || detalles.length === 0) return res.status(400).json({ message: 'Debe incluir al menos un producto' }); // 4
        const usuario = await Usuario.findByPk(DocumentoID);                            // 5
        if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado', DocumentoID }); // 6
        const nuevaCotizacion = await Cotizacion.create({                               // 7
            DocumentoID, FechaCotizacion: FechaCotizacion || new Date(),                // 8
            ValorTotal: ValorTotal || 0, EstadoID: 1                                    // 9
        });                                                                             // 10
        for (const detalle of detalles) {                                               // 11
            const nuevoDetalle = await DetalleCotizacion.create({                       // 12
                CotizacionID: nuevaCotizacion.CotizacionID, ProductoID: detalle.ProductoID, // 13
                Cantidad: detalle.Cantidad, TraePrenda: Boolean(detalle.TraePrenda),    // 14
                PrendaDescripcion: detalle.PrendaDescripcion || null                    // 15
            });                                                                         // 16
            if (detalle.tallas?.length > 0) await CotizacionTalla.bulkCreate(detalle.tallas.map(t =>
            ({
                DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID, TallaID: t.TallaID,
                Cantidad: t.Cantidad || detalle.Cantidad, PrecioTalla: t.PrecioTalla || 0
            }))); // 17
            if (detalle.colores?.length > 0) await CotizacionColor.bulkCreate(detalle.colores.map(c => ({
                DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID,
                ColorID: c.ColorID, Cantidad: c.Cantidad || detalle.Cantidad
            }))); // 18
            if (detalle.insumos?.length > 0) await CotizacionInsumo.bulkCreate(detalle.insumos.map(i => ({
                DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID,
                InsumoID: i.InsumoID, CantidadRequerida: i.CantidadRequerida || detalle.Cantidad
            }))); // 19
            if (detalle.tecnicas?.length > 0) await CotizacionTecnica.bulkCreate(detalle.tecnicas.map(t => ({
                DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID, TecnicaID: t.TecnicaID,
                ParteID: t.ParteID, ImagenDiseño: t.ImagenDiseño || null,
                Observaciones: t.Observaciones || null, CostoTecnica: t.CostoTecnica || 0
            }))); // 20
        }                                                                               // 21
        const cotizacionCompleta = await Cotizacion.findByPk(nuevaCotizacion.CotizacionID, { // 22
            include: [                                                                  // 23
                { model: Usuario, as: 'usuario' }, { model: Estado, as: 'estado' },     // 24
                {
                    model: DetalleCotizacion, as: 'detalles', include: [{ model: Producto, as: 'producto' },
                    {
                        model: CotizacionTecnica, as: 'tecnicas', include: [{ model: Tecnica, as: 'tecnica' },
                        { model: Parte, as: 'parte' }]
                    }, {
                        model: CotizacionTalla, as: 'tallas',
                        include: [{ model: Talla, as: 'talla' }]
                    }, {
                        model:
                            CotizacionColor, as: 'colores', include: [{ model: Color, as: 'color' }]
                    },
                    { model: CotizacionInsumo, as: 'insumos', include: [{ model: Insumo, as: 'insumo' }] }]
                } // 25
            ]                                                                           // 26
        });                                                                             // 27
        return res.status(201).json({ message: 'Cotización creada exitosamente', cotizacion: cotizacionCompleta }); // 28
    } catch (error) {                                                                   // 29
        res.status(500).json({ message: 'Error al crear cotización', error: error.message }); // 30
    }                                                                                   // 31
};


// ============================================
// CRUD ESTÁNDAR
// ============================================
exports.getAllCotizaciones = async (req, res) => {
    try {                                                                               // 1
        const page = Math.max(1, parseInt(req.query.page) || 1);                        // 2
        const limit = Math.max(1, parseInt(req.query.limit) || 10);                     // 3
        const search = (req.query.search || "").trim();                                 // 4
        const estado = (req.query.estado || "Todos").trim();                            // 5
        const offset = (page - 1) * limit;                                              // 6
        const whereCotizacion = { EstadoID: { [Op.ne]: 5 } };                           // 7
        if (search) {                                                                   // 8
            if (!isNaN(search)) {                                                       // 9
                whereCotizacion[Op.or] = [                                              // 10
                    { CotizacionID: parseInt(search) },                                 // 11
                    { '$usuario.Nombre$': { [Op.like]: `%${search}%` } },               // 12
                    { '$usuario.DocumentoID$': { [Op.like]: `%${search}%` } }           // 13
                ];                                                                      // 14
            } else {                                                                    // 15
                whereCotizacion[Op.or] = [                                              // 16
                    { '$usuario.Nombre$': { [Op.like]: `%${search}%` } },               // 17
                    { '$usuario.DocumentoID$': { [Op.like]: `%${search}%` } }           // 18
                ];                                                                      // 19
            }                                                                           // 20
        }                                                                               // 21
        const whereEstado = {};                                                         // 22
        if (estado !== "Todos") { whereEstado.Nombre = estado; }                        // 23
        const totalCount = await Cotizacion.count({                                     // 24
            where: whereCotizacion,                                                     // 25
            include: [                                                                  // 26
                { model: Usuario, as: 'usuario', attributes: [], required: !!search },  // 27
                {
                    model: Estado, as: 'estado', attributes: [], where: Object.keys
                        (whereEstado).length ? whereEstado : undefined, required: estado !== "Todos"
                } // 28
            ], subQuery: false                                                          // 29
        });                                                                             // 30
        const rows = await Cotizacion.findAll({                                         // 31
            where: whereCotizacion,                                                     // 32
            include: [                                                                  // 33
                { model: Usuario, as: 'usuario', required: !!search },                  // 34
                { model: Estado, as: 'estado', where: Object.keys(whereEstado).length ? whereEstado : undefined, required: estado !== "Todos" }, // 35
                {
                    model: DetalleCotizacion, as: 'detalles', include: [                  // 36
                        { model: Producto, as: 'producto' },                                // 37
                        { model: CotizacionTecnica, as: 'tecnicas', include: [{ model: Tecnica, as: 'tecnica' }, { model: Parte, as: 'parte' }] }, // 38
                        { model: CotizacionTalla, as: 'tallas', include: [{ model: Talla, as: 'talla' }] }, // 39
                        { model: CotizacionColor, as: 'colores', include: [{ model: Color, as: 'color' }] },// 40
                        { model: CotizacionInsumo, as: 'insumos', include: [{ model: Insumo, as: 'insumo' }] } // 41
                    ]
                }                                                                      // 42
            ], order: [['CotizacionID', 'DESC']], limit, offset                         // 43
        });                                                                             // 44
        res.json({ datos: rows, total: totalCount, pagina: page, totalPaginas: Math.ceil(totalCount / limit), limit }); // 45
    } catch (error) {                                                                   // 46
        console.error('Error en getAllCotizaciones:', error);                           // 47
        res.status(500).json({ message: 'Error al obtener cotizaciones', error: error.message }); // 48
    }                                                                                   // 49
};



exports.getCotizacionById = async (req, res) => {
    try {                                                                                                                                            // 1
        const cotizacion = await Cotizacion.findByPk(req.params.id, {                                                                               // 2
            include: [                                                                                                                              // 3
                { model: Usuario, as: 'usuario' }, { model: Estado, as: 'estado' },                                                                 // 4
                {                                                                                                                                   // 5
                    model: DetalleCotizacion, as: 'detalles', include: [                                                                            // 6
                        { model: Producto, as: 'producto' },                                                                                        // 7
                        { model: CotizacionTecnica, as: 'tecnicas', include: [{ model: Tecnica, as: 'tecnica' }, { model: Parte, as: 'parte' }] },   // 8
                        { model: CotizacionTalla, as: 'tallas', include: [{ model: Talla, as: 'talla' }] },                                         // 9
                        { model: CotizacionColor, as: 'colores', include: [{ model: Color, as: 'color' }] },                                        // 10
                        { model: CotizacionInsumo, as: 'insumos', include: [{ model: Insumo, as: 'insumo' }] }                                      // 11
                    ]                                                                                                                               // 12
                }                                                                                                                                   // 13
            ]                                                                                                                                       // 14
        });                                                                                                                                         // 15
        if (!cotizacion) return res.status(404).json({ message: 'Cotización no encontrada' });                                                      // 16
        const cotizacionEnriquecida = {                                                                                                             // 17
            ...cotizacion.toJSON(),                                                                                                                 // 18
            detalles: cotizacion.detalles.map(det => ({                                                                                             // 19
                ...det.toJSON(),                                                                                                                    // 20
                nombreProductoDisplay: obtenerNombreProducto(det),                                                                                  // 21
                tecnicas: det.tecnicas?.map(tec => ({                                                                                               // 22
                    ...tec.toJSON(),                                                                                                                // 23
                    ImagenUrl: tec.ImagenDiseño                                                                                                     // 24
                        ? `${process.env.API_URL || 'http://localhost:3000'}/api/cotizaciones/imagen/${tec.ImagenDiseño}`                           // 25
                        : null                                                                                                                      // 26
                })) || []                                                                                                                           // 27
            }))                                                                                                                                     // 28
        };                                                                                                                                          // 29
        res.json(cotizacionEnriquecida);                                                                                                            // 30
    } catch (error) {                                                                                                                               // 31
        res.status(500).json({ message: 'Error al obtener cotización', error: error.message });                                                     // 32
    }                                                                                                                                               // 33
};                                                                                                                                                  // 34


exports.updateCotizacion = async (req, res) => {
    try {                                                                               // 1
        const { ValorTotal, EstadoID } = req.body;                                      // 2
        const cotizacionID = req.params.id;                                             // 3
        const cotizacion = await Cotizacion.findByPk(cotizacionID, {                    // 4
            include: [{                                                                 // 5
                model: DetalleCotizacion, as: 'detalles',                               // 6
                include: [{ model: Producto, as: 'producto' }, {
                    model:
                        CotizacionTalla, as: 'tallas', include: [{
                            model:
                                Talla, as: 'talla'
                        }]
                }, {
                    model: CotizacionColor,
                    as: 'colores', include: [{ model: Color, as: 'color' }]
                }] // 7
            }]                                                                          // 8
        });                                                                             // 9
        if (!cotizacion) return res.status(404).json({ message: 'Cotización no encontrada' }); // 10
        const estadoAnterior = cotizacion.EstadoID;                                     // 11
        const estadoNuevo = EstadoID ? parseInt(EstadoID) : estadoAnterior;             // 12
        if (estadoAnterior === 2 && estadoNuevo === 4) {                                // 13
            for (const detalle of cotizacion.detalles) {                                // 14
                if (!Boolean(detalle.TraePrenda)) {                                     // 15
                    const colorID = detalle.colores?.[0]?.ColorID;                      // 16
                    const tallaID = detalle.tallas?.[0]?.TallaID;                       // 17
                    if (colorID && tallaID) {                                           // 18
                        await InventarioProducto.increment('Stock', {                   // 19
                            by: detalle.Cantidad,                                       // 20
                            where: { ProductoID: detalle.ProductoID, ColorID: colorID, TallaID: tallaID } // 21
                        });                                                             // 22
                    }                                                                   // 23
                }                                                                       // 24
            }                                                                           // 25
        }                                                                               // 26
        await cotizacion.update({                                                       // 27
            ValorTotal: ValorTotal !== undefined ? ValorTotal : cotizacion.ValorTotal,  // 28
            EstadoID: estadoNuevo                                                       // 29
        });                                                                             // 30
        res.json({ message: 'Cotización actualizada exitosamente', cotizacion });       // 31
    } catch (error) {                                                                   // 32
        res.status(500).json({ message: 'Error al actualizar cotización', error: error.message }); // 33
    }                                                                                   // 34
};


exports.deleteCotizacion = async (req, res) => {
    try {
        const cotizacion = await Cotizacion.findByPk(req.params.id);
        if (!cotizacion) return res.status(404).json({ message: 'Cotización no encontrada' });
        await cotizacion.destroy();
        res.json({ message: 'Cotización eliminada exitosamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar cotización', error: error.message });
    }
};

exports.getCotizacionesByUsuario = async (req, res) => {
    try {
        const { documentoID } = req.params;
        const cotizaciones = await Cotizacion.findAll({
            where: { DocumentoID: documentoID },
            include: [
                { model: Usuario, as: 'usuario' },
                { model: Estado, as: 'estado' },
                {
                    model: DetalleCotizacion, as: 'detalles',
                    include: [
                        { model: Producto, as: 'producto' },
                        { model: CotizacionTecnica, as: 'tecnicas', include: [{ model: Tecnica, as: 'tecnica' }, { model: Parte, as: 'parte' }] },
                        { model: CotizacionTalla, as: 'tallas', include: [{ model: Talla, as: 'talla' }] },
                        { model: CotizacionColor, as: 'colores', include: [{ model: Color, as: 'color' }] },
                        { model: CotizacionInsumo, as: 'insumos', include: [{ model: Insumo, as: 'insumo' }] }
                    ]
                }
            ],
            order: [['CotizacionID', 'DESC']]
        });
        res.json(cotizaciones);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener cotizaciones del usuario', error: error.message });
    }
};

exports.cancelarCotizacion = async (req, res) => {
    try {                                                                               // 1
        const { cotizacionID } = req.params;                                            // 2
        const cotizacion = await Cotizacion.findByPk(cotizacionID, {                    // 3
            include: [                                                                  // 4
                {
                    model: DetalleCotizacion, as: 'detalles', include: [{
                        model:
                            Producto, as: 'producto'
                    }, { model: CotizacionTalla, as: 'tallas' }, {
                        model:
                            CotizacionColor, as: 'colores'
                    }]
                }, // 5
                { model: Usuario, as: 'usuario' }, { model: Estado, as: 'estado' }      // 6
            ]                                                                           // 7
        });                                                                             // 8
        if (!cotizacion) return res.status(404).json({ message: 'Cotización no encontrada', cotizacionID }); // 9
        if (cotizacion.EstadoID === 5) return res.status(400).json({
            message: 'No se puede cancelar una cotización ya convertida a venta'
        }); // 10
        let stockDevuelto = false;                                                      // 11
        if (cotizacion.EstadoID === 2) {                                                // 12
            for (const detalle of cotizacion.detalles) {                                // 13
                if (!Boolean(detalle.TraePrenda)) {                                     // 14
                    const colorID = detalle.colores?.[0]?.ColorID;                      // 15
                    const tallaID = detalle.tallas?.[0]?.TallaID;                       // 16
                    if (colorID && tallaID) {                                           // 17
                        await InventarioProducto.increment('Stock', {
                            by: detalle.Cantidad,
                            where: {
                                ProductoID: detalle.ProductoID, ColorID: colorID,
                                TallaID: tallaID
                            }
                        }); // 18
                        stockDevuelto = true;                                           // 19
                    }                                                                   // 20
                }                                                                       // 21
            }                                                                           // 22
        }                                                                               // 23
        await cotizacion.update({ EstadoID: 4 });                                       // 24
        return res.status(200).json({                                                   // 25
            message: 'Cotización cancelada exitosamente',                               // 26
            cotizacionID: cotizacion.CotizacionID, estadoNuevo: 'Cancelada', stockDevuelto // 27
        });                                                                             // 28
    } catch (error) {                                                                   // 29
        res.status(500).json({ message: 'Error al cancelar cotización', error: error.message }); // 30
    }                                                                                   // 31
};


const calcularValorTotalCotizacion = async (cotizacionID) => {
    try {
        const cotizacion = await Cotizacion.findByPk(cotizacionID, {
            include: [{
                model: DetalleCotizacion, as: 'detalles',
                include: [{ model: Producto, as: 'producto' }, { model: CotizacionTecnica, as: 'tecnicas' }, { model: CotizacionTalla, as: 'tallas', include: [{ model: Talla, as: 'talla' }] }, { model: CotizacionInsumo, as: 'insumos', include: [{ model: Insumo, as: 'insumo' }] }]
            }]
        });
        if (!cotizacion) return 0;
        let total = 0;
        for (const detalle of cotizacion.detalles) {
            let subtotalDetalle = 0;

            // Si tiene precio unitario propio (producto personalizado), usarlo directamente
            if (detalle.PrecioUnitario && parseFloat(detalle.PrecioUnitario) > 0) {
                subtotalDetalle += parseFloat(detalle.PrecioUnitario) * detalle.Cantidad;
            } else {
                // Cálculo normal para productos del catálogo
                const precioBase = parseFloat(detalle.producto?.PrecioBase || 0);
                subtotalDetalle += precioBase * detalle.Cantidad;
                if (detalle.insumos?.length > 0) for (const insumo of detalle.insumos) subtotalDetalle += parseFloat(insumo.insumo?.PrecioTela || 0) * parseFloat(insumo.CantidadRequerida || 0);
                if (detalle.tallas?.length > 0) for (const talla of detalle.tallas) subtotalDetalle += parseFloat(talla.talla?.Precio || 0) * parseInt(talla.Cantidad || 0);
            }

            // Las técnicas siempre suman
            if (detalle.tecnicas?.length > 0) for (const tecnica of detalle.tecnicas) subtotalDetalle += parseFloat(tecnica.CostoTecnica || 0) * detalle.Cantidad;

            total += subtotalDetalle;
        }
        await cotizacion.update({ ValorTotal: total });
        return total;
    } catch (error) {
        console.error('Error recalculando valor total:', error);
        return 0;
    }
};

exports.calcularValorTotalCotizacion = calcularValorTotalCotizacion;
module.exports.crearVentaDirecta = crearVentaDirecta;
module.exports.crearCotizacionConDiseños = crearCotizacionConDiseños;