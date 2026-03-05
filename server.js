const db = require('./models');

const express = require("express");
const cors = require("cors");
const app = express();


const PORT = process.env.PORT || 3000;


// ==================== MIDDLEWARES ====================
// Permitir TODAS las peticiones en desarrollo
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const path = require('path');
const fs = require('fs');

// Servir imágenes de diseños estáticamente
app.use('/uploads/disenos', express.static(path.join(__dirname, 'uploads', 'disenos')));

// Crear carpeta si no existe
const uploadDir = path.join(__dirname, 'uploads', 'disenos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });


// Middleware para logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});


// ==================== RUTA PRINCIPAL ====================
app.get('/', (req, res) => {
    res.json({
        message: 'API de STAMPLAB funcionando correctamente',
        version: '1.0.0',
        documentacion: 'https://tu-dominio.com/api-docs',
        endpoints: {
            // Gestión de Usuarios y Permisos
            roles: '/api/roles',
            permisos: '/api/permisos',
            privilegios: '/api/privilegios',
            usuarios: '/api/usuarios',
            rolpermisos: '/api/rolpermisos',
            permisoprivilegios: '/api/permisoprivilegios',

            // Catálogo de Productos
            productos: '/api/productos',
            colores: '/api/colores',
            tallas: '/api/tallas',
            insumos: '/api/insumos',
            tecnicas: '/api/tecnicas',
            partes: '/api/partes',

            // Relaciones de Productos
            inventarioproducto: '/api/inventarioproducto',

            // Proveedores y Compras
            proveedores: '/api/proveedores',
            compras: '/api/compras',
            detallecompras: '/api/detallecompras',

            // Cotizaciones
            cotizaciones: '/api/cotizaciones',
            detallecotizaciones: '/api/detallecotizaciones',
            cotizaciontecnicas: '/api/cotizaciontecnicas',
            cotizaciontallas: '/api/cotizaciontallas',
            cotizacioncolores: '/api/cotizacioncolores',
            cotizacioninsumos: '/api/cotizacioninsumos',


            // Ventas
            ventas: '/api/ventas',
            detalleventas: '/api/detalleventas',
            estados: '/api/estados'
        }
    });
});

// ==================== IMPORTAR RUTAS ====================

// Gestión de Usuarios y Permisos
const authRoutes = require('./routes/auth');
const rolesRoutes = require('./routes/roles');
const permisosRoutes = require('./routes/permisos');
const privilegiosRoutes = require('./routes/privilegios');
const usuariosRoutes = require('./routes/usuarios');
const rolpermisosRoutes = require('./routes/rolpermisos');
const permisoprivilegiosRoutes = require('./routes/permisoprivilegios');

// Catálogo de Productos
const productosRoutes = require('./routes/productos');
const coloresRoutes = require('./routes/colores');
const tallasRoutes = require('./routes/tallas');
const insumosRoutes = require('./routes/insumos');
const tecnicasRoutes = require('./routes/tecnicas');
const partesRoutes = require('./routes/partes');

// Relaciones de Productos
const inventarioproductoRoutes = require('./routes/inventarioproducto');

// Proveedores y Compras
const proveedoresRoutes = require('./routes/proveedores');
const comprasRoutes = require('./routes/compras');
const detallecomprasRoutes = require('./routes/detallecompras');

// Cotizaciones
const cotizacionesRoutes = require('./routes/cotizaciones');
const detallecotizacionesRoutes = require('./routes/detallecotizaciones');
const cotizaciontecnicasRoutes = require('./routes/cotizaciontecnicas');
const cotizaciontallasRoutes = require('./routes/cotizaciontallas');
const cotizacioncoloresRoutes = require('./routes/cotizacioncolores');
const cotizacioninsumosRoutes = require('./routes/cotizacioninsumos');
const cotizacionPdfController = require('./controllers/cotizacionPdfController');

// Ventas
const ventasRoutes = require('./routes/ventas');
const detalleventasRoutes = require('./routes/detalleventas');
const estadosRoutes = require('./routes/estados');

// ==================== USAR RUTAS ====================

// Gestión de Usuarios y Permisos
app.use('/api', authRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/permisos', permisosRoutes);
app.use('/api/privilegios', privilegiosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/rolpermisos', rolpermisosRoutes);
app.use('/api/permisoprivilegios', permisoprivilegiosRoutes);

// Catálogo de Productos
app.use('/api/productos', productosRoutes);
app.use('/api/colores', coloresRoutes);
app.use('/api/tallas', tallasRoutes);
app.use('/api/insumos', insumosRoutes);
app.use('/api/tecnicas', tecnicasRoutes);
app.use('/api/partes', partesRoutes);

// Relaciones de Productos
app.use('/api/inventarioproducto', inventarioproductoRoutes);

// Proveedores y Compras
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/detallecompras', detallecomprasRoutes);

// Cotizaciones
app.use('/api/cotizaciones', cotizacionesRoutes);
app.use('/api/detallecotizaciones', detallecotizacionesRoutes);
app.use('/api/cotizaciontecnicas', cotizaciontecnicasRoutes);
app.use('/api/cotizaciontallas', cotizaciontallasRoutes);
app.use('/api/cotizacioncolores', cotizacioncoloresRoutes);
app.use('/api/cotizacioninsumos', cotizacioninsumosRoutes);

// Agrega esta línea después del bloque de cotizaciones
app.get('/api/cotizaciones/:cotizacionID/pdf', cotizacionPdfController.descargarPdfCotizacion);

// Ventas
app.use('/api/ventas', ventasRoutes);
app.use('/api/detalleventas', detalleventasRoutes);
app.use('/api/estados', estadosRoutes);

// ==================== MANEJO DE ERRORES ====================

// Ruta no encontrada (404)
app.use((req, res) => {
    res.status(404).json({
        message: 'Endpoint no encontrado',
        path: req.url,
        sugerencia: 'Revisa la documentación en http://localhost:3000/'
    });
});

// Error interno del servidor (500)
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Error desconocido'
    });
});

// ==================== INICIAR SERVIDOR ====================
db.sequelize.authenticate()
    .then(() => {
        console.log('Conexión a la base de datos exitosa');

        app.listen(PORT, () => {
            console.log('\n' + '='.repeat(60));
            console.log('SERVIDOR STAMPLAB INICIADO CORRECTAMENTE');
            console.log('='.repeat(60));
            console.log(`URL: http://localhost:${PORT}`);
            console.log(`Base de datos: ${db.sequelize.config.database}`);
            console.log(`Dialect: ${db.sequelize.options.dialect}`);
            console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
            console.log('='.repeat(60));
            console.log('ENDPOINTS DISPONIBLES:');
            console.log('');
            console.log('Usuarios y Permisos:');
            console.log('   • http://localhost:' + PORT + '/api/roles');
            console.log('   • http://localhost:' + PORT + '/api/permisos');
            console.log('   • http://localhost:' + PORT + '/api/privilegios');
            console.log('   • http://localhost:' + PORT + '/api/usuarios');
            console.log('');
            console.log('Catálogo:');
            console.log('   • http://localhost:' + PORT + '/api/productos');
            console.log('   • http://localhost:' + PORT + '/api/colores');
            console.log('   • http://localhost:' + PORT + '/api/tallas');
            console.log('   • http://localhost:' + PORT + '/api/insumos');
            console.log('   • http://localhost:' + PORT + '/api/tecnicas');
            console.log('');
            console.log('Compras y Proveedores:');
            console.log('   • http://localhost:' + PORT + '/api/proveedores');
            console.log('   • http://localhost:' + PORT + '/api/compras');
            console.log('');
            console.log('Cotizaciones:');
            console.log('   • http://localhost:' + PORT + '/api/cotizaciones');
            console.log('   • http://localhost:' + PORT + '/api/detallecotizaciones');
            console.log('');
            console.log('Ventas:');
            console.log('   • http://localhost:' + PORT + '/api/ventas');
            console.log('   • http://localhost:' + PORT + '/api/detalleventas');
            console.log('');
            console.log('='.repeat(60));
            console.log('Todo listo para recibir peticiones');
            console.log('='.repeat(60) + '\n');
        });
    }).catch(err => {
        console.error('Error al conectar con la base de datos:', err);
        process.exit(1);
    });

