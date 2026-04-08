jest.mock('../models', () => ({
    Producto: { findAndCountAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
    InventarioProducto: { destroy: jest.fn() },
    Color: {},
    Talla: {},
    Insumo: {},
}));

const { Producto, InventarioProducto } = require('../models');
const controller = require('../controllers/productoController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('ProductoController - Pruebas Unitarias', () => {

    describe('getAllProductos', () => {
        test('debería retornar lista paginada de productos', async () => {
            Producto.findAndCountAll.mockResolvedValue({ count: 2, rows: [{ ProductoID: 1 }, { ProductoID: 2 }] });
            const req = { query: {} };
            const res = mockRes();
            await controller.getAllProductos(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true, total: 2 }));
        });

        test('debería retornar 500 si falla la base de datos', async () => {
            Producto.findAndCountAll.mockRejectedValue(new Error('DB caída'));
            const req = { query: {} };
            const res = mockRes();
            await controller.getAllProductos(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getProductoById', () => {
        test('debería retornar el producto si existe', async () => {
            Producto.findByPk.mockResolvedValue({ ProductoID: 1, Nombre: 'Camiseta' });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.getProductoById(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true }));
        });

        test('debería retornar 404 si el producto no existe', async () => {
            Producto.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.getProductoById(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'Producto no encontrado' }));
        });
    });

    describe('createProducto', () => {
        test('debería retornar 400 si falta el nombre', async () => {
            const req = { body: { PrecioBase: 10000 } };
            const res = mockRes();
            await controller.createProducto(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'El nombre del producto es obligatorio' }));
        });

        test('debería retornar 400 si falta el precio base', async () => {
            const req = { body: { Nombre: 'Camiseta' } };
            const res = mockRes();
            await controller.createProducto(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'El precio base del producto es obligatorio' }));
        });

        test('debería retornar 400 si el precio es negativo', async () => {
            const req = { body: { Nombre: 'Camiseta', PrecioBase: -500 } };
            const res = mockRes();
            await controller.createProducto(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'El precio base debe ser un número mayor o igual a 0' }));
        });

        test('debería crear el producto correctamente', async () => {
            Producto.create.mockResolvedValue({ ProductoID: 3, Nombre: 'Sudadera', PrecioBase: 45000 });
            const req = { body: { Nombre: 'Sudadera', PrecioBase: 45000 } };
            const res = mockRes();
            await controller.createProducto(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true, mensaje: 'Producto creado exitosamente' }));
        });
    });

    describe('deleteProducto', () => {
        test('debería retornar 404 si el producto no existe', async () => {
            Producto.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.deleteProducto(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('debería eliminar el producto y sus variantes correctamente', async () => {
            const destroyMock = jest.fn().mockResolvedValue(true);
            Producto.findByPk.mockResolvedValue({ ProductoID: 1, Nombre: 'Camiseta', destroy: destroyMock });
            InventarioProducto.destroy.mockResolvedValue(true);
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.deleteProducto(req, res);
            expect(destroyMock).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true, mensaje: 'Producto eliminado exitosamente' }));
        });
    });

});