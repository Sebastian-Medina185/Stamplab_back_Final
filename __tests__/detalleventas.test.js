jest.mock('../models', () => ({
    DetalleVenta: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
    Venta: {},
    Producto: {},
    Color: {},
    Talla: {},
}));

const { DetalleVenta } = require('../models');
const controller = require('../controllers/detalleventaController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('DetalleVentaController - Pruebas Unitarias', () => {

    describe('getAllDetalleVentas', () => {
        test('debería retornar todos los detalles de venta', async () => {
            DetalleVenta.findAll.mockResolvedValue([{ DetalleVentaID: 1, Cantidad: 2 }]);
            const res = mockRes();
            await controller.getAllDetalleVentas({}, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar 500 si falla la base de datos', async () => {
            DetalleVenta.findAll.mockRejectedValue(new Error('DB caída'));
            const res = mockRes();
            await controller.getAllDetalleVentas({}, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getDetalleVentaById', () => {
        test('debería retornar el detalle si existe', async () => {
            DetalleVenta.findByPk.mockResolvedValue({ DetalleVentaID: 1, Cantidad: 3 });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.getDetalleVentaById(req, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar 404 si el detalle no existe', async () => {
            DetalleVenta.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.getDetalleVentaById(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Detalle de venta no encontrado' }));
        });
    });

    describe('createDetalleVenta', () => {
        test('debería retornar 400 si faltan datos obligatorios', async () => {
            const req = { body: { ColorID: 1 } };
            const res = mockRes();
            await controller.createDetalleVenta(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Faltan datos obligatorios' }));
        });

        test('debería crear el detalle de venta correctamente', async () => {
            DetalleVenta.create.mockResolvedValue({ DetalleVentaID: 3, VentaID: 1, ProductoID: 2, Cantidad: 2, PrecioUnitario: 15000 });
            const req = { body: { VentaID: 1, ProductoID: 2, Cantidad: 2, PrecioUnitario: 15000 } };
            const res = mockRes();
            await controller.createDetalleVenta(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Detalle de venta creado exitosamente' }));
        });
    });

    describe('deleteDetalleVenta', () => {
        test('debería retornar 404 si el detalle no existe', async () => {
            DetalleVenta.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.deleteDetalleVenta(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('debería eliminar el detalle correctamente', async () => {
            const destroyMock = jest.fn().mockResolvedValue(true);
            DetalleVenta.findByPk.mockResolvedValue({ DetalleVentaID: 1, destroy: destroyMock });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.deleteDetalleVenta(req, res);
            expect(destroyMock).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Detalle de venta eliminado exitosamente' }));
        });
    });

});