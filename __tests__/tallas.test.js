jest.mock('../models', () => ({
    Talla: {
        findAll: jest.fn(),
        findByPk: jest.fn(),
        create: jest.fn(),
    },
    Producto: {},
}));

const { Talla } = require('../models');
const controller = require('../controllers/tallaController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('TallaController - Pruebas Unitarias', () => {

    describe('getAllTallas', () => {
        test('debería retornar la lista de tallas exitosamente', async () => {
            Talla.findAll.mockResolvedValue([{ TallaID: 1, Nombre: 'S' }]);
            const res = mockRes();
            await controller.getAllTallas({}, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true }));
        });

        test('debería retornar 500 si falla la base de datos', async () => {
            Talla.findAll.mockRejectedValue(new Error('DB caída'));
            const res = mockRes();
            await controller.getAllTallas({}, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getTallaById', () => {
        test('debería retornar la talla si existe', async () => {
            Talla.findByPk.mockResolvedValue({ TallaID: 1, Nombre: 'M' });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.getTallaById(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true }));
        });

        test('debería retornar 404 si la talla no existe', async () => {
            Talla.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.getTallaById(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'Talla no encontrada' }));
        });
    });

    describe('createTalla', () => {
        test('debería retornar 400 si falta el nombre', async () => {
            const req = { body: {} };
            const res = mockRes();
            await controller.createTalla(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'El nombre es obligatorio' }));
        });

        test('debería retornar 400 si XXL no tiene precio', async () => {
            const req = { body: { Nombre: 'XXL' } };
            const res = mockRes();
            await controller.createTalla(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'El precio es obligatorio para tallas grandes' }));
        });

        test('debería retornar 400 si el precio de XXL no es número', async () => {
            const req = { body: { Nombre: 'XXL', Precio: 'abc' } };
            const res = mockRes();
            await controller.createTalla(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'El precio debe ser un número' }));
        });

        test('debería crear talla normal sin precio correctamente', async () => {
            Talla.create.mockResolvedValue({ TallaID: 3, Nombre: 'L', Precio: null });
            const req = { body: { Nombre: 'L' } };
            const res = mockRes();
            await controller.createTalla(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true, mensaje: 'Talla creada' }));
        });

        test('debería crear talla XXL con precio correctamente', async () => {
            Talla.create.mockResolvedValue({ TallaID: 4, Nombre: 'XXL', Precio: 5000 });
            const req = { body: { Nombre: 'XXL', Precio: 5000 } };
            const res = mockRes();
            await controller.createTalla(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true }));
        });
    });

    describe('deleteTalla', () => {
        test('debería retornar 404 si la talla no existe', async () => {
            Talla.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.deleteTalla(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('debería eliminar la talla correctamente', async () => {
            const destroyMock = jest.fn().mockResolvedValue(true);
            Talla.findByPk.mockResolvedValue({ TallaID: 1, Nombre: 'S', destroy: destroyMock });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.deleteTalla(req, res);
            expect(destroyMock).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true, mensaje: 'Talla eliminada' }));
        });
    });

});