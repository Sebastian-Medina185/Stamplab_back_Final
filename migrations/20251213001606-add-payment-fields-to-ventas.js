'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ventas', 'MetodoPago', {
      type: Sequelize.STRING(50),
      allowNull: true,
      validate: {
        isIn: [['transferencia', 'contraentrega']]
      }
    });

    await queryInterface.addColumn('ventas', 'ComprobanteTransferencia', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('ventas', 'FechaTransferencia', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('ventas', 'NombreReceptor', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.addColumn('ventas', 'TelefonoEntrega', {
      type: Sequelize.STRING(20),
      allowNull: true
    });

    await queryInterface.addColumn('ventas', 'DireccionEntrega', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ventas', 'MetodoPago');
    await queryInterface.removeColumn('ventas', 'ComprobanteTransferencia');
    await queryInterface.removeColumn('ventas', 'FechaTransferencia');
    await queryInterface.removeColumn('ventas', 'NombreReceptor');
    await queryInterface.removeColumn('ventas', 'TelefonoEntrega');
    await queryInterface.removeColumn('ventas', 'DireccionEntrega');
  }
};