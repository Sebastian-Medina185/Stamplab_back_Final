// ============================================================
// PRUEBAS UNITARIAS - usuariosController.js
// Proyecto: STAMPLAB
// ============================================================

// --- Mocks de dependencias externas ---
jest.mock('../models', () => ({
    Usuario: {
        findAndCountAll: jest.fn(),
        findByPk: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
    },
    Rol: {},
}));

jest.mock('bcryptjs', () => ({
    hash: jest.fn().mockResolvedValue('hashedPassword123'),
    compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
    sign: jest.fn().mockReturnValue('token_falso_123'),
}));

const { Usuario } = require('../models');
const bcrypt = require('bcryptjs');
const controller = require('../controllers/usuarioController');

// --- Helpers para simular req y res ---
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

// ============================================================
// BLOQUE 1: getAllUsuarios
// ============================================================
describe('getAllUsuarios', () => {

    test('retorna lista paginada de usuarios correctamente', async () => {
        const usuarioFalso = {
            toJSON: () => ({ DocumentoID: '123', Nombre: 'Ana', rol: { Nombre: 'Admin' } })
        };
        Usuario.findAndCountAll.mockResolvedValue({ count: 1, rows: [usuarioFalso] });

        const req = { query: { page: '1', limit: '10', search: '' } };
        const res = mockRes();

        await controller.getAllUsuarios(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            total: 1,
            pagina: 1,
        }));
    });

    test('retorna error 500 si falla la base de datos', async () => {
        Usuario.findAndCountAll.mockRejectedValue(new Error('DB caída'));

        const req = { query: {} };
        const res = mockRes();

        await controller.getAllUsuarios(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: false }));
    });

});

// ============================================================
// BLOQUE 2: getUsuarioById
// ============================================================
describe('getUsuarioById', () => {

    test('retorna el usuario si existe', async () => {
        const usuarioFalso = {
            toJSON: () => ({ DocumentoID: '1', Nombre: 'Carlos', rol: { Nombre: 'Cliente' } })
        };
        Usuario.findByPk.mockResolvedValue(usuarioFalso);

        const req = { params: { id: '1' } };
        const res = mockRes();

        await controller.getUsuarioById(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ Nombre: 'Carlos' }));
    });

    test('retorna 404 si el usuario no existe', async () => {
        Usuario.findByPk.mockResolvedValue(null);

        const req = { params: { id: '9999' } };
        const res = mockRes();

        await controller.getUsuarioById(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            mensaje: 'Usuario no encontrado'
        }));
    });

});

// ============================================================
// BLOQUE 3: createUsuario
// ============================================================
describe('createUsuario', () => {

    test('retorna 400 si faltan campos obligatorios', async () => {
        const req = { body: { Nombre: 'Sin correo' } }; // faltan campos
        const res = mockRes();

        await controller.createUsuario(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: false }));
    });

    test('retorna 400 si el correo ya está registrado', async () => {
        Usuario.findOne.mockResolvedValue({ Correo: 'ya@existe.com' }); // simula correo duplicado

        const req = {
            body: {
                DocumentoID: '111', Nombre: 'Luis', Correo: 'ya@existe.com',
                Contraseña: '1234', RolID: 2
            }
        };
        const res = mockRes();

        await controller.createUsuario(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            mensaje: expect.stringContaining('correo')
        }));
    });

    test('crea usuario correctamente con datos válidos', async () => {
        Usuario.findOne.mockResolvedValue(null);   // no existe correo duplicado
        Usuario.findByPk.mockResolvedValue(null);  // no existe documento duplicado

        const nuevoUsuario = {
            DocumentoID: '222', Nombre: 'María', Correo: 'maria@mail.com', RolID: 2,
            toJSON: () => ({ DocumentoID: '222', Nombre: 'María', Correo: 'maria@mail.com' })
        };
        Usuario.create.mockResolvedValue(nuevoUsuario);

        const req = {
            body: {
                DocumentoID: '222', Nombre: 'María', Correo: 'maria@mail.com',
                Contraseña: 'segura123', RolID: 2
            }
        };
        const res = mockRes();

        await controller.createUsuario(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            estado: true,
            mensaje: 'Usuario creado correctamente'
        }));
    });

});

// ============================================================
// BLOQUE 4: deleteUsuario
// ============================================================
describe('deleteUsuario', () => {

    test('retorna 404 si el usuario a eliminar no existe', async () => {
        Usuario.findByPk.mockResolvedValue(null);

        const req = { params: { id: '8888' } };
        const res = mockRes();

        await controller.deleteUsuario(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('no permite eliminar al administrador (RolID=1)', async () => {
        Usuario.findByPk.mockResolvedValue({ RolID: 1, destroy: jest.fn() });

        const req = { params: { id: '1' } };
        const res = mockRes();

        await controller.deleteUsuario(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            mensaje: 'No se puede eliminar al usuario Administrador'
        }));
    });

    test('elimina usuario correctamente si no es admin', async () => {
        const destroyMock = jest.fn().mockResolvedValue(true);
        Usuario.findByPk.mockResolvedValue({ RolID: 2, destroy: destroyMock });

        const req = { params: { id: '3' } };
        const res = mockRes();

        await controller.deleteUsuario(req, res);

        expect(destroyMock).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            estado: true,
            mensaje: 'Usuario eliminado exitosamente'
        }));
    });

});

// ============================================================
// BLOQUE 5: login
// ============================================================
describe('login', () => {

    test('retorna 400 si no se envían correo o contraseña', async () => {
        const req = { body: {} };
        const res = mockRes();

        await controller.login(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('retorna 404 si el usuario no existe', async () => {
        Usuario.findOne.mockResolvedValue(null);

        const req = { body: { Correo: 'noexiste@mail.com', Contraseña: '1234' } };
        const res = mockRes();

        await controller.login(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('retorna 401 si la contraseña es incorrecta', async () => {
        Usuario.findOne.mockResolvedValue({ Contraseña: 'hashReal', RolID: 2 });
        bcrypt.compare.mockResolvedValue(false); // contraseña incorrecta

        const req = { body: { Correo: 'user@mail.com', Contraseña: 'mala' } };
        const res = mockRes();

        await controller.login(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            mensaje: 'Contraseña incorrecta'
        }));
    });

    test('login exitoso retorna token y datos del usuario', async () => {
        Usuario.findOne.mockResolvedValue({
            DocumentoID: '1', Nombre: 'Admin', Correo: 'admin@mail.com',
            RolID: 1, Contraseña: 'hashReal'
        });
        bcrypt.compare.mockResolvedValue(true); // contraseña correcta

        const req = { body: { Correo: 'admin@mail.com', Contraseña: 'correcta' } };
        const res = mockRes();

        await controller.login(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            estado: true,
            token: 'token_falso_123',
            nombre: 'Admin'
        }));
    });

});