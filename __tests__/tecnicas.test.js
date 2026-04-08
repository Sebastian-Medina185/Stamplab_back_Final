jest.mock('../models', () => ({
    Tecnica: {
        findAll: jest.fn(),
        findByPk: jest.fn(),
        create: jest.fn(),
    },
}));

const { Tecnica } = require('../models');
const controller = require('../controllers/tecnicaController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('TecnicaController - Pruebas Unitarias', () => {

    describe('getAllTecnicas', () => {
        test('debería retornar la lista de técnicas exitosamente', async () => {
            Tecnica.findAll.mockResolvedValue([{ TecnicaID: 1, Nombre: 'Serigrafía' }]);
            const req = {};
            const res = mockRes();
            await controller.getAllTecnicas(req, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar 500 si falla la base de datos', async () => {
            Tecnica.findAll.mockRejectedValue(new Error('DB caída'));
            const req = {};
            const res = mockRes();
            await controller.getAllTecnicas(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: false }));
        });
    });

    describe('getTecnicaById', () => {
        test('debería retornar la técnica si existe', async () => {
            Tecnica.findByPk.mockResolvedValue({ TecnicaID: 1, Nombre: 'Bordado' });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.getTecnicaById(req, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar 404 si la técnica no existe', async () => {
            Tecnica.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.getTecnicaById(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: false }));
        });
    });

    describe('createTecnica', () => {
        test('debería retornar 400 si falta el nombre', async () => {
            const req = { body: { imagenTecnica: 'img.jpg' } };
            const res = mockRes();
            await controller.createTecnica(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'El nombre es obligatorio' }));
        });

        test('debería retornar 400 si falta la imagen', async () => {
            const req = { body: { Nombre: 'Sublimación' } };
            const res = mockRes();
            await controller.createTecnica(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'La imagen es obligatoria' }));
        });

        test('debería crear una técnica correctamente', async () => {
            Tecnica.create.mockResolvedValue({ TecnicaID: 3, Nombre: 'Sublimación', imagenTecnica: 'sub.jpg' });
            const req = { body: { Nombre: 'Sublimación', imagenTecnica: 'sub.jpg', Descripcion: 'Técnica de impresión' } };
            const res = mockRes();
            await controller.createTecnica(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true }));
        });
    });

    describe('deleteTecnica', () => {
        test('debería retornar 404 si la técnica no existe', async () => {
            Tecnica.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.deleteTecnica(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('debería eliminar la técnica correctamente', async () => {
            const destroyMock = jest.fn().mockResolvedValue(true);
            Tecnica.findByPk.mockResolvedValue({ TecnicaID: 1, Nombre: 'Bordado', destroy: destroyMock });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.deleteTecnica(req, res);
            expect(destroyMock).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true }));
        });
    });

});