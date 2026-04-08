jest.mock('../models', () => ({
    Rol: {
        findAll: jest.fn(),
        findByPk: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
    },
    Usuario: { count: jest.fn() },
    Permiso: { findAll: jest.fn() },
}));

const { Rol, Usuario } = require('../models');
const controller = require('../controllers/rolController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('RolController - Pruebas Unitarias', () => {

    describe('getAllRoles', () => {
        test('debería retornar la lista de roles exitosamente', async () => {
            Rol.findAll.mockResolvedValue([{ RolID: 1, Nombre: 'Administrador' }]);
            const req = {};
            const res = mockRes();
            await controller.getAllRoles(req, res);
            expect(res.json).toHaveBeenCalled();
        });

        test('debería retornar error 500 si falla la base de datos', async () => {
            Rol.findAll.mockRejectedValue(new Error('DB caída'));
            const req = {};
            const res = mockRes();
            await controller.getAllRoles(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: false }));
        });
    });

    describe('getRolById', () => {
        test('debería retornar un rol si el ID es válido', async () => {
            Rol.findByPk.mockResolvedValue({ RolID: 1, Nombre: 'Administrador' });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.getRolById(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true }));
        });

        test('debería retornar 404 si el rol no existe', async () => {
            Rol.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.getRolById(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'Rol no encontrado' }));
        });
    });

    describe('createRol', () => {
        test('debería retornar 400 si el nombre es muy corto', async () => {
            const req = { body: { Nombre: 'AB', Descripcion: 'Descripcion válida larga' } };
            const res = mockRes();
            await controller.createRol(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test('debería retornar 400 si la descripcion es muy corta', async () => {
            const req = { body: { Nombre: 'Vendedor', Descripcion: 'Corta' } };
            const res = mockRes();
            await controller.createRol(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test('debería retornar 400 si el nombre es un rol protegido', async () => {
            Rol.findOne.mockResolvedValue(null);
            const req = { body: { Nombre: 'Administrador', Descripcion: 'Descripcion suficientemente larga' } };
            const res = mockRes();
            await controller.createRol(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: false }));
        });

        test('debería crear un rol correctamente', async () => {
            Rol.findOne.mockResolvedValue(null);
            Rol.create.mockResolvedValue({ RolID: 5, Nombre: 'Vendedor', Descripcion: 'Gestiona las ventas del sistema' });
            const req = { body: { Nombre: 'Vendedor', Descripcion: 'Gestiona las ventas del sistema' } };
            const res = mockRes();
            await controller.createRol(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true, mensaje: 'Rol creado exitosamente' }));
        });
    });

    describe('deleteRol', () => {
        test('debería retornar 404 si el rol no existe', async () => {
            Rol.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.deleteRol(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('debería retornar 403 si se intenta eliminar un rol protegido', async () => {
            Rol.findByPk.mockResolvedValue({ RolID: 1, Nombre: 'Administrador', destroy: jest.fn() });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.deleteRol(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        });

        test('debería retornar 400 si hay usuarios asignados al rol', async () => {
            Rol.findByPk.mockResolvedValue({ RolID: 5, Nombre: 'Vendedor', destroy: jest.fn() });
            Usuario.count.mockResolvedValue(3);
            const req = { params: { id: '5' } };
            const res = mockRes();
            await controller.deleteRol(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test('debería eliminar el rol si no tiene usuarios asignados', async () => {
            const destroyMock = jest.fn().mockResolvedValue(true);
            Rol.findByPk.mockResolvedValue({ RolID: 5, Nombre: 'Vendedor', destroy: destroyMock });
            Usuario.count.mockResolvedValue(0);
            const req = { params: { id: '5' } };
            const res = mockRes();
            await controller.deleteRol(req, res);
            expect(destroyMock).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true }));
        });
    });

});