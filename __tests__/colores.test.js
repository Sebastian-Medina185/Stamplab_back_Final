jest.mock('../models', () => ({
    Color: {
        findAll: jest.fn(),
        findByPk: jest.fn(),
        create: jest.fn(),
    },
    InventarioProducto: { count: jest.fn() },
    CotizacionColor: { count: jest.fn() },
    DetalleVenta: { count: jest.fn() },
}));

const db = require('../models');
const controller = require('../controllers/colorController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('ColorController - Pruebas Unitarias', () => {

    describe('getAllColores', () => {
        test('debería retornar la lista de colores exitosamente', async () => {
            db.Color.findAll.mockResolvedValue([{ ColorID: 1, Nombre: 'Rojo' }]);
            const res = mockRes();
            await controller.getAllColores({}, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true }));
        });

        test('debería retornar 500 si falla la base de datos', async () => {
            db.Color.findAll.mockRejectedValue(new Error('DB caída'));
            const res = mockRes();
            await controller.getAllColores({}, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getColorById', () => {
        test('debería retornar el color si existe', async () => {
            db.Color.findByPk.mockResolvedValue({ ColorID: 1, Nombre: 'Azul' });
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.getColorById(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true }));
        });

        test('debería retornar 404 si el color no existe', async () => {
            db.Color.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.getColorById(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'Color no encontrado' }));
        });
    });

    describe('createColor', () => {
        test('debería retornar 400 si falta el nombre', async () => {
            const req = { body: {} };
            const res = mockRes();
            await controller.createColor(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'El nombre es obligatorio' }));
        });

        test('debería crear el color correctamente', async () => {
            db.Color.create.mockResolvedValue({ ColorID: 5, Nombre: 'Verde' });
            const req = { body: { Nombre: 'Verde' } };
            const res = mockRes();
            await controller.createColor(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true }));
        });
    });

    describe('deleteColor', () => {
        test('debería retornar 404 si el color no existe', async () => {
            db.Color.findByPk.mockResolvedValue(null);
            const req = { params: { id: '999' } };
            const res = mockRes();
            await controller.deleteColor(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('debería retornar 400 si el color está en inventario de productos', async () => {
            db.Color.findByPk.mockResolvedValue({ ColorID: 1, Nombre: 'Rojo' });
            db.InventarioProducto.count.mockResolvedValue(3);
            const req = { params: { id: '1' } };
            const res = mockRes();
            await controller.deleteColor(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: false }));
        });

        test('debería retornar 400 si el color está en cotizaciones', async () => {
            db.Color.findByPk.mockResolvedValue({ ColorID: 2, Nombre: 'Azul' });
            db.InventarioProducto.count.mockResolvedValue(0);
            db.CotizacionColor.count.mockResolvedValue(2);
            const req = { params: { id: '2' } };
            const res = mockRes();
            await controller.deleteColor(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test('debería eliminar el color si no tiene asociaciones', async () => {
            const destroyMock = jest.fn().mockResolvedValue(true);
            db.Color.findByPk.mockResolvedValue({ ColorID: 3, Nombre: 'Verde', destroy: destroyMock });
            db.InventarioProducto.count.mockResolvedValue(0);
            db.CotizacionColor.count.mockResolvedValue(0);
            db.DetalleVenta.count.mockResolvedValue(0);
            const req = { params: { id: '3' } };
            const res = mockRes();
            await controller.deleteColor(req, res);
            expect(destroyMock).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: true }));
        });
    });

});