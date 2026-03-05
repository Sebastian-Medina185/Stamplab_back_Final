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
    try {
        const { DocumentoID, FechaCotizacion, detalles } = req.body;

        console.log('\n' + '='.repeat(60));
        console.log('ANÁLISIS DE COTIZACIÓN INTELIGENTE');
        console.log('='.repeat(60));
        console.log('DocumentoID:', DocumentoID);
        console.log('Detalles recibidos:', detalles?.length || 0);

        if (!DocumentoID) {
            return res.status(400).json({ message: 'DocumentoID es obligatorio', receivedData: req.body });
        }
        if (!detalles || detalles.length === 0) {
            return res.status(400).json({ message: 'Debe incluir al menos un producto', receivedData: req.body });
        }

        const usuario = await Usuario.findByPk(DocumentoID);
        if (!usuario) {
            return res.status(404).json({ message: 'Usuario no encontrado', DocumentoID });
        }

        const tieneDiseños = detalles.some(detalle =>
            detalle.tecnicas && Array.isArray(detalle.tecnicas) && detalle.tecnicas.length > 0
        );

        console.log('Tiene diseños aplicados:', tieneDiseños ? 'SÍ' : 'NO');

        if (!tieneDiseños) {
            return await crearVentaDirecta(req, res, { DocumentoID, FechaCotizacion, detalles, usuario });
        } else {
            return await crearCotizacionConDiseños(req, res, { DocumentoID, FechaCotizacion, detalles, usuario });
        }
    } catch (error) {
        console.error('ERROR EN COTIZACIÓN INTELIGENTE:', error.message);
        res.status(500).json({
            message: 'Error al procesar la solicitud',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// ============================================
// CREAR VENTA DIRECTA (SIN DISEÑOS) - CON FIX TraePrenda
// ============================================
async function crearVentaDirecta(req, res, { DocumentoID, FechaCotizacion, detalles, usuario }) {
    try {
        console.log('\nCREANDO VENTA DIRECTA...');

        let subtotal = 0;
        const detallesCalculados = [];

        // ===== PASO 1: VALIDAR STOCK (solo para prendas del inventario) =====
        console.log('\nVALIDANDO STOCK...');
        for (const detalle of detalles) {
            if (detalle.TraePrenda) {
                console.log('  → Prenda propia, se omite validación de stock');
                continue;
            }

            const colorID = detalle.colores?.[0]?.ColorID;
            const tallaID = detalle.tallas?.[0]?.TallaID;
            const telaID = detalle.insumos?.[0]?.InsumoID;
            const cantidad = parseInt(detalle.Cantidad);

            if (!colorID || !tallaID) {
                return res.status(400).json({
                    message: 'Se requiere Color y Talla para validar stock en prendas del inventario'
                });
            }

            const whereConditions = { ProductoID: detalle.ProductoID, ColorID: colorID, TallaID: tallaID };
            if (telaID !== undefined && telaID !== null) whereConditions.TelaID = telaID;

            const variante = await InventarioProducto.findOne({ where: whereConditions });

            if (!variante) {
                const producto = await Producto.findByPk(detalle.ProductoID);
                return res.status(400).json({
                    message: `No existe variante en inventario para ${producto?.Nombre || detalle.ProductoID} - Color: ${colorID} / Talla: ${tallaID} / Tela: ${telaID || 'Sin tela'}`
                });
            }

            if (variante.Stock < cantidad) {
                const producto = await Producto.findByPk(detalle.ProductoID);
                return res.status(400).json({
                    message: `Stock insuficiente para ${producto?.Nombre || 'producto'}. Disponible: ${variante.Stock}, Solicitado: ${cantidad}`
                });
            }

            console.log(`  ✓ Stock validado - ${variante.Stock} disponibles`);
        }

        // ===== PASO 2: CALCULAR PRECIOS =====
        console.log('\nCALCULANDO PRECIOS...');
        for (const detalle of detalles) {
            // FIX: Prenda propia — precio = 0, no buscar producto en BD
            if (detalle.TraePrenda) {
                console.log('  → Prenda propia, precio = 0');
                subtotal += 0;
                detallesCalculados.push({
                    ProductoID: null,
                    ColorID: null,
                    TallaID: null,
                    TelaID: null,
                    Cantidad: parseInt(detalle.Cantidad),
                    PrecioUnitario: 0,
                    TraePrenda: true,
                    PrendaDescripcion: detalle.PrendaDescripcion || ""
                });
                continue;
            }

            const producto = await Producto.findByPk(detalle.ProductoID);
            if (!producto) throw new Error(`Producto ${detalle.ProductoID} no encontrado`);

            const tallaID = detalle.tallas?.[0]?.TallaID;
            const talla = tallaID ? await Talla.findByPk(tallaID) : null;
            const insumoID = detalle.insumos?.[0]?.InsumoID;
            const tela = insumoID ? await Insumo.findByPk(insumoID) : null;
            const colorID = detalle.colores?.[0]?.ColorID;

            const precioBase = parseFloat(producto.PrecioBase) || 0;
            const precioTalla = parseFloat(talla?.Precio) || 0;
            const precioTela = parseFloat(tela?.PrecioTela) || 0;
            const precioUnitario = precioBase + precioTalla + precioTela;
            const subtotalDetalle = precioUnitario * detalle.Cantidad;

            console.log(`  - ${producto.Nombre}: $${precioUnitario.toLocaleString()} x ${detalle.Cantidad} = $${subtotalDetalle.toLocaleString()}`);
            subtotal += subtotalDetalle;

            detallesCalculados.push({
                ProductoID: detalle.ProductoID,
                ColorID: colorID || null,
                TallaID: tallaID || null,
                TelaID: insumoID || null,
                Cantidad: detalle.Cantidad,
                PrecioUnitario: precioUnitario,
                TraePrenda: false,
                PrendaDescripcion: ""
            });
        }

        // ===== PASO 3: CREAR LA VENTA =====
        const nuevaVenta = await Venta.create({
            DocumentoID,
            FechaVenta: FechaCotizacion || new Date(),
            Subtotal: subtotal,
            Total: subtotal,
            EstadoID: 8 // PENDIENTE
        });
        console.log(`✓ Venta creada con ID: ${nuevaVenta.VentaID}`);

        // ===== PASO 4: CREAR DETALLES DE VENTA =====
        for (const detalle of detallesCalculados) {
            await DetalleVenta.create({
                VentaID: nuevaVenta.VentaID,
                ProductoID: detalle.ProductoID,
                ColorID: detalle.ColorID,
                TallaID: detalle.TallaID,
                // Solo agregar TelaID si el modelo DetalleVenta lo soporta
                ...(detalle.TelaID ? { TelaID: detalle.TelaID } : {}),
                Cantidad: detalle.Cantidad,
                PrecioUnitario: detalle.PrecioUnitario
            });
        }

        // ===== PASO 5: DESCONTAR STOCK (solo prendas del inventario) =====
        console.log('\nDESCONTANDO STOCK...');
        for (const detalle of detallesCalculados) {
            // FIX: Solo descontar stock si NO es prenda propia
            if (detalle.TraePrenda || !detalle.ColorID || !detalle.TallaID) {
                console.log('  → Prenda propia / sin variante, no se descuenta stock');
                continue;
            }

            const whereConditions = {
                ProductoID: detalle.ProductoID,
                ColorID: detalle.ColorID,
                TallaID: detalle.TallaID
            };
            if (detalle.TelaID) whereConditions.TelaID = detalle.TelaID;

            await InventarioProducto.decrement('Stock', { by: detalle.Cantidad, where: whereConditions });
            console.log(`  ✓ Descontado ${detalle.Cantidad} unidades de Producto ${detalle.ProductoID}`);
        }

        return res.status(201).json({
            tipo: 'venta',
            message: 'Venta pendiente creada exitosamente',
            mensaje: 'Tu pedido ha sido registrado y está pendiente de procesamiento.',
            venta: nuevaVenta,
            detalles: detallesCalculados
        });
    } catch (error) {
        console.error('Error al crear venta directa:', error);
        throw error;
    }
}

// ============================================
// CREAR COTIZACIÓN CON DISEÑOS (SIN DESCUENTO DE STOCK)
// ============================================
async function crearCotizacionConDiseños(req, res, { DocumentoID, FechaCotizacion, detalles, usuario }) {
    try {
        console.log('\nCREANDO COTIZACIÓN CON DISEÑOS...');

        const nuevaCotizacion = await Cotizacion.create({
            DocumentoID,
            FechaCotizacion: FechaCotizacion || new Date(),
            ValorTotal: 0,
            EstadoID: 1
        });

        for (let i = 0; i < detalles.length; i++) {
            const detalle = detalles[i];

            const nuevoDetalle = await DetalleCotizacion.create({
                CotizacionID: nuevaCotizacion.CotizacionID,
                ProductoID: detalle.ProductoID,
                Cantidad: detalle.Cantidad,
                // FIX: guardar TraePrenda correctamente
                TraePrenda: Boolean(detalle.TraePrenda),
                PrendaDescripcion: detalle.PrendaDescripcion || null
            });

            if (detalle.tecnicas?.length > 0) {
                await CotizacionTecnica.bulkCreate(detalle.tecnicas.map(t => ({
                    DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID,
                    TecnicaID: t.TecnicaID,
                    ParteID: t.ParteID,
                    ImagenDiseño: t.ImagenDiseño,
                    Observaciones: t.Observaciones,
                    CostoTecnica: t.CostoTecnica || 0
                })));
            }

            // FIX: Solo guardar tallas/colores/insumos si NO trae prenda propia
            if (!detalle.TraePrenda) {
                if (detalle.tallas?.length > 0) {
                    await CotizacionTalla.bulkCreate(detalle.tallas.map(t => ({
                        DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID,
                        TallaID: t.TallaID,
                        Cantidad: t.Cantidad,
                        PrecioTalla: t.PrecioTalla || 0
                    })));
                }
                if (detalle.colores?.length > 0) {
                    await CotizacionColor.bulkCreate(detalle.colores.map(c => ({
                        DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID,
                        ColorID: c.ColorID,
                        Cantidad: c.Cantidad
                    })));
                }
                if (detalle.insumos?.length > 0) {
                    await CotizacionInsumo.bulkCreate(detalle.insumos.map(i => ({
                        DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID,
                        InsumoID: i.InsumoID,
                        CantidadRequerida: i.CantidadRequerida
                    })));
                }
            }
        }

        const cotizacionCompleta = await Cotizacion.findByPk(nuevaCotizacion.CotizacionID, {
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
            ]
        });

        return res.status(201).json({
            tipo: 'cotizacion',
            message: 'Cotización creada exitosamente',
            mensaje: 'Tu cotización ha sido registrada. El administrador asignará los costos y te contactará pronto.',
            cotizacion: cotizacionCompleta
        });
    } catch (error) {
        console.error('Error al crear cotización con diseños:', error);
        throw error;
    }
}

// ============================================
// CONVERTIR COTIZACIÓN A VENTA - CON FIX TraePrenda
// ============================================
exports.convertirCotizacionAVenta = async (req, res) => {
    try {
        const { cotizacionID } = req.params;
        console.log('\nCONVIRTIENDO COTIZACIÓN A VENTA, ID:', cotizacionID);

        const cotizacion = await Cotizacion.findByPk(cotizacionID, {
            include: [
                {
                    model: DetalleCotizacion, as: 'detalles',
                    include: [
                        { model: Producto, as: 'producto' },
                        { model: CotizacionTalla, as: 'tallas', include: [{ model: Talla, as: 'talla' }] },
                        { model: CotizacionColor, as: 'colores', include: [{ model: Color, as: 'color' }] },
                        { model: CotizacionInsumo, as: 'insumos', include: [{ model: Insumo, as: 'insumo' }] },
                        { model: CotizacionTecnica, as: 'tecnicas', include: [{ model: Tecnica, as: 'tecnica' }, { model: Parte, as: 'parte' }] }
                    ]
                },
                { model: Usuario, as: 'usuario' },
                { model: Estado, as: 'estado' }
            ]
        });

        if (!cotizacion) {
            return res.status(404).json({ message: 'Cotización no encontrada', cotizacionID });
        }

        if (cotizacion.EstadoID !== 2) {
            return res.status(400).json({
                message: 'Solo se pueden convertir cotizaciones aprobadas',
                estadoActual: cotizacion.estado?.Nombre,
                estadoEsperado: 'Aprobada (ID: 2)'
            });
        }

        if (!cotizacion.detalles || cotizacion.detalles.length === 0) {
            return res.status(400).json({ message: 'La cotización no tiene productos asociados' });
        }

        // ===== VALIDAR STOCK (solo prendas del inventario) =====
        console.log('\nVALIDANDO STOCK...');
        for (const detalle of cotizacion.detalles) {
            const traePrenda = Boolean(detalle.TraePrenda);
            if (traePrenda) {
                console.log(`  ⚠ Prenda propia → skip stock`);
                continue;
            }

            const colorID = detalle.colores?.[0]?.ColorID;
            const tallaID = detalle.tallas?.[0]?.TallaID;
            if (!colorID || !tallaID) continue; // sin variante definida, skip

            const telaID = detalle.insumos?.[0]?.InsumoID || null;
            const whereStock = { ProductoID: detalle.ProductoID, ColorID: colorID, TallaID: tallaID };
            if (telaID) whereStock.TelaID = telaID;

            const variante = await InventarioProducto.findOne({ where: whereStock });

            // ← Ya NO bloqueamos si no hay stock, solo lo registramos
            if (!variante || variante.Stock < detalle.Cantidad) {
                console.log(`  ⚠ Sin stock suficiente para ${detalle.producto?.Nombre} — se fabricará a pedido`);
            } else {
                console.log(`  ✓ ${detalle.producto?.Nombre} — stock OK (${variante.Stock} disponibles)`);
            }
        }

        // ===== CREAR VENTA =====
        const nuevaVenta = await Venta.create({
            DocumentoID: cotizacion.DocumentoID,
            FechaVenta: new Date(),
            Subtotal: cotizacion.ValorTotal,
            Total: cotizacion.ValorTotal,
            EstadoID: 8 // PENDIENTE
        });
        console.log(`✓ Venta creada con ID: ${nuevaVenta.VentaID}`);

        // ===== CREAR DETALLES Y DESCONTAR STOCK =====
        for (const detalle of cotizacion.detalles) {
            const traePrenda = Boolean(detalle.TraePrenda);
            const tallaID = detalle.tallas?.[0]?.TallaID || null;
            const colorID = detalle.colores?.[0]?.ColorID || null;
            const telaID = detalle.insumos?.[0]?.InsumoID || null;

            // Calcular precio
            const precioBase = parseFloat(detalle.producto?.PrecioBase) || 0;
            const precioTalla = parseFloat(detalle.tallas?.[0]?.talla?.Precio) || 0;
            const precioTela = parseFloat(detalle.insumos?.[0]?.insumo?.PrecioTela) || 0;
            const costoTecnicas = detalle.tecnicas?.reduce((sum, t) => sum + (parseFloat(t.CostoTecnica) || 0), 0) || 0;
            const precioUnitario = traePrenda ? 0 : (precioBase + precioTalla + precioTela + costoTecnicas);

            await DetalleVenta.create({
                VentaID: nuevaVenta.VentaID,
                ProductoID: detalle.ProductoID,
                ColorID: colorID,
                TallaID: tallaID,
                Cantidad: detalle.Cantidad,
                PrecioUnitario: precioUnitario
            });

            // Descontar stock SOLO si no es prenda propia, tiene variante Y hay stock suficiente
            if (!traePrenda && colorID && tallaID) {
                const whereDecrement = { ProductoID: detalle.ProductoID, ColorID: colorID, TallaID: tallaID };
                if (telaID) whereDecrement.TelaID = telaID;

                const variante = await InventarioProducto.findOne({ where: whereDecrement });

                if (variante && variante.Stock >= detalle.Cantidad) {
                    await InventarioProducto.decrement('Stock', { by: detalle.Cantidad, where: whereDecrement });
                    console.log(`  ✓ Stock descontado: ${detalle.Cantidad} uds de ${detalle.producto?.Nombre}`);
                } else {
                    console.log(`  ⚠ Sin stock — ${detalle.producto?.Nombre} se fabricará a pedido`);
                }
            } else if (traePrenda) {
                console.log(`  ⚠ Prenda propia → stock no descontado`);
            }
        }

        // ===== ACTUALIZAR ESTADO DE COTIZACIÓN =====
        await cotizacion.update({ EstadoID: 5 }); // Procesada
        console.log('✓ Cotización actualizada a estado Procesada\n');

        return res.status(201).json({
            message: 'Cotización convertida a venta exitosamente',
            venta: {
                VentaID: nuevaVenta.VentaID,
                Total: nuevaVenta.Total,
                Subtotal: nuevaVenta.Subtotal,
                FechaVenta: nuevaVenta.FechaVenta,
                EstadoID: nuevaVenta.EstadoID
            },
            cotizacionID: cotizacion.CotizacionID
        });
    } catch (error) {
        console.error('ERROR AL CONVERTIR COTIZACIÓN:', error.message);
        console.error('STACK:', error.stack);
        console.error('DETALLE:', error.parent?.sqlMessage || error.original?.message || 'sin detalle SQL');
        res.status(500).json({
            message: 'Error al convertir cotización',
            error: error.message
        });
    }
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
    try {
        const { DocumentoID, FechaCotizacion, ValorTotal, detalles } = req.body;

        if (!DocumentoID) return res.status(400).json({ message: 'DocumentoID es obligatorio' });
        if (!detalles || detalles.length === 0) return res.status(400).json({ message: 'Debe incluir al menos un producto' });

        const usuario = await Usuario.findByPk(DocumentoID);
        if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado', DocumentoID });

        const nuevaCotizacion = await Cotizacion.create({
            DocumentoID,
            FechaCotizacion: FechaCotizacion || new Date(),
            ValorTotal: ValorTotal || 0,
            EstadoID: 1
        });

        for (const detalle of detalles) {
            const nuevoDetalle = await DetalleCotizacion.create({
                CotizacionID: nuevaCotizacion.CotizacionID,
                ProductoID: detalle.ProductoID,
                Cantidad: detalle.Cantidad,
                TraePrenda: Boolean(detalle.TraePrenda),
                PrendaDescripcion: detalle.PrendaDescripcion || null
            });

            if (detalle.tallas?.length > 0) await CotizacionTalla.bulkCreate(detalle.tallas.map(t => ({ DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID, TallaID: t.TallaID, Cantidad: t.Cantidad || detalle.Cantidad, PrecioTalla: t.PrecioTalla || 0 })));
            if (detalle.colores?.length > 0) await CotizacionColor.bulkCreate(detalle.colores.map(c => ({ DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID, ColorID: c.ColorID, Cantidad: c.Cantidad || detalle.Cantidad })));
            if (detalle.insumos?.length > 0) await CotizacionInsumo.bulkCreate(detalle.insumos.map(i => ({ DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID, InsumoID: i.InsumoID, CantidadRequerida: i.CantidadRequerida || detalle.Cantidad })));
            if (detalle.tecnicas?.length > 0) await CotizacionTecnica.bulkCreate(detalle.tecnicas.map(t => ({ DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID, TecnicaID: t.TecnicaID, ParteID: t.ParteID, ImagenDiseño: t.ImagenDiseño || null, Observaciones: t.Observaciones || null, CostoTecnica: t.CostoTecnica || 0 })));
        }

        const cotizacionCompleta = await Cotizacion.findByPk(nuevaCotizacion.CotizacionID, {
            include: [
                { model: Usuario, as: 'usuario' },
                { model: Estado, as: 'estado' },
                { model: DetalleCotizacion, as: 'detalles', include: [{ model: Producto, as: 'producto' }, { model: CotizacionTecnica, as: 'tecnicas', include: [{ model: Tecnica, as: 'tecnica' }, { model: Parte, as: 'parte' }] }, { model: CotizacionTalla, as: 'tallas', include: [{ model: Talla, as: 'talla' }] }, { model: CotizacionColor, as: 'colores', include: [{ model: Color, as: 'color' }] }, { model: CotizacionInsumo, as: 'insumos', include: [{ model: Insumo, as: 'insumo' }] }] }
            ]
        });

        return res.status(201).json({ message: 'Cotización creada exitosamente', cotizacion: cotizacionCompleta });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear cotización', error: error.message });
    }
};

// ============================================
// CRUD ESTÁNDAR
// ============================================
exports.getAllCotizaciones = async (req, res) => {
    try {
        const cotizaciones = await Cotizacion.findAll({
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
            ]
        });
        res.json(cotizaciones);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener cotizaciones', error: error.message });
    }
};

exports.getCotizacionById = async (req, res) => {
    try {
        const cotizacion = await Cotizacion.findByPk(req.params.id, {
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
            ]
        });
        if (!cotizacion) return res.status(404).json({ message: 'Cotización no encontrada' });

        const cotizacionEnriquecida = {
            ...cotizacion.toJSON(),
            detalles: cotizacion.detalles.map(det => ({
                ...det.toJSON(),
                nombreProductoDisplay: obtenerNombreProducto(det),
                // Agregar URL de imágenes a cada técnica para que el dashboard pueda mostrarlas
                tecnicas: det.tecnicas?.map(tec => ({
                    ...tec.toJSON(),
                    ImagenUrl: tec.ImagenDiseño
                        ? `${process.env.API_URL || 'http://localhost:3000'}/api/cotizaciones/imagen/${tec.ImagenDiseño}`
                        : null
                })) || []
            }))
        };
        res.json(cotizacionEnriquecida);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener cotización', error: error.message });
    }
};

exports.updateCotizacion = async (req, res) => {
    try {
        const { ValorTotal, EstadoID } = req.body;
        const cotizacionID = req.params.id;

        const cotizacion = await Cotizacion.findByPk(cotizacionID, {
            include: [{
                model: DetalleCotizacion, as: 'detalles',
                include: [{ model: Producto, as: 'producto' }, { model: CotizacionTalla, as: 'tallas', include: [{ model: Talla, as: 'talla' }] }, { model: CotizacionColor, as: 'colores', include: [{ model: Color, as: 'color' }] }]
            }]
        });

        if (!cotizacion) return res.status(404).json({ message: 'Cotización no encontrada' });

        const estadoAnterior = cotizacion.EstadoID;
        const estadoNuevo = EstadoID ? parseInt(EstadoID) : estadoAnterior;

        // Si se cancela una cotización aprobada (2 -> 4), devolver stock
        if (estadoAnterior === 2 && estadoNuevo === 4) {
            for (const detalle of cotizacion.detalles) {
                if (!Boolean(detalle.TraePrenda)) {
                    const colorID = detalle.colores?.[0]?.ColorID;
                    const tallaID = detalle.tallas?.[0]?.TallaID;
                    if (colorID && tallaID) {
                        await InventarioProducto.increment('Stock', {
                            by: detalle.Cantidad,
                            where: { ProductoID: detalle.ProductoID, ColorID: colorID, TallaID: tallaID }
                        });
                    }
                }
            }
        }

        await cotizacion.update({
            ValorTotal: ValorTotal !== undefined ? ValorTotal : cotizacion.ValorTotal,
            EstadoID: estadoNuevo
        });

        res.json({ message: 'Cotización actualizada exitosamente', cotizacion });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar cotización', error: error.message });
    }
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
    try {
        const { cotizacionID } = req.params;
        const cotizacion = await Cotizacion.findByPk(cotizacionID, {
            include: [
                {
                    model: DetalleCotizacion, as: 'detalles',
                    include: [{ model: Producto, as: 'producto' }, { model: CotizacionTalla, as: 'tallas' }, { model: CotizacionColor, as: 'colores' }]
                },
                { model: Usuario, as: 'usuario' },
                { model: Estado, as: 'estado' }
            ]
        });

        if (!cotizacion) return res.status(404).json({ message: 'Cotización no encontrada', cotizacionID });
        if (cotizacion.EstadoID === 5) return res.status(400).json({ message: 'No se puede cancelar una cotización ya convertida a venta' });

        let stockDevuelto = false;
        if (cotizacion.EstadoID === 2) {
            for (const detalle of cotizacion.detalles) {
                if (!Boolean(detalle.TraePrenda)) {
                    const colorID = detalle.colores?.[0]?.ColorID;
                    const tallaID = detalle.tallas?.[0]?.TallaID;
                    if (colorID && tallaID) {
                        await InventarioProducto.increment('Stock', { by: detalle.Cantidad, where: { ProductoID: detalle.ProductoID, ColorID: colorID, TallaID: tallaID } });
                        stockDevuelto = true;
                    }
                }
            }
        }

        await cotizacion.update({ EstadoID: 4 });
        return res.status(200).json({
            message: 'Cotización cancelada exitosamente',
            cotizacionID: cotizacion.CotizacionID,
            estadoNuevo: 'Cancelada',
            stockDevuelto
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al cancelar cotización', error: error.message });
    }
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
            const precioBase = parseFloat(detalle.producto?.PrecioBase || 0);
            subtotalDetalle += precioBase * detalle.Cantidad;
            if (detalle.insumos?.length > 0) for (const insumo of detalle.insumos) subtotalDetalle += parseFloat(insumo.insumo?.PrecioTela || 0) * parseFloat(insumo.CantidadRequerida || 0);
            if (detalle.tallas?.length > 0) for (const talla of detalle.tallas) subtotalDetalle += parseFloat(talla.talla?.Precio || 0) * parseInt(talla.Cantidad || 0);
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