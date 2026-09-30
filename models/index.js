// models/index.js - Carrega todos os modelos e define as associações.
// O schema é gerenciado por migrations (npm run migrate), NÃO por sync().
//
// IMPORTANTE: este é o ÚNICO ponto de entrada dos modelos.
// Controllers e rotas devem fazer require('../models') e nunca
// require('../models/xyzModel') isoladamente — as associações abaixo só
// existem depois que este arquivo é carregado, e sequelize.include()
// falha em runtime se a associação não estiver registrada.

const sequelize = require('../config/db');
const Cliente = require('./clienteModel');
const Produto = require('./produtoSequelizeModel');
const Pedido = require('./pedidoModel');
const ItemPedido = require('./itemPedidoModel');
const User = require('./userModel');
const Categoria = require('./categoriaModel');

// Define associações
// RESTRICT, e não CASCADE: apagar um cliente com pedidos zeraria o estoque dos
// produtos através de itens_pedidos, além de destruir o histórico de vendas que
// alimenta o relatório. A mesma regra está no controller e no CHECK/constraint
// do banco (migrations 20260930000002).models/clienteSequelizeController bloqueia.
Cliente.hasMany(Pedido, { foreignKey: 'cliente_id', onDelete: 'RESTRICT' });
Pedido.belongsTo(Cliente, { foreignKey: 'cliente_id' });

Pedido.hasMany(ItemPedido, { foreignKey: 'pedido_id', onDelete: 'CASCADE' });
ItemPedido.belongsTo(Pedido, { foreignKey: 'pedido_id' });

Produto.hasMany(ItemPedido, { foreignKey: 'produto_id' });
ItemPedido.belongsTo(Produto, { foreignKey: 'produto_id' });

// `as` é explícito porque a inflexão padrão do Sequelize transformaria
// "Categoria" em "Categorium" (plural latino), e views/controllers
// referenciariam a propriedade errada silenciosamente.
Categoria.hasMany(Produto, { foreignKey: 'categoria_id', as: 'Produtos', onDelete: 'RESTRICT' });
Produto.belongsTo(Categoria, { foreignKey: 'categoria_id', as: 'Categoria' });

module.exports = {
    sequelize,
    Cliente,
    Produto,
    Pedido,
    ItemPedido,
    User,
    Categoria,
};
