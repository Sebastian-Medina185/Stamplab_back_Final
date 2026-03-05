'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Hacer InsumoID nullable
    await queryInterface.changeColumn('detallecompra', 'InsumoID', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'insumos', key: 'InsumoID' }
    });

    // 2. Agregar TipoSeleccion
    await queryInterface.addColumn('detallecompra', 'TipoSeleccion', {
      type: Sequelize.ENUM('insumo', 'producto'),
      allowNull: false,
      defaultValue: 'insumo',
      after: 'CompraID'
    });

    // 3. Agregar ProductoID
    await queryInterface.addColumn('detallecompra', 'ProductoID', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'productos', key: 'ProductoID' },
      after: 'InsumoID'
    });

    // 4. Agregar InventarioID
    await queryInterface.addColumn('detallecompra', 'InventarioID', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'inventarioproducto', key: 'InventarioID' },
      after: 'ProductoID'
    });

    // 5. Agregar PrecioVenta
    await queryInterface.addColumn('detallecompra', 'PrecioVenta', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Precio de venta sugerido',
      after: 'PrecioUnitario'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('detallecompra', 'PrecioVenta');
    await queryInterface.removeColumn('detallecompra', 'InventarioID');
    await queryInterface.removeColumn('detallecompra', 'ProductoID');
    await queryInterface.removeColumn('detallecompra', 'TipoSeleccion');
    await queryInterface.changeColumn('detallecompra', 'InsumoID', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'insumos', key: 'InsumoID' }
    });
  }
};