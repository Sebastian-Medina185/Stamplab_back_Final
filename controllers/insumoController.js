const { Insumo, Producto, DetalleCompra } = require('../models');

// =========================================================
// Obtener todos los insumos (Nodos: 1 al 4)
// =========================================================
exports.getAllInsumos = async (req, res) => {
  try {                                                                               // 1
    const insumos = await Insumo.findAll();                                         // 2
    res.json(insumos);                                                              // 3
  } catch (error) {                                                                   // 4
    res.status(500).json({
      message: 'Error al obtener insumos',
      error: error.message
    });
  }
};

// =========================================================
// Obtener un insumo por ID (Nodos: 1 al 7)
// =========================================================
exports.getInsumoById = async (req, res) => {
  try {
    const insumo = await Insumo.findByPk(req.params.id);

    if (!insumo) {
      return res.status(404).json({ message: 'Insumo no encontrado' });
    }

    res.json(insumo);
  } catch (error) {
    res.status(500).json({
      message: 'Error al obtener insumo',
      error: error.message
    });
  }
};

// =========================================================
// Crear un nuevo insumo (Nodos: 1 al 17)
// =========================================================
exports.createInsumo = async (req, res) => {
  try {                                                                                 // 1
    const { Nombre, Stock, Estado, Tipo, PrecioTela } = req.body;                       // 2

    // validaciones básicas
    if (!Nombre || !Nombre.toString().trim()) {                                         // 3
      return res.status(400).json({ message: 'El Nombre es obligatorio.' });            // 4
    }

    if (!Tipo || !Tipo.toString().trim()) {                                             // 5
      return res.status(400).json({ message: 'El Tipo de insumo es obligatorio.' });    // 6
    }

    // Si es tela, PrecioTela es obligatorio y debe ser número >= 0
    if (String(Tipo).toLowerCase() === 'tela') {                                        // 7
      if (PrecioTela === undefined || PrecioTela === null || PrecioTela === '') {       // 8
        return res.status(400).json({ message: 'PrecioTela es obligatorio...' });       // 9
      }
      const p = parseFloat(PrecioTela);
      if (Number.isNaN(p) || p < 0) {                                                   // 10
        return res.status(400).json({ message: 'PrecioTela debe ser numero >= 0.' });   // 11
      }
    }

    // Preprocesar precio si viene
    let precioTelaProcessed = undefined;
    if (PrecioTela !== undefined && PrecioTela !== null && PrecioTela !== '') {         // 12
      precioTelaProcessed = parseFloat(PrecioTela);                                     // 13
    }

    const nuevoInsumo = await Insumo.create({                                           // 14
      Nombre: Nombre.trim(),
      Stock: Stock || 0,
      Estado: Estado !== undefined ? Estado : true,
      Tipo: Tipo,
      ...(precioTelaProcessed !== undefined ? { PrecioTela: precioTelaProcessed } : {})
    });

    res.status(201).json({                                                              // 15
      message: 'Insumo creado exitosamente',
      insumo: nuevoInsumo
    });
  } catch (error) {                                                                     // 16
    res.status(500).json({
      message: 'Error al crear insumo',
      error: error.message
    });
  }
};

// =========================================================
// Actualizar un insumo (Nodos: 1 al 17)
// =========================================================
exports.updateInsumo = async (req, res) => {
  try {                                                                                 // 1
    const { Nombre, Stock, Estado, Tipo, PrecioTela } = req.body;

    const insumo = await Insumo.findByPk(req.params.id);                                // 2

    if (!insumo) {                                                                      // 3
      return res.status(404).json({ message: 'Insumo no encontrado' });                 // 4
    }

    // Si el tipo se cambia a 'Tela', entonces precio debe ser válido
    if (Tipo && String(Tipo).toLowerCase() === 'tela') {                                // 5
      if (PrecioTela === undefined || PrecioTela === null || PrecioTela === '') {       // 6
        return res.status(400).json({ message: 'PrecioTela es obligatorio...' });       // 7
      }
      const p = parseFloat(PrecioTela);
      if (Number.isNaN(p) || p < 0) {                                                   // 8
        return res.status(400).json({ message: 'PrecioTela numérico >= 0.' });          // 9
      }
    }

    // Preprocesar precio si viene (permitir limpiar con null o '' -> null)
    let precioTelaProcessed = undefined;
    if (PrecioTela !== undefined) {                                                     // 10
      if (PrecioTela === null || PrecioTela === '') {                                   // 11
        precioTelaProcessed = null;                                                     // 12
      } else {
        precioTelaProcessed = parseFloat(PrecioTela);                                   // 13
      }
    }

    await insumo.update({                                                               // 14
      Nombre: Nombre || insumo.Nombre,
      Stock: Stock !== undefined ? Stock : insumo.Stock,
      Estado: Estado !== undefined ? Estado : insumo.Estado,
      Tipo: Tipo || insumo.Tipo,
      ...(precioTelaProcessed !== undefined ? { PrecioTela: precioTelaProcessed } : {})
    });

    res.json({                                                                          // 15
      message: 'Insumo actualizado exitosamente',
      insumo
    });
  } catch (error) {                                                                     // 16
    res.status(500).json({
      message: 'Error al actualizar insumo',
      error: error.message
    });
  }
};

// =========================================================
// Cambiar estado del insumo (Nodos: 1 al 14)
// =========================================================
exports.cambiarEstadoInsumo = async (req, res) => {
  try {                                                                               // 1
    const { id } = req.params;
    const { Estado } = req.body;                                                    // 2

    if (Estado === undefined || Estado === null) {                                  // 3
      return res.status(400).json({ message: 'El campo Estado es requerido' });   // 4
    }

    const insumo = await Insumo.findByPk(id);                                       // 5

    if (!insumo) {                                                                  // 6
      return res.status(404).json({ message: 'Insumo no encontrado' });           // 7
    }

    // VALIDACIÓN: Si intentan desactivar, verificar si tiene compras asociadas
    if (Estado === false || Estado === 0) {                                         // 8
      const comprasCount = await DetalleCompra.count({                              // 9
        where: { InsumoID: id }
      });

      if (comprasCount > 0) {                                                       // 10
        return res.status(400).json({                                             // 11
          message: `No se puede desactivar el insumo porque tiene ${comprasCount} compra(s) asociada(s).`,
          comprasAsociadas: comprasCount,
          permitido: false
        });
      }
    }

    // Cambiar el estado
    await insumo.update({ Estado });                                                // 12

    res.json({                                                                        // 13
      message: 'Estado del insumo actualizado correctamente',
      insumo
    });
  } catch (error) {                                                                   // 14
    console.error("Error al cambiar estado del insumo:", error);
    res.status(500).json({
      message: 'Error al cambiar estado del insumo',
      error: error.message
    });
  }
};

// =========================================================
// Eliminar un insumo (Nodos: 1 al 11)
// =========================================================
exports.deleteInsumo = async (req, res) => {
  try {                                                                               // 1
    const insumo = await Insumo.findByPk(req.params.id);                            // 2

    if (!insumo) {                                                                  // 3
      return res.status(404).json({ message: 'Insumo no encontrado' });           // 4
    }

    // Validar si tiene compras asociadas antes de eliminar
    const comprasCount = await DetalleCompra.count({                                // 5
      where: { InsumoID: req.params.id }
    });

    if (comprasCount > 0) {                                                         // 6
      return res.status(400).json({                                               // 7
        message: `No se puede eliminar el insumo porque tiene ${comprasCount} compras asociadas.`,
        comprasAsociadas: comprasCount
      });
    }

    await insumo.destroy();                                                         // 8

    res.json({ message: 'Insumo eliminado exitosamente' });                         // 9
  } catch (error) {                                                                   // 10
    res.status(500).json({
      message: 'Error al eliminar insumo',
      error: error.message
    });
  }
};
