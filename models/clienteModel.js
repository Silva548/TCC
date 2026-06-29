const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Cliente = sequelize.define('Cliente', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    nome: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
    },
    senha: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    documento: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
    },
    telefone: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    tipo: {
        type: DataTypes.ENUM('B2C', 'B2B'),
        allowNull: false,
        defaultValue: 'B2C',
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'clientes',
    timestamps: true,
});

module.exports = Cliente;
