'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('clientes', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            nome: { type: Sequelize.STRING(255), allowNull: false },
            email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
            senha: { type: Sequelize.STRING(255), allowNull: false },
            documento: { type: Sequelize.STRING(20), allowNull: false, unique: true },
            telefone: { type: Sequelize.STRING(20) },
            tipo: {
                type: Sequelize.ENUM('B2C', 'B2B'),
                allowNull: false,
                defaultValue: 'B2C',
            },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        });

        await queryInterface.addIndex('clientes', ['email'], { name: 'idx_clientes_email' });
        await queryInterface.addIndex('clientes', ['documento'], { name: 'idx_clientes_documento' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('clientes');
    },
};
