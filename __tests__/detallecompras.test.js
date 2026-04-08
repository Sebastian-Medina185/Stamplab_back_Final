jest.mock('../models', () => ({
    DetalleCompra: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
    Compra: {},
    Insumo: { findByPk: jest.fn(), increment: jest.fn(), decrement: jest.fn() },
    Producto: { findByPk: jest.fn() },
    InventarioProducto: { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn(), increment: jest.fn(), decrement: jest.fn() },
    Color: {},
    Talla: {},
}));

const { DetalleCompra, Insumo, Producto, InventarioProducto } = require('../models');
const controller = require('../controllers/detallecompraController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('DetalleCompraController - Pruebas Unitarias', () => {

    describe('getAllDetalleCompras', () => {
        test('debería retornar todos los detalles de compra exitosamente', async () => {
            DetalleCompra.findAll.mockResolvedValue([{ DetalleCompraID: 1 }]);
            const res = mockRes();
            await controller.getAllDetalleCompras({}, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar 500 si falla la base de datos', async () => {
            DetalleCompra.findAll.mockRejectedValue(new Error('DB caída'));
            const res = mockRes();
            await controller.getAllDetalleCompras({}, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getDetalleCompraById', () => {
        test('debería retornar el detalle si existe', async () => {
            DetalleCompra.findByPk.mockResolvedValue({ DetalleCompraID: 1, Cantidad: 5 });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.getDetalleCompraById(req, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar 404 si el detalle no existe', async () => {
            DetalleCompra.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.getDetalleCompraById(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Detalle de compra no encontrado' }));
        });
    });

    describe('createDetalleCompra', () => {
        test('debería retornar 400 si falta CompraID', async () => {
            const req = { body: { TipoSeleccion: 'insumo', InsumoID: 1, Cantidad: 5 } };
            const res = mockRes();
            await controller.createDetalleCompra(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'CompraID es obligatorio' }));
        });

        test('debería retornar 400 si Cantidad es 0', async () => {
            const req = { body: { CompraID: 1, TipoSeleccion: 'insumo', InsumoID: 1, Cantidad: 0 } };
            const res = mockRes();
            await controller.createDetalleCompra(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Cantidad debe ser mayor a 0' }));
        });

        test('debería retornar 400 si tipo insumo y falta InsumoID', async () => {
            const req = { body: { CompraID: 1, TipoSeleccion: 'insumo', Cantidad: 5 } };
            const res = mockRes();
            await controller.createDetalleCompra(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'InsumoID es obligatorio cuando TipoSeleccion es insumo' }));
        });

        test('debería retornar 404 si el insumo no existe', async () => {
            Insumo.findByPk.mockResolvedValue(null);
            const req = { body: { CompraID: 1, TipoSeleccion: 'insumo', InsumoID: 999, Cantidad: 5 } };
            const res = mockRes();
            await controller.createDetalleCompra(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('no encontrado') }));
        });

        test('debería crear detalle de tipo insumo correctamente', async () => {
            Insumo.findByPk.mockResolvedValue({ InsumoID: 1, Nombre: 'Hilo', Stock: 50 });
            Insumo.increment.mockResolvedValue(true);
            DetalleCompra.create.mockResolvedValue({ DetalleCompraID: 7, CompraID: 1, InsumoID: 1, Cantidad: 10, TipoSeleccion: 'insumo' });
            DetalleCompra.findByPk.mockResolvedValue({ DetalleCompraID: 7 });
            const req = { body: { CompraID: 1, TipoSeleccion: 'insumo', InsumoID: 1, Cantidad: 10, PrecioUnitario: 200 } };
            const res = mockRes();
            await controller.createDetalleCompra(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Detalle de compra creado exitosamente' }));
        });

        test('debería retornar 400 si tipo producto y faltan ColorID o TallaID', async () => {
            const req = { body: { CompraID: 1, TipoSeleccion: 'producto', ProductoID: 1, Cantidad: 3 } };
            const res = mockRes();
            await controller.createDetalleCompra(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'ColorID y TallaID son obligatorios para variante de producto' }));
        });
    });

    describe('deleteDetalleCompra', () => {
        test('debería retornar 404 si el detalle no existe', async () => {
            DetalleCompra.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.deleteDetalleCompra(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('debería eliminar el detalle y revertir stock de insumo', async () => {
            const destroyMock = jest.fn().mockResolvedValue(true);
            DetalleCompra.findByPk.mockResolvedValue({ DetalleCompraID: 1, TipoSeleccion: 'insumo', InsumoID: 1, Cantidad: 5, destroy: destroyMock });
            Insumo.decrement.mockResolvedValue(true);
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.deleteDetalleCompra(req, res);
            expect(destroyMock).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Detalle de compra eliminado exitosamente' }));
        });
    });

});