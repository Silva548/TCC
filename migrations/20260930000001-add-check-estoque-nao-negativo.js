'use strict';

// Rede de segurança para o estoque.
//
// A validação no pedidoController (agregando por produto antes de decrementar)
// já impede estoque negativo, mas isso é só código de aplicação: qualquer outro
// caminho queMexa em estoque (seed, script, correção manual) passaria sem
// rede. Um CHECK no banco é a última linha de defesa e vale mais que a
// validação em JS, porque o Postgres é quem decide.
//
// Necessário porque itens_pedidos.produto_id tem ON DELETE RESTRICT, mas
// nada impedia o UPDATE de produtos.estoque ficar negativo.

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(
            'ALTER TABLE "produtos" ADD CONSTRAINT "produtos_estoque_nao_negativo" CHECK ("estoque" >= 0)'
        );
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(
            'ALTER TABLE "produtos" DROP CONSTRAINT "produtos_estoque_nao_negativo"'
        );
    },
};