'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('itens_pedidos', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            pedido_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'pedidos', key: 'id' },
                onDelete: 'CASCADE',
            },
            produto_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'produtos', key: 'id' },
                onDelete: 'RESTRICT',
            },
            quantidade: {
                type: Sequelize.INTEGER,
                allowNull: false,
                validate: { min: 1 },
            },
            preco_unitario: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        });

        await queryInterface.addIndex('itens_pedidos', ['pedido_id'], { name: 'idx_itens_pedidos_pedido_id' });
        await queryInterface.addIndex('itens_pedidos', ['produto_id'], { name: 'idx_itens_pedidos_produto_id' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('itens_pedidos');
    },
};
