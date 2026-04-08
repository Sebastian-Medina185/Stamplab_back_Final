jest.mock('../models', () => ({
    DetalleCotizacion: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
    Cotizacion: { findByPk: jest.fn() },
    Producto: { findByPk: jest.fn() },
    CotizacionTecnica: {},
    CotizacionTalla: {},
    CotizacionColor: {},
    CotizacionInsumo: {},
    Tecnica: {}, Talla: {}, Color: {}, Insumo: {}, Parte: {},
}));

// Mock del cotizacionController para evitar dependencias circulares
jest.mock('../controllers/cotizacionController', () => ({
    calcularValorTotalCotizacion: jest.fn().mockResolvedValue(100000),
}));

const { DetalleCotizacion, Cotizacion, Producto } = require('../models');
const controller = require('../controllers/detallecotizacionController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('DetalleCotizacionController - Pruebas Unitarias', () => {

    describe('getDetalleCotizacionById', () => {
        test('debería retornar el detalle si existe', async () => {
            DetalleCotizacion.findByPk.mockResolvedValue({ DetalleCotizacionID: 1, Cantidad: 2 });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.getDetalleCotizacionById(req, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar 404 si el detalle no existe', async () => {
            DetalleCotizacion.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.getDetalleCotizacionById(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Detalle de cotización no encontrado' }));
        });
    });

    describe('createDetalleCotizacion', () => {
        test('debería retornar 404 si la cotización no existe', async () => {
            Cotizacion.findByPk.mockResolvedValue(null);
            const req = { body: { CotizacionID: 999, ProductoID: 1, Cantidad: 2 } };
            const res = mockRes();
            await controller.createDetalleCotizacion(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Cotización no encontrada' }));
        });

        test('debería retornar 404 si el producto no existe', async () => {
            Cotizacion.findByPk.mockResolvedValue({ CotizacionID: 1 });
            Producto.findByPk.mockResolvedValue(null);
            const req = { body: { CotizacionID: 1, ProductoID: 999, Cantidad: 2 } };
            const res = mockRes();
            await controller.createDetalleCotizacion(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Producto no encontrado' }));
        });

        test('debería crear el detalle correctamente', async () => {
            Cotizacion.findByPk.mockResolvedValue({ CotizacionID: 1 });
            Producto.findByPk.mockResolvedValue({ ProductoID: 2, Nombre: 'Camiseta' });
            DetalleCotizacion.create.mockResolvedValue({ DetalleCotizacionID: 5, CotizacionID: 1, ProductoID: 2, Cantidad: 3 });
            const req = { body: { CotizacionID: 1, ProductoID: 2, Cantidad: 3 } };
            const res = mockRes();
            await controller.createDetalleCotizacion(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Detalle de cotización creado exitosamente' }));
        });
    });

    describe('deleteDetalleCotizacion', () => {
        test('debería retornar 404 si el detalle no existe', async () => {
            DetalleCotizacion.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.deleteDetalleCotizacion(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('debería eliminar el detalle correctamente', async () => {
            const destroyMock = jest.fn().mockResolvedValue(true);
            DetalleCotizacion.findByPk.mockResolvedValue({ DetalleCotizacionID: 1, destroy: destroyMock });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.deleteDetalleCotizacion(req, res);
            expect(destroyMock).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Detalle de cotización eliminado exitosamente' }));
        });
    });

});