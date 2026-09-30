const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Produto = sequelize.define('Produto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    nome: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    descricao: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    preco_entrega: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Preço cobrado quando o pedido é entregue no endereço',
    },
    preco_retirada: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Preço cobrado quando o cliente retira na empresa',
    },
    embalagem: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'basica',
        comment: 'Linha da embalagem: premium ou basica',
    },
    peso_kg: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        comment: 'Peso do produto em quilogramas',
    },
    estoque: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    categoria_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'categorias',
            key: 'id',
        },
        onDelete: 'RESTRICT',
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
    tableName: 'produtos',
    timestamps: true,
});

module.exports = Produto;
