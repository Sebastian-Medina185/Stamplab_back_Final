jest.mock('../models', () => ({
    Insumo: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
    Producto: {},
    DetalleCompra: { count: jest.fn() },
}));

const { Insumo, DetalleCompra } = require('../models');
const controller = require('../controllers/insumoController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('InsumoController - Pruebas Unitarias', () => {

    describe('getAllInsumos', () => {
        test('debería retornar la lista de insumos exitosamente', async () => {
            Insumo.findAll.mockResolvedValue([{ InsumoID: 1, Nombre: 'Hilo', Tipo: 'Accesorio' }]);
            const res = mockRes();
            await controller.getAllInsumos({}, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar 500 si falla la base de datos', async () => {
            Insumo.findAll.mockRejectedValue(new Error('DB caída'));
            const res = mockRes();
            await controller.getAllInsumos({}, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getInsumoById', () => {
        test('debería retornar el insumo si existe', async () => {
            Insumo.findByPk.mockResolvedValue({ InsumoID: 1, Nombre: 'Hilo' });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.getInsumoById(req, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar 404 si el insumo no existe', async () => {
            Insumo.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.getInsumoById(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Insumo no encontrado' }));
        });
    });

    describe('createInsumo', () => {
        test('debería retornar 400 si falta el nombre', async () => {
            const req = { body: { Tipo: 'Accesorio' } };
            const res = mockRes();
            await controller.createInsumo(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'El Nombre es obligatorio.' }));
        });

        test('debería retornar 400 si falta el tipo', async () => {
            const req = { body: { Nombre: 'Botones' } };
            const res = mockRes();
            await controller.createInsumo(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'El Tipo de insumo es obligatorio.' }));
        });

        test('debería retornar 400 si tipo es Tela y falta PrecioTela', async () => {
            const req = { body: { Nombre: 'Tela algodón', Tipo: 'Tela' } };
            const res = mockRes();
            await controller.createInsumo(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'PrecioTela es obligatorio...' }));
        });

        test('debería retornar 400 si PrecioTela no es un número válido', async () => {
            const req = { body: { Nombre: 'Tela algodón', Tipo: 'Tela', PrecioTela: 'abc' } };
            const res = mockRes();
            await controller.createInsumo(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'PrecioTela debe ser numero >= 0.' }));
        });

        test('debería crear insumo de tipo Tela correctamente', async () => {
            Insumo.create.mockResolvedValue({ InsumoID: 3, Nombre: 'Tela seda', Tipo: 'Tela', PrecioTela: 12000 });
            const req = { body: { Nombre: 'Tela seda', Tipo: 'Tela', PrecioTela: 12000 } };
            const res = mockRes();
            await controller.createInsumo(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Insumo creado exitosamente' }));
        });

        test('debería crear insumo sin PrecioTela correctamente', async () => {
            Insumo.create.mockResolvedValue({ InsumoID: 4, Nombre: 'Hilo', Tipo: 'Accesorio' });
            const req = { body: { Nombre: 'Hilo', Tipo: 'Accesorio' } };
            const res = mockRes();
            await controller.createInsumo(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe('deleteInsumo', () => {
        test('debería retornar 404 si el insumo no existe', async () => {
            Insumo.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.deleteInsumo(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('debería retornar 400 si tiene compras asociadas', async () => {
            Insumo.findByPk.mockResolvedValue({ InsumoID: 1, Nombre: 'Hilo' });
            DetalleCompra.count.mockResolvedValue(3);
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.deleteInsumo(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ comprasAsociadas: 3 }));
        });

        test('debería eliminar el insumo si no tiene compras asociadas', async () => {
            const destroyMock = jest.fn().mockResolvedValue(true);
            Insumo.findByPk.mockResolvedValue({ InsumoID: 2, Nombre: 'Botones', destroy: destroyMock });
            DetalleCompra.count.mockResolvedValue(0);
            const req = { params: { id: '2' } };
            const res = mockRes();
            await controller.deleteInsumo(req, res);
            expect(destroyMock).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Insumo eliminado exitosamente' }));
        });
    });

});