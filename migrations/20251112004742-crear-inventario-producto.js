'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Crear tabla InventarioProducto
    await queryInterface.createTable('InventarioProducto', {
      InventarioID: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      ProductoID: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Productos',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      ColorID: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Colores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      TallaID: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Tallas',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      Stock: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      Estado: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Migrar datos de ProductoTalla si existen
    // SOLO SI YA TIENES DATOS
    const hasData = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM ProductoTalla',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (hasData[0].count > 0) {
      // Migrar combinando ProductoTalla con un color por defecto
      await queryInterface.sequelize.query(`
        INSERT INTO InventarioProducto (ProductoID, ColorID, TallaID, Stock, Estado, createdAt, updatedAt)
        SELECT 
          pt.ProductoID,
          (SELECT ColorID FROM Colores LIMIT 1) as ColorID,
          pt.TallaID,
          pt.StockDisponible,
          pt.Estado,
          NOW(),
          NOW()
        FROM ProductoTalla pt
      `);
    }

    // Eliminar tablas viejas (CUIDADO: solo después de migrar datos)
    // await queryInterface.dropTable('ProductoColor');
    // await queryInterface.dropTable('ProductoTalla');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('InventarioProducto');
  }
};