'use strict';

// Restaura a relação produto <-> categoria, perdida na migração de MySQL
// para Sequelize. O schema MySQL original (database.sql) tinha
// produtos.categoria com FK para categorias(id).
//
// allowNull: true para não invalidar os produtos já cadastrados —
// produtos sem categoria continuam válidos e aparece como "Sem categoria".

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('produtos', 'categoria_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'categorias',
                key: 'id',
            },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
        });

        await queryInterface.addIndex('produtos', ['categoria_id'], {
            name: 'idx_produtos_categoria_id',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('produtos', 'idx_produtos_categoria_id');
        await queryInterface.removeColumn('produtos', 'categoria_id');
    },
};
