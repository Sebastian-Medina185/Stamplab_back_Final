// Obtener todos los productos con sus variantes
const { Producto, InventarioProducto, Color, Talla, Insumo } = require('../models');
const { Op } = require('sequelize');   

exports.getAllProductos = async (req, res) => {
    try {
        // ── Parámetros de paginación y búsqueda ──
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, parseInt(req.query.limit) || 10);
        const search = (req.query.search || "").trim();
        const offset = (page - 1) * limit;

        // ── Filtro WHERE dinámico ──
        const where = search
            ? {
                [Op.or]: [
                    { Nombre: { [Op.like]: `%${search}%` } },
                    { Descripcion: { [Op.like]: `%${search}%` } }
                ]
            }
            : {};

        // ── Consulta con paginación ──
        const { count, rows } = await Producto.findAndCountAll({
            where,
            include: [
                {
                    model: InventarioProducto,
                    as: 'inventario',
                    include: [
                        { model: Color, as: 'color', attributes: ['ColorID', 'Nombre'] },
                        { model: Talla, as: 'talla', attributes: ['TallaID', 'Nombre', 'Precio'] },
                        { model: Insumo, as: 'tela', attributes: ['InsumoID', 'Nombre', 'PrecioTela'], where: { Tipo: 'Tela' }, required: false }
                    ]
                }
            ],
            limit,
            offset,
            distinct: true   // necesario para que count sea correcto con includes
        });

        res.json({
            estado: true,
            mensaje: 'Productos obtenidos exitosamente',
            datos: rows,
            total: count,
            pagina: page,
            totalPaginas: Math.ceil(count / limit),
            limit
        });
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ estado: false, mensaje: 'Error al obtener productos', error: error.message });
    }
};


// Crear un nuevo producto
exports.createProducto = async (req, res) => {
    try {
        const { Nombre, Descripcion, PrecioBase, ImagenProducto } = req.body;

        // Validación
        if (!Nombre || !Nombre.trim()) {
            return res.status(400).json({
                estado: false,
                mensaje: 'El nombre del producto es obligatorio'
            });
        }

        if (PrecioBase === undefined || PrecioBase === null) {
            return res.status(400).json({
                estado: false,
                mensaje: 'El precio base del producto es obligatorio'
            });
        }

        const precioBaseNum = parseFloat(PrecioBase);
        if (isNaN(precioBaseNum) || precioBaseNum < 0) {
            return res.status(400).json({
                estado: false,
                mensaje: 'El precio base debe ser un número mayor o igual a 0'
            });
        }

        const nuevoProducto = await Producto.create({
            Nombre: Nombre.trim(),
            Descripcion: Descripcion ? Descripcion.trim() : null,
            PrecioBase: precioBaseNum,
            ImagenProducto: ImagenProducto || null
        });

        res.status(201).json({
            estado: true,
            mensaje: 'Producto creado exitosamente',
            datos: nuevoProducto
        });
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({
            estado: false,
            mensaje: 'Error al crear producto',
            error: error.message
        });
    }
};

// Actualizar un producto
exports.updateProducto = async (req, res) => {
    try {
        const { Nombre, Descripcion, PrecioBase, ImagenProducto } = req.body;

        const producto = await Producto.findByPk(req.params.id);

        if (!producto) {
            return res.status(404).json({
                estado: false,
                mensaje: 'Producto no encontrado'
            });
        }

        // Validación de precio base si se envía
        if (PrecioBase !== undefined && PrecioBase !== null) {
            const precioBaseNum = parseFloat(PrecioBase);
            if (isNaN(precioBaseNum) || precioBaseNum < 0) {
                return res.status(400).json({
                    estado: false,
                    mensaje: 'El precio base debe ser un número mayor o igual a 0'
                });
            }
        }

        await producto.update({
            Nombre: Nombre ? Nombre.trim() : producto.Nombre,
            Descripcion: Descripcion !== undefined ? (Descripcion ? Descripcion.trim() : null) : producto.Descripcion,
            PrecioBase: PrecioBase !== undefined ? parseFloat(PrecioBase) : producto.PrecioBase,
            ImagenProducto: ImagenProducto !== undefined ? ImagenProducto : producto.ImagenProducto
        });

        res.json({
            estado: true,
            mensaje: 'Producto actualizado exitosamente',
            datos: producto
        });
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({
            estado: false,
            mensaje: 'Error al actualizar producto',
            error: error.message
        });
    }
};

// Obtener producto por ID y eliminar (sin cambios, ya estaban bien)
// Obtener producto por ID con TODAS las relaciones
exports.getProductoById = async (req, res) => {
    try {
        const producto = await Producto.findByPk(req.params.id, {
            include: [
                {
                    model: InventarioProducto,
                    as: 'inventario',
                    include: [
                        {
                            model: Color,
                            as: 'color',
                            attributes: ['ColorID', 'Nombre']
                        },
                        {
                            model: Talla,
                            as: 'talla',
                            attributes: ['TallaID', 'Nombre', 'Precio']
                        },
                        {
                            model: Insumo,
                            as: 'tela', // ✅ AGREGADO
                            attributes: ['InsumoID', 'Nombre', 'PrecioTela'],
                            required: false
                        }
                    ]
                }
            ]
        });

        if (!producto) {
            return res.status(404).json({
                estado: false,
                mensaje: 'Producto no encontrado'
            });
        }

        res.json({
            estado: true,
            mensaje: 'Producto obtenido exitosamente',
            datos: producto
        });
    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({
            estado: false,
            mensaje: 'Error al obtener producto',
            error: error.message
        });
    }
};

exports.deleteProducto = async (req, res) => {
    try {
        const producto = await Producto.findByPk(req.params.id);

        if (!producto) {
            return res.status(404).json({
                estado: false,
                mensaje: 'Producto no encontrado'
            });
        }

        // Eliminar primero las variantes (inventario)
        await InventarioProducto.destroy({
            where: { ProductoID: req.params.id }
        });

        await producto.destroy();

        res.json({
            estado: true,
            mensaje: 'Producto eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({
            estado: false,
            mensaje: 'Error al eliminar producto',
            error: error.message
        });
    }
};