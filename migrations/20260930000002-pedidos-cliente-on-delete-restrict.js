'use strict';

// Alinha o banco com a política do clienteSequelizeController: um cliente com
// pedidos vinculados NÃO pode ser excluído, porque o histórico de vendas é a
// base do relatório de vendas.
//
// A FK nasceu como ON DELETE CASCADE na migration 20260824000005, herdada do
// desenho anterior. Isso significa que apagar um cliente apagava em cascata
// todos os pedidos, os itens e — através de itens_pedidos — zeraria o estoque
// de produtos que ainda existem. O controller bloqueava, mas o banco não: uma
// remoção via migration ou ferramenta de admin passaria pelo CASCADE em
// silêncio.
//
// Troca para RESTRICT: o banco passa a recusar, e a recusa coincide com a
// mensagem que o controller já produz.

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(
            'ALTER TABLE "pedidos" DROP CONSTRAINT "pedidos_cliente_id_fkey"'
        );
        await queryInterface.sequelize.query(
            'ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" ' +
            'FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
        );
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(
            'ALTER TABLE "pedidos" DROP CONSTRAINT "pedidos_cliente_id_fkey"'
        );
        await queryInterface.sequelize.query(
            'ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" ' +
            'FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE'
        );
    },
};