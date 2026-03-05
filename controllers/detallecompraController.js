const { DetalleCompra, Compra, Insumo, Producto, InventarioProducto, Color, Talla } = require('../models');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Incrementa stock según el tipo del detalle.
 * @param {object} detalle - instancia o plain object con los campos del detalle
 */
async function incrementarStock(detalle) {
    if (detalle.TipoSeleccion === 'insumo') {
        await Insumo.increment('Stock', {
            by: detalle.Cantidad,
            where: { InsumoID: detalle.InsumoID }
        });
    } else {
        // producto → incrementa la variante
        await InventarioProducto.increment('Stock', {
            by: detalle.Cantidad,
            where: { InventarioID: detalle.InventarioID }
        });
    }
}

/**
 * Decrementa stock según el tipo del detalle (para revertir antes de update/delete).
 */
async function decrementarStock(detalle) {
    if (detalle.TipoSeleccion === 'insumo') {
        await Insumo.decrement('Stock', {
            by: detalle.Cantidad,
            where: { InsumoID: detalle.InsumoID }
        });
    } else {
        await InventarioProducto.decrement('Stock', {
            by: detalle.Cantidad,
            where: { InventarioID: detalle.InventarioID }
        });
    }
}

/**
 * Dado un detalle de tipo 'producto', resuelve (o crea) la variante en
 * InventarioProducto y devuelve el InventarioID.
 *
 * @param {object} param0 - { ProductoID, ColorID, TallaID, TelaID }
 * @returns {number} InventarioID
 */
async function resolverVariante({ ProductoID, ColorID, TallaID, TelaID }) {
    // Validar que el producto exista
    const producto = await Producto.findByPk(ProductoID);
    if (!producto) throw new Error(`Producto con ID ${ProductoID} no encontrado`);

    // Buscar variante existente
    const whereVariante = {
        ProductoID: parseInt(ProductoID),
        ColorID: parseInt(ColorID),
        TallaID: parseInt(TallaID),
        TelaID: TelaID ? parseInt(TelaID) : null
    };

    let variante = await InventarioProducto.findOne({ where: whereVariante });

    if (!variante) {
        // Crear la variante con stock 0 (el stock se incrementará después)
        variante = await InventarioProducto.create({
            ...whereVariante,
            Stock: 0,
            Estado: 1
        });
    }

    return variante.InventarioID;
}

// ─────────────────────────────────────────────────────────────────────────────
// INCLUDE helpers para los findAll / findByPk con relaciones
// ─────────────────────────────────────────────────────────────────────────────
const includeCompleto = [
    { model: Compra, as: 'compra' },
    { model: Insumo, as: 'insumo', required: false },
    {
        model: Producto,
        as: 'producto',
        required: false,
        attributes: ['ProductoID', 'Nombre', 'Descripcion', 'PrecioBase']
    },
    {
        model: InventarioProducto,
        as: 'variante',
        required: false,
        include: [
            { model: Color, as: 'color', attributes: ['ColorID', 'Nombre'] },
            { model: Talla, as: 'talla', attributes: ['TallaID', 'Nombre', 'Precio'] },
            {
                model: Insumo,
                as: 'tela',
                attributes: ['InsumoID', 'Nombre', 'PrecioTela'],
                required: false
            }
        ]
    }
];

// ─────────────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────────────

// Obtener todos los detalles de compra
exports.getAllDetalleCompras = async (req, res) => {
    try {
        const detalleCompras = await DetalleCompra.findAll({ include: includeCompleto });
        res.json(detalleCompras);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener detalles de compra', error: error.message });
    }
};

// Obtener un detalle de compra por ID
exports.getDetalleCompraById = async (req, res) => {
    try {
        const detalleCompra = await DetalleCompra.findByPk(req.params.id, { include: includeCompleto });

        if (!detalleCompra) {
            return res.status(404).json({ message: 'Detalle de compra no encontrado' });
        }

        res.json(detalleCompra);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener detalle de compra', error: error.message });
    }
};

// Crear un detalle de compra
exports.createDetalleCompra = async (req, res) => {
    try {
        const {
            CompraID,
            TipoSeleccion = 'insumo',
            InsumoID,
            ProductoID,
            ColorID,
            TallaID,
            TelaID,
            Cantidad,
            PrecioUnitario,
            PrecioVenta
        } = req.body;

        // ── Validaciones comunes ──
        if (!CompraID) return res.status(400).json({ message: 'CompraID es obligatorio' });
        if (!Cantidad || Cantidad <= 0) return res.status(400).json({ message: 'Cantidad debe ser mayor a 0' });

        let inventarioID = null;

        if (TipoSeleccion === 'insumo') {
            if (!InsumoID) return res.status(400).json({ message: 'InsumoID es obligatorio cuando TipoSeleccion es insumo' });

            const insumo = await Insumo.findByPk(InsumoID);
            if (!insumo) return res.status(404).json({ message: `Insumo con ID ${InsumoID} no encontrado` });

        } else if (TipoSeleccion === 'producto') {
            if (!ProductoID) return res.status(400).json({ message: 'ProductoID es obligatorio cuando TipoSeleccion es producto' });
            if (!ColorID || !TallaID) return res.status(400).json({ message: 'ColorID y TallaID son obligatorios para variante de producto' });

            // Buscar o crear variante
            inventarioID = await resolverVariante({ ProductoID, ColorID, TallaID, TelaID });

        } else {
            return res.status(400).json({ message: 'TipoSeleccion debe ser "insumo" o "producto"' });
        }

        // Crear el detalle
        const nuevoDetalle = await DetalleCompra.create({
            CompraID,
            TipoSeleccion,
            InsumoID: TipoSeleccion === 'insumo' ? InsumoID : null,
            ProductoID: TipoSeleccion === 'producto' ? ProductoID : null,
            InventarioID: inventarioID,
            Cantidad,
            PrecioUnitario: PrecioUnitario || 0,
            PrecioVenta: PrecioVenta || null
        });

        // Incrementar stock
        await incrementarStock(nuevoDetalle);

        // Retornar con relaciones
        const detalleCompleto = await DetalleCompra.findByPk(nuevoDetalle.DetalleCompraID, { include: includeCompleto });

        res.status(201).json({
            message: 'Detalle de compra creado exitosamente',
            detalleCompra: detalleCompleto
        });

    } catch (error) {
        console.error('Error al crear detalle de compra:', error);
        res.status(500).json({ message: 'Error al crear detalle de compra', error: error.message });
    }
};

// Actualizar un detalle de compra
exports.updateDetalleCompra = async (req, res) => {
    try {
        const {
            Cantidad,
            PrecioUnitario,
            PrecioVenta,
            ColorID,
            TallaID,
            TelaID
        } = req.body;

        const detalleCompra = await DetalleCompra.findByPk(req.params.id);
        if (!detalleCompra) return res.status(404).json({ message: 'Detalle de compra no encontrado' });

        // ── Revertir stock anterior ──
        await decrementarStock(detalleCompra);

        let inventarioID = detalleCompra.InventarioID;

        // Si es producto y cambia la variante, resolver la nueva
        if (detalleCompra.TipoSeleccion === 'producto' && (ColorID || TallaID || TelaID !== undefined)) {
            inventarioID = await resolverVariante({
                ProductoID: detalleCompra.ProductoID,
                ColorID: ColorID || (await InventarioProducto.findByPk(detalleCompra.InventarioID))?.ColorID,
                TallaID: TallaID || (await InventarioProducto.findByPk(detalleCompra.InventarioID))?.TallaID,
                TelaID: TelaID !== undefined ? TelaID : (await InventarioProducto.findByPk(detalleCompra.InventarioID))?.TelaID
            });
        }

        await detalleCompra.update({
            Cantidad: Cantidad !== undefined ? Cantidad : detalleCompra.Cantidad,
            PrecioUnitario: PrecioUnitario !== undefined ? PrecioUnitario : detalleCompra.PrecioUnitario,
            PrecioVenta: PrecioVenta !== undefined ? PrecioVenta : detalleCompra.PrecioVenta,
            InventarioID: inventarioID
        });

        // Incrementar con la nueva cantidad
        await incrementarStock(detalleCompra);

        const detalleActualizado = await DetalleCompra.findByPk(detalleCompra.DetalleCompraID, { include: includeCompleto });

        res.json({
            message: 'Detalle de compra actualizado exitosamente',
            detalleCompra: detalleActualizado
        });

    } catch (error) {
        console.error('Error al actualizar detalle de compra:', error);
        res.status(500).json({ message: 'Error al actualizar detalle de compra', error: error.message });
    }
};

// Eliminar un detalle de compra
exports.deleteDetalleCompra = async (req, res) => {
    try {
        const detalleCompra = await DetalleCompra.findByPk(req.params.id);
        if (!detalleCompra) return res.status(404).json({ message: 'Detalle de compra no encontrado' });

        // Revertir stock antes de eliminar
        await decrementarStock(detalleCompra);

        await detalleCompra.destroy();

        res.json({ message: 'Detalle de compra eliminado exitosamente' });

    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar detalle de compra', error: error.message });
    }
};