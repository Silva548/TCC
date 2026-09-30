// Reconhece violações de chave estrangeira vindas do PostgreSQL.
//
// A tentação é testar err.name === 'SequelizeForeignKeyConstraintError', mas
// essa classe só é lançada pelos validadores do próprio Sequelize. Quando o
// banco recusa a operação — que é o caso de DELETE com ON DELETE RESTRICT — o
// que chega é uma SequelizeDatabaseError embrulhando o erro do driver pg, com o
// SQLSTATE em err.original.code.
//
// Testar pelo nome da classe deixava o tratamento como código morto: a recusa
// do banco passava direto para next(err) e virava 500 em vez do 400 previsto.
//
// Os SQLSTATEs relevantes do PostgreSQL:
//   23001 restrict_violation     — DELETE/UPDATE barrado por ON DELETE RESTRICT
//   23503 foreign_key_violation  — INSERT/UPDATE que deixaria órfão, ou FK
//                                  imediata em ON DELETE NO ACTION
const SQLSTATES_DE_FK = new Set(['23001', '23503']);

const codigoDoErro = (err) => {
    if (!err || typeof err !== 'object') {
        return null;
    }
    // Sequelize guarda o erro do driver em original e em parent (alias do mesmo
    // objeto); qualquer um dos dois serve.
    return err.original?.code || err.parent?.code || null;
};

const ehViolacaoDeChaveEstrangeira = (err) => {
    if (!err) {
        return false;
    }
    // Validador do próprio Sequelize (ex.: associação com null: false)
    if (typeof err.name === 'string' && err.name.includes('ForeignKeyConstraintError')) {
        return true;
    }
    return SQLSTATES_DE_FK.has(codigoDoErro(err));
};

module.exports = { ehViolacaoDeChaveEstrangeira, codigoDoErro, SQLSTATES_DE_FK };
