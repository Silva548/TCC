const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Pedido = require('./pedidoModel');
const Produto = require('./produtoSequelizeModel');

const ItemPedido = sequelize.define('ItemPedido', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    pedido_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Pedido,
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    produto_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Produto,
            key: 'id',
        },
        onDelete: 'RESTRICT',
    },
    quantidade: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
        },
    },
    preco_unitario: {
        type: DataTypes.DECIMAL(10, 2),
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
    tableName: 'itens_pedidos',
    timestamps: true,
});

// Associações são definidas centralizadamente em models/index.js

module.exports = ItemPedido;
