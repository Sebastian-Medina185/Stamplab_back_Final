jest.mock('../models', () => ({
    Cotizacion: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), count: jest.fn() },
    DetalleCotizacion: { findAll: jest.fn(), create: jest.fn(), bulkCreate: jest.fn() },
    Usuario: { findByPk: jest.fn() },
    Estado: {},
    CotizacionTecnica: { bulkCreate: jest.fn() },
    CotizacionTalla: { bulkCreate: jest.fn() },
    CotizacionColor: { bulkCreate: jest.fn() },
    CotizacionInsumo: { bulkCreate: jest.fn() },
    Tecnica: {}, Talla: {}, Color: {}, Insumo: {},
    Producto: {}, Parte: {}, Venta: { create: jest.fn() },
    DetalleVenta: { create: jest.fn() },
    InventarioProducto: { findOne: jest.fn(), decrement: jest.fn(), increment: jest.fn() },
    sequelize: { fn: jest.fn(), col: jest.fn(), where: jest.fn() },
}));

const { Cotizacion, Usuario, Venta, InventarioProducto } = require('../models');
const controller = require('../controllers/cotizacionController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('CotizacionController - Pruebas Unitarias', () => {

    describe('getAllCotizaciones', () => {
        test('debería retornar lista paginada de cotizaciones exitosamente', async () => {
            Cotizacion.count.mockResolvedValue(2);
            Cotizacion.findAll.mockResolvedValue([{ CotizacionID: 1 }, { CotizacionID: 2 }]);
            const req = { query: {} };
            const res = mockRes();
            await controller.getAllCotizaciones(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
        });

        test('debería retornar 500 si falla la base de datos', async () => {
            Cotizacion.count.mockRejectedValue(new Error('DB caída'));
            const req = { query: {} };
            const res = mockRes();
            await controller.getAllCotizaciones(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getCotizacionById', () => {
        test('debería retornar la cotización si existe', async () => {
            Cotizacion.findByPk.mockResolvedValue({
                CotizacionID: 1, EstadoID: 1,
                toJSON: () => ({ CotizacionID: 1 }),
                detalles: []
            });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.getCotizacionById(req, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar 404 si la cotización no existe', async () => {
            Cotizacion.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.getCotizacionById(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Cotización no encontrada' }));
        });
    });

    describe('createCotizacionInteligente', () => {
        test('debería retornar 400 si falta DocumentoID', async () => {
            const req = { body: { detalles: [{ Cantidad: 1 }] } };
            const res = mockRes();
            await controller.createCotizacionInteligente(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'DocumentoID es obligatorio' }));
        });

        test('debería retornar 400 si no hay detalles', async () => {
            const req = { body: { DocumentoID: '123', detalles: [] } };
            const res = mockRes();
            await controller.createCotizacionInteligente(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Debe incluir al menos un producto' }));
        });

        test('debería retornar 404 si el usuario no existe', async () => {
            Usuario.findByPk.mockResolvedValue(null);
            const req = { body: { DocumentoID: '999', detalles: [{ Cantidad: 1, colores: [], tallas: [] }] } };
            const res = mockRes();
            await controller.createCotizacionInteligente(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Usuario no encontrado' }));
        });
    });

    describe('deleteCotizacion', () => {
        test('debería retornar 404 si la cotización no existe', async () => {
            Cotizacion.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.deleteCotizacion(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('debería eliminar la cotización correctamente', async () => {
            const destroyMock = jest.fn().mockResolvedValue(true);
            Cotizacion.findByPk.mockResolvedValue({ CotizacionID: 1, destroy: destroyMock });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.deleteCotizacion(req, res);
            expect(destroyMock).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Cotización eliminada exitosamente' }));
        });
    });

    describe('convertirCotizacionAVenta', () => {
        test('debería retornar 404 si la cotización no existe', async () => {
            Cotizacion.findByPk.mockResolvedValue(null);
            const req = { params: { cotizacionID: '999' } };
            const res = mockRes();
            await controller.convertirCotizacionAVenta(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('debería retornar 400 si la cotización no está aprobada', async () => {
            Cotizacion.findByPk.mockResolvedValue({ CotizacionID: 1, EstadoID: 1, detalles: [] });
            const req = { params: { cotizacionID: '1' } };
            const res = mockRes();
            await controller.convertirCotizacionAVenta(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Solo se pueden convertir cotizaciones aprobadas' }));
        });
    });

});