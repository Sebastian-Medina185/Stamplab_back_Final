const {
    Cotizacion,
    DetalleCotizacion,
    Estado,
    Usuario,
    CotizacionTecnica,
    CotizacionTalla,
    CotizacionColor,
    CotizacionInsumo,
    Tecnica,
    Talla,
    Color,
    Insumo,
    Producto,
    Parte,
    Venta,
    DetalleVenta,
    InventarioProducto,
    sequelize
} = require('../models');

const { Op } = require('sequelize');


// Agregar esta función helper al inicio del archivo
function obtenerNombreProducto(detalle) {
    if (detalle.TraePrenda) {
        return "Prenda llevada por el cliente";
    }
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

        // ========================================
        // VALIDACIONES BÁSICAS
        // ========================================
        if (!DocumentoID) {
            return res.status(400).json({
                message: 'DocumentoID es obligatorio',
                receivedData: req.body
            });
        }

        if (!detalles || detalles.length === 0) {
            return res.status(400).json({
                message: 'Debe incluir al menos un producto',
                receivedData: req.body
            });
        }

        // Validar que el usuario existe
        const usuario = await Usuario.findByPk(DocumentoID);
        if (!usuario) {
            return res.status(404).json({
                message: 'Usuario no encontrado',
                DocumentoID: DocumentoID
            });
        }

        console.log('Usuario encontrado:', usuario.Nombre);

        // ========================================
        // DETECTAR SI HAY DISEÑOS (TÉCNICAS)
        // ========================================
        const tieneDiseños = detalles.some(detalle =>
            detalle.tecnicas &&
            Array.isArray(detalle.tecnicas) &&
            detalle.tecnicas.length > 0
        );

        console.log('\nAnálisis de contenido:');
        console.log('   - Tiene diseños aplicados:', tieneDiseños ? 'SÍ' : 'NO');

        // ========================================
        // DECISIÓN: COTIZACIÓN O VENTA DIRECTA
        // ========================================
        if (!tieneDiseños) {
            console.log('\nRUTA: VENTA DIRECTA (sin diseños)');
            console.log('   → Se creará una VENTA PENDIENTE');
            return await crearVentaDirecta(req, res, { DocumentoID, FechaCotizacion, detalles, usuario });
        } else {
            console.log('\nRUTA: COTIZACIÓN (con diseños)');
            console.log('   → Se creará una COTIZACIÓN normal');
            return await crearCotizacionConDiseños(req, res, { DocumentoID, FechaCotizacion, detalles, usuario });
        }

    } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('ERROR EN COTIZACIÓN INTELIGENTE');
        console.error('='.repeat(60));
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('='.repeat(60) + '\n');

        res.status(500).json({
            message: 'Error al procesar la solicitud',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};



// ============================================
// CREAR COTIZACIÓN COMPLETA (desde Dashboard)
// ============================================
exports.createCotizacionCompleta = async (req, res) => {
    try {
        const { DocumentoID, FechaCotizacion, ValorTotal, detalles } = req.body;

        console.log('\n' + '='.repeat(60));
        console.log('CREANDO COTIZACIÓN COMPLETA (DASHBOARD)');
        console.log('='.repeat(60));
        console.log('DocumentoID:', DocumentoID);
        console.log('Detalles recibidos:', detalles?.length || 0);

        // Validaciones
        if (!DocumentoID) {
            return res.status(400).json({
                message: 'DocumentoID es obligatorio'
            });
        }

        if (!detalles || detalles.length === 0) {
            return res.status(400).json({
                message: 'Debe incluir al menos un producto'
            });
        }

        // Validar que el usuario existe
        const usuario = await Usuario.findByPk(DocumentoID);
        if (!usuario) {
            return res.status(404).json({
                message: 'Usuario no encontrado',
                DocumentoID
            });
        }

        // Crear la cotización
        const nuevaCotizacion = await Cotizacion.create({
            DocumentoID,
            FechaCotizacion: FechaCotizacion || new Date(),
            ValorTotal: ValorTotal || 0,
            EstadoID: 1 // Pendiente
        });

        console.log(`✓ Cotización creada con ID: ${nuevaCotizacion.CotizacionID}`);

        // Crear detalles
        for (const detalle of detalles) {
            const nuevoDetalle = await DetalleCotizacion.create({
                CotizacionID: nuevaCotizacion.CotizacionID,
                ProductoID: detalle.ProductoID,
                Cantidad: detalle.Cantidad,
                TraePrenda: detalle.TraePrenda || false,
                PrendaDescripcion: detalle.PrendaDescripcion || null
            });

            // Crear tallas
            if (detalle.tallas && detalle.tallas.length > 0) {
                await CotizacionTalla.bulkCreate(
                    detalle.tallas.map(t => ({
                        DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID,
                        TallaID: t.TallaID,
                        Cantidad: t.Cantidad || detalle.Cantidad,
                        PrecioTalla: t.PrecioTalla || 0
                    }))
                );
            }

            // Crear colores
            if (detalle.colores && detalle.colores.length > 0) {
                await CotizacionColor.bulkCreate(
                    detalle.colores.map(c => ({
                        DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID,
                        ColorID: c.ColorID,
                        Cantidad: c.Cantidad || detalle.Cantidad
                    }))
                );
            }

            // Crear insumos
            if (detalle.insumos && detalle.insumos.length > 0) {
                await CotizacionInsumo.bulkCreate(
                    detalle.insumos.map(i => ({
                        DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID,
                        InsumoID: i.InsumoID,
                        CantidadRequerida: i.CantidadRequerida || detalle.Cantidad
                    }))
                );
            }

            // Crear técnicas
            if (detalle.tecnicas && detalle.tecnicas.length > 0) {
                await CotizacionTecnica.bulkCreate(
                    detalle.tecnicas.map(t => ({
                        DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID,
                        TecnicaID: t.TecnicaID,
                        ParteID: t.ParteID,
                        ImagenDiseño: t.ImagenDiseño || null,
                        Observaciones: t.Observaciones || null,
                        CostoTecnica: t.CostoTecnica || 0
                    }))
                );
            }
        }

        // Obtener cotización completa
        const cotizacionCompleta = await Cotizacion.findByPk(nuevaCotizacion.CotizacionID, {
            include: [
                { model: Usuario, as: 'usuario' },
                { model: Estado, as: 'estado' },
                {
                    model: DetalleCotizacion,
                    as: 'detalles',
                    include: [
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
                }
            ]
        });

        console.log('='.repeat(60));
        console.log('✅ COTIZACIÓN COMPLETA CREADA EXITOSAMENTE');
        console.log('='.repeat(60) + '\n');

        return res.status(201).json({
            message: 'Cotización creada exitosamente',
            cotizacion: cotizacionCompleta
        });

    } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('❌ ERROR AL CREAR COTIZACIÓN COMPLETA');
        console.error('='.repeat(60));
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('='.repeat(60) + '\n');

        res.status(500).json({
            message: 'Error al crear cotización',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};



// ===========================================
// NUEVA FUNCIÓN: CONVERTIR COTIZACIÓN A VENTA
// ============================================
exports.convertirCotizacionAVenta = async (req, res) => {
    try {
        const { cotizacionID } = req.params;

        console.log('\n' + '='.repeat(60));
        console.log('CONVIRTIENDO COTIZACIÓN A VENTA');
        console.log('CotizacionID recibido:', cotizacionID);
        console.log('='.repeat(60));

        // Obtener cotización completa
        const cotizacion = await Cotizacion.findByPk(cotizacionID, {
            include: [
                {
                    model: DetalleCotizacion,
                    as: 'detalles',
                    include: [
                        { model: Producto, as: 'producto' },
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
                        },
                        {
                            model: CotizacionTecnica,
                            as: 'tecnicas',
                            include: [
                                { model: Tecnica, as: 'tecnica' },
                                { model: Parte, as: 'parte' }
                            ]
                        }
                    ]
                },
                { model: Usuario, as: 'usuario' },
                { model: Estado, as: 'estado' }
            ]
        });

        if (!cotizacion) {
            console.error('Cotización no encontrada');
            return res.status(404).json({
                message: 'Cotización no encontrada',
                cotizacionID
            });
        }

        console.log('✓ Cotización encontrada');
        console.log('   Estado actual:', cotizacion.estado?.Nombre);
        console.log('   EstadoID:', cotizacion.EstadoID);

        if (cotizacion.EstadoID !== 2) { // 2 = Aprobada
            console.error('Estado incorrecto:', cotizacion.EstadoID);
            return res.status(400).json({
                message: 'Solo se pueden convertir cotizaciones aprobadas',
                estadoActual: cotizacion.estado?.Nombre || cotizacion.EstadoID,
                estadoEsperado: 'Aprobada (ID: 2)'
            });
        }

        console.log('✓ Estado válido (Aprobada)');
        console.log('   Detalles encontrados:', cotizacion.detalles?.length || 0);

        if (!cotizacion.detalles || cotizacion.detalles.length === 0) {
            return res.status(400).json({
                message: 'La cotización no tiene productos asociados'
            });
        }

        // ========================================
        // ✅ VALIDAR STOCK SOLO SI NO ES PRENDA PROPIA (CORREGIDO)
        // ========================================
        console.log('\n🔍 VALIDANDO REQUISITOS...');

        for (const detalle of cotizacion.detalles) {
            const productoNombre = detalle.producto?.Nombre || `Producto ${detalle.ProductoID}`;

            // ✅ PRIMERO: Verificar TraePrenda ANTES de acceder a colorID/tallaID
            const traePrenda = Boolean(detalle.TraePrenda);

            console.log(`\n   📦 ${productoNombre}:`);
            console.log(`      TraePrenda: ${traePrenda}`);
            console.log(`      Cantidad: ${detalle.Cantidad}`);

            // ✅ SI TRAE PRENDA PROPIA, OMITIR TODA LA VALIDACIÓN
            if (traePrenda) {
                console.log(`      ⚠️ Es prenda propia - No requiere stock`);
                console.log(`      ✓ Validación omitida correctamente`);
                continue; // Saltar al siguiente detalle inmediatamente
            }

            // ✅ SOLO SI NO TRAE PRENDA, ENTONCES VALIDAR STOCK
            console.log(`      🔍 Prenda del inventario - Validando stock...`);

            const colorID = detalle.colores?.[0]?.ColorID;
            const tallaID = detalle.tallas?.[0]?.TallaID;

            console.log(`      ProductoID: ${detalle.ProductoID}`);
            console.log(`      ColorID: ${colorID}`);
            console.log(`      TallaID: ${tallaID}`);

            // Validar que existan color y talla
            if (!colorID || !tallaID) {
                throw new Error(
                    `❌ ERROR: Cotización sin color/talla especificada en ${productoNombre}.\n` +
                    `   Solución: Si el cliente trae prenda propia, marca TraePrenda=true en la base de datos.\n` +
                    `   ProductoID: ${detalle.ProductoID}, ColorID: ${colorID}, TallaID: ${tallaID}`
                );
            }

            // Validar que exista la variante en inventario
            const variante = await InventarioProducto.findOne({
                where: {
                    ProductoID: detalle.ProductoID,
                    ColorID: colorID,
                    TallaID: tallaID
                },
                attributes: ['InventarioID', 'ProductoID', 'ColorID', 'TallaID', 'Stock']
            });

            if (!variante) {
                throw new Error(
                    `❌ No existe variante en inventario para:\n` +
                    `  - Producto: ${productoNombre}\n` +
                    `  - Color ID: ${colorID}\n` +
                    `  - Talla ID: ${tallaID}`
                );
            }

            console.log(`      Stock disponible: ${variante.Stock}`);

            if (variante.Stock < detalle.Cantidad) {
                throw new Error(
                    `❌ Stock insuficiente para ${productoNombre}:\n` +
                    `  - Disponible: ${variante.Stock}\n` +
                    `  - Necesario: ${detalle.Cantidad}\n` +
                    `  - Faltante: ${detalle.Cantidad - variante.Stock}`
                );
            }

            console.log(`      ✅ Stock suficiente`);
        }

        console.log('\n✅ Validación completada exitosamente\n');

        // ========================================
        // CREAR VENTA
        // ========================================
        console.log('📝 CREANDO VENTA...');
        const nuevaVenta = await Venta.create({
            DocumentoID: cotizacion.DocumentoID,
            FechaVenta: new Date(),
            Subtotal: cotizacion.ValorTotal,
            Total: cotizacion.ValorTotal,
            EstadoID: 8 // PENDIENTE
        });

        console.log(`✓ Venta creada con ID: ${nuevaVenta.VentaID}\n`);

        // ========================================
        // CREAR DETALLES Y DESCONTAR STOCK
        // ========================================
        console.log('📦 CREANDO DETALLES Y DESCONTANDO STOCK...\n');

        for (const detalle of cotizacion.detalles) {
            const traePrenda = Boolean(detalle.TraePrenda);
            const tallaID = detalle.tallas?.[0]?.TallaID || null;
            const colorID = detalle.colores?.[0]?.ColorID || null;

            // Calcular precio unitario
            const precioBase = parseFloat(detalle.producto?.PrecioBase) || 0;
            const precioTalla = parseFloat(detalle.tallas?.[0]?.talla?.Precio) || 0;
            const precioTela = parseFloat(detalle.insumos?.[0]?.insumo?.PrecioTela) || 0;
            const costoTecnicas = detalle.tecnicas?.reduce((sum, t) =>
                sum + (parseFloat(t.CostoTecnica) || 0), 0) || 0;
            const precioUnitario = precioBase + precioTalla + precioTela + costoTecnicas;

            console.log(`   📦 ${detalle.producto?.Nombre}:`);
            console.log(`      Precio unitario: $${precioUnitario.toLocaleString()}`);
            console.log(`      Cantidad: ${detalle.Cantidad}`);
            console.log(`      TraePrenda: ${traePrenda}`);

            // Crear detalle de venta
            await DetalleVenta.create({
                VentaID: nuevaVenta.VentaID,
                ProductoID: detalle.ProductoID,
                ColorID: colorID,  // Puede ser null si trae prenda
                TallaID: tallaID,  // Puede ser null si trae prenda
                Cantidad: detalle.Cantidad,
                PrecioUnitario: precioUnitario
            });

            console.log(`      ✅ Detalle de venta creado`);

            // ✅ DESCONTAR STOCK SOLO SI NO ES PRENDA PROPIA
            if (!traePrenda && colorID && tallaID) {
                const [affectedRows] = await InventarioProducto.decrement(
                    'Stock',
                    {
                        by: detalle.Cantidad,
                        where: {
                            ProductoID: detalle.ProductoID,
                            ColorID: colorID,
                            TallaID: tallaID
                        }
                    }
                );

                console.log(`      Stock descontado: ${detalle.Cantidad} unidades`);

                if (affectedRows === 0) {
                    console.warn(`      Advertencia: No se afectaron filas al descontar stock`);
                }
            } else {
                console.log(`      Prenda propia - Stock no descontado`);
            }

            console.log(''); // Línea en blanco entre productos
        }

        // ========================================
        // ACTUALIZAR ESTADO A "PROCESADA" (ID 14)
        // ========================================
        console.log('ACTUALIZANDO ESTADO DE COTIZACIÓN...');
        await cotizacion.update({ EstadoID: 14 });
        console.log('✓ Estado actualizado a PROCESADA (ID: 14)\n');

        console.log('='.repeat(60));
        console.log('CONVERSIÓN EXITOSA');
        console.log('='.repeat(60) + '\n');

        return res.status(201).json({
            message: 'Cotización convertida a venta exitosamente',
            venta: {
                VentaID: nuevaVenta.VentaID,
                Total: nuevaVenta.Total,
                Subtotal: nuevaVenta.Subtotal,
                FechaVenta: nuevaVenta.FechaVenta,
                EstadoID: nuevaVenta.EstadoID
            },
            cotizacionID: cotizacion.CotizacionID,
            estadoActualizado: 'Procesada',
            nuevoEstadoID: 14
        });

    } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('ERROR AL CONVERTIR COTIZACIÓN');
        console.error('='.repeat(60));
        console.error('Mensaje:', error.message);
        console.error('Stack:', error.stack);
        console.error('='.repeat(60) + '\n');

        res.status(500).json({
            message: 'Error al convertir cotización',
            error: error.message,
            detalles: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};


// ============================================
// CREAR VENTA DIRECTA (SIN DISEÑOS) + DESCUENTO DE STOCK
// ============================================
async function crearVentaDirecta(req, res, { DocumentoID, FechaCotizacion, detalles, usuario }) {
    try {
        console.log('\nCREANDO VENTA DIRECTA...');

        let subtotal = 0;
        const detallesCalculados = [];

        // ========================================
        // PASO 1: VALIDAR STOCK DISPONIBLE - CORREGIDO
        // ========================================
        console.log('\nVALIDANDO STOCK DISPONIBLE...');
        for (const detalle of detalles) {
            const colorID = detalle.colores?.[0]?.ColorID;
            const tallaID = detalle.tallas?.[0]?.TallaID;
            const telaID = detalle.insumos?.[0]?.InsumoID; // INCLUIR TELA
            const cantidad = parseInt(detalle.Cantidad);

            if (!colorID || !tallaID) {
                throw new Error('Se requiere Color y Talla para validar stock');
            }

            console.log(`   Buscando variante:`);
            console.log(`   - ProductoID: ${detalle.ProductoID}`);
            console.log(`   - ColorID: ${colorID}`);
            console.log(`   - TallaID: ${tallaID}`);
            console.log(`   - TelaID: ${telaID}`); // ✅ LOG

            // CORRECCIÓN: Incluir TelaID en la búsqueda
            const whereConditions = {
                ProductoID: detalle.ProductoID,
                ColorID: colorID,
                TallaID: tallaID
            };

            // Solo agregar TelaID si existe (puede ser null)
            if (telaID !== undefined && telaID !== null) {
                whereConditions.TelaID = telaID;
            }

            const variante = await InventarioProducto.findOne({
                where: whereConditions
            });

            if (!variante) {
                const producto = await Producto.findByPk(detalle.ProductoID);
                throw new Error(
                    `No existe variante en inventario para:\n` +
                    `  - Producto: ${producto?.Nombre || detalle.ProductoID}\n` +
                    `  - Color ID: ${colorID}\n` +
                    `  - Talla ID: ${tallaID}\n` +
                    `  - Tela ID: ${telaID || 'Sin tela'}\n\n` +
                    `Verifica que esta combinación esté registrada en el inventario.`
                );
            }

            if (variante.Stock < cantidad) {
                const producto = await Producto.findByPk(detalle.ProductoID);
                throw new Error(
                    `Stock insuficiente para ${producto?.Nombre || 'producto'}.\n` +
                    `Disponible: ${variante.Stock}, Solicitado: ${cantidad}`
                );
            }

            console.log(`   ✓ Stock validado - ${variante.Stock} disponibles`);
        }

        // ========================================
        // PASO 2: CALCULAR PRECIOS
        // ========================================
        console.log('\nCALCULANDO PRECIOS...');
        for (const detalle of detalles) {
            const producto = await Producto.findByPk(detalle.ProductoID);
            if (!producto) {
                throw new Error(`Producto ${detalle.ProductoID} no encontrado`);
            }

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

            console.log(`   - ${producto.Nombre}:`);
            console.log(`     Precio base: $${precioBase.toLocaleString()}`);
            console.log(`     Precio talla: $${precioTalla.toLocaleString()}`);
            console.log(`     Precio tela: $${precioTela.toLocaleString()}`);
            console.log(`     Precio unitario: $${precioUnitario.toLocaleString()}`);
            console.log(`     Cantidad: ${detalle.Cantidad}`);
            console.log(`     Subtotal: $${subtotalDetalle.toLocaleString()}`);

            subtotal += subtotalDetalle;

            detallesCalculados.push({
                ProductoID: detalle.ProductoID,
                ColorID: colorID || null,
                TallaID: tallaID || null,
                Cantidad: detalle.Cantidad,
                PrecioUnitario: precioUnitario
            });
        }

        console.log(`\nSubtotal total: $${subtotal.toLocaleString()}`);

        // ========================================
        // PASO 3: CREAR LA VENTA
        // ========================================
        console.log('\nCREANDO VENTA...');
        const nuevaVenta = await Venta.create({
            DocumentoID,
            FechaVenta: FechaCotizacion || new Date(),
            Subtotal: subtotal,
            Total: subtotal,
            EstadoID: 8 // PENDIENTE
        });

        console.log(`✓ Venta creada con ID: ${nuevaVenta.VentaID}`);

        // ========================================
        // PASO 4: CREAR DETALLES DE VENTA
        // ========================================
        for (const detalle of detallesCalculados) {
            await DetalleVenta.create({
                VentaID: nuevaVenta.VentaID,
                ...detalle
            });
        }

        console.log(`✓ ${detallesCalculados.length} detalles de venta creados`);

        // ========================================
        // PASO 5: DESCONTAR STOCK - CORREGIDO
        // ========================================
        console.log('\n📦 DESCONTANDO STOCK...');
        for (let i = 0; i < detalles.length; i++) {
            const detalleOriginal = detalles[i];
            const detalleCalculado = detallesCalculados[i];

            const telaID = detalleOriginal.insumos?.[0]?.InsumoID;

            // CORRECCIÓN: Incluir TelaID en el descuento
            const whereConditions = {
                ProductoID: detalleCalculado.ProductoID,
                ColorID: detalleCalculado.ColorID,
                TallaID: detalleCalculado.TallaID
            };

            if (telaID !== undefined && telaID !== null) {
                whereConditions.TelaID = telaID;
            }

            await InventarioProducto.decrement('Stock', {
                by: detalleCalculado.Cantidad,
                where: whereConditions
            });

            console.log(`   ✓ Descontado ${detalleCalculado.Cantidad} unidades de Producto ${detalleCalculado.ProductoID}`);
        }

        console.log('='.repeat(60) + '\n');

        return res.status(201).json({
            tipo: 'venta',
            message: 'Venta pendiente creada exitosamente',
            mensaje: 'Tu pedido ha sido registrado y está pendiente de procesamiento. El stock ha sido reservado.',
            venta: nuevaVenta,
            detalles: detallesCalculados
        });

    } catch (error) {
        console.error('❌ Error al crear venta directa:', error);
        throw error;
    }
}

// ============================================
// CREAR COTIZACIÓN CON DISEÑOS (SIN DESCUENTO DE STOCK)
// ============================================
async function crearCotizacionConDiseños(req, res, { DocumentoID, FechaCotizacion, detalles, usuario }) {
    try {
        console.log('\nCREANDO COTIZACIÓN CON DISEÑOS...');
        console.log('El stock NO se descuenta en cotizaciones (solo es presupuesto)');

        // Crear la cotización con estado "Pendiente" (EstadoID = 1)
        const nuevaCotizacion = await Cotizacion.create({
            DocumentoID,
            FechaCotizacion: FechaCotizacion || new Date(),
            ValorTotal: 0,
            EstadoID: 1 // PENDIENTE
        });

        console.log(`Cotización creada con ID: ${nuevaCotizacion.CotizacionID}`);

        // Crear los detalles con todos sus datos
        for (let i = 0; i < detalles.length; i++) {
            const detalle = detalles[i];
            console.log(`\n   Detalle ${i + 1}/${detalles.length}:`);

            const nuevoDetalle = await DetalleCotizacion.create({
                CotizacionID: nuevaCotizacion.CotizacionID,
                ProductoID: detalle.ProductoID,
                Cantidad: detalle.Cantidad,
                TraePrenda: detalle.TraePrenda || false,
                PrendaDescripcion: detalle.PrendaDescripcion
            });

            // Crear técnicas asociadas
            if (detalle.tecnicas && detalle.tecnicas.length > 0) {
                const tecnicasData = detalle.tecnicas.map(t => ({
                    DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID,
                    TecnicaID: t.TecnicaID,
                    ParteID: t.ParteID,
                    ImagenDiseño: t.ImagenDiseño,
                    Observaciones: t.Observaciones,
                    CostoTecnica: t.CostoTecnica || 0
                }));
                await CotizacionTecnica.bulkCreate(tecnicasData);
            }

            // Crear tallas, colores, insumos
            if (detalle.tallas && detalle.tallas.length > 0) {
                await CotizacionTalla.bulkCreate(detalle.tallas.map(t => ({
                    DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID,
                    TallaID: t.TallaID,
                    Cantidad: t.Cantidad,
                    PrecioTalla: t.PrecioTalla || 0
                })));
            }

            if (detalle.colores && detalle.colores.length > 0) {
                await CotizacionColor.bulkCreate(detalle.colores.map(c => ({
                    DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID,
                    ColorID: c.ColorID,
                    Cantidad: c.Cantidad
                })));
            }

            if (detalle.insumos && detalle.insumos.length > 0) {
                await CotizacionInsumo.bulkCreate(detalle.insumos.map(i => ({
                    DetalleCotizacionID: nuevoDetalle.DetalleCotizacionID,
                    InsumoID: i.InsumoID,
                    CantidadRequerida: i.CantidadRequerida
                })));
            }
        }

        // Retornar la cotización completa
        const cotizacionCompleta = await Cotizacion.findByPk(nuevaCotizacion.CotizacionID, {
            include: [
                { model: Usuario, as: 'usuario' },
                { model: Estado, as: 'estado' },
                {
                    model: DetalleCotizacion,
                    as: 'detalles',
                    include: [
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
                }
            ]
        });

        console.log('='.repeat(60));
        console.log('COTIZACIÓN CON DISEÑOS CREADA EXITOSAMENTE');
        console.log('='.repeat(60) + '\n');

        return res.status(201).json({
            tipo: 'cotizacion',
            message: 'Cotización creada exitosamente',
            mensaje: 'Tu cotización ha sido registrada. El administrador asignará los costos de los diseños y te contactará pronto. El stock se descontará cuando se convierta en venta.',
            cotizacion: cotizacionCompleta
        });

    } catch (error) {
        console.error('Error al crear cotización con diseños:', error);
        throw error;
    }
}


// ============================================
// MANTENER FUNCIONES ORIGINALES
// ============================================
exports.getAllCotizaciones = async (req, res) => {
    try {
        const cotizaciones = await Cotizacion.findAll({
            include: [
                { model: Usuario, as: 'usuario' },
                { model: Estado, as: 'estado' },
                {
                    model: DetalleCotizacion,
                    as: 'detalles',
                    include: [
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
                }
            ]
        });
        res.json(cotizaciones);
    } catch (error) {
        res.status(500).json({
            message: 'Error al obtener cotizaciones',
            error: error.message
        });
    }
};



exports.getCotizacionById = async (req, res) => {
    try {
        const cotizacion = await Cotizacion.findByPk(req.params.id, {
            include: [
                { model: Usuario, as: 'usuario' },
                { model: Estado, as: 'estado' },
                {
                    model: DetalleCotizacion,
                    as: 'detalles',
                    include: [
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
                }
            ]
        });

        if (!cotizacion) {
            return res.status(404).json({ message: 'Cotización no encontrada' });
        }

        // Enriquecer datos con nombre de producto correcto
        const cotizacionEnriquecida = {
            ...cotizacion.toJSON(),
            detalles: cotizacion.detalles.map(det => ({
                ...det.toJSON(),
                nombreProductoDisplay: obtenerNombreProducto(det)
            }))
        };

        res.json(cotizacionEnriquecida);
    } catch (error) {
        res.status(500).json({
            message: 'Error al obtener cotización',
            error: error.message
        });
    }
};


// ACTUALIZAR: Función updateCotizacion existente
// lógica de devolución de stock al cambiar estado
exports.updateCotizacion = async (req, res) => {
    try {
        const { ValorTotal, EstadoID } = req.body;
        const cotizacionID = req.params.id;

        const cotizacion = await Cotizacion.findByPk(cotizacionID, {
            include: [
                {
                    model: DetalleCotizacion,
                    as: 'detalles',
                    include: [
                        { model: Producto, as: 'producto' },
                        {
                            model: CotizacionTalla,
                            as: 'tallas',
                            include: [{ model: Talla, as: 'talla' }]
                        },
                        {
                            model: CotizacionColor,
                            as: 'colores',
                            include: [{ model: Color, as: 'color' }]
                        }
                    ]
                }
            ]
        });

        if (!cotizacion) {
            return res.status(404).json({ message: 'Cotización no encontrada' });
        }

        const estadoAnterior = cotizacion.EstadoID;
        const estadoNuevo = EstadoID ? parseInt(EstadoID) : estadoAnterior;

        console.log('\n' + '='.repeat(60));
        console.log('CAMBIO DE ESTADO DE COTIZACIÓN');
        console.log('='.repeat(60));
        console.log(`Cotización ID: ${cotizacionID}`);
        console.log(`Estado anterior: ${estadoAnterior}`);
        console.log(`Estado nuevo: ${estadoNuevo}`);

        // LÓGICA: Si se cancela una cotización aprobada (2 -> 3), DEVOLVER el stock
        if (estadoAnterior === 2 && estadoNuevo === 3) {
            console.log('\nDEVOLVIENDO STOCK (cotización aprobada cancelada)...');

            for (const detalle of cotizacion.detalles) {
                const traePrenda = Boolean(detalle.TraePrenda);

                if (!traePrenda) {
                    const colorID = detalle.colores?.[0]?.ColorID;
                    const tallaID = detalle.tallas?.[0]?.TallaID;

                    if (colorID && tallaID) {
                        await InventarioProducto.increment('Stock', {
                            by: detalle.Cantidad,
                            where: {
                                ProductoID: detalle.ProductoID,
                                ColorID: colorID,
                                TallaID: tallaID
                            }
                        });

                        console.log(`   ✓ Devuelto ${detalle.Cantidad} unidades de ${detalle.producto?.Nombre}`);
                    }
                }
            }
        }

        // Actualizar cotización
        await cotizacion.update({
            ValorTotal: ValorTotal !== undefined ? ValorTotal : cotizacion.ValorTotal,
            EstadoID: estadoNuevo
        });

        console.log('='.repeat(60) + '\n');

        res.json({
            message: 'Cotización actualizada exitosamente',
            cotizacion,
            stockDevuelto: estadoAnterior === 2 && estadoNuevo === 3
        });
    } catch (error) {
        console.error('Error al actualizar cotización:', error);
        res.status(500).json({
            message: 'Error al actualizar cotización',
            error: error.message
        });
    }
};

exports.deleteCotizacion = async (req, res) => {
    try {
        const cotizacion = await Cotizacion.findByPk(req.params.id);

        if (!cotizacion) {
            return res.status(404).json({ message: 'Cotización no encontrada' });
        }

        await cotizacion.destroy();
        res.json({ message: 'Cotización eliminada exitosamente' });
    } catch (error) {
        res.status(500).json({
            message: 'Error al eliminar cotización',
            error: error.message
        });
    }
};

const calcularValorTotalCotizacion = async (cotizacionID) => {
    try {
        const cotizacion = await Cotizacion.findByPk(cotizacionID, {
            include: [
                {
                    model: DetalleCotizacion,
                    as: 'detalles',
                    include: [
                        { model: Producto, as: 'producto' },
                        { model: CotizacionTecnica, as: 'tecnicas' },
                        { model: CotizacionTalla, as: 'tallas', include: [{ model: Talla, as: 'talla' }] },
                        { model: CotizacionInsumo, as: 'insumos', include: [{ model: Insumo, as: 'insumo' }] }
                    ]
                }
            ]
        });

        if (!cotizacion) return 0;

        let total = 0;

        for (const detalle of cotizacion.detalles) {
            let subtotalDetalle = 0;

            const precioBase = parseFloat(detalle.producto?.PrecioBase || 0);
            subtotalDetalle += precioBase * detalle.Cantidad;

            if (detalle.insumos && detalle.insumos.length > 0) {
                for (const insumo of detalle.insumos) {
                    const precioTela = parseFloat(insumo.insumo?.PrecioTela || 0);
                    const cantidadRequerida = parseFloat(insumo.CantidadRequerida || 0);
                    subtotalDetalle += precioTela * cantidadRequerida;
                }
            }

            if (detalle.tallas && detalle.tallas.length > 0) {
                for (const talla of detalle.tallas) {
                    const precioTalla = parseFloat(talla.talla?.Precio || 0);
                    const cantidadTalla = parseInt(talla.Cantidad || 0);
                    subtotalDetalle += precioTalla * cantidadTalla;
                }
            }

            if (detalle.tecnicas && detalle.tecnicas.length > 0) {
                for (const tecnica of detalle.tecnicas) {
                    const costoTecnica = parseFloat(tecnica.CostoTecnica || 0);
                    subtotalDetalle += costoTecnica * detalle.Cantidad;
                }
            }

            total += subtotalDetalle;
        }

        await cotizacion.update({ ValorTotal: total });
        return total;
    } catch (error) {
        console.error('Error recalculando valor total:', error);
        return 0;
    }
};



//Obtener cotizaciones por usuario
exports.getCotizacionesByUsuario = async (req, res) => {
    try {
        const { documentoID } = req.params;

        console.log('Buscando cotizaciones para usuario:', documentoID);

        const cotizaciones = await Cotizacion.findAll({
            where: { DocumentoID: documentoID },
            include: [
                { model: Usuario, as: 'usuario' },
                { model: Estado, as: 'estado' },
                {
                    model: DetalleCotizacion,
                    as: 'detalles',
                    include: [
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
                }
            ],
            order: [['CotizacionID', 'DESC']]
        });

        console.log('Cotizaciones encontradas:', cotizaciones.length);

        res.json(cotizaciones);
    } catch (error) {
        console.error('Error al obtener cotizaciones del usuario:', error);
        res.status(500).json({
            message: 'Error al obtener cotizaciones del usuario',
            error: error.message
        });
    }
};


// NUEVA FUNCIÓN: CANCELAR COTIZACIÓN Y DEVOLVER STOCK
exports.cancelarCotizacion = async (req, res) => {
    try {
        const { cotizacionID } = req.params;

        console.log('\n' + '='.repeat(60));
        console.log('CANCELANDO COTIZACIÓN Y DEVOLVIENDO STOCK');
        console.log('CotizacionID:', cotizacionID);
        console.log('='.repeat(60));

        // Obtener cotización completa con sus detalles
        const cotizacion = await Cotizacion.findByPk(cotizacionID, {
            include: [
                {
                    model: DetalleCotizacion,
                    as: 'detalles',
                    include: [
                        { model: Producto, as: 'producto' },
                        {
                            model: CotizacionTalla,
                            as: 'tallas',
                            include: [{ model: Talla, as: 'talla' }]
                        },
                        {
                            model: CotizacionColor,
                            as: 'colores',
                            include: [{ model: Color, as: 'color' }]
                        }
                    ]
                },
                { model: Usuario, as: 'usuario' },
                { model: Estado, as: 'estado' }
            ]
        });

        if (!cotizacion) {
            console.error('Cotización no encontrada');
            return res.status(404).json({
                message: 'Cotización no encontrada',
                cotizacionID
            });
        }

        console.log('✓ Cotización encontrada');
        console.log('   Estado actual:', cotizacion.estado?.Nombre);
        console.log('   EstadoID:', cotizacion.EstadoID);

        // Verificar si la cotización ya fue procesada como venta (EstadoID 14)
        if (cotizacion.EstadoID === 14) {
            return res.status(400).json({
                message: 'No se puede cancelar una cotización que ya fue convertida a venta',
                estadoActual: 'Procesada'
            });
        }

        // DEVOLVER STOCK SOLO SI LA COTIZACIÓN SE CONVIRTIÓ EN VENTA
        // (Es decir, si el estado es 14 = Procesada, significaba que se descontó stock)
        // Pero como la estamos cancelando, vamos a verificar si tiene una venta asociada

        // Para cotizaciones que nunca se convirtieron en venta (estados 1, 2, 3),
        // NO hay stock que devolver porque nunca se descontó

        console.log('\nANALIZANDO SI HAY STOCK PARA DEVOLVER...');

        // Solo devolvemos stock si la cotización estaba aprobada (estado 2)
        // Y el cliente NO traía prenda propia
        let stockDevuelto = false;

        if (cotizacion.EstadoID === 2) { // Aprobada
            for (const detalle of cotizacion.detalles) {
                const traePrenda = Boolean(detalle.TraePrenda);

                if (!traePrenda) {
                    const colorID = detalle.colores?.[0]?.ColorID;
                    const tallaID = detalle.tallas?.[0]?.TallaID;

                    if (colorID && tallaID) {
                        console.log(`\n   📦 Devolviendo stock para:`);
                        console.log(`      Producto: ${detalle.producto?.Nombre}`);
                        console.log(`      Cantidad: ${detalle.Cantidad}`);

                        await InventarioProducto.increment('Stock', {
                            by: detalle.Cantidad,
                            where: {
                                ProductoID: detalle.ProductoID,
                                ColorID: colorID,
                                TallaID: tallaID
                            }
                        });

                        stockDevuelto = true;
                        console.log(`      ✓ Stock devuelto exitosamente`);
                    }
                } else {
                    console.log(`\n   ${detalle.producto?.Nombre || 'Producto'}: Es prenda propia - No requiere devolución de stock`);
                }
            }
        } else {
            console.log('   Cotización no aprobada - No hay stock que devolver');
        }

        // Actualizar estado a "Cancelada" (EstadoID 3)
        console.log('\nACTUALIZANDO ESTADO DE COTIZACIÓN...');
        await cotizacion.update({ EstadoID: 3 }); // 3 = Cancelada
        console.log('✓ Estado actualizado a CANCELADA (ID: 3)\n');

        console.log('='.repeat(60));
        console.log('COTIZACIÓN CANCELADA EXITOSAMENTE');
        console.log('='.repeat(60) + '\n');

        return res.status(200).json({
            message: 'Cotización cancelada exitosamente',
            cotizacionID: cotizacion.CotizacionID,
            estadoAnterior: cotizacion.estado?.Nombre,
            estadoNuevo: 'Cancelada',
            stockDevuelto: stockDevuelto,
            detallesCancelados: cotizacion.detalles.map(d => ({
                producto: d.producto?.Nombre,
                cantidad: d.Cantidad,
                traePrenda: d.TraePrenda
            }))
        });

    } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('ERROR AL CANCELAR COTIZACIÓN');
        console.error('='.repeat(60));
        console.error('Mensaje:', error.message);
        console.error('Stack:', error.stack);
        console.error('='.repeat(60) + '\n');

        res.status(500).json({
            message: 'Error al cancelar cotización',
            error: error.message,
            detalles: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};


exports.calcularValorTotalCotizacion = calcularValorTotalCotizacion;
module.exports.crearVentaDirecta = crearVentaDirecta;
module.exports.crearCotizacionConDiseños = crearCotizacionConDiseños;