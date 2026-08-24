const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Categoria = sequelize.define('Categoria', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    nome: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
    },
}, {
    tableName: 'categorias',
    timestamps: true,
});

module.exports = Categoria;
