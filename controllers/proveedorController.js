const { Proveedor, Compra } = require('../models');

// Obtener todos los proveedores
exports.getAllProveedores = async (req, res) => {
  try {
    const proveedores = await Proveedor.findAll({
      include: [
        {
          model: Compra,
          as: 'compras'
        }
      ]
    });
    res.json(proveedores);
  } catch (error) {
    res.status(500).json({
      message: 'Error al obtener proveedores',
      error: error.message
    });
  }
};

// Obtener un proveedor por NIT
exports.getProveedorByNit = async (req, res) => {
  try {
    const nitParam = (req.params.nit || '').trim();
    const proveedor = await Proveedor.findOne({
      where: { Nit: nitParam },
      include: [
        {
          model: Compra,
          as: 'compras'
        }
      ]
    });

    if (!proveedor) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    res.json(proveedor);
  } catch (error) {
    res.status(500).json({
      message: 'Error al obtener proveedor',
      error: error.message
    });
  }
};

// Crear un nuevo proveedor
exports.createProveedor = async (req, res) => {
  try {
    let { Nit, Nombre, Correo, Telefono, Direccion, Estado } = req.body;
    if (!Nit || !Nombre) {
      return res.status(400).json({ message: 'Nit y Nombre son requeridos' });
    }

    Nit = Nit.trim();

    // verificar unicidad de Nit
    const existe = await Proveedor.findOne({ where: { Nit } });
    if (existe) {
      return res.status(409).json({ message: 'Nit ya registrado' });
    }

    const nuevoProveedor = await Proveedor.create({
      Nit,
      Nombre,
      Correo,
      Telefono,
      Direccion,
      Estado: Estado !== undefined ? Estado : true
    });

    res.status(201).json({
      message: 'Proveedor creado exitosamente',
      proveedor: nuevoProveedor
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error al crear proveedor',
      error: error.message
    });
  }
};

// Actualizar un proveedor (incluye posibilidad de cambiar el Nit)
exports.updateProveedor = async (req, res) => {
  try {
    const nitParam = (req.params.nit || '').trim();
    const { Nit: nuevoNit, Nombre, Correo, Telefono, Direccion, Estado } = req.body;

    const proveedor = await Proveedor.findOne({ where: { Nit: nitParam } });

    if (!proveedor) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    // Si intentan cambiar Nit, verificar unicidad
    if (nuevoNit && nuevoNit.trim() !== proveedor.Nit) {
      const nitTrim = nuevoNit.trim();
      const conflicto = await Proveedor.findOne({ where: { Nit: nitTrim } });
      if (conflicto) {
        return res.status(409).json({ message: 'El nuevo Nit ya está en uso por otro proveedor' });
      }
      proveedor.Nit = nitTrim;
    }

    // Actualizar otros campos
    proveedor.Nombre = Nombre || proveedor.Nombre;
    proveedor.Correo = Correo || proveedor.Correo;
    proveedor.Telefono = Telefono || proveedor.Telefono;
    proveedor.Direccion = Direccion || proveedor.Direccion;
    proveedor.Estado = Estado !== undefined ? Estado : proveedor.Estado;

    await proveedor.save();

    res.json({
      message: 'Proveedor actualizado exitosamente',
      proveedor
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error al actualizar proveedor',
      error: error.message
    });
  }
};

// Eliminar (o desactivar si tiene compras) un proveedor
exports.deleteProveedor = async (req, res) => {
  try {
    const nitParam = (req.params.nit || '').trim();
    const proveedor = await Proveedor.findOne({ where: { Nit: nitParam } });

    if (!proveedor) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    // Comprobar compras relacionadas: si existe proveedor.id, usar ProveedorRefId; si no, usar Nit legacy
    let comprasCount = 0;
    if (proveedor.id) {
      comprasCount = await Compra.count({ where: { ProveedorRefId: proveedor.id } });
    } else {
      comprasCount = await Compra.count({ where: { ProveedorID: proveedor.Nit } });
    }

    if (comprasCount > 0) {
      // ✅ CORRECCIÓN: Si tiene compras relacionadas, desactivarlo y retornar mensaje claro
      proveedor.Estado = false;
      await proveedor.save();
      
      return res.status(200).json({
        message: 'No se puede eliminar el proveedor porque tiene compras asociadas. Se ha desactivado en su lugar.',
        accion: 'desactivado', // ✅ Indicador para el frontend
        proveedor
      });
    }

    // Si no tiene compras, se puede eliminar físicamente
    await proveedor.destroy();

    res.json({ 
      message: 'Proveedor eliminado exitosamente',
      accion: 'eliminado' // Indicador para el frontend
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error al eliminar proveedor',
      error: error.message
    });
  }
};