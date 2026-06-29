// models/index.js - Sincroniza todos os modelos e associações

const sequelize = require('../config/db');
const Cliente = require('./clienteModel');
const Produto = require('./produtoSequelizeModel');
const Pedido = require('./pedidoModel');
const ItemPedido = require('./itemPedidoModel');

// Define associações
Cliente.hasMany(Pedido, { foreignKey: 'cliente_id', onDelete: 'CASCADE' });
Pedido.belongsTo(Cliente, { foreignKey: 'cliente_id' });

Pedido.hasMany(ItemPedido, { foreignKey: 'pedido_id', onDelete: 'CASCADE' });
ItemPedido.belongsTo(Pedido, { foreignKey: 'pedido_id' });

Produto.hasMany(ItemPedido, { foreignKey: 'produto_id' });
ItemPedido.belongsTo(Produto, { foreignKey: 'produto_id' });

// Função para sincronizar o banco de dados
const syncDatabase = async (force = false) => {
    try {
        await sequelize.sync({ force });
        console.log('Database synced successfully');
    } catch (err) {
        console.error('Error syncing database:', err);
    }
};

module.exports = {
    sequelize,
    Cliente,
    Produto,
    Pedido,
    ItemPedido,
    syncDatabase,
};
