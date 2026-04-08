jest.mock('../models', () => ({
    Proveedor: {
        findAll: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
    },
    Compra: { count: jest.fn() },
}));

const { Proveedor, Compra } = require('../models');
const controller = require('../controllers/proveedorController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('ProveedorController - Pruebas Unitarias', () => {

    describe('getAllProveedores', () => {
        test('debería retornar la lista de proveedores exitosamente', async () => {
            Proveedor.findAll.mockResolvedValue([{ Nit: '123', Nombre: 'Proveedor A' }]);
            const req = {};
            const res = mockRes();
            await controller.getAllProveedores(req, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar 500 si falla la base de datos', async () => {
            Proveedor.findAll.mockRejectedValue(new Error('DB caída'));
            const req = {};
            const res = mockRes();
            await controller.getAllProveedores(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getProveedorByNit', () => {
        test('debería retornar el proveedor si existe el NIT', async () => {
            Proveedor.findOne.mockResolvedValue({ Nit: '900123', Nombre: 'Textiles SA' });
            const req = { params: { nit: '900123' } };
            const res = mockRes();
            await controller.getProveedorByNit(req, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar 404 si el proveedor no existe', async () => {
            Proveedor.findOne.mockResolvedValue(null);
            const req = { params: { nit: '000000' } };
            const res = mockRes();
            await controller.getProveedorByNit(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Proveedor no encontrado' }));
        });
    });

    describe('createProveedor', () => {
        test('debería retornar 400 si faltan Nit o Nombre', async () => {
            const req = { body: { Correo: 'sin@nit.com' } };
            const res = mockRes();
            await controller.createProveedor(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Nit y Nombre son requeridos' }));
        });

        test('debería retornar 409 si el NIT ya está registrado', async () => {
            Proveedor.findOne.mockResolvedValue({ Nit: '900123' });
            const req = { body: { Nit: '900123', Nombre: 'Duplicado SA' } };
            const res = mockRes();
            await controller.createProveedor(req, res);
            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Nit ya registrado' }));
        });

        test('debería crear el proveedor correctamente', async () => {
            Proveedor.findOne.mockResolvedValue(null);
            Proveedor.create.mockResolvedValue({ Nit: '800456', Nombre: 'Nuevo Proveedor' });
            const req = { body: { Nit: '800456', Nombre: 'Nuevo Proveedor', Correo: 'prov@mail.com' } };
            const res = mockRes();
            await controller.createProveedor(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Proveedor creado exitosamente' }));
        });
    });

    describe('deleteProveedor', () => {
        test('debería retornar 404 si el proveedor no existe', async () => {
            Proveedor.findOne.mockResolvedValue(null);
            const req = { params: { nit: '000000' } };
            const res = mockRes();
            await controller.deleteProveedor(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('debería desactivar el proveedor si tiene compras asociadas', async () => {
            const saveMock = jest.fn().mockResolvedValue(true);
            Proveedor.findOne.mockResolvedValue({ Nit: '900123', id: null, Estado: true, save: saveMock });
            Compra.count.mockResolvedValue(2);
            const req = { params: { nit: '900123' } };
            const res = mockRes();
            await controller.deleteProveedor(req, res);
            expect(saveMock).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accion: 'desactivado' }));
        });

        test('debería eliminar el proveedor si no tiene compras', async () => {
            const destroyMock = jest.fn().mockResolvedValue(true);
            Proveedor.findOne.mockResolvedValue({ Nit: '800456', id: null, destroy: destroyMock });
            Compra.count.mockResolvedValue(0);
            const req = { params: { nit: '800456' } };
            const res = mockRes();
            await controller.deleteProveedor(req, res);
            expect(destroyMock).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accion: 'eliminado' }));
        });
    });

});