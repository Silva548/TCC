'use strict';

// Remove clientes.senha. A coluna guardava hash bcrypt, mas nunca foi usada
// para autenticar: o único fluxo de login (authController) opera sobre a
// tabela users. Eram duas tabelas com autenticação paralela, das quais só uma
// funcionava — superfície de risco sem fluxo.
//
// ATENÇÃO: migration destrutiva. O down recria a coluna vazia; os hashes
// só podem ser recuperados a partir de um pg_dump feito antes da aplicação.

module.exports = {
    async up(queryInterface) {
        await queryInterface.removeColumn('clientes', 'senha');
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.addColumn('clientes', 'senha', {
            type: Sequelize.STRING(255),
            allowNull: true,
        });
    },
};
