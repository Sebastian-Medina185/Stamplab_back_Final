jest.mock('../models', () => ({
    Venta: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), count: jest.fn() },
    Usuario: {},
    DetalleVenta: { findAll: jest.fn(), create: jest.fn(), destroy: jest.fn() },
    DetalleCompra: { findAll: jest.fn() },
    Compra: {},
    Producto: {},
    Insumo: {},
    InventarioProducto: { findOne: jest.fn(), decrement: jest.fn(), increment: jest.fn() },
    Color: {},
    Talla: {},
    Estado: {},
    sequelize: { fn: jest.fn(), col: jest.fn(), where: jest.fn() },
}));

const { Venta, DetalleVenta, InventarioProducto } = require('../models');
const controller = require('../controllers/ventaController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('VentaController - Pruebas Unitarias', () => {

    describe('getAllVentas', () => {
        test('debería retornar lista paginada de ventas exitosamente', async () => {
            Venta.count.mockResolvedValue(1);
            Venta.findAll.mockResolvedValue([{ VentaID: 1, Total: 50000 }]);
            const req = { query: {} };
            const res = mockRes();
            await controller.getAllVentas(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
        });

        test('debería retornar 500 si falla la base de datos', async () => {
            Venta.count.mockRejectedValue(new Error('DB caída'));
            const req = { query: {} };
            const res = mockRes();
            await controller.getAllVentas(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getVentaById', () => {
        test('debería retornar la venta si existe', async () => {
            Venta.findByPk.mockResolvedValue({ VentaID: 1, Total: 80000 });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.getVentaById(req, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar 404 si la venta no existe', async () => {
            Venta.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.getVentaById(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Venta no encontrada' }));
        });
    });

    describe('crearVenta', () => {
        test('debería retornar 400 si faltan datos obligatorios', async () => {
            const req = { body: {} };
            const res = mockRes();
            await controller.crearVenta(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Faltan datos obligatorios' }));
        });

        test('debería retornar 400 si no existe variante del producto', async () => {
            InventarioProducto.findOne.mockResolvedValue(null);
            const req = {
                body: {
                    DocumentoID: '123',
                    detalles: [{ ProductoID: 1, ColorID: 1, TallaID: 1, Cantidad: 2, PrecioUnitario: 10000 }]
                }
            };
            const res = mockRes();
            await controller.crearVenta(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('No existe variante') }));
        });

        test('debería retornar 400 si el stock es insuficiente', async () => {
            InventarioProducto.findOne.mockResolvedValue({ Stock: 1 });
            const req = {
                body: {
                    DocumentoID: '123',
                    detalles: [{ ProductoID: 1, ColorID: 1, TallaID: 1, Cantidad: 5, PrecioUnitario: 10000 }]
                }
            };
            const res = mockRes();
            await controller.crearVenta(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Stock insuficiente') }));
        });

        test('debería crear la venta correctamente', async () => {
            InventarioProducto.findOne.mockResolvedValue({ Stock: 10 });
            InventarioProducto.decrement.mockResolvedValue(true);
            DetalleVenta.create.mockResolvedValue({});
            Venta.create.mockResolvedValue({ VentaID: 5, DocumentoID: '123', Total: 20000 });
            const req = {
                body: {
                    DocumentoID: '123', Subtotal: 18000, Total: 20000,
                    detalles: [{ ProductoID: 1, ColorID: 1, TallaID: 1, Cantidad: 2, PrecioUnitario: 10000 }]
                }
            };
            const res = mockRes();
            await controller.crearVenta(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Venta creada correctamente' }));
        });
    });

    describe('deleteVenta', () => {
        test('debería retornar 404 si la venta no existe', async () => {
            Venta.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.deleteVenta(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('debería eliminar la venta correctamente', async () => {
            const destroyMock = jest.fn().mockResolvedValue(true);
            Venta.findByPk.mockResolvedValue({ VentaID: 1, EstadoID: 9, detalles: [], destroy: destroyMock });
            DetalleVenta.destroy.mockResolvedValue(true);
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.deleteVenta(req, res);
            expect(destroyMock).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Venta eliminada exitosamente' }));
        });
    });

});