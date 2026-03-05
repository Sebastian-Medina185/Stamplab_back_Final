const express = require('express');
const router = express.Router();
const cotizacionController = require('../controllers/cotizacionController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── Configuración de multer para imágenes de diseños ──
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'disenos');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
    }
});

// ── Subir imagen de diseño ──
router.post('/upload-diseno', upload.single('imagen'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No se recibió imagen' });
    res.json({ filename: req.file.filename });
});

// ── Servir imagen por nombre ──
router.get('/imagen/:filename', cotizacionController.getImagenDiseno);

router.get('/', cotizacionController.getAllCotizaciones);
router.get('/usuario/:documentoID', cotizacionController.getCotizacionesByUsuario);
router.get('/:id', cotizacionController.getCotizacionById);
router.put('/:id', cotizacionController.updateCotizacion);
router.delete('/:id', cotizacionController.deleteCotizacion);
router.post('/inteligente', cotizacionController.createCotizacionInteligente);
router.post('/completa', cotizacionController.createCotizacionCompleta);
router.post('/:cotizacionID/convertir-a-venta', cotizacionController.convertirCotizacionAVenta);
router.put('/:cotizacionID/cancelar', cotizacionController.cancelarCotizacion);

module.exports = router;