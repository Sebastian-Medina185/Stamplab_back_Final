'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class DetalleVenta extends Model {
        static associate(models) {
            DetalleVenta.belongsTo(models.Producto, {
                foreignKey: 'ProductoID',
                as: 'producto'
            });

            DetalleVenta.belongsTo(models.Color, {
                foreignKey: 'ColorID',
                as: 'color'
            });

            DetalleVenta.belongsTo(models.Talla, {
                foreignKey: 'TallaID',
                as: 'talla'
            });

            DetalleVenta.belongsTo(models.Venta, {
                foreignKey: 'VentaID',
                as: 'venta'
            });
        }
    }

    DetalleVenta.init({
        DetalleVentaID: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        VentaID: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        ProductoID: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        ColorID: {
            type: DataTypes.INTEGER
        },
        TallaID: {
            type: DataTypes.INTEGER
        },

        Cantidad: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        PrecioUnitario: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'DetalleVenta',
        tableName: 'detalleventa',
        timestamps: false
    });

    return DetalleVenta;
};