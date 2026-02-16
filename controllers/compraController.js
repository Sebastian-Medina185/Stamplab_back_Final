const { Compra, Proveedor, DetalleCompra, Insumo } = require('../models');

console.log("Asociaciones de Compra:", Object.keys(Compra.associations));

// Obtener todas las compras
exports.getAllCompras = async (req, res) => {
  try {
    const compras = await Compra.findAll({
      include: [
        {
          model: Proveedor,
          as: 'proveedor'
        },
        {
          model: DetalleCompra,
          as: 'detalles',
          include: [
            {
              model: Insumo,
              as: 'insumo'
            }
          ]
        }
      ]
    });
    res.json(compras);
  } catch (error) {
    res.status(500).json({
      message: 'Error al obtener compras',
      error: error.message
    });
  }
};

// Obtener una compra por ID
exports.getCompraById = async (req, res) => {
  try {
    const compra = await Compra.findByPk(req.params.id, {
      include: [
        {
          model: Proveedor,
          as: 'proveedor'
        },
        {
          model: DetalleCompra,
          as: 'detalles',
          include: [
            {
              model: Insumo,
              as: 'insumo'
            }
          ]
        }
      ]
    });

    if (!compra) {
      return res.status(404).json({ message: 'Compra no encontrada' });
    }

    res.json(compra);
  } catch (error) {
    res.status(500).json({
      message: 'Error al obtener compra',
      error: error.message
    });
  }
};

// Crear una nueva compra con detalles
exports.createCompra = async (req, res) => {
  try {
    const { ProveedorID, ProveedorRefId, detalles } = req.body;

    // Validar que haya detalles
    if (!detalles || detalles.length === 0) {
      return res.status(400).json({ message: 'Debe agregar al menos un insumo' });
    }

    // ✅ Validar cantidades
    for (const detalle of detalles) {
      if (!detalle.InsumoID || !detalle.Cantidad) {
        return res.status(400).json({
          message: 'Cada detalle debe tener InsumoID y Cantidad'
        });
      }
      if (detalle.Cantidad <= 0) {
        return res.status(400).json({ message: 'Las cantidades deben ser mayores a 0' });
      }
    }

    // ✅ Resolver tanto ProveedorRefId como el Nit (ProveedorID)
    let proveedorRef = ProveedorRefId || null;
    let proveedorNit = ProveedorID || null;

    console.log("Antes de validar proveedor:", { proveedorRef, proveedorNit });

    // Si solo tenemos ProveedorRefId, buscar el proveedor completo
    if (proveedorRef && !proveedorNit) {
      console.log("Buscando proveedor por ID:", proveedorRef);
      const proveedor = await Proveedor.findByPk(proveedorRef);

      if (!proveedor) {
        console.error("Proveedor no encontrado con ID:", proveedorRef);
        return res.status(404).json({
          message: 'Proveedor no encontrado',
          proveedorBuscado: proveedorRef
        });
      }

      proveedorNit = proveedor.Nit;
      console.log("Proveedor encontrado:", { id: proveedor.id, Nit: proveedor.Nit, Nombre: proveedor.Nombre });
    }

    // Si tenemos Nit pero no el ID, buscarlo
    if (!proveedorRef && proveedorNit) {
      const proveedor = await Proveedor.findOne({ where: { Nit: proveedorNit } });
      if (!proveedor) {
        return res.status(404).json({ message: 'Proveedor (Nit) no existe' });
      }

      proveedorRef = proveedor.id;
      console.log("Proveedor encontrado:", { id: proveedor.id, Nit: proveedor.Nit, Nombre: proveedor.Nombre });
    }

    // Validar que tengamos ambos
    if (!proveedorRef || !proveedorNit) {
      return res.status(400).json({ message: 'Se requiere un proveedor válido' });
    }

    console.log("Proveedor validado correctamente:", { proveedorRef, proveedorNit });

    // Crear la compra con AMBOS campos
    const nuevaCompra = await Compra.create({
      ProveedorID: proveedorNit,
      ProveedorRefId: proveedorRef,
      FechaCompra: req.body.FechaCompra
        ? new Date(req.body.FechaCompra + "T12:00:00")
        : new Date()
    });

    console.log("Compra creada exitosamente con ID:", nuevaCompra.CompraID);

    // Crear los detalles
    const detallesConCompraID = detalles.map(detalle => ({
      CompraID: nuevaCompra.CompraID,
      InsumoID: detalle.InsumoID,
      Cantidad: detalle.Cantidad,
      PrecioUnitario: detalle.PrecioUnitario || 0
    }));

    await DetalleCompra.bulkCreate(detallesConCompraID);

    console.log("Detalles creados:", detallesConCompraID.length);

    // Retornar la compra completa
    const compraCompleta = await Compra.findByPk(nuevaCompra.CompraID, {
      include: [
        {
          model: Proveedor,
          as: 'proveedor'
        },
        {
          model: DetalleCompra,
          as: 'detalles',
          include: [
            {
              model: Insumo,
              as: 'insumo'
            }
          ]
        }
      ]
    });

    res.status(201).json({
      message: 'Compra creada exitosamente',
      compra: compraCompleta
    });

  } catch (error) {
    console.error("Error al crear compra:", error);
    console.error("Stack trace:", error.stack);
    res.status(500).json({
      message: 'Error al crear compra',
      error: error.message,
      details: error.stack
    });
  }
};

// Actualizar una compra
exports.updateCompra = async (req, res) => {
  try {
    const { ProveedorRefId, FechaCompra, detalles } = req.body;

    const compra = await Compra.findByPk(req.params.id);

    if (!compra) {
      return res.status(404).json({ message: 'Compra no encontrada' });
    }

    // Validar que haya detalles
    if (!detalles || detalles.length === 0) {
      return res.status(400).json({ message: 'Debe agregar al menos un insumo' });
    }

    // Validar cantidades
    for (const detalle of detalles) {
      if (!detalle.InsumoID || !detalle.Cantidad) {
        return res.status(400).json({
          message: 'Cada detalle debe tener InsumoID y Cantidad'
        });
      }
      if (detalle.Cantidad <= 0) {
        return res.status(400).json({ message: 'Las cantidades deben ser mayores a 0' });
      }
    }

    // Resolver el proveedor
    let proveedorRef = ProveedorRefId;
    let proveedorNit = null;

    if (proveedorRef) {
      const proveedor = await Proveedor.findByPk(proveedorRef);

      if (!proveedor) {
        return res.status(404).json({
          message: 'Proveedor no encontrado'
        });
      }

      proveedorNit = proveedor.Nit;
    }


    // Actualizar la compra
    await compra.update({
      ProveedorID: proveedorNit || compra.ProveedorID,
      ProveedorRefId: proveedorRef || compra.ProveedorRefId,
      FechaCompra: FechaCompra
        ? new Date(FechaCompra + "T12:00:00")
        : compra.FechaCompra
    });

    // Eliminar detalles anteriores
    await DetalleCompra.destroy({
      where: { CompraID: req.params.id }
    });

    // Crear nuevos detalles
    const detallesConCompraID = detalles.map(detalle => ({
      CompraID: compra.CompraID,
      InsumoID: detalle.InsumoID,
      Cantidad: detalle.Cantidad,
      PrecioUnitario: detalle.PrecioUnitario || 0
    }));

    await DetalleCompra.bulkCreate(detallesConCompraID);

    // Retornar la compra actualizada
    const compraActualizada = await Compra.findByPk(compra.CompraID, {
      include: [
        {
          model: Proveedor,
          as: 'proveedor'
        },
        {
          model: DetalleCompra,
          as: 'detalles',
          include: [
            {
              model: Insumo,
              as: 'insumo'
            }
          ]
        }
      ]
    });

    res.json({
      message: 'Compra actualizada exitosamente',
      compra: compraActualizada
    });

  } catch (error) {
    console.error("Error al actualizar compra:", error);
    res.status(500).json({
      message: 'Error al actualizar compra',
      error: error.message
    });
  }
};

// Eliminar una compra
exports.deleteCompra = async (req, res) => {
  try {
    const compra = await Compra.findByPk(req.params.id);

    if (!compra) {
      return res.status(404).json({ message: 'Compra no encontrada' });
    }

    // Eliminar primero los detalles
    await DetalleCompra.destroy({
      where: { CompraID: req.params.id }
    });

    // Luego eliminar la compra
    await compra.destroy();

    res.json({ message: 'Compra eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({
      message: 'Error al eliminar compra',
      error: error.message
    });
  }
};