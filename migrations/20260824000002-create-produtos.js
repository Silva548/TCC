'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('produtos', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            nome: { type: Sequelize.STRING(255), allowNull: false },
            descricao: { type: Sequelize.TEXT },
            preco: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
            peso_kg: {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: false,
                comment: 'Peso do produto em quilogramas',
            },
            estoque: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('produtos');
    },
};
