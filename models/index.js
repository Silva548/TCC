// models/index.js - Carrega todos os modelos e define as associações.
// O schema é gerenciado por migrations (npm run migrate), NÃO por sync().

const sequelize = require('../config/db');
const Cliente = require('./clienteModel');
const Produto = require('./produtoSequelizeModel');
const Pedido = require('./pedidoModel');
const ItemPedido = require('./itemPedidoModel');
const User = require('./userModel');
const Categoria = require('./categoriaModel');

// Define associações
Cliente.hasMany(Pedido, { foreignKey: 'cliente_id', onDelete: 'CASCADE' });
Pedido.belongsTo(Cliente, { foreignKey: 'cliente_id' });

Pedido.hasMany(ItemPedido, { foreignKey: 'pedido_id', onDelete: 'CASCADE' });
ItemPedido.belongsTo(Pedido, { foreignKey: 'pedido_id' });

Produto.hasMany(ItemPedido, { foreignKey: 'produto_id' });
ItemPedido.belongsTo(Produto, { foreignKey: 'produto_id' });

module.exports = {
    sequelize,
    Cliente,
    Produto,
    Pedido,
    ItemPedido,
    User,
    Categoria,
};
