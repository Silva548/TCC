'use strict';

// Cada produto passa a ter dois preços — um para entrega e outro para
// retirada na empresa — e uma linha de embalagem (premium ou basica), usada
// nos filtros da listagem. O preço único anterior é copiado para os dois
// campos antes de a coluna ser removida, para não perder os dados existentes.

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('produtos', 'preco_entrega', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0,
        });
        await queryInterface.addColumn('produtos', 'preco_retirada', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0,
        });
        await queryInterface.addColumn('produtos', 'embalagem', {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: 'basica',
        });

        await queryInterface.sequelize.query(
            'UPDATE produtos SET preco_entrega = preco, preco_retirada = preco'
        );

        await queryInterface.removeColumn('produtos', 'preco');
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.addColumn('produtos', 'preco', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0,
        });

        await queryInterface.sequelize.query(
            'UPDATE produtos SET preco = preco_entrega'
        );

        await queryInterface.removeColumn('produtos', 'embalagem');
        await queryInterface.removeColumn('produtos', 'preco_retirada');
        await queryInterface.removeColumn('produtos', 'preco_entrega');
    },
};
