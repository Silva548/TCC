const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Cliente = require('./clienteModel');

const Pedido = sequelize.define('Pedido', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    cliente_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Cliente,
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    data: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    status: {
        type: DataTypes.ENUM('pendente', 'processando', 'enviado', 'entregue', 'cancelado'),
        allowNull: false,
        defaultValue: 'pendente',
    },
    valor_total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
    },
    forma_pagamento: {
        type: DataTypes.ENUM('credito', 'debito', 'pix', 'boleto', 'dinheiro'),
        allowNull: false,
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
    tableName: 'pedidos',
    timestamps: true,
});

// Associações são definidas centralizadamente em models/index.js

module.exports = Pedido;
