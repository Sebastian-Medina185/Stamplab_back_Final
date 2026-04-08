jest.mock('../models', () => ({
    Compra: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
    Proveedor: { findByPk: jest.fn(), findOne: jest.fn() },
    DetalleCompra: { findAll: jest.fn(), bulkCreate: jest.fn(), destroy: jest.fn() },
    Insumo: { findByPk: jest.fn(), increment: jest.fn(), decrement: jest.fn() },
    Producto: { findByPk: jest.fn() },
    InventarioProducto: { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn(), increment: jest.fn(), decrement: jest.fn() },
    Color: {},
    Talla: {},
}));

// Silenciar el console.log del controller
jest.spyOn(console, 'log').mockImplementation(() => { });

const { Compra, Proveedor, DetalleCompra, Insumo, Producto, InventarioProducto } = require('../models');
const controller = require('../controllers/compraController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('CompraController - Pruebas Unitarias', () => {

    describe('getAllCompras', () => {
        test('debería retornar todas las compras exitosamente', async () => {
            Compra.findAll.mockResolvedValue([{ CompraID: 1 }, { CompraID: 2 }]);
            const res = mockRes();
            await controller.getAllCompras({}, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar 500 si falla la base de datos', async () => {
            Compra.findAll.mockRejectedValue(new Error('DB caída'));
            const res = mockRes();
            await controller.getAllCompras({}, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getCompraById', () => {
        test('debería retornar la compra si existe', async () => {
            Compra.findByPk.mockResolvedValue({ CompraID: 1, ProveedorID: '123' });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.getCompraById(req, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar 404 si la compra no existe', async () => {
            Compra.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.getCompraById(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Compra no encontrada' }));
        });
    });

    describe('createCompra', () => {
        test('debería retornar 400 si no hay detalles', async () => {
            const req = { body: { ProveedorID: '123', detalles: [] } };
            const res = mockRes();
            await controller.createCompra(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Debe agregar al menos un insumo o producto' }));
        });

        test('debería retornar 400 si cantidad es 0 o negativa', async () => {
            const req = { body: { ProveedorID: '123', detalles: [{ TipoSeleccion: 'insumo', InsumoID: 1, Cantidad: 0 }] } };
            const res = mockRes();
            await controller.createCompra(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Las cantidades deben ser mayores a 0' }));
        });

        test('debería retornar 404 si el proveedor no existe', async () => {
            Proveedor.findByPk.mockResolvedValue(null);
            const req = {
                body: {
                    ProveedorRefId: 999,
                    detalles: [{ TipoSeleccion: 'insumo', InsumoID: 1, Cantidad: 5 }]
                }
            };
            const res = mockRes();
            await controller.createCompra(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Proveedor no encontrado' }));
        });

        test('debería crear la compra correctamente con insumos', async () => {
            Proveedor.findByPk.mockResolvedValue({ id: 1, Nit: '900123' });
            Proveedor.findOne.mockResolvedValue(null);
            Compra.create.mockResolvedValue({ CompraID: 10, ProveedorID: '900123' });
            DetalleCompra.bulkCreate.mockResolvedValue([]);
            Insumo.increment.mockResolvedValue(true);
            Compra.findByPk.mockResolvedValue({ CompraID: 10 });
            const req = {
                body: {
                    ProveedorRefId: 1,
                    detalles: [{ TipoSeleccion: 'insumo', InsumoID: 1, Cantidad: 10, PrecioUnitario: 500 }]
                }
            };
            const res = mockRes();
            await controller.createCompra(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Compra creada exitosamente' }));
        });
    });

    describe('deleteCompra', () => {
        test('debería retornar 404 si la compra no existe', async () => {
            Compra.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.deleteCompra(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('debería eliminar la compra y revertir el stock', async () => {
            const destroyMock = jest.fn().mockResolvedValue(true);
            Compra.findByPk.mockResolvedValue({ CompraID: 1, destroy: destroyMock });
            DetalleCompra.findAll.mockResolvedValue([{ TipoSeleccion: 'insumo', InsumoID: 1, Cantidad: 5 }]);
            Insumo.decrement.mockResolvedValue(true);
            DetalleCompra.destroy.mockResolvedValue(true);
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.deleteCompra(req, res);
            expect(destroyMock).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Compra eliminada exitosamente' }));
        });
    });

});