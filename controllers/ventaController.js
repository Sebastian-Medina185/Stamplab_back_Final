const {
    Venta,
    Usuario,
    DetalleVenta,
    DetalleCompra,
    Compra,
    Producto,
    Tecnica,
    Insumo,
    InventarioProducto,
    Color,
    Talla,
    Estado,
    sequelize
} = require('../models');

const { Op } = require('sequelize');

// Obtener todas las ventas
exports.getAllVentas = async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.max(1, parseInt(req.query.limit) || 10);
        const search = (req.query.search || "").trim();
        const estado = req.query.estado;
        const offset = (page - 1) * limit;

        // ── Filtro por estado ──
        const whereVenta = {};
        if (estado === "pendientes") {
            whereVenta.EstadoID = 8;
        } else if (estado === "procesadas") {
            whereVenta.EstadoID = { [Op.ne]: 8 };
        }

        // ── Filtro de búsqueda ──
        if (search) {
            if (!isNaN(search)) {
                whereVenta[Op.or] = [
                    { VentaID: parseInt(search) },
                    { '$usuario.Nombre$':      { [Op.like]: `%${search}%` } },
                    { '$usuario.DocumentoID$': { [Op.like]: `%${search}%` } }
                ];
            } else {
                whereVenta[Op.or] = [
                    { '$usuario.Nombre$':      { [Op.like]: `%${search}%` } },
                    { '$usuario.DocumentoID$': { [Op.like]: `%${search}%` } }
                ];
            }
        }

        // ── 1. COUNT: subQuery:false necesario para que $usuario.X$ funcione en WHERE ──
        const totalCount = await Venta.count({
            where: whereVenta,
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: [],
                    required: !!search
                }
            ],
            subQuery: false
        });

        // ── 2. QUERY de datos ──
        // SIN subQuery:false → Sequelize envuelve la query en una subconsulta
        // para aplicar LIMIT/OFFSET correctamente sobre VentaIDs únicos,
        // no sobre las filas del JOIN con DetalleVenta.
        const rows = await Venta.findAll({
            where: whereVenta,
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: { exclude: ['Contraseña'] },
                    required: !!search
                },
                {
                    model: DetalleVenta,
                    as: 'detalles',
                    include: [
                        { model: Producto, as: 'producto' },
                        { model: Color,    as: 'color'    },
                        { model: Talla,    as: 'talla'    }
                    ]
                },
                { model: Estado, as: 'estado' }
            ],
            order:    [['VentaID', 'DESC']],
            limit,
            offset,
});

        res.json({
            datos:        rows,
            total:        totalCount,
            pagina:       page,
            totalPaginas: Math.ceil(totalCount / limit),
            limit
        });

    } catch (error) {
        res.status(500).json({ message: 'Error al obtener ventas', error: error.message });
    }
};


// Obtener una venta por ID
exports.getVentaById = async (req, res) => {
    try {
        const venta = await Venta.findByPk(req.params.id, {
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: { exclude: ['Contraseña'] }
                },
                {
                    model: DetalleVenta,
                    as: 'detalles',
                    include: [
                        { model: Producto, as: 'producto' },
                        { model: Color, as: 'color' },
                        { model: Talla, as: 'talla' }
                    ]
                },
                {
                    model: Estado,
                    as: 'estado'
                }
            ]
        });

        if (!venta) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        res.json(venta);
    } catch (error) {
        res.status(500).json({
            message: 'Error al obtener venta',
            error: error.message
        });
    }
};

// CREAR VENTA CON DESCUENTO DE STOCK
// CREAR VENTA CON DESCUENTO DE STOCK
exports.crearVenta = async (req, res) => {
    try {
        const {
            DocumentoID,
            Subtotal,
            Total,
            EstadoID,
            detalles,
            // CAMPOS OPCIONALES DE MÉTODO DE PAGO
            metodoPago,
            comprobanteTransferencia,
            fechaTransferencia,
            nombreReceptor,
            telefonoEntrega,
            direccionEntrega
        } = req.body;

        // Validaciones básicas
        if (!DocumentoID || !detalles || detalles.length === 0) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }

        // 🔹 VALIDAR MÉTODO DE PAGO SOLO SI SE PROPORCIONA
        if (metodoPago) {
            if (metodoPago === 'transferencia') {
                if (!comprobanteTransferencia) {
                    return res.status(400).json({
                        error: "Debe proporcionar el comprobante de transferencia"
                    });
                }
            }

            if (metodoPago === 'contraentrega') {
                if (!nombreReceptor || !telefonoEntrega || !direccionEntrega) {
                    return res.status(400).json({
                        error: "Complete todos los datos de entrega (nombre, teléfono y dirección)"
                    });
                }
            }
        }

        // VALIDAR STOCK ANTES DE CREAR LA VENTA
        for (const item of detalles) {
            const variante = await InventarioProducto.findOne({
                where: {
                    ProductoID: item.ProductoID,
                    ColorID: item.ColorID,
                    TallaID: item.TallaID
                }
            });

            if (!variante) {
                return res.status(400).json({
                    error: `No existe variante para Producto ${item.ProductoID}, Color ${item.ColorID}, Talla ${item.TallaID}`
                });
            }

            if (variante.Stock < item.Cantidad) {
                return res.status(400).json({
                    error: `Stock insuficiente. Disponible: ${variante.Stock}, Solicitado: ${item.Cantidad}`
                });
            }
        }

        // 🔹 CREAR LA VENTA (método de pago es opcional)
        const nuevaVenta = await Venta.create({
            DocumentoID,
            Subtotal,
            Total,
            EstadoID: EstadoID || 8, // 8 = Pendiente por defecto
            // Solo incluir si se proporciona
            MetodoPago: metodoPago || null,
            ComprobanteTransferencia: metodoPago === 'transferencia' ? comprobanteTransferencia : null,
            FechaTransferencia: metodoPago === 'transferencia' ? (fechaTransferencia || new Date()) : null,
            NombreReceptor: metodoPago === 'contraentrega' ? nombreReceptor : null,
            TelefonoEntrega: metodoPago === 'contraentrega' ? telefonoEntrega : null,
            DireccionEntrega: metodoPago === 'contraentrega' ? direccionEntrega : null
        });

        // Crear detalles y descontar stock
        for (const item of detalles) {
            await DetalleVenta.create({
                VentaID: nuevaVenta.VentaID,
                ProductoID: item.ProductoID,
                Cantidad: item.Cantidad,
                PrecioUnitario: item.PrecioUnitario,
                ColorID: item.ColorID,
                TallaID: item.TallaID
            });

            // DESCONTAR STOCK
            await InventarioProducto.decrement(
                'Stock',
                {
                    by: item.Cantidad,
                    where: {
                        ProductoID: item.ProductoID,
                        ColorID: item.ColorID,
                        TallaID: item.TallaID
                    }
                }
            );
        }

        return res.status(201).json({
            message: "Venta creada correctamente",
            venta: nuevaVenta
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Error al crear venta",
            error: error.message
        });
    }
};


// 🆕 ACTUALIZAR ESTADO DE VENTA (con lógica de devolución de stock si se cancela)
exports.updateEstadoVenta = async (req, res) => {
    try {
        const { EstadoID } = req.body;
        const ventaId = req.params.id;

        if (!EstadoID) {
            return res.status(400).json({ message: 'EstadoID es requerido' });
        }

        const venta = await Venta.findByPk(ventaId, {
            include: [
                {
                    model: DetalleVenta,
                    as: 'detalles'
                }
            ]
        });

        if (!venta) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        const estadoAnterior = venta.EstadoID;
        const estadoNuevo = parseInt(EstadoID);

        console.log('\n' + '='.repeat(60));
        console.log('CAMBIO DE ESTADO DE VENTA');
        console.log('='.repeat(60));
        console.log(`Venta ID: ${ventaId}`);
        console.log(`Estado anterior: ${estadoAnterior}`);
        console.log(`Estado nuevo: ${estadoNuevo}`);

        // LÓGICA: Si se cancela una venta pendiente, DEVOLVER el stock
        // EstadoID 13 = Cancelada 
        if (estadoAnterior === 8 && estadoNuevo === 12) {
            console.log('\nDEVOLVIENDO STOCK (venta cancelada)...');

            for (const detalle of venta.detalles) {
                await InventarioProducto.increment('Stock', {
                    by: detalle.Cantidad,
                    where: {
                        ProductoID: detalle.ProductoID,
                        ColorID: detalle.ColorID,
                        TallaID: detalle.TallaID
                    }
                });

                console.log(`   ✓ Devuelto ${detalle.Cantidad} unidades de Producto ${detalle.ProductoID}`);
            }
        }

        // Actualizar el estado
        await venta.update({ EstadoID: estadoNuevo });

        console.log('='.repeat(60) + '\n');

        res.json({
            message: 'Estado actualizado exitosamente',
            venta,
            stockDevuelto: estadoAnterior === 8 && estadoNuevo === 12
        });

    } catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(500).json({
            message: 'Error al actualizar estado',
            error: error.message
        });
    }
};

// ACTUALIZAR VENTA COMPLETA (con detalles)
exports.updateVenta = async (req, res) => {
    try {
        const { EstadoID, Subtotal, Total, detalles } = req.body;
        const ventaId = req.params.id;

        const venta = await Venta.findByPk(ventaId);

        if (!venta) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        // Si solo se actualiza el estado (cambio de estado desde el modal)
        if (EstadoID && !detalles) {
            await venta.update({ EstadoID });
            return res.json({
                message: 'Estado actualizado exitosamente',
                venta
            });
        }

        // Si se actualizan los detalles (edición completa)
        if (detalles && detalles.length > 0) {
            // Eliminar detalles antiguos
            await DetalleVenta.destroy({
                where: { VentaID: ventaId }
            });

            // Crear nuevos detalles
            for (const item of detalles) {
                await DetalleVenta.create({
                    VentaID: ventaId,
                    ProductoID: item.ProductoID,
                    Cantidad: item.Cantidad,
                    PrecioUnitario: item.PrecioUnitario,
                    ColorID: item.ColorID,
                    TallaID: item.TallaID
                });
            }

            // Actualizar totales
            await venta.update({
                Subtotal: Subtotal || venta.Subtotal,
                Total: Total || venta.Total,
                EstadoID: EstadoID || venta.EstadoID
            });
        }

        res.json({
            message: 'Venta actualizada exitosamente',
            venta
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Error al actualizar venta',
            error: error.message
        });
    }
};

// Eliminar una venta (con devolución de stock)
exports.deleteVenta = async (req, res) => {
    try {
        const venta = await Venta.findByPk(req.params.id, {
            include: [
                {
                    model: DetalleVenta,
                    as: 'detalles'
                }
            ]
        });

        if (!venta) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        console.log('\n🗑️ ELIMINANDO VENTA Y DEVOLVIENDO STOCK...');

        // DEVOLVER STOCK si la venta estaba pendiente
        if (venta.EstadoID === 8) {
            for (const detalle of venta.detalles) {
                await InventarioProducto.increment('Stock', {
                    by: detalle.Cantidad,
                    where: {
                        ProductoID: detalle.ProductoID,
                        ColorID: detalle.ColorID,
                        TallaID: detalle.TallaID
                    }
                });
                console.log(`   ✓ Stock devuelto: ${detalle.Cantidad} unidades`);
            }
        }

        // Eliminar detalles
        await DetalleVenta.destroy({
            where: { VentaID: req.params.id }
        });

        // Eliminar venta
        await venta.destroy();

        res.json({
            message: 'Venta eliminada exitosamente',
            stockDevuelto: venta.EstadoID === 8
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error al eliminar venta',
            error: error.message
        });
    }
};

// Dashboard (sin cambios)
exports.getDashboardData = async (req, res) => {
    try {
        const { mes, productoId } = req.query;
        // NOTA: el filtro tecnicaId se elimina porque DetalleVenta
        // no tiene asociación con Tecnica en tu modelo actual.

        // ── Construir WHERE para Venta (filtro de mes) ──
        let whereVenta = {};
        if (mes) {
            const mesNum = parseInt(mes);
            whereVenta = {
                [Op.and]: [
                    sequelize.where(sequelize.fn('MONTH', sequelize.col('venta.FechaVenta')), mesNum),
                    sequelize.where(sequelize.fn('YEAR', sequelize.col('venta.FechaVenta')), new Date().getFullYear())
                ]
            };
        }

        // ── Construir WHERE para DetalleVenta (filtro de producto) ──
        let whereDetalle = {};
        if (productoId) {
            whereDetalle.ProductoID = parseInt(productoId);
        }

        // ── 1. Ventas por mes (agrupado por mes) ──
        const ventasPorMes = await DetalleVenta.findAll({
            attributes: [
                [sequelize.fn('MONTH', sequelize.col('venta.FechaVenta')), 'mes'],
                [sequelize.fn('COUNT', sequelize.col('DetalleVentaID')), 'ventas']
            ],
            include: [
                {
                    model: Venta,
                    as: 'venta',
                    attributes: [],
                    where: whereVenta
                }
            ],
            where: whereDetalle,
            group: [sequelize.fn('MONTH', sequelize.col('venta.FechaVenta'))],
            order: [[sequelize.fn('MONTH', sequelize.col('venta.FechaVenta')), 'ASC']],
            raw: true
        });

        // ── 2. Productos más vendidos (por producto, top 10) ──
        const productosMasVendidos = await DetalleVenta.findAll({
            attributes: [
                'ProductoID',
                [sequelize.fn('SUM', sequelize.col('DetalleVenta.Cantidad')), 'cantidad']
            ],
            include: [
                {
                    model: Venta,
                    as: 'venta',
                    attributes: [],
                    where: whereVenta
                },
                {
                    model: Producto,
                    as: 'producto',
                    attributes: ['Nombre']
                }
            ],
            where: whereDetalle,
            group: ['DetalleVenta.ProductoID', 'producto.ProductoID', 'producto.Nombre'],
            order: [[sequelize.fn('SUM', sequelize.col('DetalleVenta.Cantidad')), 'DESC']],
            limit: 10,
            raw: true
        });

        // ── 3. Insumos más utilizados: viene de DetalleCompra (tipo 'insumo') ──
        // DetalleVenta no tiene relación con insumos directamente,
        // así que consultamos DetalleCompra agrupado por mes.
        const insumosUtilizados = await DetalleCompra.findAll({
            attributes: [
                [sequelize.fn('MONTH', sequelize.col('compra.FechaCompra')), 'mes'],
                [sequelize.fn('SUM', sequelize.col('DetalleCompra.Cantidad')), 'cantidad']
            ],
            include: [
                {
                    model: Compra,
                    as: 'compra',
                    attributes: [],
                    where: mes ? {
                        [Op.and]: [
                            sequelize.where(sequelize.fn('MONTH', sequelize.col('compra.FechaCompra')), parseInt(mes)),
                            sequelize.where(sequelize.fn('YEAR', sequelize.col('compra.FechaCompra')), new Date().getFullYear())
                        ]
                    } : {}
                }
            ],
            where: { TipoSeleccion: 'insumo' },
            group: [sequelize.fn('MONTH', sequelize.col('compra.FechaCompra'))],
            order: [[sequelize.fn('MONTH', sequelize.col('compra.FechaCompra')), 'ASC']],
            raw: true
        });

        // ── Formatear respuestas ──
        const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        const ventasFormateadas = ventasPorMes.map(item => ({
            mes: mesesNombres[item.mes - 1],
            ventas: parseInt(item.ventas) || 0
        }));

        const productosFormateados = productosMasVendidos.map(item => ({
            mes: item['producto.Nombre'] || `Producto ${item.ProductoID}`,
            cantidad: parseInt(item.cantidad) || 0
        }));

        const insumosFormateados = insumosUtilizados.map(item => ({
            mes: mesesNombres[item.mes - 1],
            cantidad: parseInt(item.cantidad) || 0
        }));

        res.json({
            estado: true,
            mensaje: 'Datos del dashboard obtenidos exitosamente',
            datos: {
                ventasPorTecnicas: ventasFormateadas,   // ahora son ventas por mes
                productosMasVendidos: productosFormateados,
                insumosUtilizados: insumosFormateados
            }
        });

    } catch (error) {
        console.error('Error al obtener datos del dashboard:', error);
        res.status(500).json({
            estado: false,
            mensaje: 'Error al obtener datos del dashboard',
            error: error.message
        });
    }
};