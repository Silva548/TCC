'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('pedidos', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            cliente_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'clientes', key: 'id' },
                onDelete: 'CASCADE',
            },
            data: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            status: {
                type: Sequelize.ENUM('pendente', 'processando', 'enviado', 'entregue', 'cancelado'),
                allowNull: false,
                defaultValue: 'pendente',
            },
            valor_total: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
            forma_pagamento: {
                type: Sequelize.ENUM('credito', 'debito', 'pix', 'boleto', 'dinheiro'),
                allowNull: false,
            },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        });

        await queryInterface.addIndex('pedidos', ['cliente_id'], { name: 'idx_pedidos_cliente_id' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('pedidos');
    },
};
