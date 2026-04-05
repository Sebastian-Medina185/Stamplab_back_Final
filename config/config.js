require('dotenv').config();

module.exports = {
  development: {
    username: "root",
    password: "medina",
    database: "STAMPLAB_NEW",
    host: "localhost",
    dialect: "mysql",
    port: 3306,
    define: {
      timestamps: false,
      freezeTableName: true,
      underscored: false
    }
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT),
    dialect: "mysql",
    logging: false,
    define: {
      timestamps: false,
      freezeTableName: true,
      underscored: false
    }
  }
};