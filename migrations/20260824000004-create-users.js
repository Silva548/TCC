'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('users', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            username: { type: Sequelize.STRING(100), allowNull: false, unique: true },
            password: { type: Sequelize.STRING(255), allowNull: false },
            role: {
                type: Sequelize.ENUM('admin', 'user'),
                allowNull: false,
                defaultValue: 'user',
            },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('users');
    },
};
