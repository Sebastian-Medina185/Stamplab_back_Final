'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class DetalleCompra extends Model {
    static associate(models) {
      // Pertenece a una compra
      DetalleCompra.belongsTo(models.Compra, {
        foreignKey: 'CompraID',
        as: 'compra'
      });

      // Pertenece a un insumo (opcional, solo cuando TipoSeleccion = 'insumo')
      DetalleCompra.belongsTo(models.Insumo, {
        foreignKey: 'InsumoID',
        as: 'insumo'
      });

      // Pertenece a un producto (opcional, solo cuando TipoSeleccion = 'producto')
      DetalleCompra.belongsTo(models.Producto, {
        foreignKey: 'ProductoID',
        as: 'producto'
      });

      // Referencia a la variante creada/incrementada
      DetalleCompra.belongsTo(models.InventarioProducto, {
        foreignKey: 'InventarioID',
        as: 'variante'
      });
    }
  }

  DetalleCompra.init({
    DetalleCompraID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    CompraID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'compras',
        key: 'CompraID'
      }
    },
    // 'insumo' o 'producto'
    TipoSeleccion: {
      type: DataTypes.ENUM('insumo', 'producto'),
      allowNull: false,
      defaultValue: 'insumo'
    },
    // Nullable: solo se usa cuando TipoSeleccion = 'insumo'
    InsumoID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'insumos',
        key: 'InsumoID'
      }
    },
    // Nullable: solo se usa cuando TipoSeleccion = 'producto'
    ProductoID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'productos',
        key: 'ProductoID'
      }
    },
    // ID de la variante (InventarioProducto) creada o incrementada
    InventarioID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'inventarioproducto',
        key: 'InventarioID'
      }
    },
    Cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    // Precio al que se compró
    PrecioUnitario: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Precio al que se compró'
    },
    // Precio de venta sugerido (aplica para ambos tipos)
    PrecioVenta: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Precio de venta sugerido'
    }
  }, {
    sequelize,
    modelName: 'DetalleCompra',
    tableName: 'detallecompra',
    timestamps: false
  });

  return DetalleCompra;
};