// RUTA TEMPORAL - borrar después de usarla
router.get('/seed/insertar', async (req, res) => {
    try {
        const { Parte } = require('../models');

        // Eliminar los incorrectos
        await Parte.destroy({ where: { ParteID: [1, 2, 3] } });

        res.json({ message: 'Partes incorrectas eliminadas' });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// GET /api/partes - Obtener todas las partes
router.get('/', parteController.getAllPartes);

// GET /api/partes/:id - Obtener una parte por ID
router.get('/:id', parteController.getParteById);

// POST /api/partes - Crear una nueva parte
router.post('/', parteController.createParte);

// PUT /api/partes/:id - Actualizar una parte
router.put('/:id', parteController.updateParte);

// DELETE /api/partes/:id - Eliminar una parte
router.delete('/:id', parteController.deleteParte);

module.exports = router;