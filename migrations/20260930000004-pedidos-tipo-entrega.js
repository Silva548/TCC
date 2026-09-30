'use strict';

// O pedido passa a registrar se o carvão será entregue no endereço do cliente
// ou retirado na empresa. É o que decide qual preço do produto entra no total
// (preco_entrega ou preco_retirada), por isso a modalidade vive no pedido.
// Pedidos antigos assumem "entrega", o modo anterior implícito.

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('pedidos', 'tipo_entrega', {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: 'entrega',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('pedidos', 'tipo_entrega');
    },
};
