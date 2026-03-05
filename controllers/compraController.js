const { Compra, Proveedor, DetalleCompra, Insumo, Producto, InventarioProducto, Color, Talla } = require('../models');

console.log("Asociaciones de Compra:", Object.keys(Compra.associations));

// ─────────────────────────────────────────────────────────────────────────────
// INCLUDES reutilizables
// ─────────────────────────────────────────────────────────────────────────────
const includeDetalles = [
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
      { model: Insumo, as: 'tela', attributes: ['InsumoID', 'Nombre', 'PrecioTela'], required: false }
    ]
  }
];

const includeCompra = [
  { model: Proveedor, as: 'proveedor' },
  { model: DetalleCompra, as: 'detalles', include: includeDetalles }
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS de stock
// ─────────────────────────────────────────────────────────────────────────────
async function incrementarStockDetalle(detalle) {
  if (detalle.TipoSeleccion === 'insumo') {
    await Insumo.increment('Stock', { by: detalle.Cantidad, where: { InsumoID: detalle.InsumoID } });
  } else {
    await InventarioProducto.increment('Stock', { by: detalle.Cantidad, where: { InventarioID: detalle.InventarioID } });
  }
}

async function decrementarStockDetalle(detalle) {
  if (detalle.TipoSeleccion === 'insumo') {
    await Insumo.decrement('Stock', { by: detalle.Cantidad, where: { InsumoID: detalle.InsumoID } });
  } else {
    await InventarioProducto.decrement('Stock', { by: detalle.Cantidad, where: { InventarioID: detalle.InventarioID } });
  }
}

/**
 * Busca o crea una variante en InventarioProducto.
 * @returns {number} InventarioID
 */
async function resolverVariante({ ProductoID, ColorID, TallaID, TelaID }) {
  const producto = await Producto.findByPk(ProductoID);
  if (!producto) throw new Error(`Producto con ID ${ProductoID} no encontrado`);

  const whereVariante = {
    ProductoID: parseInt(ProductoID),
    ColorID: parseInt(ColorID),
    TallaID: parseInt(TallaID),
    TelaID: TelaID ? parseInt(TelaID) : null
  };

  let variante = await InventarioProducto.findOne({ where: whereVariante });

  if (!variante) {
    // Crear la variante con stock 0 (se incrementará luego)
    variante = await InventarioProducto.create({ ...whereVariante, Stock: 0, Estado: 1 });
  }

  return variante.InventarioID;
}

/**
 * Prepara un array de detalles listos para bulkCreate, resolviendo variantes si aplica.
 * @param {Array} detalles - array del body
 * @param {number} CompraID
 * @returns {Array}
 */
async function prepararDetalles(detalles, CompraID) {
  const resultado = [];

  for (const detalle of detalles) {
    const tipo = detalle.TipoSeleccion || 'insumo';

    if (tipo === 'insumo') {
      if (!detalle.InsumoID) throw new Error('Cada detalle de tipo insumo debe tener InsumoID');
      resultado.push({
        CompraID,
        TipoSeleccion: 'insumo',
        InsumoID: detalle.InsumoID,
        ProductoID: null,
        InventarioID: null,
        Cantidad: detalle.Cantidad,
        PrecioUnitario: detalle.PrecioUnitario || 0,
        PrecioVenta: detalle.PrecioVenta || null
      });

    } else if (tipo === 'producto') {
      if (!detalle.ProductoID) throw new Error('Cada detalle de tipo producto debe tener ProductoID');
      if (!detalle.ColorID || !detalle.TallaID) throw new Error('ColorID y TallaID son obligatorios para detalles de tipo producto');

      const inventarioID = await resolverVariante({
        ProductoID: detalle.ProductoID,
        ColorID: detalle.ColorID,
        TallaID: detalle.TallaID,
        TelaID: detalle.TelaID || null
      });

      resultado.push({
        CompraID,
        TipoSeleccion: 'producto',
        InsumoID: null,
        ProductoID: detalle.ProductoID,
        InventarioID: inventarioID,
        Cantidad: detalle.Cantidad,
        PrecioUnitario: detalle.PrecioUnitario || 0,
        PrecioVenta: detalle.PrecioVenta || null
      });

    } else {
      throw new Error(`TipoSeleccion inválido: ${tipo}. Debe ser "insumo" o "producto"`);
    }
  }

  return resultado;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIONES comunes de detalles
// ─────────────────────────────────────────────────────────────────────────────
function validarDetalles(detalles) {
  if (!detalles || detalles.length === 0) {
    return 'Debe agregar al menos un insumo o producto';
  }
  for (const detalle of detalles) {
    if (!detalle.Cantidad || detalle.Cantidad <= 0) {
      return 'Las cantidades deben ser mayores a 0';
    }
    const tipo = detalle.TipoSeleccion || 'insumo';
    if (tipo === 'insumo' && !detalle.InsumoID) return 'Cada detalle de tipo insumo debe tener InsumoID';
    if (tipo === 'producto' && !detalle.ProductoID) return 'Cada detalle de tipo producto debe tener ProductoID';
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD COMPRAS
// ─────────────────────────────────────────────────────────────────────────────

// Obtener todas las compras
exports.getAllCompras = async (req, res) => {
  try {
    const compras = await Compra.findAll({ include: includeCompra });
    res.json(compras);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener compras', error: error.message });
  }
};

// Obtener una compra por ID
exports.getCompraById = async (req, res) => {
  try {
    const compra = await Compra.findByPk(req.params.id, { include: includeCompra });

    if (!compra) return res.status(404).json({ message: 'Compra no encontrada' });

    res.json(compra);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener compra', error: error.message });
  }
};

// Crear una nueva compra con detalles (insumos y/o productos)
exports.createCompra = async (req, res) => {
  try {
    const { ProveedorID, ProveedorRefId, detalles } = req.body;

    // Validar detalles
    const errorDetalles = validarDetalles(detalles);
    if (errorDetalles) return res.status(400).json({ message: errorDetalles });

    // ── Resolver proveedor ──
    let proveedorRef = ProveedorRefId || null;
    let proveedorNit = ProveedorID || null;

    if (proveedorRef && !proveedorNit) {
      const proveedor = await Proveedor.findByPk(proveedorRef);
      if (!proveedor) return res.status(404).json({ message: 'Proveedor no encontrado', proveedorBuscado: proveedorRef });
      proveedorNit = proveedor.Nit;
    }

    if (!proveedorRef && proveedorNit) {
      const proveedor = await Proveedor.findOne({ where: { Nit: proveedorNit } });
      if (!proveedor) return res.status(404).json({ message: 'Proveedor (Nit) no existe' });
      proveedorRef = proveedor.id;
    }

    if (!proveedorRef || !proveedorNit) {
      return res.status(400).json({ message: 'Se requiere un proveedor válido' });
    }

    // ── Crear la compra ──
    const nuevaCompra = await Compra.create({
      ProveedorID: proveedorNit,
      ProveedorRefId: proveedorRef,
      FechaCompra: req.body.FechaCompra
        ? new Date(req.body.FechaCompra + 'T12:00:00')
        : new Date()
    });

    // ── Preparar y crear detalles (resuelve variantes automáticamente) ──
    const detallesPreparados = await prepararDetalles(detalles, nuevaCompra.CompraID);
    await DetalleCompra.bulkCreate(detallesPreparados);

    // ── Incrementar stock para cada detalle ──
    for (const detalle of detallesPreparados) {
      await incrementarStockDetalle(detalle);
    }

    // ── Retornar compra completa ──
    const compraCompleta = await Compra.findByPk(nuevaCompra.CompraID, { include: includeCompra });

    res.status(201).json({
      message: 'Compra creada exitosamente',
      compra: compraCompleta
    });

  } catch (error) {
    console.error('Error al crear compra:', error);
    res.status(500).json({ message: 'Error al crear compra', error: error.message, details: error.stack });
  }
};

// Actualizar una compra
exports.updateCompra = async (req, res) => {
  try {
    const { ProveedorRefId, FechaCompra, detalles } = req.body;

    const compra = await Compra.findByPk(req.params.id);
    if (!compra) return res.status(404).json({ message: 'Compra no encontrada' });

    const errorDetalles = validarDetalles(detalles);
    if (errorDetalles) return res.status(400).json({ message: errorDetalles });

    // ── Resolver nuevo proveedor si viene ──
    let proveedorNit = compra.ProveedorID;
    let proveedorRef = compra.ProveedorRefId;

    if (ProveedorRefId) {
      const proveedor = await Proveedor.findByPk(ProveedorRefId);
      if (!proveedor) return res.status(404).json({ message: 'Proveedor no encontrado' });
      proveedorNit = proveedor.Nit;
      proveedorRef = ProveedorRefId;
    }

    await compra.update({
      ProveedorID: proveedorNit,
      ProveedorRefId: proveedorRef,
      FechaCompra: FechaCompra ? new Date(FechaCompra + 'T12:00:00') : compra.FechaCompra
    });

    // ── Revertir stock de los detalles anteriores ──
    const detallesAnteriores = await DetalleCompra.findAll({ where: { CompraID: req.params.id } });
    for (const detalleAnterior of detallesAnteriores) {
      await decrementarStockDetalle(detalleAnterior);
    }
    await DetalleCompra.destroy({ where: { CompraID: req.params.id } });

    // ── Crear nuevos detalles ──
    const detallesPreparados = await prepararDetalles(detalles, compra.CompraID);
    await DetalleCompra.bulkCreate(detallesPreparados);

    // ── Incrementar stock con los nuevos detalles ──
    for (const detalle of detallesPreparados) {
      await incrementarStockDetalle(detalle);
    }

    const compraActualizada = await Compra.findByPk(compra.CompraID, { include: includeCompra });

    res.json({
      estado: true,
      message: 'Compra actualizada exitosamente',
      compra: compraActualizada
    });

  } catch (error) {
    console.error('Error al actualizar compra:', error);
    res.status(500).json({ message: 'Error al actualizar compra', error: error.message });
  }
};

// Eliminar una compra
exports.deleteCompra = async (req, res) => {
  try {
    const compra = await Compra.findByPk(req.params.id);
    if (!compra) return res.status(404).json({ message: 'Compra no encontrada' });

    // ── Revertir stock antes de eliminar ──
    const detalles = await DetalleCompra.findAll({ where: { CompraID: req.params.id } });
    for (const detalle of detalles) {
      await decrementarStockDetalle(detalle);
    }

    await DetalleCompra.destroy({ where: { CompraID: req.params.id } });
    await compra.destroy();

    res.json({ estado: true, message: 'Compra eliminada exitosamente' });

  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar compra', error: error.message });
  }
};