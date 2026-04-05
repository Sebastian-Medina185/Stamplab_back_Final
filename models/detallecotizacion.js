'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class DetalleCotizacion extends Model {
        static associate(models) {
            // Ya no pertenece a Usuario, sino a Cotizacion
            DetalleCotizacion.belongsTo(models.Cotizacion, {
                foreignKey: 'CotizacionID',
                as: 'cotizacion'
            });

            // Pertenece a Producto
            DetalleCotizacion.belongsTo(models.Producto, {
                foreignKey: 'ProductoID',
                as: 'producto'
            });

            // Mantener:
            DetalleCotizacion.hasMany(models.CotizacionTecnica, {
                foreignKey: 'DetalleCotizacionID',
                as: 'tecnicas'
            });

            DetalleCotizacion.hasMany(models.CotizacionTalla, {
                foreignKey: 'DetalleCotizacionID',
                as: 'tallas'
            });

            DetalleCotizacion.hasMany(models.CotizacionColor, {
                foreignKey: 'DetalleCotizacionID',
                as: 'colores'
            });

            DetalleCotizacion.hasMany(models.CotizacionInsumo, {
                foreignKey: 'DetalleCotizacionID',
                as: 'insumos'
            });
        }
    }

    DetalleCotizacion.init({
        DetalleCotizacionID: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        CotizacionID: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'Cotizaciones', key: 'CotizacionID' }
        },
        ProductoID: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'Productos', key: 'ProductoID' }
        },
        Cantidad: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        TraePrenda: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        PrendaDescripcion: DataTypes.TEXT,
        PrecioUnitario: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: true,
            defaultValue: null
        }
    }, {
        sequelize,
        modelName: 'DetalleCotizacion',
        tableName: 'detallecotizacion',
        timestamps: false
    });

    return DetalleCotizacion;
};