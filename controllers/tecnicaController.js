const { Tecnica } = require('../models');

exports.getAllTecnicas = async (req, res) => {
    try {
        const tecnicas = await Tecnica.findAll();
        res.json(tecnicas);
    } catch (error) {
        console.error('Error en getAllTecnicas:', error);
        res.status(500).json({ 
            estado: false,
            message: 'Error al obtener técnicas', 
            error: error.message 
        });
    }
};

exports.getTecnicaById = async (req, res) => {
    try {
        const tecnica = await Tecnica.findByPk(req.params.id);
        if (!tecnica) {
            return res.status(404).json({ 
                estado: false,
                message: 'Técnica no encontrada' 
            });
        }
        res.json(tecnica);
    } catch (error) {
        console.error('Error en getTecnicaById:', error);
        res.status(500).json({ 
            estado: false,
            message: 'Error al obtener técnica', 
            error: error.message 
        });
    }
};

exports.createTecnica = async (req, res) => {
    try {
        console.log('=== CREAR TÉCNICA ===');
        console.log('Body recibido:', JSON.stringify(req.body).substring(0, 200) + '...');
        
        const { Nombre, Descripcion, imagenTecnica, Estado } = req.body;

        // Validaciones
        if (!Nombre || !Nombre.trim()) {
            return res.status(400).json({ 
                estado: false, 
                message: 'El nombre es obligatorio' 
            });
        }

        if (!imagenTecnica || !imagenTecnica.trim()) {
            return res.status(400).json({ 
                estado: false, 
                message: 'La imagen es obligatoria' 
            });
        }

        // Crear técnica
        const nuevaTecnica = await Tecnica.create({
            Nombre: Nombre.trim(),
            Descripcion: Descripcion ? Descripcion.trim() : "",
            imagenTecnica: imagenTecnica.trim(),
            Estado: Estado !== undefined ? Boolean(Estado) : true
        });

        console.log('Técnica creada con ID:', nuevaTecnica.TecnicaID);

        res.status(201).json({ 
            estado: true, 
            message: 'Técnica creada exitosamente',
            tecnica: nuevaTecnica 
        });
    } catch (error) {
        console.error('Error en createTecnica:', error);
        console.error('Detalles del error:', {
            name: error.name,
            message: error.message,
            sql: error.sql
        });
        
        res.status(500).json({ 
            estado: false,
            message: 'Error al crear técnica', 
            error: error.message,
            detalles: error.name === 'SequelizeDatabaseError' ? 'Verifica el tipo de dato de imagenTecnica en la BD' : undefined
        });
    }
};

exports.updateTecnica = async (req, res) => {
    try {
        console.log('=== ACTUALIZAR TÉCNICA ===');
        console.log('ID:', req.params.id);
        console.log('Body recibido:', JSON.stringify(req.body).substring(0, 200) + '...');
        
        const tecnica = await Tecnica.findByPk(req.params.id);
        
        if (!tecnica) {
            return res.status(404).json({ 
                estado: false,
                message: 'Técnica no encontrada' 
            });
        }

        const { Nombre, Descripcion, imagenTecnica, Estado } = req.body;

        // Preparar datos para actualizar
        const updateData = {};
        
        if (Nombre !== undefined) {
            updateData.Nombre = Nombre.trim();
        }
        
        if (Descripcion !== undefined) {
            updateData.Descripcion = Descripcion.trim();
        }
        
        if (imagenTecnica !== undefined) {
            updateData.imagenTecnica = imagenTecnica.trim();
        }
        
        if (Estado !== undefined) {
            updateData.Estado = Boolean(Estado);
        }

        console.log('Datos a actualizar:', Object.keys(updateData));

        await tecnica.update(updateData);

        console.log('Técnica actualizada exitosamente');

        res.json({ 
            estado: true, 
            message: 'Técnica actualizada exitosamente',
            tecnica 
        });
    } catch (error) {
        console.error('Error en updateTecnica:', error);
        console.error('Detalles del error:', {
            name: error.name,
            message: error.message,
            sql: error.sql
        });
        
        res.status(500).json({ 
            estado: false,
            message: 'Error al actualizar técnica', 
            error: error.message,
            detalles: error.name === 'SequelizeDatabaseError' ? 'Verifica el tipo de dato de imagenTecnica en la BD' : undefined
        });
    }
};

exports.deleteTecnica = async (req, res) => {
    try {
        const tecnica = await Tecnica.findByPk(req.params.id);

        if (!tecnica) {
            return res.status(404).json({
                estado: false,
                message: 'Técnica no encontrada'
            });
        }

        await tecnica.destroy();

        res.json({
            estado: true,
            message: 'Técnica eliminada exitosamente'
        });
    } catch (error) {
        console.error('Error en deleteTecnica:', error);

        // ── Foreign key: la técnica está asociada a diseños de cotizaciones ──
        const esFKError =
            error.name === 'SequelizeForeignKeyConstraintError' ||
            (error.parent?.code === 'ER_ROW_IS_REFERENCED_2') ||
            (error.original?.code === 'ER_ROW_IS_REFERENCED_2') ||
            (error.parent?.errno === 1451) ||
            (error.original?.errno === 1451);

        if (esFKError) {
            return res.status(409).json({
                estado: false,
                message: 'No se puede eliminar esta técnica porque está asociada a uno o más diseños de cotizaciones. Primero elimina o reasigna esos diseños.'
            });
        }

        res.status(500).json({
            estado: false,
            message: 'Error al eliminar técnica',
            error: error.message
        });
    }
};
